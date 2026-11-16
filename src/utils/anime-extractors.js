/**
 * Shared extractors for Ukrainian anime players (Ashdi, MoonAnime, FenixPlay, CSST/Monstro).
 * Ported from CakesTwix/cloudstream-extensions-uk AnitubeinuaProvider extractors.
 */

import { fetchText, safeFetch, ensureUrl } from './http.js';
import {
    base64ToBytes,
    bytesToUtf8,
    extractPlayerJsFiles,
    extractPlayerJsSubtitleRaw,
    parsePlayerJsSubtitles,
    fetchHlsSubtitles,
    buildNuvioStream,
} from './playerjs.js';

const MOON_REFERER = 'https://moonanime.art/';
const FENIX_REFERER = 'https://fenixplay.xyz/';
const ASHDI_REFERER = 'https://ashdi.vip/';

function distinctSubtitles(subs) {
    const seen = new Set();
    return (subs || []).filter(s => {
        if (!s || !s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
    });
}

function markForcedSubtitle(label, isForced) {
    if (!isForced) return label;
    if (/forced|форс|напис/i.test(label)) return label;
    return `${label} (форсовані)`;
}

/**
 * Extracts stream + subtitles from ashdi.vip embed/vod URL.
 */
export async function extractAshdi(iframeUrl, sourceLabel, providerName, refererOverride) {
    const fixedUrl = ensureUrl(iframeUrl).replace('/embed/', '/vod/');
    if (!fixedUrl) return [];

    const html = await fetchText(fixedUrl, {
        headers: { Referer: 'https://anitube.in.ua/' },
        timeoutMs: 12000,
    });
    if (!html) return [];

    const files = extractPlayerJsFiles(html);
    const fileUrl = files[files.length - 1] || '';
    if (!fileUrl) return [];

    const subRaw = extractPlayerJsSubtitleRaw(html);
    let subtitles = parsePlayerJsSubtitles(subRaw);
    const playReferer = refererOverride || ASHDI_REFERER;

    if (subtitles.length === 0 && fileUrl.includes('.m3u8')) {
        subtitles = await fetchHlsSubtitles(fileUrl, { Referer: playReferer });
    }

    const stream = buildNuvioStream({
        providerName,
        title: `${sourceLabel} (Ashdi)`,
        url: fileUrl,
        quality: '1080p',
        headers: { Referer: playReferer },
        subtitles: distinctSubtitles(subtitles),
        type: 'hls',
    });
    return stream ? [stream] : [];
}

function moonOuterDecode(base64Blob) {
    try {
        const raw = base64ToBytes(base64Blob);
        if (raw.length < 33) return '';
        const state0 = raw[0];
        const key = raw.subarray(1, 33);
        const data = raw.subarray(33);
        const chars = [];
        let state = state0;
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const k = key[i % 32];
            const dec = d ^ k ^ state;
            chars.push(String.fromCharCode(dec));
            state = (d + k) & 0xff;
        }
        return chars.join('');
    } catch (_) {
        return '';
    }
}

function moonDecrypt(encoded, key = 'mAnK') {
    try {
        const decoded = base64ToBytes(String(encoded || '').replace(/\s+/g, ''));
        const out = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            out[i] = decoded[i] ^ key.charCodeAt(i % key.length);
        }
        return bytesToUtf8(out);
    } catch (_) {
        return '';
    }
}

