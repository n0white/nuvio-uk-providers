/**
 * HTTP helpers compatible with QuickJS (NuvioMobile / NuvioTV) and Node.js.
 */

export const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const MOBILE_USER_AGENT =
    'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

export const BASE_HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
};

export function ensureUrl(url, baseUrl) {
    if (!url) return '';
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === 'null' || trimmed.startsWith('#') || trimmed.startsWith('javascript:')) {
        return '';
    }
    if (trimmed.startsWith('//')) return 'https:' + trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (!baseUrl) return trimmed;
    const base = baseUrl.replace(/\/+$/, '');
    return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

export function isCloudflareChallenge(html) {
    if (!html || typeof html !== 'string') return false;
    return (
        html.includes('Just a moment...') ||
        html.includes('cf-browser-verification') ||
        html.includes('_cf_chl_opt')
    );
}

export function isTruncatedHtml(html) {
    if (!html || typeof html !== 'string') return false;
    if (html.endsWith('\n...[truncated]')) return true;
    if (html.length >= 700000 && /<html[\s>]/i.test(html) && !/<\/html>/i.test(html)) {
        return true;
    }
    return false;
}

export async function safeFetch(url, options = {}) {
    const { headers = {}, method = 'GET', body, redirect, timeoutMs = 15000 } = options;
    const mergedHeaders = Object.assign({}, BASE_HEADERS, headers);

    try {
        let controller = null;
        let timer = null;
        if (typeof AbortController !== 'undefined' && typeof setTimeout === 'function' && timeoutMs > 0) {
            controller = new AbortController();
            timer = setTimeout(() => {
                try { controller.abort(); } catch (_) {}
            }, timeoutMs);
        }

        const fetchOpts = {
            method,
            headers: mergedHeaders,
        };
        if (body !== undefined) fetchOpts.body = body;
        if (redirect) fetchOpts.redirect = redirect;
        if (controller) fetchOpts.signal = controller.signal;

        const res = await fetch(url, fetchOpts);
        if (timer) clearTimeout(timer);
        return res;
    } catch (err) {
        return null;
    }
}

export async function fetchText(url, options = {}) {
    const res = await safeFetch(url, options);
    if (!res || !res.ok) return null;
    try {
        const text = await res.text();
        if (!text || isTruncatedHtml(text)) return null;
        return text;
    } catch (_) {
        return null;
    }
}

export async function fetchJson(url, options = {}) {
    const res = await safeFetch(url, Object.assign({
        headers: Object.assign({ 'Accept': 'application/json, text/plain, */*' }, options.headers || {}),
    }, options));
    if (!res || !res.ok) return null;
    try {
        const data = await res.json();
        return data;
    } catch (_) {
        return null;
    }
}

export function encodeForm(params) {
    return Object.keys(params)
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] == null ? '' : String(params[k]))}`)
        .join('&');
}

export async function postFormText(url, params, headers = {}, timeoutMs = 15000) {
    const body = typeof params === 'string' ? params : encodeForm(params);
    return fetchText(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, headers),
        body,
        timeoutMs,
    });
}

export function extractDleHash(html) {
    if (!html) return '';
    const match = html.match(/dle_login_hash\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1] : '';
}
