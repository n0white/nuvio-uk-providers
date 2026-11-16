/**
 * UASerials.com provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (UASerialsProProvider)
 */

const cheerio = require('cheerio');
const CryptoJS = require('crypto-js');
import { fetchText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate } from '../utils/matching.js';
import {
    decodeTortuga,
    parsePlayerJsSubtitles,
    buildNuvioStream,
    dedupeStreams,
} from '../utils/playerjs.js';

const MAIN_URL = 'https://uaserials.com';
const PROVIDER_NAME = 'UASerials';
const AES_PASSPHRASE = '297796CCB81D255125';
const TORTUGA_REFERER = 'https://tortuga.tw/';

function decryptTag1(tag1Json) {
    try {
        const data = JSON.parse(tag1Json);
        const ct = data && (data.ciphertext || data.ct);
        const s = data && (data.salt || data.s);
        const ivHex = data && data.iv;
        if (!ct || !s || !ivHex) return [];

        const salt = CryptoJS.enc.Hex.parse(String(s).replace(/[^0-9a-fA-F]/g, ''));
        const iv = CryptoJS.enc.Hex.parse(String(ivHex).replace(/[^0-9a-fA-F]/g, ''));
        const key = CryptoJS.PBKDF2(AES_PASSPHRASE, salt, {
            keySize: 256 / 32,
            iterations: Number(data.iterations) || 999,
            hasher: CryptoJS.algo.SHA512,
        });
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(ct) },
            key,
            { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.NoPadding }
        );
        const raw = decrypted.toString(CryptoJS.enc.Utf8).replace(/\\/g, '');
        const lastBracket = raw.lastIndexOf(']');
        if (lastBracket < 0) return [];
        const cleanJson = raw.slice(0, lastBracket + 1);
        const parsed = JSON.parse(cleanJson);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function extractFileField(html) {
    const m = String(html || '').match(/file\s*:\s*["']([^"',]+)["']/);
    return m ? m[1].trim() : '';
}

function extractSubField(html) {
    const m = String(html || '').match(/subtitle\s*:\s*["']([^"',]+)["']/);
    return m ? m[1].trim() : '';
}

function decodePlayerField(raw, allowBracket = false) {
    if (!raw) return '';
    if (raw.startsWith('http') || (allowBracket && raw.startsWith('['))) return raw;
    return decodeTortuga(raw) || '';
}

async function searchUASerials(query) {
    const encoded = encodeURIComponent(query).replace(/%20/g, '%20');
    const url = `${MAIN_URL}/search/${encoded}/`;
    const html = await fetchText(url, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const items = [];
    const seen = new Set();

    $('.uas-card').each((_, el) => {
        const $el = $(el);
        const href = ensureUrl($el.attr('href') || $el.find('a').first().attr('href'), MAIN_URL);
        const title = $el.find('.uas-card__title').first().text().trim();
        const engTitle = $el.find('.uas-card__orig').first().text().trim();
        if (!href || !title || seen.has(href)) return;
        seen.add(href);

        const ym = $el.text().match(/\b(19\d{2}|20\d{2})\b/);
        items.push({
            title,
            href,
            extraTitles: engTitle ? [engTitle] : [],
            year: ym ? parseInt(ym[1], 10) : null,
        });
    });

    return items;
}

function makeStream(dubTitle, url, subs, defaultTitle) {
    const title = (dubTitle || defaultTitle || PROVIDER_NAME).trim();
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
        headers: { Referer: TORTUGA_REFERER },
        subtitles: subs,
    });
}

async function extractFromPage(candidate, meta, isTv, season, episode) {
    const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!html) return [];

    const $ = cheerio.load(html);
    const pageTitle = $('.short-title').first().text().trim() || candidate.title;
    const engTitle = $('.oname').first().text().trim();
    const yearText = $('.short-list a[href*=/year/]').first().text().trim();
    const pageYear = /^\d{4}$/.test(yearText) ? parseInt(yearText, 10) : candidate.year;

    const score = scoreCandidate(pageTitle, meta, {
        year: pageYear,
        extraTitles: engTitle ? [engTitle] : candidate.extraTitles,
        season,
        isTv,
    });
    if (score <= 0) return [];

    const translation = $('.short-list li:contains(Переклад) span[data-popup]')
        .first()
        .text()
        .trim()
        .replace(/\|/g, '/');

    const tag1 = $('player-control[data-tag1]').first().attr('data-tag1') ||
        $('div.fplayer player-control').first().attr('data-tag1');
    if (!tag1) return [];

    const tabs = decryptTag1(tag1);
    if (tabs.length === 0) return [];

    const playerTab = tabs.find(t => t && t.tabName === 'Плеєр' && t.url) ||
        tabs.find(t => t && t.url && !/трейлер/i.test(t.tabName || ''));
    const playerUrl = ensureUrl(playerTab && playerTab.url, MAIN_URL);
    if (!playerUrl) return [];

    const playerHtml = await fetchText(playerUrl, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
    if (!playerHtml) return [];

    const decodedFile = decodePlayerField(extractFileField(playerHtml), true);
    if (!decodedFile) return [];

    const decodedSub = decodePlayerField(extractSubField(playerHtml), true);

    if (!decodedFile.startsWith('[')) {
        // Movie direct URL
        const subs = parsePlayerJsSubtitles(decodedSub);
        const s = makeStream(translation || pageTitle, decodedFile, subs, pageTitle);
        return s ? [s] : [];
    }

    let seasons = null;
    try { seasons = JSON.parse(decodedFile); } catch (_) { return []; }
    if (!Array.isArray(seasons)) return [];

    const targetS = parseInt(season, 10) || 1;
    const targetE = parseInt(episode, 10) || 1;
    const streams = [];

    seasons.forEach((sItem, sIdx) => {
        const sNum = parseInt(sItem.season, 10) || (sIdx + 1);
        if (isTv && sNum !== targetS) return;

        (sItem.folder || []).forEach((epItem, eIdx) => {
            const eNum = parseInt(epItem.number, 10) || (eIdx + 1);
            if (isTv && eNum !== targetE) return;

            const fileStr = String(epItem.file || '').trim();
            if (!fileStr) return;

            const baseSubs = parsePlayerJsSubtitles(epItem.subtitle || '');

            for (const rawTrack of fileStr.split(';')) {
                const track = rawTrack.trim();
                if (!track) continue;

                const subTailMatch = track.match(/\(subtitle:(.*)\)$/);
                const cleanTrack = subTailMatch ? track.slice(0, subTailMatch.index) : track;
                const trackSubs = subTailMatch && subTailMatch[1]
                    ? parsePlayerJsSubtitles(subTailMatch[1])
                    : [];

                const braceEnd = cleanTrack.indexOf('}');
                const braceStart = cleanTrack.indexOf('{');
                const dubName = (braceStart >= 0 && braceEnd > braceStart)
                    ? cleanTrack.slice(braceStart + 1, braceEnd).trim()
                    : (translation || 'Плеєр');
                const streamUrl = braceEnd >= 0
                    ? cleanTrack.slice(braceEnd + 1).trim()
                    : cleanTrack.trim();

                if (!/^https?:\/\//i.test(streamUrl)) continue;
                const mergedSubs = trackSubs.length > 0 ? trackSubs : baseSubs;
                const s = makeStream(dubName, streamUrl, mergedSubs, pageTitle);
                if (s) streams.push(s);
            }
        });
    });

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
            const results = await searchUASerials(query);
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
        console.error('[UASerials] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
