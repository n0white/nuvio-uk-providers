/**
 * UAFlix.net provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (UAFlixProvider)
 */

const cheerio = require('cheerio');
import { fetchText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import {
    parsePlayerJsSubtitles,
    formatEpisodeTag,
    makeUkStream,
    dedupeStreams,
} from '../utils/playerjs.js';

const MAIN_URL = 'https://uafix.net';
const PROVIDER_NAME = 'UAFlix';

function extractUAFlixFile(text) {
    if (!text) return '';
    const single = text.match(/file\s*:\s*'([^']+)'/);
    if (single && single[1]) return single[1].trim();
    const dbl = text.match(/file\s*:\s*"([^"]+)"/);
    if (dbl && dbl[1]) return dbl[1].trim();
    return '';
}

function extractUAFlixSubtitle(text) {
    if (!text) return '';
    const single = text.match(/subtitle\s*:\s*'([^']*)'/);
    if (single && single[1] !== undefined) return single[1].trim();
    const dbl = text.match(/subtitle\s*:\s*"([^"]*)"/);
    if (dbl && dbl[1] !== undefined) return dbl[1].trim();
    return '';
}

function getPlayerReferer(playerUrl) {
    try {
        if (/^https?:\/\/zetvideo\.net\b/i.test(playerUrl)) {
            return playerUrl;
        }
    } catch (_) {}
    return 'https://tortuga.wtf/';
}

function extractAllNumbers(str) {
    return (String(str || '').match(/\d+/g) || []).map(n => parseInt(n, 10));
}

