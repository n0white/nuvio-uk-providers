/**
 * Kinostrain.com provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (KinostrainProvider)
 */

const cheerio = require('cheerio');
import { fetchText, fetchJson, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { extractFileValue, extractPlayerJsSubtitleRaw, makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://kinostrain.com';
const SEARCH_API = 'https://api.kinostrain.com/api/search';
const PROVIDER_NAME = 'Kinostrain';

function resolveNuxtValue(arr, val) {
    if (typeof val === 'number' && val >= 0 && val < arr.length) {
        return arr[val];
    }
    return val;
}

function extractNuxtSources(html, isTv, targetSeason, targetEpisode) {
    const $ = cheerio.load(html);
    const raw = $('script#__NUXT_DATA__').first().html();
    if (!raw) return [];

    let arr = null;
    try { arr = JSON.parse(raw); } catch (_) { return []; }
    if (!Array.isArray(arr)) return [];

    let contentIdx = -1;
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        for (const k of Object.keys(item)) {
            if (k.startsWith('content-') && typeof item[k] === 'number') {
                contentIdx = item[k];
                break;
            }
        }
        if (contentIdx >= 0) break;
    }
    if (contentIdx < 0) return [];

    let content = arr[contentIdx];
    const wrapped = content && resolveNuxtValue(arr, content.data);
    if (wrapped && typeof wrapped === 'object') content = wrapped;

    const seasonsArr = content && resolveNuxtValue(arr, content.seasons);
    if (!Array.isArray(seasonsArr)) return [];

    const sources = [];
    seasonsArr.forEach((sIdx, i) => {
        const seasonObj = resolveNuxtValue(arr, sIdx);
        if (!seasonObj || typeof seasonObj !== 'object') return;
        const sNum = Number(resolveNuxtValue(arr, seasonObj.number)) || (i + 1);
        if (isTv && sNum !== targetSeason) return;

        const playerData = resolveNuxtValue(arr, seasonObj.playerData);
        if (!playerData || typeof playerData !== 'object') return;

        const key = isTv ? String(targetEpisode) : '1';
        const epPlayerData = resolveNuxtValue(arr, playerData[key]) || (!isTv ? playerData : null);
        if (!epPlayerData || typeof epPlayerData !== 'object') return;

        for (const pKey of Object.keys(epPlayerData)) {
            const srcList = resolveNuxtValue(arr, epPlayerData[pKey]);
            if (!Array.isArray(srcList)) continue;
            for (const srcIdx of srcList) {
                const srcObj = resolveNuxtValue(arr, srcIdx);
                if (!srcObj || typeof srcObj !== 'object') continue;
                const name = resolveNuxtValue(arr, srcObj.name) || pKey;
                const link = resolveNuxtValue(arr, srcObj.link);
                if (typeof link === 'string' && link.trim()) {
                    sources.push({ name: String(name), link: link.trim() });
                }
            }
        }
    });

    return sources;
}

async function resolveKinostrainSource(src) {
    if (src.link.includes('ashdi.vip')) {
        const html = await fetchText(src.link, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
        if (!html) return null;
        const file = extractFileValue(html);
        if (!file) return null;
        const subRaw = extractPlayerJsSubtitleRaw(html);
        return makeUkStream({
            providerName: PROVIDER_NAME,
            dubTitle: `${src.name} (Ashdi)`,
            url: file,
            rawSub: subRaw,
            referer: src.link,
        });
    }
    return makeUkStream({
        providerName: PROVIDER_NAME,
        dubTitle: src.name,
        url: src.link,
        referer: `${MAIN_URL}/`,
    });
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
            const res = await fetchJson(`${SEARCH_API}?q=${encodeURIComponent(query)}&limit=10`, { timeoutMs: 10000 });
            const list = (res && res.data) || [];
            for (const item of list) {
                if (!item || !item.slug) continue;
                const itemIsMovie = item.type === 'movie';
                if (isTv && itemIsMovie) continue;
                if (!isTv && !itemIsMovie) continue;

                const href = itemIsMovie
                    ? `${MAIN_URL}/${item.type}-${item.slug}`
                    : `${MAIN_URL}/${item.slug}/season-${effSeason}`;
                if (seen.has(href)) continue;
                seen.add(href);

                allFound.push({
                    title: stripSeo(item.name),
                    href,
                    extraTitles: item.originalName ? [item.originalName] : [],
                    year: item.yearStart ? parseInt(item.yearStart, 10) : null,
                });
            }
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;
            const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
            if (!html) continue;

            if (scoreCandidate(candidate.title, meta, {
                year: candidate.year,
                extraTitles: candidate.extraTitles,
                season: effSeason,
                isTv,
            }) <= 0) continue;

            const sources = extractNuxtSources(html, isTv, effSeason, effEpisode);
            if (sources.length === 0) continue;

            const resolved = await Promise.all(sources.slice(0, 8).map(resolveKinostrainSource));
            const streams = dedupeStreams(resolved.filter(Boolean));
            if (streams.length > 0) return streams;
        }

        return [];
    } catch (err) {
        console.error('[Kinostrain] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
