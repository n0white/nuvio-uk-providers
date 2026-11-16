/**
 * Uakino.best provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (UakinoProvider)
 *
 * Includes optional settings (mirror URL, cf_clearance Cookie, User-Agent)
 * in case uakino.best triggers a Cloudflare challenge on the user's network.
 */

const cheerio = require('cheerio');
import {
    fetchText,
    fetchJson,
    postFormText,
    ensureUrl,
    MOBILE_USER_AGENT,
    isCloudflareChallenge,
} from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate } from '../utils/matching.js';
import {
    extractPlayerJsFiles,
    extractPlayerJsSubtitleRaw,
    parsePlayerJsSubtitles,
    resolvePlayerJsUrls,
    buildNuvioStream,
    dedupeStreams,
} from '../utils/playerjs.js';

const DEFAULT_MAIN_URL = 'https://uakino.best';
const PROVIDER_NAME = 'Uakino';

function getSettings() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SCRAPER_SETTINGS && typeof globalThis.SCRAPER_SETTINGS === 'object') {
            return globalThis.SCRAPER_SETTINGS;
        }
    } catch (_) {}
    return {};
}

function getConfig() {
    const s = getSettings();
    const baseUrl = (typeof s.baseUrl === 'string' && s.baseUrl.trim())
        ? s.baseUrl.trim().replace(/\/+$/, '')
        : DEFAULT_MAIN_URL;
    const cookie = typeof s.cookie === 'string' ? s.cookie.trim() : '';
    const userAgent = (typeof s.userAgent === 'string' && s.userAgent.trim())
        ? s.userAgent.trim()
        : MOBILE_USER_AGENT;
    return { baseUrl, cookie, userAgent };
}

function buildHeaders(cfg, referer) {
    const headers = {
        'User-Agent': cfg.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': referer || `${cfg.baseUrl}/`,
    };
    if (cfg.cookie) {
        headers.Cookie = cfg.cookie;
    }
    return headers;
}

