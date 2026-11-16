/**
 * TMDB / IMDb / Kitsu / AniList metadata resolver tailored for Ukrainian providers.
 * Prioritizes Ukrainian (uk-UA) titles alongside English & original titles.
 */

import { fetchJson } from './http.js';

const DEFAULT_TMDB_API_KEY = '8265bd1679663a7ea12ac168da84d2e8';
const TMDB_API_BASE = 'https://api.themoviedb.org/3';

function getTmdbApiKey() {
    if (typeof globalThis !== 'undefined' && globalThis.TMDB_API_KEY) {
        return globalThis.TMDB_API_KEY;
    }
    return DEFAULT_TMDB_API_KEY;
}

export function isTvMediaType(mediaType) {
    return String(mediaType || '').toLowerCase() !== 'movie';
}

function parseKitsuId(id) {
    return String(id || '').match(/^kitsu:(\d+)(?::(\d+))?$/i);
}

function parseTrackerId(id) {
    const m = String(id || '').match(/^(mal|anilist|anidb|tvdb):(\d+)(?::(\d+))?$/i);
    if (!m) return null;
    return {
        tracker: m[1].toLowerCase(),
        externalId: m[2],
        absEpisode: m[3] ? parseInt(m[3], 10) : null,
    };
}

async function resolveImdbToTmdb(imdbId, mediaType) {
    const apiKey = getTmdbApiKey();
    const url = `${TMDB_API_BASE}/find/${encodeURIComponent(imdbId)}?api_key=${apiKey}&external_source=imdb_id&language=uk-UA`;
    const data = await fetchJson(url, { timeoutMs: 8000 });
    if (!data) return null;
    const isMovie = !isTvMediaType(mediaType);
    const list = (isMovie ? data.movie_results : data.tv_results) ||
        data.movie_results ||
        data.tv_results ||
        [];
    return list[0] && list[0].id ? String(list[0].id) : null;
}

async function searchTmdbByTitle(title, mediaType) {
    if (!title) return null;
    const apiKey = getTmdbApiKey();
    const type = isTvMediaType(mediaType) ? 'tv' : 'movie';
    const url = `${TMDB_API_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
    const data = await fetchJson(url, { timeoutMs: 8000 });
    const results = data && data.results;
    return results && results.length > 0 ? String(results[0].id) : null;
}

async function aniListMedia(tracker) {
    if (!tracker || (tracker.tracker !== 'anilist' && tracker.tracker !== 'mal')) return null;
    const isAniList = tracker.tracker === 'anilist';
    const query = isAniList
        ? 'query($id: Int){Media(id: $id, type: ANIME){idMal title{romaji english native}}}'
        : 'query($idMal: Int){Media(idMal: $idMal, type: ANIME){idMal title{romaji english native}}}';
    const variables = isAniList
        ? { id: Number(tracker.externalId) }
        : { idMal: Number(tracker.externalId) };
    if (!Number.isFinite(variables.id !== undefined ? variables.id : variables.idMal)) return null;

    const data = await fetchJson('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
            'User-Agent': 'Nuvio-UK-Providers/1.0',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        timeoutMs: 6000,
    });
    return data && data.data && data.data.Media ? data.data.Media : null;
}

async function resolveKitsuMeta(kitsuId, mediaType) {
    const data = await fetchJson(`https://kitsu.io/api/edge/anime/${kitsuId}`, { timeoutMs: 8000 });
    const attrs = data && data.data && data.data.attributes;
    if (!attrs) return null;

    const candidates = [
        attrs.titles && attrs.titles.en,
        attrs.canonicalTitle,
        attrs.titles && attrs.titles.en_jp,
    ].map(t => (t || '').trim()).filter(Boolean);

    for (const candidate of candidates) {
        const tmdbId = await searchTmdbByTitle(candidate, mediaType);
        if (tmdbId) {
            const meta = await fetchTmdbById(tmdbId, mediaType);
            if (meta) return meta;
        }
    }

    const year = attrs.startDate && /^\d{4}/.test(attrs.startDate)
        ? parseInt(attrs.startDate.slice(0, 4), 10)
        : null;
    return {
        tmdbId: null,
        mediaType: isTvMediaType(mediaType) ? 'tv' : 'movie',
        titleUk: '',
        titleEn: candidates[0] || '',
        titleOriginal: (attrs.titles && attrs.titles.en_jp) || candidates[0] || '',
        year,
        isAnime: true,
        originalLanguage: attrs.originalLanguage || 'ja',
        seasonEpisodeCounts: {},
        queries: candidates,
        allTitles: candidates,
    };
}

