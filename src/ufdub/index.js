/**
 * UFDub.com provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (UFDubProvider)
 */

const cheerio = require('cheerio');
import { fetchText, postFormText, safeFetch, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://ufdub.com';
const PROVIDER_NAME = 'UFDub';

function extractLastInt(str) {
    const m = String(str || '').match(/\d+/g);
    return m ? parseInt(m[m.length - 1], 10) : null;
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
                `${MAIN_URL}/index.php?do=search`,
                { do: 'search', subaction: 'search', story: query },
                { Referer: `${MAIN_URL}/` },
                12000
            );
            if (!html) continue;

            const $ = cheerio.load(html);
            $('.short').each((_, el) => {
                const $a = $(el).find('.short-t').first();
                const title = stripSeo($a.text().trim());
                const href = ensureUrl($a.attr('href'), MAIN_URL);
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
            const origTitle = $('h1.top-title .short-t-or').first().text().trim();
            const pageTitle = stripSeo($('h1.top-title').first().text().replace(origTitle, '').trim()) || candidate.title;
            const ym = $('.full-desc').text().match(/\b(19\d{2}|20\d{2})\b/);
            const pageYear = ym ? parseInt(ym[1], 10) : null;

            if (scoreCandidate(pageTitle, meta, {
                year: pageYear,
                extraTitles: origTitle ? [origTitle] : [],
                season: effSeason,
                isTv,
            }) <= 0) continue;

            const playerUrl = ensureUrl($('input[value*="video.ufdub.com"]').first().attr('value'), MAIN_URL);
            if (!playerUrl) continue;

            const playerHtml = await fetchText(playerUrl, { headers: { Referer: candidate.href }, timeoutMs: 12000 });
            if (!playerHtml) continue;

            const matches = playerHtml.match(/https:\/\/ufdub\.com\/video\/VIDEOS\.php\?[^'"\r\n]+/g) || [];
            const epLinks = [];
            for (const rawLink of matches) {
                const cleanLink = rawLink.replace(/['"]+$/, '').replace(/ /g, '%20');
                if (/Seriya=.*Трейлер/i.test(cleanLink)) continue;
                const seriyaMatch = cleanLink.match(/Seriya=([^&]+)/);
                let seriyaLabel = '';
                try { seriyaLabel = seriyaMatch ? decodeURIComponent(seriyaMatch[1]) : ''; } catch (_) { seriyaLabel = seriyaMatch ? seriyaMatch[1] : ''; }
                const epNum = extractLastInt(seriyaLabel);
                if (!isTv || epNum === effEpisode) {
                    epLinks.push({ url: cleanLink, label: seriyaLabel });
                    if (!isTv) break;
                }
            }

            if (epLinks.length === 0) continue;

            const streams = [];
            for (const ep of epLinks.slice(0, 3)) {
                const res = await safeFetch(ep.url, { headers: { Referer: playerUrl }, redirect: 'manual', timeoutMs: 10000 });
                let finalUrl = '';
                if (res && res.headers && res.headers.get('location')) {
                    finalUrl = res.headers.get('location');
                } else if (res && res.url && res.url !== ep.url) {
                    finalUrl = res.url;
                } else {
                    const followed = await safeFetch(ep.url, { headers: { Referer: playerUrl }, timeoutMs: 10000 });
                    if (followed && followed.url) finalUrl = followed.url;
                }

                if (finalUrl && /^https?:\/\//i.test(finalUrl)) {
                    const s = makeUkStream({
                        providerName: PROVIDER_NAME,
                        dubTitle: `Озвучення (${PROVIDER_NAME})`,
                        url: finalUrl,
                        referer: `${MAIN_URL}/`,
                    });
                    if (s) streams.push(s);
                }
            }

            const deduped = dedupeStreams(streams);
            if (deduped.length > 0) return deduped;
        }

        return [];
    } catch (err) {
        console.error('[UFDub] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