async function searchUAFlix(query) {
    const url = `${MAIN_URL}/index.php?do=search&subaction=search&search_start=0&story=${encodeURIComponent(query)}`;
    const html = await fetchText(url, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();

    $('.sres-wrap').each((_, el) => {
        const $el = $(el);
        const href = ensureUrl($el.attr('href') || $el.find('a').first().attr('href'), MAIN_URL);
        if (!href || seen.has(href)) return;

        const title = (
            $el.find('.vi-title').first().text() ||
            $el.find('.sres-img img').first().attr('alt') ||
            $el.find('h2, .sres-text h2').first().text() ||
            ''
        ).trim();
        if (!title) return;

        seen.add(href);
        const ym = $el.text().match(/\b(19\d{2}|20\d{2})\b/);
        items.push({
            title: stripSeo(title),
            href,
            year: ym ? parseInt(ym[1], 10) : null,
        });
    });

    return items;
}

function makeStream(dubTitle, url, rawSub, referer, defaultTitle, metaCtx = {}) {
    return makeUkStream({
        providerName: PROVIDER_NAME,
        dubTitle: dubTitle || defaultTitle || PROVIDER_NAME,
        url,
        rawSub,
        referer,
        episodeTag: metaCtx.episodeTag || '',
        siteTitle: metaCtx.siteTitle || defaultTitle || '',
    });
}

async function extractFromPlayerUrl(playerUrl, pageUrl, isTv, season, episode, fallbackTitle, metaCtx = {}) {
    const fixedPlayer = ensureUrl(playerUrl, MAIN_URL);
    if (!fixedPlayer || /youtube\.com|youtu\.be/i.test(fixedPlayer)) return [];

    const playerHtml = await fetchText(fixedPlayer, {
        headers: { Referer: pageUrl || `${MAIN_URL}/` },
        timeoutMs: 12000,
    });
    if (!playerHtml) return [];

    const rawFile = extractUAFlixFile(playerHtml);
    if (!rawFile) return [];

    const referer = getPlayerReferer(fixedPlayer);
    const streams = [];

    if (!isTv) {
        if (rawFile.startsWith('[')) {
            try {
                const dubs = JSON.parse(rawFile);
                for (const dub of dubs) {
                    if (dub && dub.file) {
                        const s = makeStream(dub.title, dub.file, dub.subtitle, referer, fallbackTitle, metaCtx);
                        if (s) streams.push(s);
                    }
                }
            } catch (_) {}
        } else if (/^https?:\/\//i.test(rawFile)) {
            const subRaw = extractUAFlixSubtitle(playerHtml);
            const s = makeStream(`Озвучення (${PROVIDER_NAME})`, rawFile, subRaw, referer, fallbackTitle, metaCtx);
            if (s) streams.push(s);
        }
        return dedupeStreams(streams);
    }

    // Series JSON: Dubs -> Seasons -> Episodes
    let dubs = null;
    try { dubs = JSON.parse(rawFile); } catch (_) { return []; }
    if (!Array.isArray(dubs)) return [];

    const targetS = parseInt(season, 10) || 1;
    const targetE = parseInt(episode, 10) || 1;

    for (const dub of dubs) {
        const dubTitle = dub.title || PROVIDER_NAME;
        for (const sItem of (dub.folder || [])) {
            const sNum = extractAllNumbers(sItem.title)[0];
            if (sNum !== targetS) continue;
            for (const ep of (sItem.folder || [])) {
                const eNum = extractAllNumbers(ep.title)[0];
                if (eNum === targetE && ep.file) {
                    const s = makeStream(dubTitle, ep.file, ep.subtitle, referer, fallbackTitle, metaCtx);
                    if (s) streams.push(s);
                }
            }
        }
    }

    return dedupeStreams(streams);
}

async function extractFromPage(candidate, meta, isTv, season, episode) {
    if (isTv && /\/(film|cartoons)\//i.test(candidate.href)) return [];
    const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const rawH1 = $('.fright h1 [itemprop=name]').first().text() || $('.fright h1').first().text() || candidate.title;
    const pageTitle = stripSeo(rawH1);
    const engTitle = $('span.eng-rus').first().text().trim();

    let pageYear = candidate.year;
    $('.fcols4 .finfo li').each((_, el) => {
        const label = $(el).find('span').first().text().trim();
        if (label === 'Рік виходу:') {
            const y = parseInt($(el).find('.year').first().text().trim(), 10);
            if (Number.isFinite(y)) pageYear = y;
        }
    });

    const score = scoreCandidate(pageTitle, meta, {
        year: pageYear,
        extraTitles: engTitle ? [engTitle] : [],
        season,
        isTv,
    });
    if (score <= 0) return [];

    const playerUrl = ensureUrl(
        $('.video-box iframe').first().attr('src') || $('.video-box iframe').first().attr('data-src'),
        MAIN_URL
    );

    const metaCtx = {
        episodeTag: formatEpisodeTag(isTv, season, episode),
        siteTitle: pageTitle,
    };

    if (playerUrl && !/youtube\.com|youtu\.be/i.test(playerUrl)) {
        const streams = await extractFromPlayerUrl(playerUrl, candidate.href, isTv, season, episode, pageTitle, metaCtx);
        if (streams.length > 0) return streams;
    }

    // Fallback: multi-page episode cards on the site itself (.video-item)
    if (isTv) {
        const targetS = parseInt(season, 10) || 1;
        const targetE = parseInt(episode, 10) || 1;
        const totalPages = Math.min(5, Math.max(1, $('.pagination li').length));

        for (let p = 1; p <= totalPages; p++) {
            const pageHtml = p === 1
                ? html
                : await fetchText(`${candidate.href}?page=${p}`, { headers: { Referer: candidate.href }, timeoutMs: 10000 });
            if (!pageHtml) continue;
            const $p = cheerio.load(pageHtml);

            let matchedEpHref = '';
            $p('.video-item').each((_, el) => {
                if (matchedEpHref) return;
                const nums = extractAllNumbers($p(el).find('.vi-title').text());
                const epSeason = nums.length >= 2 ? nums[0] : 1;
                const epNum = nums.length >= 2 ? nums[1] : nums[0];
                if (epSeason === targetS && epNum === targetE) {
                    matchedEpHref = ensureUrl($p(el).find('.vi-img').attr('href'), MAIN_URL);
                }
            });

            if (matchedEpHref) {
                const epHtml = await fetchText(matchedEpHref, { headers: { Referer: candidate.href }, timeoutMs: 10000 });
                if (!epHtml) return [];
                const $ep = cheerio.load(epHtml);
                const epPlayerUrl = ensureUrl(
                    $ep('.video-box iframe').first().attr('src') || $ep('.video-box iframe').first().attr('data-src'),
                    MAIN_URL
                );
                if (epPlayerUrl) {
                    return extractFromPlayerUrl(epPlayerUrl, matchedEpHref, false, null, null, pageTitle, metaCtx);
                }
            }
        }
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

        const allFound = [];
        const seenUrls = new Set();

        for (const query of meta.queries.slice(0, 3)) {
            if (Date.now() - start > 25000) break;
            const results = await searchUAFlix(query);
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
        console.error('[UAFlix] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
