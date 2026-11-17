/**
 * BambooUA.com provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (BambooUAProvider)
 */

const cheerio = require('cheerio');
import { fetchText, postFormText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { formatEpisodeTag, makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://bambooua.com';
const PROVIDER_NAME = 'BambooUA';

function isSponsorVideo(url) {
    return /sponsor|patreon|donat|pidtrym/i.test(String(url || ''));
}

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
            if (Date.now() - start > 25000) break;
            const html = await postFormText(
                MAIN_URL,
                { do: 'search', subaction: 'search', story: query },
                { Referer: `${MAIN_URL}/` },
                12000
            );
            if (!html) continue;

            const $ = cheerio.load(html);
            $('article.swiper-slide').each((_, el) => {
                const $el = $(el);
                const title = stripSeo($el.find('h2.label-3').first().text().trim());
                const href = ensureUrl($el.find('a.link-title').first().attr('href'), MAIN_URL);
                if (!title || !href || seen.has(href)) return;
                seen.add(href);
                allFound.push({ title, href });
            });
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;
            const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
            if (!html) continue;

            const $ = cheerio.load(html);
            const yearStr = $('.trending-info .text-detail span.badge-danger').first().text().trim();
            const pageYear = /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null;
            if (scoreCandidate(candidate.title, meta, { year: pageYear, season: effSeason, isTv }) <= 0) continue;

            const m = html.match(/const\s+playlist\s*=\s*(\[[\s\S]*?\]);/);
            if (!m || !m[1]) continue;

            let playlist = null;
            try { playlist = JSON.parse(m[1]); } catch (_) { continue; }
            if (!Array.isArray(playlist)) continue;

            const pageTitle = stripSeo($('h1').first().text().trim() || candidate.title);
            const episodeTag = formatEpisodeTag(isTv, effSeason, effEpisode);
            const streams = [];
            for (const group of playlist) {
                const groupTitle = (group && group.title) || PROVIDER_NAME;
                if (!isTv) {
                    const files = [];
                    if (group.file && !isSponsorVideo(group.file)) files.push(group.file);
                    for (const ep of (group.folder || [])) {
                        if (ep && ep.file && !isSponsorVideo(ep.file)) files.push(ep.file);
                    }
                    for (const f of files) {
                        const s = makeUkStream({
                            providerName: PROVIDER_NAME,
                            dubTitle: groupTitle,
                            url: f,
                            referer: `${MAIN_URL}/`,
                            episodeTag,
                            siteTitle: pageTitle,
                        });
                        if (s) streams.push(s);
                    }
                } else {
                    const episodes = (group.folder || []).filter(ep => ep && ep.file && !isSponsorVideo(ep.file));
                    const targetEp = episodes.find(ep => {
                        const numM = String(ep.title || '').match(/\d+/);
                        return numM && parseInt(numM[0], 10) === effEpisode;
                    }) || episodes[effEpisode - 1];
                    if (targetEp && targetEp.file) {
                        const s = makeUkStream({
                            providerName: PROVIDER_NAME,
                            dubTitle: groupTitle,
                            url: targetEp.file,
                            referer: `${MAIN_URL}/`,
                            episodeTag,
                            siteTitle: pageTitle,
                        });
                        if (s) streams.push(s);
                    }
                }
            }

            const deduped = dedupeStreams(streams);
            if (deduped.length > 0) return deduped;
        }

        return [];
    } catch (err) {
        console.error('[BambooUA] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
