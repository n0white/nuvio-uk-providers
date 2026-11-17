/**
 * Unimay.media provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (UnimayProvider)
 */

import { fetchJson } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate } from '../utils/matching.js';
import { formatEpisodeTag, makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://www.unimay.media';
const API_URL = 'https://api.unimay.media';
const PROVIDER_NAME = 'Unimay';

async function getStreams(tmdbId, mediaType, season, episode) {
    const start = Date.now();
    try {
        const isTv = isTvMediaType(mediaType);
        const meta = await getMediaMeta(tmdbId, mediaType, season);
        if (!meta || !meta.queries || meta.queries.length === 0) return [];

        const effSeason = season != null ? parseInt(season, 10) : (meta.effectiveSeason || 1);
        const effEpisode = episode != null ? parseInt(episode, 10) : 1;

        const allFound = [];
        const seenCodes = new Set();

        for (const query of meta.queries.slice(0, 3)) {
            if (Date.now() - start > 20000) break;
            const res = await fetchJson(`${API_URL}/v1/release/search?title=${encodeURIComponent(query)}&page=0`, { timeoutMs: 10000 });
            const list = (res && res.content) || [];
            for (const item of list) {
                if (!item || !item.code || seenCodes.has(item.code)) continue;
                seenCodes.add(item.code);
                const names = item.names || {};
                const title = (names.ukr || names.eng || '').trim();
                const extra = [names.eng, names.jap].filter(Boolean);
                allFound.push({
                    code: item.code,
                    title,
                    extraTitles: extra,
                    year: item.year ? parseInt(item.year, 10) : null,
                });
            }
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 40000) break;
            if (scoreCandidate(candidate.title, meta, {
                year: candidate.year,
                extraTitles: candidate.extraTitles,
                season: effSeason,
                isTv,
            }) <= 0) continue;

            const release = await fetchJson(`${API_URL}/v1/release?code=${encodeURIComponent(candidate.code)}`, { timeoutMs: 10000 });
            const playlist = (release && release.playlist) || [];
            if (playlist.length === 0) continue;

            const targetEp = isTv
                ? playlist.find(ep => ep && !ep.premium && Number(ep.number) === effEpisode)
                : (playlist.find(ep => ep && !ep.premium) || playlist[0]);

            if (!targetEp || !targetEp.hls || !targetEp.hls.master) continue;

            const episodeTag = formatEpisodeTag(isTv, effSeason, effEpisode);
            const s = makeUkStream({
                providerName: PROVIDER_NAME,
                dubTitle: `Unimay (${targetEp.title || 'Дубляж'})`,
                url: targetEp.hls.master,
                referer: `${MAIN_URL}/`,
                episodeTag,
                siteTitle: candidate.title,
            });
            if (s) return dedupeStreams([s]);
        }

        return [];
    } catch (err) {
        console.error('[Unimay] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
