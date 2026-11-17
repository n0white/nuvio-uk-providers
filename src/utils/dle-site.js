/**
 * Shared search + PlayerJS/Tortuga runner for Ukrainian DLE sites
 * (KinoVezha, Serialno, KinoTron, KlonTV, AnimeUA).
 */

const cheerio = require('cheerio');
import { fetchText, postFormText, ensureUrl } from './http.js';
import { getMediaMeta, isTvMediaType } from './metadata.js';
import { pickBestCandidates, scoreCandidate, stripSeo } from './matching.js';
import {
    decodeAndReverse,
    extractFileValue,
    extractPlayerJsSubtitleRaw,
    parseTortugaFileTracks,
    formatEpisodeTag,
    makeUkStream,
    dedupeStreams,
} from './playerjs.js';

function extractFirstInt(str) {
    const m = String(str || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
}

export async function runDleSiteProvider(config, tmdbId, mediaType, season, episode) {
    const start = Date.now();
    const {
        providerName,
        mainUrl,
        searchUrl,
        cardSelector,
        getCard,
        getDetail,
        useDecodeAndReverse = false,
        playerFormat = 'dub-season-ep', // or 'season-ep'
        playReferer = 'https://tortuga.wtf/',
    } = config;

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
            const html = await postFormText(
                searchUrl || mainUrl,
                { do: 'search', subaction: 'search', story: query },
                { Referer: `${mainUrl}/` },
                12000
            );
            if (!html) continue;

            const $ = cheerio.load(html);
            $(cardSelector).each((_, el) => {
                const card = getCard($, $(el));
                if (!card || !card.title || !card.href) return;
                const href = ensureUrl(card.href, mainUrl);
                if (!href || seenUrls.has(href)) return;
                seenUrls.add(href);
                allFound.push({
                    title: stripSeo(card.title),
                    href,
                    year: card.year || null,
                    extraTitles: card.extraTitles || [],
                });
            });

            if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) {
                break;
            }
        }

        if (allFound.length === 0) return [];

        const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
        for (const candidate of candidates) {
            if (Date.now() - start > 45000) break;

            const html = await fetchText(candidate.href, { headers: { Referer: `${mainUrl}/` }, timeoutMs: 12000 });
            if (!html) continue;

            const $ = cheerio.load(html);
            const detail = getDetail($, candidate);
            const pageTitle = stripSeo(detail.title || candidate.title);
            const score = scoreCandidate(pageTitle, meta, {
                year: detail.year || candidate.year,
                extraTitles: detail.extraTitles || candidate.extraTitles || [],
                season: effSeason,
                isTv,
            });
            if (score <= 0) continue;

            const playerUrl = ensureUrl((detail.playerUrl || '').replace('?multivoice', ''), mainUrl);
            if (!playerUrl || /youtube\.com|youtu\.be/i.test(playerUrl)) continue;

            const playerHtml = await fetchText(playerUrl, {
                headers: { Referer: `${mainUrl}/` },
                timeoutMs: 12000,
            });
            if (!playerHtml) continue;

            const rawFile = extractFileValue(playerHtml);
            if (!rawFile) continue;

            const decoded = useDecodeAndReverse ? decodeAndReverse(rawFile) : rawFile;
            if (!decoded) continue;

            const episodeTag = formatEpisodeTag(isTv, effSeason, effEpisode);
            const streams = [];
            if (!decoded.startsWith('[')) {
                if (!isTv && /^https?:\/\//i.test(decoded)) {
                    const rawSub = extractPlayerJsSubtitleRaw(playerHtml);
                    const s = makeUkStream({
                        providerName,
                        dubTitle: `Озвучення (${providerName})`,
                        url: decoded,
                        rawSub,
                        referer: playReferer,
                        episodeTag,
                        siteTitle: pageTitle,
                    });
                    if (s) streams.push(s);
                }
            } else {
                let parsed = null;
                try { parsed = JSON.parse(decoded); } catch (_) {}
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const first = parsed[0];
                    const firstSub = first && Array.isArray(first.folder) ? first.folder[0] : null;
                    const hasThreeLevels = !!(firstSub && Array.isArray(firstSub.folder));
                    const effectiveFormat = hasThreeLevels ? 'dub-season-ep' : playerFormat;

                    if (effectiveFormat === 'season-ep') {
                        parsed.forEach((sItem, sIdx) => {
                            const sNum = parseInt(sItem.season, 10) || extractFirstInt(sItem.title) || (sIdx + 1);
                            if (isTv && sNum !== effSeason) return;
                            (sItem.folder || []).forEach((epItem, eIdx) => {
                                const eNum = parseInt(epItem.number, 10) || extractFirstInt(epItem.title) || (eIdx + 1);
                                if (isTv && eNum !== effEpisode) return;
                                for (const track of parseTortugaFileTracks(epItem.file, providerName)) {
                                    const s = makeUkStream({
                                        providerName,
                                        dubTitle: track.source,
                                        url: track.url,
                                        rawSub: epItem.subtitle || track.inlineSub || '',
                                        referer: playReferer,
                                        episodeTag,
                                        siteTitle: pageTitle,
                                    });
                                    if (s) streams.push(s);
                                }
                            });
                        });
                    } else {
                        for (const dub of parsed) {
                            const dubTitle = (dub && dub.title) || providerName;
                            if (dub && dub.file && !dub.folder) {
                                if (!isTv) {
                                    const s = makeUkStream({
                                        providerName,
                                        dubTitle,
                                        url: dub.file,
                                        rawSub: dub.subtitle || '',
                                        referer: playReferer,
                                        episodeTag,
                                        siteTitle: pageTitle,
                                    });
                                    if (s) streams.push(s);
                                }
                                continue;
                            }
                            for (const sItem of (dub && dub.folder) || []) {
                                const sNum = parseInt(sItem.season, 10) || extractFirstInt(sItem.title);
                                if (isTv && sNum !== effSeason) continue;
                                for (const epItem of (sItem.folder || [])) {
                                    const eNum = parseInt(epItem.number, 10) || extractFirstInt(epItem.title);
                                    if (isTv && eNum !== effEpisode) continue;
                                    for (const track of parseTortugaFileTracks(epItem.file, dubTitle)) {
                                        const s = makeUkStream({
                                            providerName,
                                            dubTitle: track.source && track.source !== providerName && track.source !== 'Озвучення' ? track.source : dubTitle,
                                            url: track.url,
                                            rawSub: epItem.subtitle || track.inlineSub || '',
                                            referer: playReferer,
                                            episodeTag,
                                            siteTitle: pageTitle,
                                        });
                                        if (s) streams.push(s);
                                    }
                                    if (!isTv) break;
                                }
                                if (!isTv) break;
                            }
                        }
                    }
                }
            }

            const deduped = dedupeStreams(streams);
            if (deduped.length > 0) return deduped;
        }

        return [];
    } catch (err) {
        console.error(`[${providerName}] Error:`, err && err.message ? err.message : err);
        return [];
    }
}
