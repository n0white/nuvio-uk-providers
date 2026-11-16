/**
 * Ukrainian/English title cleaning and candidate scoring helpers.
 * Ported from CakesTwix/cloudstream-extensions-uk common/TitleUtils.kt + Nuvio matching guards.
 */

const SEO_PATTERNS = [
    /\s*[-–—/:|]?\s*дивити(?:сь|ся)\s+онлайн(?:\s*(?:[-–—/:|]|українською(?:\s+мовою)?|(?:в|у)\s+(?:hd|full\s*hd|4k|хорошій\s+якості|високій\s+якості|кращій\s+якості|відмінній\s+якості|1080p|720p)|безкоштовно|всі\s+серії|усі\s+серії|онлайн|hd|\([^)]*\)))*\s*$/i,
    /\s*[-–—/:|]\s*українською(?:\s+мовою)?(?:\s+онлайн)?\s*$/i,
    /\s*\((?:українською|укр\.?|озвучка|дубляж)[^)]*\)\s*$/i,
];

const TRAILING_PUNCT_RE = /[\s\-–—/:|]+$/;
const TRAILING_YEAR_RE = /\s*\(((?:19|20)\d{2})\)\s*$/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[a-zA-Z]/;

export function stripSeo(raw) {
    if (!raw) return '';
    let result = String(raw).trim();
    for (const re of SEO_PATTERNS) {
        result = result.replace(re, '');
    }
    return result.replace(TRAILING_PUNCT_RE, '').replace(/\s+/g, ' ').trim();
}

export function stripYear(raw) {
    const clean = stripSeo(raw);
    const m = clean.match(TRAILING_YEAR_RE);
    if (!m) return { title: clean, year: null };
    const year = parseInt(m[1], 10);
    const withoutYear = clean.slice(0, m.index).replace(TRAILING_PUNCT_RE, '').trim();
    return { title: withoutYear, year };
}

export function splitOriginalTitle(raw) {
    const clean = stripSeo(raw);
    const parts = clean.split('/').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { ukTitle: clean, originalTitle: null };

    const cyrillic = parts.filter(p => CYRILLIC_RE.test(p));
    const latin = parts.filter(p => LATIN_RE.test(p) && !CYRILLIC_RE.test(p));

    if (cyrillic.length > 0 && latin.length > 0) {
        return {
            ukTitle: cyrillic.join(' / '),
            originalTitle: latin.join(' / '),
        };
    }
    return { ukTitle: clean, originalTitle: null };
}

export function cleanTitleWithOriginal(raw, shouldStripYear = true) {
    const { title, year } = shouldStripYear ? stripYear(raw) : { title: stripSeo(raw), year: null };
    const { ukTitle, originalTitle } = splitOriginalTitle(title);
    return { title: ukTitle, originalTitle, year };
}

