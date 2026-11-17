/**
 * Cikava-Ideya.top provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (CikavaIdeyaProvider)
 */

const cheerio = require('cheerio');
import { fetchText, postFormText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { extractFileValue, extractPlayerJsSubtitleRaw, formatEpisodeTag, makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://cikava-ideya.top';
const PROVIDER_NAME = 'Цікава Ідея';
const PLAY_REFERER = 'https://tortuga.wtf/';

function extractInt(str) {
    const m = String(str || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function parseSwitchesObject(html) {
    const marker = 'switches = Object(';
    const idx = html.indexOf(marker);
    if (idx < 0) return null;
    const start = idx + marker.length;
    const end = html.indexOf(');', start);
    if (end <= start) return null;
    try {
        return JSON.parse(html.slice(start, end));
    } catch (_) {
        return null;
    }
}

async function resolveCikavaPlayer(playerUrl, metaCtx = {}) {
    const url = ensureUrl(playerUrl, MAIN_URL);
    if (!url) return [];
    const html = await fetchText(url, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const streamUrl = extractFileValue(html);
    if (!streamUrl || !/^https?:\/\//i.test(streamUrl)) return [];
    const subRaw = extractPlayerJsSubtitleRaw(html);

    const s = makeUkStream({
        providerName: PROVIDER_NAME,
        dubTitle: PROVIDER_NAME,
        url: streamUrl,
        rawSub: subRaw,
        referer: PLAY_REFERER,
        episodeTag: metaCtx.episodeTag || '',
        siteTitle: metaCtx.siteTitle || '',
    });
    return s ? [s] : [];
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
            $('.th-item').each((_, el) => {
                const $el = $(el);
                if (/видалено|призупинено|правообласник/i.test($el.text())) return;
                const title = stripSeo($el.find('.th-title').first().text().trim());
                const href = ensureUrl($el.find('.th-in').first().attr('href'), MAIN_URL);
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
            if (!html || /видалено|правовласника/i.test(html.slice(0, 50000))) continue;

            const $ = cheerio.load(html);
            const pageTitle = stripSeo($('.full h1').first().text().trim() || candidate.title);
            const yearStr = $('.flist li').eq(0).text().match(/\b(19\d{2}|20\d{2})\b/);
            const pageYear = yearStr ? parseInt(yearStr[1], 10) : null;

            if (scoreCandidate(pageTitle, meta, { year: pageYear, season: effSeason, isTv }) <= 0) continue;

            const switches = parseSwitchesObject(html);
            const player1 = switches && switches.Player1;
            if (!player1) continue;

            const metaCtx = {
                episodeTag: formatEpisodeTag(isTv, effSeason, effEpisode),
                siteTitle: pageTitle,
            };

            if (typeof player1 === 'string') {
                if (isTv) continue;
                const streams = await resolveCikavaPlayer(player1, metaCtx);
                if (streams.length > 0) return dedupeStreams(streams);
                continue;
            }

            if (typeof player1 === 'object') {
                const targetUrls = [];
                for (const sKey of Object.keys(player1)) {
                    const sNum = extractInt(sKey);
                    if (isTv && sNum != null && sNum !== effSeason) continue;
                    const episodesObj = player1[sKey];
                    if (!episodesObj || typeof episodesObj !== 'object') continue;
                    for (const eKey of Object.keys(episodesObj)) {
                        const eNum = extractInt(eKey);
                        if (!isTv || eNum === effEpisode) {
                            if (typeof episodesObj[eKey] === 'string') {
                                targetUrls.push(episodesObj[eKey]);
                            }
                            if (!isTv) break;
                        }
                    }
                }
                const res = await Promise.all(targetUrls.slice(0, 4).map(u => resolveCikavaPlayer(u, metaCtx)));
                const streams = dedupeStreams(res.flat());
                if (streams.length > 0) return streams;
            }
        }

        return [];
    } catch (err) {
        console.error('[CikavaIdeya] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