function extractMoonSubtitles(decodedValues) {
    const subs = [];
    for (const val of decodedValues) {
        if (!/^https?:\/\//i.test(val)) continue;
        if (!/\.(vtt|srt|ass)(\?|$)/i.test(val)) continue;
        if (/thumbnail|sprite|preview|storyboard/i.test(val)) continue;
        const fileName = val.split('?')[0].split('/').pop() || '';
        const langMatch = fileName.match(/[_-]([a-z]{2})\.(vtt|srt|ass)$/i);
        const isForced = /forced|signs|napisy/i.test(val);
        subs.push({
            url: val,
            language: langMatch ? langMatch[1].toLowerCase() : 'uk',
            name: markForcedSubtitle((langMatch && langMatch[1]) || 'Субтитри', isForced),
        });
    }
    return distinctSubtitles(subs);
}

async function resolveMoonContent(contentUrl) {
    try {
        const cookieRes = await safeFetch(MOON_REFERER, {
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeoutMs: 8000,
        });
        const setCookie = cookieRes && cookieRes.headers ? cookieRes.headers.get('set-cookie') : '';
        const headers = {
            Referer: MOON_REFERER,
            Origin: 'https://moonanime.art',
            Accept: '*/*',
        };
        if (setCookie) {
            headers.Cookie = setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
        }
        const res = await safeFetch(contentUrl, {
            headers,
            redirect: 'manual',
            timeoutMs: 8000,
        });
        if (!res) return null;
        const loc = res.headers && res.headers.get('location');
        if (loc) return ensureUrl(loc, MOON_REFERER);
        const body = (await res.text() || '').trim();
        return /^https?:\/\//i.test(body) ? body : null;
    } catch (_) {
        return null;
    }
}

/**
 * Extracts stream(s) + subtitles from moonanime.art / moonanime.net iframe URL.
 */
export async function extractMoon(iframeUrl, sourceLabel, providerName) {
    const cleanUrl = ensureUrl(iframeUrl)
        .replace(/[?&]player=[^&]*/g, '')
        .replace('?&', '?')
        .replace(/[?&]$/, '');
    if (!cleanUrl) return [];

    const html = await fetchText(cleanUrl, {
        headers: { Referer: 'https://anitube.in.ua/' },
        timeoutMs: 12000,
    });

    let rawFile = '';
    let subtitles = [];

    if (html) {
        const atobMatch = html.match(/atob\s*\(\s*["']([^"']+)["']\s*\)/);
        if (atobMatch && atobMatch[1]) {
            const decodedJs = moonOuterDecode(atobMatch[1]);
            if (decodedJs) {
                const keyMatch = decodedJs.match(/var\s+k\s*=\s*["']([^"']+)["']/);
                const xorKey = keyMatch && keyMatch[1];
                if (xorKey) {
                    const decodedValues = [];
                    const encRe = /_0xd\s*\(\s*["']([^"']+)["']\s*\)/g;
                    let m;
                    while ((m = encRe.exec(decodedJs)) !== null) {
                        const val = moonDecrypt(m[1], xorKey);
                        if (val) decodedValues.push(val);
                    }
                    subtitles = extractMoonSubtitles(decodedValues);
                    for (const val of decodedValues) {
                        const isMedia = /\.(m3u8|mp4|webm)/i.test(val) || val.startsWith('[');
                        const isMoon = /mooncdn|moonanime\.art\/content|s\.moonanime\.art/i.test(val);
                        const isStatic = /\.(jpg|jpeg|png|vtt|srt|txt)(\?|$)/i.test(val);
                        if ((isMedia || isMoon) && !isStatic) {
                            rawFile = val;
                            break;
                        }
                    }
                }
                if (!rawFile) {
                    const contentMatch = decodedJs.match(/(https?:\/\/s\.moonanime\.art\/content\/[^\s"'`]+)/);
                    if (contentMatch && contentMatch[1] && !/\.(jpg|jpeg|png)$/i.test(contentMatch[1])) {
                        const resolved = await resolveMoonContent(contentMatch[1]);
                        if (resolved) rawFile = resolved;
                    }
                }
            }
        }
    }

    if (!rawFile) {
        const hashMatch = cleanUrl.match(/\/iframe\/([a-zA-Z0-9]+)\/?/);
        if (hashMatch && hashMatch[1]) {
            const qualityParts = [];
            for (const q of [1080, 720, 480]) {
                const resolved = await resolveMoonContent(`https://s.moonanime.art/content/v/${hashMatch[1]}/${q}/`);
                if (resolved) qualityParts.push(`[${q}p]${resolved}`);
            }
            if (qualityParts.length > 0) rawFile = qualityParts.join(',');
        }
    }

    if (!rawFile) return [];

    const moonHeaders = {
        Referer: MOON_REFERER,
        Origin: 'https://moonanime.art',
    };
    const streams = [];

    if (rawFile.startsWith('[')) {
        const re = /\[(\d+p)\](https?:\/\/[^\s,]+)/g;
        let m;
        while ((m = re.exec(rawFile)) !== null) {
            const qLabel = m[1];
            let qUrl = m[2];
            if (/s\.moonanime\.art|moonanime\.art\/content/i.test(qUrl)) {
                qUrl = (await resolveMoonContent(qUrl)) || '';
            }
            if (!qUrl) continue;
            const s = buildNuvioStream({
                providerName,
                title: `${sourceLabel} (Moon ${qLabel})`,
                url: qUrl,
                quality: qLabel,
                headers: moonHeaders,
                subtitles,
            });
            if (s) streams.push(s);
        }
    } else {
        let finalUrl = rawFile;
        if (/s\.moonanime\.art|moonanime\.art\/content/i.test(finalUrl) && !finalUrl.includes('.m3u8')) {
            finalUrl = (await resolveMoonContent(finalUrl)) || '';
        }
        if (finalUrl) {
            const s = buildNuvioStream({
                providerName,
                title: `${sourceLabel} (Moon)`,
                url: finalUrl,
                quality: '1080p',
                headers: moonHeaders,
                subtitles,
            });
            if (s) streams.push(s);
        }
    }

    return streams;
}

function extractJsObject(html, marker) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) return null;
    const start = html.indexOf('{', markerIndex + marker.length);
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let quote = '';
    let escaped = false;

    for (let i = start; i < html.length; i++) {
        const ch = html[i];
        if (escaped) {
            escaped = false;
        } else if (ch === '\\' && inString) {
            escaped = true;
        } else if (inString && ch === quote) {
            inString = false;
        } else if (!inString && (ch === '"' || ch === "'")) {
            inString = true;
            quote = ch;
        } else if (!inString) {
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) return html.slice(start, i + 1);
            }
        }
    }
    return null;
}

