/**
 * PlayerJS / Tortuga / Ashdi / HDVBua utilities for Ukrainian Nuvio providers.
 * Pure JS (no TextDecoder/Buffer dependencies) for QuickJS (NuvioMobile/NuvioTV) + Node.js compatibility.
 */

import { fetchText, ensureUrl } from './http.js';

export function bytesToUtf8(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; ) {
        const b0 = bytes[i++];
        if (b0 < 0x80) {
            out += String.fromCharCode(b0);
        } else if ((b0 & 0xe0) === 0xc0 && i < bytes.length) {
            const b1 = bytes[i++];
            out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
        } else if ((b0 & 0xf0) === 0xe0 && i + 1 < bytes.length) {
            const b1 = bytes[i++];
            const b2 = bytes[i++];
            out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
        } else if ((b0 & 0xf8) === 0xf0 && i + 2 < bytes.length) {
            const b1 = bytes[i++];
            const b2 = bytes[i++];
            const b3 = bytes[i++];
            let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
            cp -= 0x10000;
            out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        }
    }
    return out;
}

export function base64ToBytes(b64) {
    const cleaned = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!cleaned) return new Uint8Array(0);
    const padLen = (4 - (cleaned.length % 4)) % 4;
    const padded = cleaned + '='.repeat(padLen);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i) & 0xff;
    }
    return bytes;
}

/**
 * Decodes Tortuga XOR-obfuscated strings (first byte = salt, key = (salt + 7*i + 13) % 256).
 */
export function decodeTortuga(encoded) {
    if (!encoded) return null;
    const clean = String(encoded).trim().replace(/\s+/g, '').replace(/=+$/, '');
    if (!clean) return null;
    try {
        const bytes = base64ToBytes(clean);
        if (bytes.length < 2) return null;
        const salt = bytes[0];
        const out = new Uint8Array(bytes.length - 1);
        for (let i = 1; i < bytes.length; i++) {
            const key = (salt + 7 * (i - 1) + 13) % 256;
            out[i - 1] = bytes[i] ^ key;
        }
        const text = bytesToUtf8(out);
        if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('[') || text.startsWith('{')) {
            return text;
        }
        return null;
    } catch (_) {
        return null;
    }
}

/**
 * Extracts all `file: "..."` or `file: '...'` values from a script/HTML string.
 */
export function extractPlayerJsFiles(html) {
    if (!html) return [];
    const results = [];
    const re = /file\s*:\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        if (m[2]) results.push(m[2].replace(/\\\//g, '/').trim());
    }
    return results;
}

/**
 * Extracts `subtitle: "..."` value from PlayerJS script/HTML.
 */
export function extractPlayerJsSubtitleRaw(html) {
    if (!html) return '';
    const re = /subtitle\s*:\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
    let last = '';
    let m;
    while ((m = re.exec(html)) !== null) {
        if (m[2] !== undefined) last = m[2].replace(/\\\//g, '/').trim();
    }
    return last;
}

/**
 * Parses PlayerJS subtitle format: `[Full]https://a.vtt,[Forced]https://b.vtt` or bare URL(s).
 */
export function parsePlayerJsSubtitles(raw) {
    const value = (raw || '').trim();
    if (!value) return [];

    const subs = [];
    const seen = new Set();
    const pushSub = (name, url) => {
        const cleanUrl = ensureUrl(url);
        if (!cleanUrl || seen.has(cleanUrl)) return;
        seen.add(cleanUrl);
        subs.push({
            url: cleanUrl,
            language: 'uk',
            name: (name || 'Субтитри').trim(),
        });
    };

    if (value.includes('[')) {
        const re = /\[([^\]]*)\]\s*([^,\[\]]+)/g;
        let m;
        while ((m = re.exec(value)) !== null) {
            pushSub(m[1] || 'Субтитри', m[2].replace(/,+$/, '').trim());
        }
    } else {
        for (const part of value.split(',')) {
            const u = part.trim();
            if (/^https?:\/\//i.test(u) || u.startsWith('//')) {
                pushSub('Субтитри', u);
            }
        }
    }

    return subs;
}

function parseHlsAttributes(raw) {
    const attrs = {};
    let cur = '';
    let inQuotes = false;
    const flush = () => {
        const eq = cur.indexOf('=');
        if (eq > 0) {
            const k = cur.slice(0, eq).trim().toUpperCase();
            const v = cur.slice(eq + 1).trim().replace(/^"|"$/g, '');
            attrs[k] = v;
        }
        cur = '';
    };
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            cur += ch;
        } else if (ch === ',' && !inQuotes) {
            flush();
        } else {
            cur += ch;
        }
    }
    flush();
    return attrs;
}

