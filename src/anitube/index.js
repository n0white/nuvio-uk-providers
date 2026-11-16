/**
 * AniTube.in.ua provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (AnitubeinuaProvider)
 */

const cheerio = require('cheerio');
import { fetchText, fetchJson, postFormText, ensureUrl, extractDleHash } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate } from '../utils/matching.js';
import { buildNuvioStream, dedupeStreams, extractPlayerJsFiles, extractPlayerJsSubtitleRaw, parsePlayerJsSubtitles, resolvePlayerJsUrls } from '../utils/playerjs.js';
import { extractAshdi, extractMoon, extractFenix, extractCsst } from '../utils/anime-extractors.js';

const MAIN_URL = 'https://anitube.in.ua';
const PROVIDER_NAME = 'AniTube';
const ANITUBE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Referer': `${MAIN_URL}/`,
};

function extractTrailingInt(str) {
    if (!str) return null;
    const matches = String(str).match(/\d+/g);
    if (!matches || matches.length === 0) return null;
    const raw = matches[matches.length - 1];
    const num = parseInt(raw, 10);
    return Number.isFinite(num) ? num : null;
}

function unescapeUnicode(input) {
    return String(input || '').replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );
}

async function searchAnitube(query) {
    const html = await postFormText(
        `${MAIN_URL}/`,
        {
            do: 'search',
            subaction: 'search',
            story: query,
        },
        ANITUBE_HEADERS,
        12000
    );
    if (!html) return [];

    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();

    $('article.story, .story').each((_, el) => {
        const $el = $(el);
        const $link = $el.find('.story_c h2 a, div.text_content a').first();
        const title = $link.text().trim();
        const href = ensureUrl($link.attr('href'), MAIN_URL);
        if (!title || !href || seen.has(href)) return;
        seen.add(href);

        // Extract year if shown on search card
        const cardText = $el.text();
        const yearMatch = cardText.match(/\b(19\d{2}|20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

        items.push({ title, href, year });
    });

    return items;
}

function parsePlaylistsHtml(rawHtml) {
    const $ = cheerio.load(rawHtml);
    const lists = $('.playlists-lists .playlists-items');

    const categoriesMap = {};
    const studiosMap = {};
    const playersMap = {};

    if (lists.length > 0) {
        lists.eq(0).find('li').each((_, el) => {
            const id = $(el).attr('data-id');
            if (id) categoriesMap[id.trim()] = $(el).text().trim();
        });
    }
    if (lists.length > 1) {
        lists.eq(1).find('li').each((_, el) => {
            const id = $(el).attr('data-id');
            if (id) studiosMap[id.trim()] = $(el).text().trim();
        });
    }
    if (lists.length > 2) {
        lists.eq(2).find('li').each((_, el) => {
            const id = $(el).attr('data-id');
            if (id) playersMap[id.trim()] = $(el).text().trim();
        });
    }

    const items = [];
    $('.playlists-videos .playlists-items li').each((_, el) => {
        const $el = $(el);
        const videoDataId = ($el.attr('data-id') || '').trim();
        const epText = $el.text().trim();
        const epNum = extractTrailingInt(epText);
        const fileUrl = ($el.attr('data-file') || '').trim();
        if (!fileUrl) return;

        const segments = videoDataId.split('_');
        const catId = segments.slice(0, 2).join('_');
        const studioId = segments.slice(0, 3).join('_');

        const categoryName = categoriesMap[catId] || 'ОЗВУЧЕННЯ';
        const isDub = !/субтитри/i.test(categoryName);
        const studioName = studiosMap[studioId] || categoryName;
        const playerName = playersMap[videoDataId] || 'Плеєр';

        items.push({
            episodeNum: epNum,
            episodeName: epText,
            url: fileUrl,
            isDub,
            studioName,
            playerName,
        });
    });

    return items;
}

function parseRalodePlayer(html) {
    const marker = 'RalodePlayer.init(';
    const idx = html.indexOf(marker);
    if (idx < 0) return [];

    const afterInit = html.slice(idx + marker.length);
    const endIdx = afterInit.indexOf(');');
    const rawArgs = endIdx >= 0 ? afterInit.slice(0, endIdx) : afterInit;

    const splitIdx = rawArgs.indexOf('],');
    if (splitIdx < 0) return [];

    const namesPart = rawArgs.slice(0, splitIdx + 1).trim();
    const rest = rawArgs.slice(splitIdx + 2).trim();
    const lastComma = rest.lastIndexOf(',');
    const episodesPart = (lastComma >= 0 ? rest.slice(0, lastComma) : rest).trim();

    let playerNames = [];
    try {
        playerNames = JSON.parse(unescapeUnicode(namesPart));
    } catch (_) {
        playerNames = namesPart.replace(/^\[|\]$/g, '').split('","').map(s => unescapeUnicode(s.replace(/^"|"$/g, '')));
    }

    let jsonEpisodes = [];
    try {
        jsonEpisodes = JSON.parse(episodesPart);
    } catch (_) {
        return [];
    }

    const items = [];
    jsonEpisodes.forEach((group, pIdx) => {
        const playerName = playerNames[pIdx] || 'Плеєр';
        let latestNum = 0;
        for (const ep of (group || [])) {
            const epName = (ep && ep.name || '').trim();
            if (!epName || epName === 'ПЛЕЙЛИСТ') continue;
            let epNum = extractTrailingInt(epName);
            if (epNum == null) epNum = latestNum + 1;
            latestNum = epNum;

            const iframeMatch = String(ep.code || '').match(/<iframe[^>]+src=["']([^"']+)["']/i);
            const url = iframeMatch ? iframeMatch[1].trim() : '';
            if (!url) continue;

            items.push({
                episodeNum: epNum,
                episodeName: epName,
                url,
                isDub: !/субтитр/i.test(playerName),
                studioName: playerName,
                playerName,
            });
        }
    });

    return items;
}

async function resolveItemStreams(item) {
    const rawUrl = ensureUrl(item.url, MAIN_URL);
    if (!rawUrl || rawUrl.includes('video.ufdub')) return [];

    const labelPrefix = item.studioName && item.studioName !== item.playerName
        ? `${item.playerName} (${item.studioName})`
        : item.playerName;
    const tag = item.isDub ? labelPrefix : `${labelPrefix} [SUB]`;

    if (rawUrl.includes('ashdi.vip')) {
        return extractAshdi(rawUrl, tag, PROVIDER_NAME, 'https://qeruya.cyou/');
    }
    if (rawUrl.includes('moonanime')) {
        return extractMoon(rawUrl, tag, PROVIDER_NAME);
    }
    if (rawUrl.includes('fenixplay')) {
        return extractFenix(rawUrl, tag, item.episodeNum, PROVIDER_NAME);
    }
    if (
        rawUrl.includes('csst.online/embed/') ||
        rawUrl.includes('monstro.site/embed/') ||
        rawUrl.includes('monstro.online/embed/')
    ) {
        return extractCsst(rawUrl, tag, PROVIDER_NAME);
    }
    if (rawUrl.includes('udrop.com')) {
        const s = buildNuvioStream({
            providerName: PROVIDER_NAME,
            title: tag,
            url: rawUrl,
            quality: 'Auto',
        });
        return s ? [s] : [];
    }
    if (/tortuga\.(wtf|tw)|hdvbua\.pro/i.test(rawUrl)) {
        const html = await fetchText(rawUrl, { headers: ANITUBE_HEADERS, timeoutMs: 12000 });
        if (!html) return [];
        const urls = [];
        for (const rf of extractPlayerJsFiles(html)) {
            for (const u of resolvePlayerJsUrls(rf)) {
                if (!urls.includes(u)) urls.push(u);
            }
        }
        const subs = parsePlayerJsSubtitles(extractPlayerJsSubtitleRaw(html));
        return urls.map(u => buildNuvioStream({
            providerName: PROVIDER_NAME,
            title: `${tag} (Tortuga)`,
            url: u,
            quality: '1080p',
            headers: { Referer: rawUrl },
            subtitles: subs,
        })).filter(Boolean);
    }
    return [];
}

function computeAbsoluteEpisode(meta, season, episode) {
    const s = parseInt(season, 10);
    const e = parseInt(episode, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s <= 1) return e;
    const counts = (meta && meta.seasonEpisodeCounts) || {};
    let total = 0;
    for (let i = 1; i < s; i++) {
        if (!counts[i]) return null;
        total += counts[i];
    }
    return total + e;
}

async function extractFromPage(candidate, meta, isTv, season, episode) {
    const html = await fetchText(candidate.href, { headers: ANITUBE_HEADERS, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const pageTitle = $('.story_c h2').first().text().trim() || candidate.title;
    const yearText = $('.story_c_r a[href*=/xfsearch/year/]').first().text().trim();
    const pageYear = /^\d{4}$/.test(yearText) ? parseInt(yearText, 10) : candidate.year;

    const score = scoreCandidate(pageTitle, meta, { year: pageYear, season, isTv });
    if (score <= 0) return [];

    const newsIdMatch = candidate.href.split('/').pop().match(/^(\d+)/);
    const newsId = newsIdMatch ? newsIdMatch[1] : '';
    const dleHash = extractDleHash(html);

    let allItems = [];
    if (newsId) {
        const ajaxUrl = `${MAIN_URL}/engine/ajax/playlists.php?news_id=${newsId}&xfield=playlist&user_hash=${encodeURIComponent(dleHash)}`;
        const ajaxJson = await fetchJson(ajaxUrl, {
            headers: Object.assign({}, ANITUBE_HEADERS, {
                'Referer': candidate.href,
                'X-Requested-With': 'XMLHttpRequest',
            }),
            timeoutMs: 12000,
        });
        if (ajaxJson && ajaxJson.success && ajaxJson.response) {
            allItems = parsePlaylistsHtml(ajaxJson.response);
        }
    }

    if (allItems.length === 0) {
        allItems = parseRalodePlayer(html);
    }

    if (allItems.length === 0) return [];

    let targetItems = [];
    if (!isTv) {
        // Movie / OVA: include all dubs/players for the movie (or first episode if numbered)
        const distinctNums = Array.from(new Set(allItems.map(it => it.episodeNum).filter(n => n != null)));
        if (distinctNums.length <= 1) {
            targetItems = allItems;
        } else {
            const firstEp = Math.min(...distinctNums);
            targetItems = allItems.filter(it => it.episodeNum === firstEp || it.episodeNum == null);
        }
    } else {
        const epNum = parseInt(episode, 10);
        targetItems = allItems.filter(it => it.episodeNum === epNum);

        // Fallback for continuous absolute-numbered anime (e.g. One Piece / Naruto)
        if (targetItems.length === 0 && Number(season) > 1) {
            const absEp = computeAbsoluteEpisode(meta, season, epNum);
            if (absEp && absEp !== epNum) {
                targetItems = allItems.filter(it => it.episodeNum === absEp);
            }
        }
    }

    if (targetItems.length === 0) return [];

    // Limit concurrent/total external player requests so we stay well within 60s timeout
    const capped = targetItems.slice(0, 8);
    const results = await Promise.all(capped.map(it => resolveItemStreams(it)));
    return dedupeStreams(results.flat());
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const start = Date.now();
    try {
        const isTv = isTvMediaType(mediaType);
        const meta = await getMediaMeta(tmdbId, mediaType, season);
        if (!meta || !meta.queries || meta.queries.length === 0) {
            return [];
        }

        const effSeason = season != null ? parseInt(season, 10) : (meta.effectiveSeason || 1);
        const effEpisode = episode != null ? parseInt(episode, 10) : 1;

        // Build search queries (include season suffix if season > 1)
        const searchQueries = [];
        const addQ = (q) => {
            const clean = (q || '').trim();
            if (clean && !searchQueries.some(x => x.toLowerCase() === clean.toLowerCase())) {
                searchQueries.push(clean);
            }
        };

        if (isTv && effSeason > 1) {
            if (meta.titleUk) addQ(`${meta.titleUk} ${effSeason} сезон`);
            if (meta.titleUk) addQ(`${meta.titleUk} ${effSeason}`);
        }
        for (const q of meta.queries) addQ(q);

        const allFound = [];
        const seenUrls = new Set();

        for (const query of searchQueries.slice(0, 4)) {
            if (Date.now() - start > 25000) break;
            const results = await searchAnitube(query);
            for (const item of results) {
                if (!seenUrls.has(item.href)) {
                    seenUrls.add(item.href);
                    allFound.push(item);
                }
            }
            const quickMatch = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1);
            if (quickMatch.length > 0) break;
        }

        if (allFound.length === 0) return [];

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;
            const streams = await extractFromPage(candidate, meta, isTv, effSeason, effEpisode);
            if (streams.length > 0) {
                return streams;
            }
        }

        return [];
    } catch (err) {
        console.error('[AniTube] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
