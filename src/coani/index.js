/**
 * Coani.net provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (CoaninetProvider)
 */

const cheerio = require('cheerio');
import { fetchText, fetchJson, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { formatEpisodeTag, makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://coani.net';
const PROVIDER_NAME = 'Coaninet';

async function getStreams(tmdbId, mediaType, season, episode) {
    const start = Date.now();
    try {
        const isTv = isTvMediaType(mediaType);
        const meta = await getMediaMeta(tmdbId, mediaType, season);
        if (!meta || !meta.queries || meta.queries.length === 0) return [];

        const effSeason = season != null ? parseInt(season, 10) : (meta.effectiveSeason || 1);
        const effEpisode = episode != null ? parseInt(episode, 10) : 1;

        const allFound = [];
        const seen = new Set();

        for (const query of meta.queries.slice(0, 3)) {
            if (Date.now() - start > 20000) break;
            const res = await fetchJson(`${MAIN_URL}/api/public/film/catalog?search=${encodeURIComponent(query)}`, { timeoutMs: 10000 });
            const list = (res && res.data) || [];
            for (const entry of list) {
                const d = entry && entry.data;
                const filmSlug = d && (d.film_seo_slug || d.filmSeoSlug);
                const seoSlug = d && (d.seo_slug || d.seoSlug);
                if (!d || !filmSlug || !seoSlug) continue;
                const href = `${MAIN_URL}/catalog/${filmSlug}/${seoSlug}`;
                if (seen.has(href)) continue;
                seen.add(href);
                allFound.push({
                    title: stripSeo(d.name || d.film_name),
                    href,
                    extraTitles: [d.film_name, d.originalName, d.engName].filter(Boolean),
                    year: d.year ? parseInt(d.year, 10) : null,
                });
            }
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 42000) break;
            const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
            if (!html) continue;

            const $ = cheerio.load(html);
            const seasons = [];
            $('.seasons-tabs a.seasons-tab[href]').each((_, el) => {
                const m = $(el).text().match(/\d+/);
                const sNum = m ? parseInt(m[0], 10) : null;
                const href = ensureUrl($(el).attr('href'), MAIN_URL);
                if (sNum && href && !seasons.some(s => s.href === href)) {
                    seasons.push({ num: sNum, href });
                }
            });

            const targetSeasonObj = seasons.find(s => s.num === effSeason)
                || ((!isTv || (seasons.length === 0 && effSeason === 1)) ? { num: 1, href: candidate.href } : null);
            if (!targetSeasonObj) continue;
            const seasonSlug = targetSeasonObj.href.split('/').pop();
            const seasonRes = await fetchJson(`${MAIN_URL}/api/public/film/season?slug=${encodeURIComponent(seasonSlug)}`, { timeoutMs: 10000 });
            const seasonId = seasonRes && seasonRes.data && seasonRes.data.id;
            if (!seasonId) continue;

            const seriesRes = await fetchJson(`${MAIN_URL}/api/public/film/season/${seasonId}/series`, { timeoutMs: 10000 });
            const items = (seriesRes && seriesRes.data) || [];
            const episodeTag = formatEpisodeTag(isTv, effSeason, effEpisode);
            const streams = [];

            for (const entry of items) {
                const d = entry && entry.data;
                if (!d || !d.video) continue;
                if (isTv && Number(d.number) !== effEpisode) continue;
                if (!isTv && Number(d.number) > 1) continue;

                const s = makeUkStream({
                    providerName: PROVIDER_NAME,
                    dubTitle: d.voice_type || d.voiceType || PROVIDER_NAME,
                    url: d.video,
                    referer: `${MAIN_URL}/`,
                    episodeTag,
                    siteTitle: candidate.title,
                });
                if (s) streams.push(s);
            }

            const deduped = dedupeStreams(streams);
            if (deduped.length > 0) return deduped;
        }

        return [];
    } catch (err) {
        console.error('[Coaninet] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