export function normalizeText(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/[\u2018\u2019\u02BC'`"]/g, '') // Ukrainian apostrophes & quotes
        .replace(/[\u00AB\u00BB]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokenize(str) {
    const norm = normalizeText(str);
    if (!norm) return [];
    return norm.split(' ').filter(Boolean);
}

/**
 * Scores a search result candidate against TMDB/Kitsu metadata.
 * Returns a numeric score (>0 is a match, <=0 should be rejected).
 */
export function scoreCandidate(candidateTitle, meta, opts = {}) {
    if (!candidateTitle || !meta) return -1;
    const { year: candidateYear = null, extraTitles = [], season = null, isTv = false } = opts;

    const parsed = cleanTitleWithOriginal(candidateTitle, true);
    const slashParts = String(candidateTitle)
        .split('/')
        .map(p => cleanTitleWithOriginal(p, true).title)
        .filter(Boolean);
    const candidateVariants = [
        parsed.title,
        parsed.originalTitle,
        ...slashParts,
        ...extraTitles,
        candidateTitle,
    ].filter(Boolean);

    const rawTargets = (meta.allTitles && meta.allTitles.length > 0)
        ? meta.allTitles
        : [meta.titleUk, meta.titleEn, meta.titleOriginal].filter(Boolean);
    const targetTitles = [];
    for (const t of rawTargets) {
        if (!t) continue;
        targetTitles.push(t);
        if (t.includes(':')) {
            const prefix = t.split(':')[0].trim();
            if (prefix.length >= 5) targetTitles.push(prefix);
        }
    }

    if (targetTitles.length === 0) return -1;

    // Reject obvious non-matching season markers in title if searching for a specific season > 1
    // or reject "трейлер" / "анонс"
    const lowerRaw = candidateTitle.toLowerCase();
    if (/\b(трейлер|анонс|тізер|trailer)\b/i.test(lowerRaw)) return -1;

    let bestTitleScore = 0;

    for (const target of targetTitles) {
        const normTarget = normalizeText(target);
        if (!normTarget) continue;
        const targetTokens = normTarget.split(' ').filter(Boolean);

        for (const cand of candidateVariants) {
            const normCand = normalizeText(cand);
            if (!normCand) continue;

            // Strip trailing season suffix like "(1 сезон)", "2 сезон", "сезон 2", "season 2" for base comparison
            const normCandBase = normCand
                .replace(/\b(\d+\s*сезон|сезон\s*\d+|season\s*\d+|s\d+)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (normCand === normTarget || normCandBase === normTarget) {
                bestTitleScore = Math.max(bestTitleScore, 100);
                continue;
            }

            const candTokens = (normCandBase || normCand).split(' ').filter(Boolean);
            if (candTokens.length === 0 || targetTokens.length === 0) continue;

            const candSet = new Set(candTokens);
            const targetSet = new Set(targetTokens);

            let overlap = 0;
            for (const t of targetSet) {
                if (candSet.has(t)) overlap++;
            }

            const coverageTarget = overlap / targetSet.size;
            const coverageCand = overlap / candSet.size;

            if (coverageTarget >= 0.65 && coverageCand >= 0.5) {
                const score = Math.round(coverageTarget * 60 + coverageCand * 30);
                bestTitleScore = Math.max(bestTitleScore, score);
            } else if (targetTokens.length === 1 && targetTokens[0].length >= 5 && candSet.has(targetTokens[0])) {
                // Single distinctive keyword (e.g. "Фрірен" from "Фрірен: після кінця пригоди")
                const startsWithTarget = candTokens[0] === targetTokens[0];
                const score = startsWithTarget ? 68 : Math.max(46, 58 - candTokens.length * 2);
                bestTitleScore = Math.max(bestTitleScore, score);
            } else if (targetTokens.length === 1 && candTokens[0] === targetTokens[0] && candTokens.length <= 3) {
                bestTitleScore = Math.max(bestTitleScore, 55);
            }
        }
    }

    if (bestTitleScore < 45) return -1;

    let finalScore = bestTitleScore;

    // Year verification if both are available
    const effectiveYear = candidateYear || parsed.year;
    if (meta.year && effectiveYear) {
        const diff = Math.abs(meta.year - effectiveYear);
        if (diff === 0) finalScore += 25;
        else if (diff === 1) finalScore += 10;
        else if (diff > 2 && !isTv) {
            // Movies with >2 year gap are almost certainly remakes or wrong titles
            return -1;
        } else if (diff > 5 && isTv) {
            finalScore -= 20;
        }
    }

    // Season match boost if page title explicitly names a season (common on uakino/eneyida)
    if (isTv && season != null) {
        const seasonMatch = lowerRaw.match(/(?:(\d+)\s*сезон|сезон\s*(\d+)|season\s*(\d+))/i);
        if (seasonMatch) {
            const pageSeason = parseInt(seasonMatch[1] || seasonMatch[2] || seasonMatch[3], 10);
            if (pageSeason === Number(season)) {
                finalScore += 30;
            } else {
                finalScore -= 35;
            }
        }
    }

    return finalScore;
}

export function pickBestCandidates(items, meta, opts = {}, limit = 3) {
    const scored = [];
    for (const item of items) {
        const s = scoreCandidate(item.title, meta, {
            year: item.year || null,
            extraTitles: item.extraTitles || [],
            season: opts.season,
            isTv: opts.isTv,
        });
        if (s > 0) {
            scored.push({ item, score: s });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.item);
}