function authorizeFenixUrl(url, mediaAccess) {
    const value = (url || '').trim();
    if (!value) return '';
    const origin = (mediaAccess && mediaAccess.origin || '').trim().replace(/\/+$/, '');
    const token = (mediaAccess && mediaAccess.token || '').trim();
    if (!origin || !token) return value;
    if (!value.startsWith(origin)) return value;
    if (value.includes('token=')) return value;
    return value + (value.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}

/**
 * Extracts streams + subtitles from fenixplay.xyz embed URL.
 */
export async function extractFenix(iframeUrl, sourceLabel, episodeNumber, providerName) {
    const fixedUrl = ensureUrl(iframeUrl);
    if (!fixedUrl) return [];

    const html = await fetchText(fixedUrl, {
        headers: { Referer: 'https://anitube.in.ua/' },
        timeoutMs: 12000,
    });
    if (!html) return [];

    const playlistRaw = extractJsObject(html, 'window.FENIX_PLAYLIST');
    if (!playlistRaw) return [];

    let playlist = null;
    let mediaAccess = null;
    try {
        playlist = JSON.parse(playlistRaw);
    } catch (_) {
        return [];
    }
    const accessRaw = extractJsObject(html, 'window.FENIX_MEDIA_ACCESS');
    if (accessRaw) {
        try { mediaAccess = JSON.parse(accessRaw); } catch (_) {}
    }

    const episodes = [].concat(playlist.episodes || [], playlist.mini_episodes || playlist.miniEpisodes || []);
    if (episodes.length === 0) return [];

    const ep = episodes.find(e => e && e.number != null && Number(e.number) === Number(episodeNumber)) || episodes[0];
    if (!ep) return [];

    const subtitles = distinctSubtitles((ep.subtitles || []).map(sub => {
        const subUrl = authorizeFenixUrl(sub.url, mediaAccess);
        if (!subUrl) return null;
        const name = (sub.label || '').trim() || (sub.language || '').trim() || 'Субтитри';
        const isForced = sub.is_forced === true || sub.isForced === true || String(sub.kind || '').toLowerCase() === 'signs';
        return {
            url: subUrl,
            language: (sub.language || 'uk').toLowerCase(),
            name: markForcedSubtitle(name, isForced),
        };
    }).filter(Boolean));

    const streams = [];
    const seenUrls = new Set();

    const addFenixStream = (rawUrl, label) => {
        const authorized = authorizeFenixUrl(rawUrl, mediaAccess);
        if (!authorized || seenUrls.has(authorized)) return;
        seenUrls.add(authorized);
        const title = label && label !== sourceLabel ? `${sourceLabel} — ${label} (Fenix)` : `${sourceLabel} (Fenix)`;
        const s = buildNuvioStream({
            providerName,
            title,
            url: authorized,
            quality: '1080p',
            headers: { Referer: FENIX_REFERER },
            subtitles,
            type: 'hls',
        });
        if (s) streams.push(s);
    };

    for (const track of (ep.tracks || [])) {
        addFenixStream(track.hls_url || track.hlsUrl, (track.label || '').trim() || sourceLabel);
    }
    addFenixStream(ep.hls_master_url || ep.hlsMasterUrl, sourceLabel);

    return streams;
}

/**
 * Extracts quality streams + subtitles from csst.online / monstro.* embeds.
 */
export async function extractCsst(iframeUrl, sourceLabel, providerName) {
    const fixedUrl = ensureUrl(iframeUrl);
    if (!fixedUrl) return [];

    const html = await fetchText(fixedUrl, {
        headers: { Referer: 'https://anitube.in.ua/' },
        timeoutMs: 12000,
    });
    if (!html) return [];

    const files = extractPlayerJsFiles(html);
    const fileStr = files[files.length - 1] || '';
    if (!fileStr) return [];

    const subtitles = parsePlayerJsSubtitles(extractPlayerJsSubtitleRaw(html));
    const streams = [];

    for (const part of fileStr.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(https?:\/\/.+)$/);
        const quality = bracketMatch ? bracketMatch[1] : 'Auto';
        const url = bracketMatch ? bracketMatch[2].trim() : trimmed;
        if (!/^https?:\/\//i.test(url)) continue;
        const s = buildNuvioStream({
            providerName,
            title: `${sourceLabel} (${quality})`,
            url,
            quality,
            headers: { Referer: fixedUrl },
            subtitles,
        });
        if (s) streams.push(s);
    }

    return streams;
}