function resolveRelativeUrl(base, target) {
    const t = (target || '').trim();
    if (!t) return '';
    if (/^https?:\/\//i.test(t)) return t;
    if (t.startsWith('//')) return 'https:' + t;
    const m = String(base || '').match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
    if (!m) return t;
    if (t.startsWith('/')) return m[1] + t;
    const cleanBase = String(base).split('?')[0].split('#')[0];
    const lastSlash = cleanBase.lastIndexOf('/');
    return (lastSlash > 8 ? cleanBase.slice(0, lastSlash + 1) : m[1] + '/') + t;
}

/**
 * Parses `#EXT-X-MEDIA:TYPE=SUBTITLES` entries from an HLS master playlist.
 */
export async function fetchHlsSubtitles(masterUrl, headers = {}) {
    if (!masterUrl || !masterUrl.includes('.m3u8')) return [];
    const text = await fetchText(masterUrl, { headers, timeoutMs: 8000 });
    if (!text) return [];
    const subs = [];
    const seen = new Set();
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!/^#EXT-X-MEDIA:/i.test(line)) continue;
        const attrs = parseHlsAttributes(line.slice(line.indexOf(':') + 1));
        if (String(attrs.TYPE || '').toUpperCase() !== 'SUBTITLES') continue;
        const url = resolveRelativeUrl(masterUrl, attrs.URI);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        let name = attrs.NAME || attrs.LANGUAGE || 'Субтитри';
        const isForced = String(attrs.FORCED || '').toUpperCase() === 'YES';
        if (isForced && !/forced|форс|напис/i.test(name)) {
            name += ' (форсовані)';
        }
        subs.push({
            url,
            language: attrs.LANGUAGE || 'uk',
            name,
        });
    }
    return subs;
}

/**
 * Resolves a raw PlayerJS `file:` value into direct URLs (plain or Tortuga XOR-encoded).
 */
