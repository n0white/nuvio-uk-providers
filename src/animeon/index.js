/**
 * AnimeON.club provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (AnimeONProvider)
 */

import { fetchJson, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates } from '../utils/matching.js';
import { makeUkStream, dedupeStreams } from '../utils/playerjs.js';
import { extractAshdi, extractMoon, extractFenix } from '../utils/anime-extractors.js';

const MAIN_URL = 'https://animeon.club';
const PROVIDER_NAME = 'AnimeON';

async function resolveAnimeOnUrl(rawUrl, label, isDub, episodeNum) {
    const url = ensureUrl(rawUrl, MAIN_URL);
    if (!url) return [];
    if (url.includes('ashdi.vip')) {
        return extractAshdi(url, label, PROVIDER_NAME, 'https://ashdi.vip/', isDub);
    }
    if (url.includes('moonanime')) {
        return extractMoon(url, label, PROVIDER_NAME, isDub);
    }
    if (url.includes('fenixplay')) {
        return extractFenix(url, label, episodeNum || 1, PROVIDER_NAME, isDub);
    }
    if (/\.m3u8|\.mp4/i.test(url)) {
        const s = makeUkStream({
            providerName: PROVIDER_NAME,
            dubTitle: label,
            url,
            referer: `${MAIN_URL}/`,
        });
        return s ? [s] : [];
    }
    return [];
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const start = Date.now();
    try {
        const isTv = isTvMediaType(mediaType);
        const meta = await getMediaMeta(tmdbId, mediaType, season);
        if (!meta || !meta.queries || meta.queries.length === 0) return [];

        const effSeason = season != null ? parseInt(season, 10) : (meta.effectiveSeason || 1);
        const effEpisode = episode != null ? parseInt(episode, 10) : 1;

        const searchQueries = [];
        const addQ = (q) => {
            const clean = (q || '').trim();
            if (clean && !searchQueries.some(x => x.toLowerCase() === clean.toLowerCase())) searchQueries.push(clean);
        };
        if (isTv && effSeason > 1 && meta.titleUk) addQ(`${meta.titleUk} ${effSeason} сезон`);
        for (const q of meta.queries) addQ(q);

        const allFound = [];
        const seenIds = new Set();

        for (const query of searchQueries.slice(0, 4)) {
            if (Date.now() - start > 20000) break;
            const res = await fetchJson(`${MAIN_URL}/api/anime?search=${encodeURIComponent(query)}`, { timeoutMs: 10000 });
            const list = (res && res.results) || [];
            for (const item of list) {
                if (!item || !item.id || seenIds.has(item.id)) continue;
                seenIds.add(item.id);
                const title = (item.titleUa || item.titleEn || '').trim();
                const extra = [item.titleEn, item.titleOriginal].filter(Boolean);
                const ym = String(item.releaseDate || item.year || '').match(/\d{4}/);
                allFound.push({
                    id: item.id,
                    title,
                    extraTitles: extra,
                    year: ym ? parseInt(ym[0], 10) : null,
                });
            }
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 42000) break;
            const trRes = await fetchJson(`${MAIN_URL}/api/player/${candidate.id}/translations`, { timeoutMs: 10000 });
            const translations = (trRes && trRes.translations) || [];
            if (translations.length === 0) continue;

            const tasks = [];
            for (const entry of translations) {
                const tr = entry && entry.translation;
                if (!tr || !tr.id) continue;
                const isDub = !tr.isSub && !/субтитр/i.test(tr.name || '');

                for (const pl of (entry.player || [])) {
                    if (!pl || !pl.id) continue;
                    const label = `${tr.name || PROVIDER_NAME} (${pl.name || 'Player'})`;
                    tasks.push({ trId: tr.id, plId: pl.id, label, isDub, episodesCount: pl.episodesCount || 0 });
                }
            }

            const limitedTasks = tasks.slice(0, 8);
            const streamArrays = await Promise.all(limitedTasks.map(async (t) => {
                let videoUrl = '';
                if (isTv || t.episodesCount > 0) {
                    const epListUrl = `${MAIN_URL}/api/player/${candidate.id}/episodes?take=1000&skip=0&playerId=${t.plId}&translationId=${t.trId}&includeAlternative=true`;
                    const epRes = await fetchJson(epListUrl, { timeoutMs: 10000 });
                    const episodes = (epRes && epRes.episodes) || [];
                    const target = episodes.find(e => Number(e.episode) === effEpisode || Number(e.sourceEpisode) === effEpisode)
                        || (!isTv ? episodes[0] : null);
                    if (target && target.id) {
                        const epDetail = await fetchJson(`${MAIN_URL}/api/player/${target.id}/episode`, { timeoutMs: 10000 });
                        videoUrl = (epDetail && (epDetail.videoUrl || epDetail.fileUrl)) || '';
                    }
                }
                if (!videoUrl && (!isTv || t.episodesCount === 0)) {
                    const direct = await fetchJson(`${MAIN_URL}/api/player/${t.plId}/${t.trId}`, { timeoutMs: 10000 });
                    videoUrl = (direct && (direct.videoUrl || direct.fileUrl)) || '';
                }
                if (!videoUrl) return [];
                return resolveAnimeOnUrl(videoUrl, t.label, t.isDub, effEpisode);
            }));

            const streams = dedupeStreams(streamArrays.flat());
            if (streams.length > 0) return streams;
        }

        return [];
    } catch (err) {
        console.error('[AnimeON] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
