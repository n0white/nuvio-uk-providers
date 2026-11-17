/**
 * Doramy.world provider for Nuvio
 * Ported from CakesTwix/cloudstream-extensions-uk (DoramyWorldProvider)
 */

const cheerio = require('cheerio');
import { fetchText, ensureUrl } from '../utils/http.js';
import { getMediaMeta, isTvMediaType } from '../utils/metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from '../utils/matching.js';
import { makeUkStream, dedupeStreams } from '../utils/playerjs.js';

const MAIN_URL = 'https://doramy.world';
const PROVIDER_NAME = 'DoramyWorld';
const ASHDI_REFERER = 'https://ashdi.vip/';

function extractInt(str) {
    const m = String(str || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
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
        const seen = new Set();

        for (const query of meta.queries.slice(0, 3)) {
            if (Date.now() - start > 25000) break;
            const html = await fetchText(
                `${MAIN_URL}/?s=${encodeURIComponent(query)}`,
                { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 }
            );
            if (!html) continue;

            const $ = cheerio.load(html);
            $('article.type-dorama, article.type-film, article.type-show').each((_, el) => {
                const $a = $(el).find('h3.post-title a').first();
                const href = ensureUrl($a.attr('href'), MAIN_URL);
                const lines = $a.text().split(/\r?\n|\//).map(s => stripSeo(s.trim())).filter(Boolean);
                const title = lines[0] || '';
                if (!href || !title || seen.has(href)) return;
                seen.add(href);
                allFound.push({ title, href, extraTitles: lines.slice(1) });
            });
            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
        }

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;
            const html = await fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
            if (!html) continue;

            const $ = cheerio.load(html);
            const rawTitle = $('h1.project-title').first().text();
            const titleParts = rawTitle.split('/').map(p => p.trim()).filter(Boolean);
            const pageTitle = titleParts[0] || candidate.title;
            const extra = titleParts.slice(1);

            let pageYear = null;
            $('li.item').each((_, el) => {
                const t = $(el).text();
                if (t.includes('Рік')) {
                    const ym = t.match(/\b(19\d{2}|20\d{2})\b/);
                    if (ym) pageYear = parseInt(ym[1], 10);
                }
            });

            if (scoreCandidate(pageTitle, meta, { year: pageYear, extraTitles: extra, season: effSeason, isTv }) <= 0) {
                continue;
            }

            const iframe = ensureUrl($('iframe[src*=ashdi]').first().attr('src'), MAIN_URL);
            if (!iframe) continue;

            const ashdiHtml = await fetchText(iframe, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12000 });
            if (!ashdiHtml) continue;

            if (!isTv || iframe.includes('/vod/')) {
                const m = ashdiHtml.match(/(https?:\/\/[^'"]+\.m3u8[^'"]*)/);
                if (m && m[1]) {
                    const s = makeUkStream({
                        providerName: PROVIDER_NAME,
                        dubTitle: `Озвучення (${PROVIDER_NAME})`,
                        url: m[1],
                        referer: ASHDI_REFERER,
                    });
                    if (s) return [s];
                }
                continue;
            }

            const jsonMatch = ashdiHtml.match(/file:'(\[[\s\S]*?\])'/);
            if (!jsonMatch || !jsonMatch[1]) continue;

            let groups = null;
            try { groups = JSON.parse(jsonMatch[1]); } catch (_) { continue; }
            if (!Array.isArray(groups)) continue;

            const streams = [];
            for (const group of groups) {
                const groupTitle = (group && group.title) || PROVIDER_NAME;
                const seasons = group.folder || [];
                const targetSeasonObj = seasons[effSeason - 1] || seasons[0];
                if (!targetSeasonObj) continue;

                const episodes = targetSeasonObj.folder || [targetSeasonObj];
                for (const ep of episodes) {
                    const eNum = extractInt(ep.title);
                    if (eNum === effEpisode && ep.file) {
                        const s = makeUkStream({
                            providerName: PROVIDER_NAME,
                            dubTitle: groupTitle,
                            url: ep.file,
                            referer: ASHDI_REFERER,
                        });
                        if (s) streams.push(s);
                    }
                }
            }

            const deduped = dedupeStreams(streams);
            if (deduped.length > 0) return deduped;
        }

        return [];
    } catch (err) {
        console.error('[DoramyWorld] Error:', err && err.message ? err.message : err);
        return [];
    }
}

module.exports = { getStreams };