export function resolvePlayerJsUrls(rawFile) {
    const value = (rawFile || '').trim();
    if (!value) return [];

    const directMatches = value.match(/https?:\/\/[^\s,"'\]]+/g) || [];
    const mediaDirect = directMatches.filter(u =>
        /\.m3u8|\.mp4|\/vod\//i.test(u)
    );
    if (mediaDirect.length > 0) return Array.from(new Set(mediaDirect));

    const decoded = decodeTortuga(value);
    if (decoded) {
        const decodedMatches = decoded.match(/https?:\/\/[^\s,"'\]]+/g) || [];
        if (decodedMatches.length > 0) return Array.from(new Set(decodedMatches));
        if (/^https?:\/\//i.test(decoded)) return [decoded];
    }

    if (/^https?:\/\//i.test(value)) return [value];
    return [];
}

/**
 * Builds a clean Nuvio stream object.
 */
export function buildNuvioStream({
    providerName,
    name,
    title,
    url,
    quality = 'Auto',
    language = 'uk',
    headers = {},
    subtitles = [],
    type,
}) {
    const cleanUrl = ensureUrl(url);
    if (!cleanUrl || cleanUrl.includes('[object')) return null;

    const detectedType = type || (/\.m3u8(\?|$)/i.test(cleanUrl) || cleanUrl.includes('/hls/') ? 'hls' : 'mp4');
    const cleanQuality = String(quality || '').match(/\b(2160p|4k|1080p|800p|720p|480p|360p)\b/i)?.[1] || quality || 'Auto';
    const displayName = (name || title || providerName || 'Stream').trim();

    const stream = {
        name: displayName,
        title: title || displayName,
        provider: providerName,
        url: cleanUrl,
        quality: cleanQuality,
        language: language || 'uk',
        type: detectedType,
    };

    if (headers && Object.keys(headers).length > 0) {
        stream.headers = headers;
    }
    if (Array.isArray(subtitles) && subtitles.length > 0) {
        stream.subtitles = subtitles;
    }
    return stream;
}

export function dedupeStreams(streams) {
    const seen = new Set();
    const out = [];
    for (const s of streams) {
        if (!s || !s.url) continue;
        const key = `${s.url}|${s.title || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(s);
    }
    return out;
}

/**
 * Decodes Tortuga XOR or Base64+reverse obfuscated strings.
 */
export function decodeAndReverse(encoded) {
    if (!encoded) return '';
    const trimmed = String(encoded).trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
        return trimmed;
    }
    const tortuga = decodeTortuga(trimmed);
    if (tortuga) return tortuga;
    try {
        const bytes = base64ToBytes(trimmed.replace(/=+$/, ''));
        const text = bytesToUtf8(bytes);
        return text.split('').reverse().join('');
    } catch (_) {
        return '';
    }
}

/**
 * Extracts `file: '...'` or `file: "..."` handling embedded quotes safely.
 */
export function extractFileValue(html) {
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

/**
 * Parses Tortuga episode `file` string: `{DubName}https://...m3u8(subtitle:[Lang]url)`
 * May contain multiple `;`-separated tracks.
 */
export function parseTortugaFileTracks(rawFile, fallbackLabel = 'Озвучення') {
    const tracks = [];
    for (const rawPart of String(rawFile || '').split(';')) {
        const part = rawPart.trim();
        if (!part) continue;

        const subTailMatch = part.match(/\(subtitle:(.*)\)$/i);
        const cleanPart = subTailMatch ? part.slice(0, subTailMatch.index).trim() : part;
        const inlineSub = subTailMatch && subTailMatch[1] ? subTailMatch[1].trim() : '';

        const braceStart = cleanPart.indexOf('{');
        const braceEnd = cleanPart.indexOf('}');
        const source = (braceStart >= 0 && braceEnd > braceStart)
            ? cleanPart.slice(braceStart + 1, braceEnd).trim()
            : fallbackLabel;
        const streamUrl = (braceEnd >= 0 ? cleanPart.slice(braceEnd + 1) : cleanPart).trim();

        if (/^https?:\/\//i.test(streamUrl)) {
            tracks.push({ source: source || fallbackLabel, url: streamUrl, inlineSub });
        }
    }
    return tracks;
}

/**
 * Helper to create a properly formatted Ukrainian Nuvio stream card.
 */
export function formatEpisodeTag(isTv, season, episode) {
    if (!isTv) return '';
    const s = parseInt(season, 10);
    const e = parseInt(episode, 10);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return '';
    return `S${s}E${e}`;
}

function truncateLabel(str, maxLen = 36) {
    const clean = String(str || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length > maxLen ? clean.slice(0, maxLen - 1).trimEnd() + '…' : clean;
}

export function makeUkStream({
    providerName,
    dubTitle,
    url,
    rawSub = '',
    subs = null,
    referer = '',
    quality = '1080p',
    headers = {},
    episodeTag = '',
    siteTitle = '',
    isSub: isSubOverride = null,
}) {
    const baseName = (dubTitle || providerName || 'Stream').trim();
    const displayName = episodeTag ? `${episodeTag} • ${baseName}` : baseName;
    const parsedSubs = Array.isArray(subs) ? subs : parsePlayerJsSubtitles(rawSub);
    const isSub = isSubOverride !== null ? isSubOverride : /субтитр|\bsub\b/i.test(baseName);
    const modeLabel = isSub
        ? 'Субтитри'
        : (parsedSubs.length > 0 ? 'Озвучення (+суб)' : 'Озвучення');
    const shortSite = truncateLabel(siteTitle);
    const langLabel = shortSite ? `${modeLabel} • ${shortSite} • uk` : `${modeLabel} • uk`;
    const mergedHeaders = Object.assign({}, referer ? { Referer: referer } : {}, headers);

    return buildNuvioStream({
        providerName,
        name: displayName,
        title: displayName,
        url,
        quality,
        language: langLabel,
        headers: mergedHeaders,
        subtitles: parsedSubs,
    });
}