async function fetchTmdbById(tmdbId, mediaType) {
    const apiKey = getTmdbApiKey();
    const type = isTvMediaType(mediaType) ? 'tv' : 'movie';

    const ukUrl = `${TMDB_API_BASE}/${type}/${tmdbId}?api_key=${apiKey}&language=uk-UA`;
    const enUrl = `${TMDB_API_BASE}/${type}/${tmdbId}?api_key=${apiKey}&language=en-US`;
    const transUrl = `${TMDB_API_BASE}/${type}/${tmdbId}/translations?api_key=${apiKey}`;

    // Fetch uk-UA and en-US in parallel; translations only if uk-UA title looks untranslated/missing
    const [ukData, enData] = await Promise.all([
        fetchJson(ukUrl, { timeoutMs: 8000 }),
        fetchJson(enUrl, { timeoutMs: 8000 }),
    ]);

    const base = ukData || enData;
    if (!base) return null;

    let titleUk = ((ukData && (ukData.title || ukData.name)) || '').trim();
    const titleEn = ((enData && (enData.title || enData.name)) || '').trim();
    const titleOriginal = (base.original_title || base.original_name || '').trim();
    const originalLanguage = base.original_language || '';

    // Check translations endpoint if ukData returned an identical Latin title or empty
    if (!titleUk || (titleUk === titleEn && !/[\u0400-\u04FF]/.test(titleUk))) {
        const transData = await fetchJson(transUrl, { timeoutMs: 6000 });
        const translations = (transData && transData.translations) || [];
        const ukTrans = translations.find(t => t.iso_639_1 === 'uk');
        const transTitle = ukTrans && ukTrans.data && ((ukTrans.data.title || ukTrans.data.name) || '').trim();
        if (transTitle) {
            titleUk = transTitle;
        }
    }

    const dateStr = type === 'movie' ? base.release_date : base.first_air_date;
    const year = dateStr && /^\d{4}/.test(dateStr) ? parseInt(dateStr.slice(0, 4), 10) : null;
    const isAnime =
        originalLanguage === 'ja' ||
        ((base.genres || []).some(g => g.id === 16) && (originalLanguage === 'ja' || originalLanguage === 'zh' || originalLanguage === 'ko'));

    const seasonEpisodeCounts = {};
    if (type === 'tv' && Array.isArray(base.seasons)) {
        for (const s of base.seasons) {
            if (s && s.season_number > 0 && s.episode_count > 0) {
                seasonEpisodeCounts[s.season_number] = s.episode_count;
            }
        }
    }

    const allTitles = [];
    const pushUnique = (val) => {
        const clean = (val || '').trim();
        if (!clean) return;
        if (!allTitles.some(t => t.toLowerCase() === clean.toLowerCase())) {
            allTitles.push(clean);
        }
    };

    pushUnique(titleUk);
    pushUnique(titleEn);
    if (/^[\x00-\x7F\u00C0-\u024F\u0400-\u04FF\s\-,:!.'?&()0-9]+$/.test(titleOriginal)) {
        pushUnique(titleOriginal);
    }

    // Build concise search queries (Ukrainian title first, then English/Romaji)
    const queries = [];
    const pushQuery = (q) => {
        const clean = (q || '').trim();
        if (!clean) return;
        if (!queries.some(x => x.toLowerCase() === clean.toLowerCase())) {
            queries.push(clean);
        }
    };

    pushQuery(titleUk);
    if (titleUk && titleUk.includes(':')) pushQuery(titleUk.split(':')[0]);
    pushQuery(titleEn);
    if (titleEn && titleEn.includes(':')) pushQuery(titleEn.split(':')[0]);
    pushQuery(titleOriginal);

    return {
        tmdbId: String(tmdbId),
        mediaType: type,
        titleUk,
        titleEn,
        titleOriginal,
        year,
        isAnime,
        originalLanguage,
        seasonEpisodeCounts,
        queries,
        allTitles,
    };
}

/**
 * Resolve any Nuvio ID (TMDB numeric, imdb tt..., kitsu:..., mal:..., anilist:...)
 * into normalized Ukrainian/English metadata.
 */
export async function getMediaMeta(id, mediaType, season) {
    const raw = (id == null ? '' : String(id).trim())
        .replace(/^tmdb[:/]/i, '')
        .replace(/^(?:movie|series)[:/]/i, '');

    if (!raw) return null;

    const kitsuMatch = parseKitsuId(raw);
    if (kitsuMatch) {
        const meta = await resolveKitsuMeta(kitsuMatch[1], mediaType);
        if (meta && season == null && kitsuMatch[2]) {
            meta.effectiveSeason = parseInt(kitsuMatch[2], 10);
        }
        return meta;
    }

    const tracker = parseTrackerId(raw);
    if (tracker) {
        const media = await aniListMedia(tracker);
        if (!media || !media.title) return null;
        const candidates = [media.title.english, media.title.romaji, media.title.native]
            .map(t => (t || '').trim())
            .filter(Boolean);
        for (const candidate of candidates) {
            const tmdbId = await searchTmdbByTitle(candidate, mediaType);
            if (tmdbId) {
                const meta = await fetchTmdbById(tmdbId, mediaType);
                if (meta) {
                    for (const c of candidates) {
                        if (!meta.allTitles.some(t => t.toLowerCase() === c.toLowerCase())) {
                            meta.allTitles.push(c);
                        }
                    }
                    return meta;
                }
            }
        }
        return {
            tmdbId: null,
            mediaType: isTvMediaType(mediaType) ? 'tv' : 'movie',
            titleUk: '',
            titleEn: candidates[0] || '',
            titleOriginal: media.title.romaji || candidates[0] || '',
            year: null,
            isAnime: true,
            originalLanguage: 'ja',
            seasonEpisodeCounts: {},
            queries: candidates,
            allTitles: candidates,
        };
    }

    let tmdbId = raw;
    if (!/^\d+$/.test(raw)) {
        const imdbId = /^tt\d+$/i.test(raw) ? raw : (/^imdb:(tt\d+)$/i.test(raw) ? raw.slice(5) : null);
        if (!imdbId) return null;
        tmdbId = await resolveImdbToTmdb(imdbId, mediaType);
        if (!tmdbId) return null;
    }

    return fetchTmdbById(tmdbId, mediaType);
}
