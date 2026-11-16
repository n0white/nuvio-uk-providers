/**
 * Eneyida.tv provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (EneyidaProvider)
 */

const cheerio = require('cheerio');
import { fetchText, postFormText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate } from '../utils/matching.js';
import {
    extractPlayerJsFiles,
    extractPlayerJsSubtitleRaw,
    parsePlayerJsSubtitles,
    buildNuvioStream,
    dedupeStreams,
} from '../utils/playerjs.js';

const MAIN_URL = 'https://eneyida.tv';
const PROVIDER_NAME = 'Eneyida';
const PLAY_REFERER = 'https://tortuga.wtf/';

function extractNumber(str) {
    const m = String(str || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

function extractEneyidaFileValue(html) {
    const m = String(html || '').match(/file\s*:\s*(['"])/);
    if (!m) return '';
    const quote = m[1];
    const start = m.index + m[0].length;
    let out = '';
    for (let i = start; i < html.length; i++) {
        const ch = html[i];
        if (ch === '\\' && i + 1 < html.length) {
            out += html[i + 1];
            i++;
            continue;
        }
        if (ch === quote) break;
        out += ch;
    }
    return out.trim();
}

async function searchEneyida(query) {
    const html = await postFormText(
        MAIN_URL,
        {
            do: 'search',
            subaction: 'search',
            story: query,
        },
        { Referer: `${MAIN_URL}/` },
        12000
    );
    if (!html) return [];

    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();

    $('article.short').each((_, el) => {
        const $el = $(el);
        const $link = $el.find('a.short_title').first();
        const title = $link.text().trim();
        const href = ensureUrl($link.attr('href'), MAIN_URL);
        if (!title || !href || seen.has(href)) return;
        seen.add(href);

        const yearText = $el.find('.short_info, .short_year').text();
        const ym = yearText.match(/\b(19\d{2}|20\d{2})\b/);
        items.push({
            title,
            href,
            year: ym ? parseInt(ym[1], 10) : null,
        });
    });

    return items;
}

function makeStream(dubTitle, url, rawSub, defaultTitle) {
    const title = (dubTitle || defaultTitle || PROVIDER_NAME).trim();
    const subs = parsePlayerJsSubtitles(rawSub);
    const isSub = /субтитр/i.test(title);
    const langLabel = isSub
        ? 'Субтитри • uk'
        : (subs.length > 0 ? 'Озвучення (+суб) • uk' : 'Озвучення • uk');

    return buildNuvioStream({
        providerName: PROVIDER_NAME,
        name: title,
        title,
        url,
        quality: '1080p',
        language: langLabel,
        headers: { Referer: PLAY_REFERER },
        subtitles: subs,
    });
}

async function extractFromPage(candidate, meta, isTv, season, episode) {
    const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const pageTitle = $('div.full_header-title h1').first().text().trim() || candidate.title;
    const origTitle = $('div.full_header-title .orig_title, div.full_header-title h2').first().text().trim();
    const yearText = $('.full_info li').eq(0).find('a').first().text().trim();
    const pageYear = /^\d{4}$/.test(yearText) ? parseInt(yearText, 10) : candidate.year;

    const score = scoreCandidate(pageTitle, meta, {
        year: pageYear,
        extraTitles: origTitle ? [origTitle] : [],
        season,
        isTv,
    });
    if (score <= 0) return [];

    const playerUrl = ensureUrl(
        $('.tabs_b.visible iframe').first().attr('src') ||
        $('.tabs_b iframe').first().attr('src') ||
        $('.tabs_b iframe').first().attr('data-src'),
        MAIN_URL
    );
    if (!playerUrl || /youtube\.com|youtu\.be/i.test(playerUrl)) return [];

    const playerHtml = await fetchText(playerUrl, {
        headers: { Referer: candidate.href },
        timeoutMs: 12000,
    });
    if (!playerHtml) return [];

    const rawFile = extractEneyidaFileValue(playerHtml) || (extractPlayerJsFiles(playerHtml)[0] || '');
    if (!rawFile) return [];

    let parsedJson = null;
    if (rawFile.startsWith('[')) {
        try { parsedJson = JSON.parse(rawFile); } catch (_) {}
    }

    const streams = [];
    if (!isTv) {
        if (Array.isArray(parsedJson)) {
            for (const dub of parsedJson) {
                if (dub && dub.file) {
                    const s = makeStream(dub.title, dub.file, dub.subtitle, pageTitle);
                    if (s) streams.push(s);
                }
            }
        } else if (/^https?:\/\//i.test(rawFile)) {
            const subRaw = extractPlayerJsSubtitleRaw(playerHtml);
            const s = makeStream(`Озвучення (${PROVIDER_NAME})`, rawFile, subRaw, PROVIDER_NAME);
            if (s) streams.push(s);
        }
        return dedupeStreams(streams);
    }

    // TV Series
    if (!Array.isArray(parsedJson) || parsedJson.length === 0) return [];

    const targetS = parseInt(season, 10) || 1;
    const targetE = parseInt(episode, 10) || 1;
    const first = parsedJson[0];
    const isSeasonFirst = /сезон/i.test((first && first.title) || '');

    if (isSeasonFirst) {
        // Format A: Season -> Dub -> Episode
        for (const sItem of parsedJson) {
            const sNum = extractNumber(sItem.title);
            if (sNum !== targetS) continue;
            for (const dub of (sItem.folder || [])) {
                const dubTitle = dub.title || PROVIDER_NAME;
                for (const ep of (dub.folder || [])) {
                    const eNum = extractNumber(ep.title);
                    if (eNum === targetE && ep.file) {
                        const s = makeStream(dubTitle, ep.file, ep.subtitle, pageTitle);
                        if (s) streams.push(s);
                    }
                }
            }
        }
    } else {
        // Format B: Dub -> Season -> Episode
        for (const dub of parsedJson) {
            const dubTitle = dub.title || PROVIDER_NAME;
            for (const sItem of (dub.folder || [])) {
                const sNum = extractNumber(sItem.title);
                if (sNum !== targetS) continue;
                for (const ep of (sItem.folder || [])) {
                    const eNum = extractNumber(ep.title);
                    if (eNum === targetE && ep.file) {
                        const s = makeStream(dubTitle, ep.file, ep.subtitle, pageTitle);
                        if (s) streams.push(s);
                    }
                }
            }
        }
    }

    return dedupeStreams(streams);
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
        const seenUrls = new Set();

        for (const query of meta.queries.slice(0, 3)) {
            if (Date.now() - start > 25000) break;
            const results = await searchEneyida(query);
            for (const item of results) {
                if (!seenUrls.has(item.href)) {
                    seenUrls.add(item.href);
                    allFound.push(item);
                }
            }
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) {
                break;
            }
        }

        if (allFound.length === 0) return [];

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;
            const streams = await extractFromPage(candidate, meta, isTv, effSeason, effEpisode);
            if (streams.length > 0) return streams;
        }

        return [];
    } catch (err) {
        console.error('[Eneyida] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