function selectPlayerReferer(playerUrl, fallbackReferer) {
    try {
        const m = String(playerUrl || '').match(/^(https?:)\/\/([^/:?#]+)(?::(\d+))?/i);
        if (!m) return fallbackReferer;
        const scheme = m[1].toLowerCase();
        const host = m[2].toLowerCase();
        if (host === 'ashdi.vip') {
            return String(playerUrl).split('#')[0];
        }
        return `${scheme}//${host}${m[3] ? ':' + m[3] : ''}/`;
    } catch (_) {
        return fallbackReferer;
    }
}

function extractTrailingNumber(text) {
    const m = String(text || '').match(/\d+/g);
    if (!m || m.length === 0) return null;
    const num = parseInt(m[0], 10);
    return Number.isFinite(num) ? num : null;
}

async function searchUakino(query, cfg) {
    const html = await postFormText(
        `${cfg.baseUrl}/ua/`,
        {
            do: 'search',
            subaction: 'search',
            story: query,
        },
        buildHeaders(cfg, `${cfg.baseUrl}/`),
        12000
    );
    if (!html || isCloudflareChallenge(html)) return { blocked: isCloudflareChallenge(html), items: [] };

    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();

    $('div.movie-item.short-item, div.movie-item').each((_, el) => {
        const $el = $(el);
        const $link = $el.find('a.movie-title, a.full-movie').first();
        const href = ensureUrl($link.attr('href'), cfg.baseUrl);
        if (!href || /\/news\/|\/franchise\//i.test(href) || seen.has(href)) return;

        const title = ($link.text() || $el.find('div.full-movie-title').first().text() || '').trim();
        if (!title) return;

        seen.add(href);
        const cardText = $el.text();
        const yearMatch = cardText.match(/\b(19\d{2}|20\d{2})\b/);
        items.push({
            title,
            href,
            year: yearMatch ? parseInt(yearMatch[1], 10) : null,
        });
    });

    return { blocked: false, items };
}

function parsePlaylistItems(rawPayload) {
    let html = '';
    if (typeof rawPayload === 'string') {
        try {
            const parsed = JSON.parse(rawPayload);
            if (parsed && parsed.success && parsed.response) {
                html = parsed.response;
            }
        } catch (_) {
            html = rawPayload;
        }
    } else if (rawPayload && rawPayload.success && rawPayload.response) {
        html = rawPayload.response;
    }
    if (!html) return [];

    const $ = cheerio.load(html);
    const items = [];
    $('div.playlists-videos li').each((_, el) => {
        const $el = $(el);
        const fileUrl = ensureUrl($el.attr('data-file'));
        if (!fileUrl) return;
        const voice = ($el.attr('data-voice') || 'Uakino').trim();
        const epName = $el.text().trim();
        items.push({
            url: fileUrl,
            voice,
            epName,
            epNum: extractTrailingNumber(epName),
        });
    });

    if (items.length === 0) {
        const re = /data-file=\\?["']([^\\"']+)/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const u = ensureUrl(m[1].replace(/\\\//g, '/'));
            if (u) items.push({ url: u, voice: 'Uakino', epName: '', epNum: null });
        }
    }

    return items;
}

function extractInlinePlayerUrls($, cfg) {
    const urls = [];
    const seen = new Set();
    const pushUrl = (raw) => {
        const u = ensureUrl(raw, cfg.baseUrl);
        if (!u || seen.has(u) || /youtube\.com|youtu\.be/i.test(u)) return;
        seen.add(u);
        urls.push(u);
    };

    $('[itemprop]').each((_, el) => {
        const $el = $(el);
        const prop = ($el.attr('itemprop') || '').toLowerCase();
        if (!/\b(video|embedurl|contenturl)\b/.test(prop)) return;
        for (const attr of ['value', 'content', 'href', 'src', 'data-src']) {
            const val = $el.attr(attr);
            if (val) pushUrl(val);
        }
    });

    $('iframe[src], iframe[data-src]').each((_, el) => {
        const $el = $(el);
        const id = ($el.attr('id') || '').toLowerCase();
        const cls = ($el.attr('class') || '').toLowerCase();
        if (id.includes('trailer') || id.includes('overroll') || cls.includes('trailer')) return;
        const src = $el.attr('src') || $el.attr('data-src');
        if (src) pushUrl(src);
    });

    return urls;
}

async function resolveUakinoPlayer(playerUrl, sourceLabel, cfg) {
    const normalized = ensureUrl(playerUrl, cfg.baseUrl);
    if (!normalized) return [];

    const html = await fetchText(normalized, {
        headers: buildHeaders(cfg, `${cfg.baseUrl}/`),
        timeoutMs: 12000,
    });
    if (!html) return [];

    const rawFiles = extractPlayerJsFiles(html);
    const streamUrls = [];
    for (const rf of rawFiles) {
        for (const u of resolvePlayerJsUrls(rf)) {
            if (!streamUrls.includes(u)) streamUrls.push(u);
        }
    }
    if (streamUrls.length === 0) return [];

    const subtitles = parsePlayerJsSubtitles(extractPlayerJsSubtitleRaw(html));
    const referer = selectPlayerReferer(normalized, `${cfg.baseUrl}/`);
    const label = (sourceLabel || PROVIDER_NAME).trim();
    const isSub = /субтитр/i.test(label);
    const langLabel = isSub
        ? 'Субтитри • uk'
        : (subtitles.length > 0 ? 'Озвучення (+суб) • uk' : 'Озвучення • uk');

    return streamUrls.map(url =>
        buildNuvioStream({
            providerName: PROVIDER_NAME,
            name: label,
            title: label,
            url,
            quality: '1080p',
            language: langLabel,
            headers: referer ? { Referer: referer } : {},
            subtitles,
        })
    ).filter(Boolean);
}

async function resolveSeasonUrl($, detailUrl, season, cfg) {
    if (!season) return null;
    const links = [];
    $('.seasons li a').each((_, el) => {
        const href = ensureUrl($(el).attr('href'), cfg.baseUrl);
        const text = $(el).text().trim();
        if (href) links.push({ href, text });
    });
    if (links.length === 0) return null;

    const target = Number(season);
    for (const link of links) {
        const m = link.text.match(/(\d+)\s*сезон|сезон\s*(\d+)/i);
        if (m) {
            const sNum = parseInt(m[1] || m[2], 10);
            if (sNum === target) return link.href;
        }
    }
    return null;
}

async function extractFromPage(candidate, meta, isTv, season, episode, cfg) {
    let targetUrl = candidate.href;
    let html = await fetchText(targetUrl, {
        headers: buildHeaders(cfg, `${cfg.baseUrl}/`),
        timeoutMs: 12000,
    });
    if (!html || isCloudflareChallenge(html)) return [];

    let $ = cheerio.load(html);
    let pageTitle = $('h1 span.solototle').first().text().trim() || $('h1').first().text().trim() || candidate.title;

    let pageYear = candidate.year;
    $('.fi-item-s, .fi-item').each((_, el) => {
        const label = $(el).find('.fi-label').text();
        if (label.includes('Рік виходу:')) {
            const y = parseInt($(el).find('.fi-desc').text().trim(), 10);
            if (Number.isFinite(y)) pageYear = y;
        }
    });

    if (scoreCandidate(pageTitle, meta, { year: pageYear, season, isTv }) <= 0) {
        return [];
    }

    if (isTv && season) {
        const betterSeasonUrl = await resolveSeasonUrl($, targetUrl, season, cfg);
        if (betterSeasonUrl && betterSeasonUrl !== targetUrl) {
            const sHtml = await fetchText(betterSeasonUrl, {
                headers: buildHeaders(cfg, targetUrl),
                timeoutMs: 12000,
            });
            if (sHtml && !isCloudflareChallenge(sHtml)) {
                targetUrl = betterSeasonUrl;
                html = sHtml;
                $ = cheerio.load(html);
            }
        }
    }

    const newsId =
        $('div.playlists-ajax').first().attr('data-news_id') ||
        (targetUrl.split('/').pop().match(/^(\d+)/) || [])[1] ||
        '';

    let playlistItems = [];
    if (newsId) {
        const playlistUrl = `${cfg.baseUrl}/engine/ajax/playlists.php?news_id=${newsId}&xfield=playlist`;
        const ajaxRes = await fetchText(playlistUrl, {
            headers: Object.assign({}, buildHeaders(cfg, targetUrl), {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest',
            }),
            timeoutMs: 12000,
        });
        if (ajaxRes) {
            playlistItems = parsePlaylistItems(ajaxRes);
        }
    }

    const playersToResolve = [];
    if (!isTv) {
        for (const item of playlistItems) {
            playersToResolve.push({ url: item.url, label: item.voice });
        }
        for (const inlineUrl of extractInlinePlayerUrls($, cfg)) {
            if (!playersToResolve.some(p => p.url === inlineUrl)) {
                playersToResolve.push({ url: inlineUrl, label: PROVIDER_NAME });
            }
        }
    } else {
        const targetEp = parseInt(episode, 10);
        const matching = playlistItems.filter(it => it.epNum === targetEp);
        for (const item of matching) {
            playersToResolve.push({ url: item.url, label: item.voice || PROVIDER_NAME });
        }
        if (playersToResolve.length === 0 && targetEp === 1) {
            for (const inlineUrl of extractInlinePlayerUrls($, cfg)) {
                playersToResolve.push({ url: inlineUrl, label: PROVIDER_NAME });
            }
        }
    }

    if (playersToResolve.length > 0) {
        const resolved = await Promise.all(
            playersToResolve.slice(0, 8).map(p => resolveUakinoPlayer(p.url, p.label, cfg))
        );
        const streams = dedupeStreams(resolved.flat());
        if (streams.length > 0) return streams;
    }

    // Fallback: direct `file:` embedded on detail page
    const pageFiles = extractPlayerJsFiles(html);
    const fallbackStreams = [];
    for (const rf of pageFiles) {
        for (const u of resolvePlayerJsUrls(rf)) {
            const s = buildNuvioStream({
                providerName: PROVIDER_NAME,
                title: pageTitle,
                url: u,
                quality: '1080p',
                headers: { Referer: `${cfg.baseUrl}/` },
            });
            if (s) fallbackStreams.push(s);
        }
    }
    return dedupeStreams(fallbackStreams);
}

async function getStreams(tmdbId, mediaType, season, episode) {
    const start = Date.now();
    try {
        const cfg = getConfig();
        const isTv = isTvMediaType(mediaType);
        const meta = await getMediaMeta(tmdbId, mediaType, season);
        if (!meta || !meta.queries || meta.queries.length === 0) {
            return [];
        }

        const effSeason = season != null ? parseInt(season, 10) : (meta.effectiveSeason || 1);
        const effEpisode = episode != null ? parseInt(episode, 10) : 1;

        const searchQueries = [];
        const addQ = (q) => {
            const clean = (q || '').trim();
            if (clean && !searchQueries.some(x => x.toLowerCase() === clean.toLowerCase())) {
                searchQueries.push(clean);
            }
        };
        if (isTv && effSeason > 1 && meta.titleUk) {
            addQ(`${meta.titleUk} ${effSeason} сезон`);
        }
        for (const q of meta.queries) addQ(q);

        const allFound = [];
        const seenUrls = new Set();

        for (const query of searchQueries.slice(0, 3)) {
            if (Date.now() - start > 25000) break;
            const res = await searchUakino(query, cfg);
            if (res.blocked) {
                console.warn('[Uakino] Cloudflare challenge encountered (403). Configure mirror or cf_clearance cookie in plugin settings.');
                return [];
            }
            for (const item of res.items) {
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
            const streams = await extractFromPage(candidate, meta, isTv, effSeason, effEpisode, cfg);
            if (streams.length > 0) return streams;
        }

        return [];
    } catch (err) {
        console.error('[Uakino] Error:', err && err.message ? err.message : err);
        return [];
    }
}

function onSettings() {
    return [
        {
            type: 'header',
            title: 'Налаштування Uakino',
        },
        {
            type: 'info',
            text: 'Якщо uakino.best блокує запити захистом Cloudflare (403), вкажіть дзеркало або cookie cf_clearance з браузера з відповідним User-Agent.',
        },
        {
            type: 'text',
            key: 'baseUrl',
            label: 'Базовий URL (дзеркало)',
            default: DEFAULT_MAIN_URL,
            placeholder: DEFAULT_MAIN_URL,
        },
        {
            type: 'text',
            key: 'cookie',
            label: 'Cookie (cf_clearance=...)',
            default: '',
            placeholder: 'cf_clearance=...',
        },
        {
            type: 'text',
            key: 'userAgent',
            label: 'User-Agent',
            default: MOBILE_USER_AGENT,
            placeholder: MOBILE_USER_AGENT,
        },
    ];
}

module.exports = { getStreams, onSettings };
