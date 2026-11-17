/**
 * animeon - Nuvio UK Provider (from cloudstream-extensions-uk)
 * Generated: 2026-11-17T00:13:51.468Z
 */
var __provider = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/utils/http.js
  function ensureUrl(url, baseUrl) {
    if (!url) return "";
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === "null" || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
      return "";
    }
    if (trimmed.startsWith("//")) return "https:" + trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (!baseUrl) return trimmed;
    const base = baseUrl.replace(/\/+$/, "");
    return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`;
  }
  function isTruncatedHtml(html) {
    if (!html || typeof html !== "string") return false;
    if (html.endsWith("\n...[truncated]")) return true;
    if (html.length >= 7e5 && /<html[\s>]/i.test(html) && !/<\/html>/i.test(html)) {
      return true;
    }
    return false;
  }
  function safeFetch(_0) {
    return __async(this, arguments, function* (url, options = {}) {
      const { headers = {}, method = "GET", body, redirect, timeoutMs = 15e3 } = options;
      const mergedHeaders = Object.assign({}, BASE_HEADERS, headers);
      try {
        let controller = null;
        let timer = null;
        if (typeof AbortController !== "undefined" && typeof setTimeout === "function" && timeoutMs > 0) {
          controller = new AbortController();
          timer = setTimeout(() => {
            try {
              controller.abort();
            } catch (_) {
            }
          }, timeoutMs);
        }
        const fetchOpts = {
          method,
          headers: mergedHeaders
        };
        if (body !== void 0) fetchOpts.body = body;
        if (redirect) fetchOpts.redirect = redirect;
        if (controller) fetchOpts.signal = controller.signal;
        const res = yield fetch(url, fetchOpts);
        if (timer) clearTimeout(timer);
        return res;
      } catch (err) {
        return null;
      }
    });
  }
  function fetchText(_0) {
    return __async(this, arguments, function* (url, options = {}) {
      const res = yield safeFetch(url, options);
      if (!res || !res.ok) return null;
      try {
        const text = yield res.text();
        if (!text || isTruncatedHtml(text)) return null;
        return text;
      } catch (_) {
        return null;
      }
    });
  }
  function fetchJson(_0) {
    return __async(this, arguments, function* (url, options = {}) {
      const res = yield safeFetch(url, Object.assign({
        headers: Object.assign({ "Accept": "application/json, text/plain, */*" }, options.headers || {})
      }, options));
      if (!res || !res.ok) return null;
      try {
        const data = yield res.json();
        return data;
      } catch (_) {
        return null;
      }
    });
  }
  var USER_AGENT, BASE_HEADERS;
  var init_http = __esm({
    "src/utils/http.js"() {
      USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
      BASE_HEADERS = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7"
      };
    }
  });

  // src/utils/metadata.js
  function getTmdbApiKey() {
    if (typeof globalThis !== "undefined" && globalThis.TMDB_API_KEY) {
      return globalThis.TMDB_API_KEY;
    }
    return DEFAULT_TMDB_API_KEY;
  }
  function isTvMediaType(mediaType) {
    return String(mediaType || "").toLowerCase() !== "movie";
  }
  function parseKitsuId(id) {
    return String(id || "").match(/^kitsu:(\d+)(?::(\d+))?$/i);
  }
  function parseTrackerId(id) {
    const m = String(id || "").match(/^(mal|anilist|anidb|tvdb):(\d+)(?::(\d+))?$/i);
    if (!m) return null;
    return {
      tracker: m[1].toLowerCase(),
      externalId: m[2],
      absEpisode: m[3] ? parseInt(m[3], 10) : null
    };
  }
  function resolveImdbToTmdb(imdbId, mediaType) {
    return __async(this, null, function* () {
      const apiKey = getTmdbApiKey();
      const url = `${TMDB_API_BASE}/find/${encodeURIComponent(imdbId)}?api_key=${apiKey}&external_source=imdb_id&language=uk-UA`;
      const data = yield fetchJson(url, { timeoutMs: 8e3 });
      if (!data) return null;
      const isMovie = !isTvMediaType(mediaType);
      const list = (isMovie ? data.movie_results : data.tv_results) || data.movie_results || data.tv_results || [];
      return list[0] && list[0].id ? String(list[0].id) : null;
    });
  }
  function searchTmdbByTitle(title, mediaType) {
    return __async(this, null, function* () {
      if (!title) return null;
      const apiKey = getTmdbApiKey();
      const type = isTvMediaType(mediaType) ? "tv" : "movie";
      const url = `${TMDB_API_BASE}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(title)}`;
      const data = yield fetchJson(url, { timeoutMs: 8e3 });
      const results = data && data.results;
      return results && results.length > 0 ? String(results[0].id) : null;
    });
  }
  function aniListMedia(tracker) {
    return __async(this, null, function* () {
      if (!tracker || tracker.tracker !== "anilist" && tracker.tracker !== "mal") return null;
      const isAniList = tracker.tracker === "anilist";
      const query = isAniList ? "query($id: Int){Media(id: $id, type: ANIME){idMal title{romaji english native}}}" : "query($idMal: Int){Media(idMal: $idMal, type: ANIME){idMal title{romaji english native}}}";
      const variables = isAniList ? { id: Number(tracker.externalId) } : { idMal: Number(tracker.externalId) };
      if (!Number.isFinite(variables.id !== void 0 ? variables.id : variables.idMal)) return null;
      const data = yield fetchJson("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "User-Agent": "Nuvio-UK-Providers/1.0",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ query, variables }),
        timeoutMs: 6e3
      });
      return data && data.data && data.data.Media ? data.data.Media : null;
    });
  }
  function resolveKitsuMeta(kitsuId, mediaType) {
    return __async(this, null, function* () {
      const data = yield fetchJson(`https://kitsu.io/api/edge/anime/${kitsuId}`, { timeoutMs: 8e3 });
      const attrs = data && data.data && data.data.attributes;
      if (!attrs) return null;
      const candidates = [
        attrs.titles && attrs.titles.en,
        attrs.canonicalTitle,
        attrs.titles && attrs.titles.en_jp
      ].map((t) => (t || "").trim()).filter(Boolean);
      for (const candidate of candidates) {
        const tmdbId = yield searchTmdbByTitle(candidate, mediaType);
        if (tmdbId) {
          const meta = yield fetchTmdbById(tmdbId, mediaType);
          if (meta) return meta;
        }
      }
      const year = attrs.startDate && /^\d{4}/.test(attrs.startDate) ? parseInt(attrs.startDate.slice(0, 4), 10) : null;
      return {
        tmdbId: null,
        mediaType: isTvMediaType(mediaType) ? "tv" : "movie",
        titleUk: "",
        titleEn: candidates[0] || "",
        titleOriginal: attrs.titles && attrs.titles.en_jp || candidates[0] || "",
        year,
        isAnime: true,
        originalLanguage: attrs.originalLanguage || "ja",
        seasonEpisodeCounts: {},
        queries: candidates,
        allTitles: candidates
      };
    });
  }
  function fetchTmdbById(tmdbId, mediaType) {
    return __async(this, null, function* () {
      const apiKey = getTmdbApiKey();
      const type = isTvMediaType(mediaType) ? "tv" : "movie";
      const ukUrl = `${TMDB_API_BASE}/${type}/${tmdbId}?api_key=${apiKey}&language=uk-UA`;
      const enUrl = `${TMDB_API_BASE}/${type}/${tmdbId}?api_key=${apiKey}&language=en-US`;
      const transUrl = `${TMDB_API_BASE}/${type}/${tmdbId}/translations?api_key=${apiKey}`;
      const [ukData, enData] = yield Promise.all([
        fetchJson(ukUrl, { timeoutMs: 8e3 }),
        fetchJson(enUrl, { timeoutMs: 8e3 })
      ]);
      const base = ukData || enData;
      if (!base) return null;
      let titleUk = (ukData && (ukData.title || ukData.name) || "").trim();
      const titleEn = (enData && (enData.title || enData.name) || "").trim();
      const titleOriginal = (base.original_title || base.original_name || "").trim();
      const originalLanguage = base.original_language || "";
      if (!titleUk || titleUk === titleEn && !/[\u0400-\u04FF]/.test(titleUk)) {
        const transData = yield fetchJson(transUrl, { timeoutMs: 6e3 });
        const translations = transData && transData.translations || [];
        const ukTrans = translations.find((t) => t.iso_639_1 === "uk");
        const transTitle = ukTrans && ukTrans.data && (ukTrans.data.title || ukTrans.data.name || "").trim();
        if (transTitle) {
          titleUk = transTitle;
        }
      }
      const dateStr = type === "movie" ? base.release_date : base.first_air_date;
      const year = dateStr && /^\d{4}/.test(dateStr) ? parseInt(dateStr.slice(0, 4), 10) : null;
      const isAnime = originalLanguage === "ja" || (base.genres || []).some((g) => g.id === 16) && (originalLanguage === "ja" || originalLanguage === "zh" || originalLanguage === "ko");
      const seasonEpisodeCounts = {};
      if (type === "tv" && Array.isArray(base.seasons)) {
        for (const s of base.seasons) {
          if (s && s.season_number > 0 && s.episode_count > 0) {
            seasonEpisodeCounts[s.season_number] = s.episode_count;
          }
        }
      }
      const allTitles = [];
      const pushUnique = (val) => {
        const clean = (val || "").trim();
        if (!clean) return;
        if (!allTitles.some((t) => t.toLowerCase() === clean.toLowerCase())) {
          allTitles.push(clean);
        }
      };
      pushUnique(titleUk);
      pushUnique(titleEn);
      if (/^[\x00-\x7F\u00C0-\u024F\u0400-\u04FF\s\-,:!.'?&()0-9]+$/.test(titleOriginal)) {
        pushUnique(titleOriginal);
      }
      const queries = [];
      const pushQuery = (q) => {
        const clean = (q || "").trim();
        if (!clean) return;
        if (!queries.some((x) => x.toLowerCase() === clean.toLowerCase())) {
          queries.push(clean);
        }
      };
      pushQuery(titleUk);
      if (titleUk && titleUk.includes(":")) pushQuery(titleUk.split(":")[0]);
      pushQuery(titleEn);
      if (titleEn && titleEn.includes(":")) pushQuery(titleEn.split(":")[0]);
      pushQuery(titleOriginal);
      return {
        tmdbId: String(tmdbId),
        mediaType: type,
        titleUk,
        titleEn,
        titleOriginal,
        year,
        isAnime,
        originalLanguage,
        seasonEpisodeCounts,
        queries,
        allTitles
      };
    });
  }
  function getMediaMeta(id, mediaType, season) {
    return __async(this, null, function* () {
      const raw = (id == null ? "" : String(id).trim()).replace(/^tmdb[:/]/i, "").replace(/^(?:movie|series)[:/]/i, "");
      if (!raw) return null;
      const kitsuMatch = parseKitsuId(raw);
      if (kitsuMatch) {
        const meta = yield resolveKitsuMeta(kitsuMatch[1], mediaType);
        if (meta && season == null && kitsuMatch[2]) {
          meta.effectiveSeason = parseInt(kitsuMatch[2], 10);
        }
        return meta;
      }
      const tracker = parseTrackerId(raw);
      if (tracker) {
        const media = yield aniListMedia(tracker);
        if (!media || !media.title) return null;
        const candidates = [media.title.english, media.title.romaji, media.title.native].map((t) => (t || "").trim()).filter(Boolean);
        for (const candidate of candidates) {
          const tmdbId2 = yield searchTmdbByTitle(candidate, mediaType);
          if (tmdbId2) {
            const meta = yield fetchTmdbById(tmdbId2, mediaType);
            if (meta) {
              for (const c of candidates) {
                if (!meta.allTitles.some((t) => t.toLowerCase() === c.toLowerCase())) {
                  meta.allTitles.push(c);
                }
              }
              return meta;
            }
          }
        }
        return {
          tmdbId: null,
          mediaType: isTvMediaType(mediaType) ? "tv" : "movie",
          titleUk: "",
          titleEn: candidates[0] || "",
          titleOriginal: media.title.romaji || candidates[0] || "",
          year: null,
          isAnime: true,
          originalLanguage: "ja",
          seasonEpisodeCounts: {},
          queries: candidates,
          allTitles: candidates
        };
      }
      let tmdbId = raw;
      if (!/^\d+$/.test(raw)) {
        const imdbId = /^tt\d+$/i.test(raw) ? raw : /^imdb:(tt\d+)$/i.test(raw) ? raw.slice(5) : null;
        if (!imdbId) return null;
        tmdbId = yield resolveImdbToTmdb(imdbId, mediaType);
        if (!tmdbId) return null;
      }
      return fetchTmdbById(tmdbId, mediaType);
    });
  }
  var DEFAULT_TMDB_API_KEY, TMDB_API_BASE;
  var init_metadata = __esm({
    "src/utils/metadata.js"() {
      init_http();
      DEFAULT_TMDB_API_KEY = "8265bd1679663a7ea12ac168da84d2e8";
      TMDB_API_BASE = "https://api.themoviedb.org/3";
    }
  });

  // src/utils/matching.js
  function stripSeo(raw) {
    if (!raw) return "";
    let result = String(raw).trim();
    for (const re of SEO_PATTERNS) {
      result = result.replace(re, "");
    }
    return result.replace(TRAILING_PUNCT_RE, "").replace(/\s+/g, " ").trim();
  }
  function stripYear(raw) {
    const clean = stripSeo(raw);
    const m = clean.match(TRAILING_YEAR_RE);
    if (!m) return { title: clean, year: null };
    const year = parseInt(m[1], 10);
    const withoutYear = clean.slice(0, m.index).replace(TRAILING_PUNCT_RE, "").trim();
    return { title: withoutYear, year };
  }
  function splitOriginalTitle(raw) {
    const clean = stripSeo(raw);
    const parts = clean.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { ukTitle: clean, originalTitle: null };
    const cyrillic = parts.filter((p) => CYRILLIC_RE.test(p));
    const latin = parts.filter((p) => LATIN_RE.test(p) && !CYRILLIC_RE.test(p));
    if (cyrillic.length > 0 && latin.length > 0) {
      return {
        ukTitle: cyrillic.join(" / "),
        originalTitle: latin.join(" / ")
      };
    }
    return { ukTitle: clean, originalTitle: null };
  }
  function cleanTitleWithOriginal(raw, shouldStripYear = true) {
    const { title, year } = shouldStripYear ? stripYear(raw) : { title: stripSeo(raw), year: null };
    const { ukTitle, originalTitle } = splitOriginalTitle(title);
    return { title: ukTitle, originalTitle, year };
  }
  function normalizeText(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/[\u2018\u2019\u02BC'`"]/g, "").replace(/[\u00AB\u00BB]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }
  function scoreCandidate(candidateTitle, meta, opts = {}) {
    if (!candidateTitle || !meta) return -1;
    const { year: candidateYear = null, extraTitles = [], season = null, isTv = false } = opts;
    const parsed = cleanTitleWithOriginal(candidateTitle, true);
    const slashParts = String(candidateTitle).split("/").map((p) => cleanTitleWithOriginal(p, true).title).filter(Boolean);
    const candidateVariants = [
      parsed.title,
      parsed.originalTitle,
      ...slashParts,
      ...extraTitles,
      candidateTitle
    ].filter(Boolean);
    const rawTargets = meta.allTitles && meta.allTitles.length > 0 ? meta.allTitles : [meta.titleUk, meta.titleEn, meta.titleOriginal].filter(Boolean);
    const targetTitles = [];
    for (const t of rawTargets) {
      if (!t) continue;
      targetTitles.push(t);
      if (t.includes(":")) {
        const prefix = t.split(":")[0].trim();
        if (prefix.length >= 5) targetTitles.push(prefix);
      }
    }
    if (targetTitles.length === 0) return -1;
    const lowerRaw = candidateTitle.toLowerCase();
    if (/\b(трейлер|анонс|тізер|trailer)\b/i.test(lowerRaw)) return -1;
    let bestTitleScore = 0;
    for (const target of targetTitles) {
      const normTarget = normalizeText(target);
      if (!normTarget) continue;
      const targetTokens = normTarget.split(" ").filter(Boolean);
      for (const cand of candidateVariants) {
        const normCand = normalizeText(cand);
        if (!normCand) continue;
        const normCandBase = normCand.replace(/\b(\d+\s*сезон|сезон\s*\d+|season\s*\d+|s\d+)\b/gi, "").replace(/\s+/g, " ").trim();
        if (normCand === normTarget || normCandBase === normTarget) {
          bestTitleScore = Math.max(bestTitleScore, 100);
          continue;
        }
        const candTokens = (normCandBase || normCand).split(" ").filter(Boolean);
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
    const effectiveYear = candidateYear || parsed.year;
    if (meta.year && effectiveYear) {
      const diff = Math.abs(meta.year - effectiveYear);
      if (diff === 0) finalScore += 25;
      else if (diff === 1) finalScore += 10;
      else if (diff > 2 && !isTv) {
        return -1;
      } else if (diff > 5 && isTv) {
        finalScore -= 20;
      }
    }
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
  function pickBestCandidates(items, meta, opts = {}, limit = 3) {
    const scored = [];
    for (const item of items) {
      const s = scoreCandidate(item.title, meta, {
        year: item.year || null,
        extraTitles: item.extraTitles || [],
        season: opts.season,
        isTv: opts.isTv
      });
      if (s > 0) {
        scored.push({ item, score: s });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.item);
  }
  var SEO_PATTERNS, TRAILING_PUNCT_RE, TRAILING_YEAR_RE, CYRILLIC_RE, LATIN_RE;
  var init_matching = __esm({
    "src/utils/matching.js"() {
      SEO_PATTERNS = [
        /\s*[-–—/:|]?\s*дивити(?:сь|ся)\s+онлайн(?:\s*(?:[-–—/:|]|українською(?:\s+мовою)?|(?:в|у)\s+(?:hd|full\s*hd|4k|хорошій\s+якості|високій\s+якості|кращій\s+якості|відмінній\s+якості|1080p|720p)|безкоштовно|всі\s+серії|усі\s+серії|онлайн|hd|\([^)]*\)))*\s*$/i,
        /\s*[-–—/:|]\s*українською(?:\s+мовою)?(?:\s+онлайн)?\s*$/i,
        /\s*\((?:українською|укр\.?|озвучка|дубляж)[^)]*\)\s*$/i
      ];
      TRAILING_PUNCT_RE = /[\s\-–—/:|]+$/;
      TRAILING_YEAR_RE = /\s*\(((?:19|20)\d{2})\)\s*$/;
      CYRILLIC_RE = /[\u0400-\u04FF]/;
      LATIN_RE = /[a-zA-Z]/;
    }
  });

  // src/utils/playerjs.js
  function bytesToUtf8(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; ) {
      const b0 = bytes[i++];
      if (b0 < 128) {
        out += String.fromCharCode(b0);
      } else if ((b0 & 224) === 192 && i < bytes.length) {
        const b1 = bytes[i++];
        out += String.fromCharCode((b0 & 31) << 6 | b1 & 63);
      } else if ((b0 & 240) === 224 && i + 1 < bytes.length) {
        const b1 = bytes[i++];
        const b2 = bytes[i++];
        out += String.fromCharCode((b0 & 15) << 12 | (b1 & 63) << 6 | b2 & 63);
      } else if ((b0 & 248) === 240 && i + 2 < bytes.length) {
        const b1 = bytes[i++];
        const b2 = bytes[i++];
        const b3 = bytes[i++];
        let cp = (b0 & 7) << 18 | (b1 & 63) << 12 | (b2 & 63) << 6 | b3 & 63;
        cp -= 65536;
        out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
      }
    }
    return out;
  }
  function base64ToBytes(b64) {
    const cleaned = String(b64 || "").replace(/[^A-Za-z0-9+/=]/g, "");
    if (!cleaned) return new Uint8Array(0);
    const padLen = (4 - cleaned.length % 4) % 4;
    const padded = cleaned + "=".repeat(padLen);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i) & 255;
    }
    return bytes;
  }
  function extractPlayerJsFiles(html) {
    if (!html) return [];
    const results = [];
    const re = /file\s*:\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[2]) results.push(m[2].replace(/\\\//g, "/").trim());
    }
    return results;
  }
  function extractPlayerJsSubtitleRaw(html) {
    if (!html) return "";
    const re = /subtitle\s*:\s*(['"])((?:\\.|(?!\1).)*?)\1/g;
    let last = "";
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[2] !== void 0) last = m[2].replace(/\\\//g, "/").trim();
    }
    return last;
  }
  function parsePlayerJsSubtitles(raw) {
    const value = (raw || "").trim();
    if (!value) return [];
    const subs = [];
    const seen = /* @__PURE__ */ new Set();
    const pushSub = (name, url) => {
      const cleanUrl = ensureUrl(url);
      if (!cleanUrl || seen.has(cleanUrl)) return;
      seen.add(cleanUrl);
      subs.push({
        url: cleanUrl,
        language: "uk",
        name: (name || "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438").trim()
      });
    };
    if (value.includes("[")) {
      const re = /\[([^\]]*)\]\s*([^,\[\]]+)/g;
      let m;
      while ((m = re.exec(value)) !== null) {
        pushSub(m[1] || "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438", m[2].replace(/,+$/, "").trim());
      }
    } else {
      for (const part of value.split(",")) {
        const u = part.trim();
        if (/^https?:\/\//i.test(u) || u.startsWith("//")) {
          pushSub("\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438", u);
        }
      }
    }
    return subs;
  }
  function parseHlsAttributes(raw) {
    const attrs = {};
    let cur = "";
    let inQuotes = false;
    const flush = () => {
      const eq = cur.indexOf("=");
      if (eq > 0) {
        const k = cur.slice(0, eq).trim().toUpperCase();
        const v = cur.slice(eq + 1).trim().replace(/^"|"$/g, "");
        attrs[k] = v;
      }
      cur = "";
    };
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        cur += ch;
      } else if (ch === "," && !inQuotes) {
        flush();
      } else {
        cur += ch;
      }
    }
    flush();
    return attrs;
  }
  function resolveRelativeUrl(base, target) {
    const t = (target || "").trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    if (t.startsWith("//")) return "https:" + t;
    const m = String(base || "").match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
    if (!m) return t;
    if (t.startsWith("/")) return m[1] + t;
    const cleanBase = String(base).split("?")[0].split("#")[0];
    const lastSlash = cleanBase.lastIndexOf("/");
    return (lastSlash > 8 ? cleanBase.slice(0, lastSlash + 1) : m[1] + "/") + t;
  }
  function fetchHlsSubtitles(_0) {
    return __async(this, arguments, function* (masterUrl, headers = {}) {
      if (!masterUrl || !masterUrl.includes(".m3u8")) return [];
      const text = yield fetchText(masterUrl, { headers, timeoutMs: 8e3 });
      if (!text) return [];
      const subs = [];
      const seen = /* @__PURE__ */ new Set();
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!/^#EXT-X-MEDIA:/i.test(line)) continue;
        const attrs = parseHlsAttributes(line.slice(line.indexOf(":") + 1));
        if (String(attrs.TYPE || "").toUpperCase() !== "SUBTITLES") continue;
        const url = resolveRelativeUrl(masterUrl, attrs.URI);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        let name = attrs.NAME || attrs.LANGUAGE || "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438";
        const isForced = String(attrs.FORCED || "").toUpperCase() === "YES";
        if (isForced && !/forced|форс|напис/i.test(name)) {
          name += " (\u0444\u043E\u0440\u0441\u043E\u0432\u0430\u043D\u0456)";
        }
        subs.push({
          url,
          language: attrs.LANGUAGE || "uk",
          name
        });
      }
      return subs;
    });
  }
  function buildNuvioStream({
    providerName,
    name,
    title,
    url,
    quality = "Auto",
    language = "uk",
    headers = {},
    subtitles = [],
    type
  }) {
    var _a;
    const cleanUrl = ensureUrl(url);
    if (!cleanUrl || cleanUrl.includes("[object")) return null;
    const detectedType = type || (/\.m3u8(\?|$)/i.test(cleanUrl) || cleanUrl.includes("/hls/") ? "hls" : "mp4");
    const cleanQuality = ((_a = String(quality || "").match(/\b(2160p|4k|1080p|800p|720p|480p|360p)\b/i)) == null ? void 0 : _a[1]) || quality || "Auto";
    const displayName = (name || title || providerName || "Stream").trim();
    const stream = {
      name: displayName,
      title: title || displayName,
      provider: providerName,
      url: cleanUrl,
      quality: cleanQuality,
      language: language || "uk",
      type: detectedType
    };
    if (headers && Object.keys(headers).length > 0) {
      stream.headers = headers;
    }
    if (Array.isArray(subtitles) && subtitles.length > 0) {
      stream.subtitles = subtitles;
    }
    return stream;
  }
  function dedupeStreams(streams) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const s of streams) {
      if (!s || !s.url) continue;
      const key = `${s.url}|${s.title || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }
  function makeUkStream({ providerName, dubTitle, url, rawSub = "", subs = null, referer = "", quality = "1080p", headers = {} }) {
    const title = (dubTitle || providerName || "Stream").trim();
    const parsedSubs = Array.isArray(subs) ? subs : parsePlayerJsSubtitles(rawSub);
    const isSub = /субтитр|\bsub\b/i.test(title);
    const langLabel = isSub ? "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 \u2022 uk" : parsedSubs.length > 0 ? "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (+\u0441\u0443\u0431) \u2022 uk" : "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F \u2022 uk";
    const mergedHeaders = Object.assign({}, referer ? { Referer: referer } : {}, headers);
    return buildNuvioStream({
      providerName,
      name: title,
      title,
      url,
      quality,
      language: langLabel,
      headers: mergedHeaders,
      subtitles: parsedSubs
    });
  }
  var init_playerjs = __esm({
    "src/utils/playerjs.js"() {
      init_http();
    }
  });

  // src/utils/anime-extractors.js
  function distinctSubtitles(subs) {
    const seen = /* @__PURE__ */ new Set();
    return (subs || []).filter((s) => {
      if (!s || !s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  }
  function markForcedSubtitle(label, isForced) {
    if (!isForced) return label;
    if (/forced|форс|напис/i.test(label)) return label;
    return `${label} (\u0444\u043E\u0440\u0441\u043E\u0432\u0430\u043D\u0456)`;
  }
  function buildLanguageLabel(isDub, subtitles) {
    const hasSubs = Array.isArray(subtitles) && subtitles.length > 0;
    if (isDub === false) return "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 \u2022 uk";
    return hasSubs ? "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (+\u0441\u0443\u0431) \u2022 uk" : "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F \u2022 uk";
  }
  function extractAshdi(iframeUrl, sourceLabel, providerName, refererOverride, isDub = true) {
    return __async(this, null, function* () {
      const fixedUrl = ensureUrl(iframeUrl).replace("/embed/", "/vod/");
      if (!fixedUrl) return [];
      const html = yield fetchText(fixedUrl, {
        headers: { Referer: "https://anitube.in.ua/" },
        timeoutMs: 12e3
      });
      if (!html) return [];
      const files = extractPlayerJsFiles(html);
      const fileUrl = files[files.length - 1] || "";
      if (!fileUrl) return [];
      const subRaw = extractPlayerJsSubtitleRaw(html);
      let subtitles = parsePlayerJsSubtitles(subRaw);
      const playReferer = refererOverride || ASHDI_REFERER;
      if (subtitles.length === 0 && fileUrl.includes(".m3u8")) {
        subtitles = yield fetchHlsSubtitles(fileUrl, { Referer: playReferer });
      }
      const cleanSubs = distinctSubtitles(subtitles);
      const stream = buildNuvioStream({
        providerName,
        name: sourceLabel,
        title: sourceLabel,
        url: fileUrl,
        quality: "1080p",
        language: buildLanguageLabel(isDub, cleanSubs),
        headers: { Referer: playReferer },
        subtitles: cleanSubs,
        type: "hls"
      });
      return stream ? [stream] : [];
    });
  }
  function moonOuterDecode(base64Blob) {
    try {
      const raw = base64ToBytes(base64Blob);
      if (raw.length < 33) return "";
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
        state = d + k & 255;
      }
      return chars.join("");
    } catch (_) {
      return "";
    }
  }
  function moonDecrypt(encoded, key = "mAnK") {
    try {
      const decoded = base64ToBytes(String(encoded || "").replace(/\s+/g, ""));
      const out = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        out[i] = decoded[i] ^ key.charCodeAt(i % key.length);
      }
      return bytesToUtf8(out);
    } catch (_) {
      return "";
    }
  }
  function extractMoonSubtitles(decodedValues) {
    const subs = [];
    for (const val of decodedValues) {
      if (!/^https?:\/\//i.test(val)) continue;
      if (!/\.(vtt|srt|ass)(\?|$)/i.test(val)) continue;
      if (/thumbnail|sprite|preview|storyboard/i.test(val)) continue;
      const fileName = val.split("?")[0].split("/").pop() || "";
      const langMatch = fileName.match(/[_-]([a-z]{2})\.(vtt|srt|ass)$/i);
      const isForced = /forced|signs|napisy/i.test(val);
      subs.push({
        url: val,
        language: langMatch ? langMatch[1].toLowerCase() : "uk",
        name: markForcedSubtitle(langMatch && langMatch[1] || "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438", isForced)
      });
    }
    return distinctSubtitles(subs);
  }
  function resolveMoonContent(contentUrl) {
    return __async(this, null, function* () {
      try {
        const cookieRes = yield safeFetch(MOON_REFERER, {
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          timeoutMs: 8e3
        });
        const setCookie = cookieRes && cookieRes.headers ? cookieRes.headers.get("set-cookie") : "";
        const headers = {
          Referer: MOON_REFERER,
          Origin: "https://moonanime.art",
          Accept: "*/*"
        };
        if (setCookie) {
          headers.Cookie = setCookie.split(",").map((c) => c.split(";")[0].trim()).join("; ");
        }
        const res = yield safeFetch(contentUrl, {
          headers,
          redirect: "manual",
          timeoutMs: 8e3
        });
        if (!res) return null;
        const loc = res.headers && res.headers.get("location");
        if (loc) return ensureUrl(loc, MOON_REFERER);
        const body = ((yield res.text()) || "").trim();
        return /^https?:\/\//i.test(body) ? body : null;
      } catch (_) {
        return null;
      }
    });
  }
  function extractMoon(iframeUrl, sourceLabel, providerName, isDub = true) {
    return __async(this, null, function* () {
      const cleanUrl = ensureUrl(iframeUrl).replace(/[?&]player=[^&]*/g, "").replace("?&", "?").replace(/[?&]$/, "");
      if (!cleanUrl) return [];
      const html = yield fetchText(cleanUrl, {
        headers: { Referer: "https://anitube.in.ua/" },
        timeoutMs: 12e3
      });
      let rawFile = "";
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
                const isMedia = /\.(m3u8|mp4|webm)/i.test(val) || val.startsWith("[");
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
                const resolved = yield resolveMoonContent(contentMatch[1]);
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
            const resolved = yield resolveMoonContent(`https://s.moonanime.art/content/v/${hashMatch[1]}/${q}/`);
            if (resolved) qualityParts.push(`[${q}p]${resolved}`);
          }
          if (qualityParts.length > 0) rawFile = qualityParts.join(",");
        }
      }
      if (!rawFile) return [];
      const moonHeaders = {
        Referer: MOON_REFERER,
        Origin: "https://moonanime.art"
      };
      const streams = [];
      if (rawFile.startsWith("[")) {
        const re = /\[(\d+p)\](https?:\/\/[^\s,]+)/g;
        let m;
        while ((m = re.exec(rawFile)) !== null) {
          const qLabel = m[1];
          let qUrl = m[2];
          if (/s\.moonanime\.art|moonanime\.art\/content/i.test(qUrl)) {
            qUrl = (yield resolveMoonContent(qUrl)) || "";
          }
          if (!qUrl) continue;
          const s = buildNuvioStream({
            providerName,
            name: sourceLabel,
            title: sourceLabel,
            url: qUrl,
            quality: qLabel,
            language: buildLanguageLabel(isDub, subtitles),
            headers: moonHeaders,
            subtitles
          });
          if (s) streams.push(s);
        }
      } else {
        let finalUrl = rawFile;
        if (/s\.moonanime\.art|moonanime\.art\/content/i.test(finalUrl) && !finalUrl.includes(".m3u8")) {
          finalUrl = (yield resolveMoonContent(finalUrl)) || "";
        }
        if (finalUrl) {
          const s = buildNuvioStream({
            providerName,
            name: sourceLabel,
            title: sourceLabel,
            url: finalUrl,
            quality: "1080p",
            language: buildLanguageLabel(isDub, subtitles),
            headers: moonHeaders,
            subtitles
          });
          if (s) streams.push(s);
        }
      }
      return streams;
    });
  }
  function extractJsObject(html, marker) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex < 0) return null;
    const start = html.indexOf("{", markerIndex + marker.length);
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let quote = "";
    let escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (escaped) {
        escaped = false;
      } else if (ch === "\\" && inString) {
        escaped = true;
      } else if (inString && ch === quote) {
        inString = false;
      } else if (!inString && (ch === '"' || ch === "'")) {
        inString = true;
        quote = ch;
      } else if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) return html.slice(start, i + 1);
        }
      }
    }
    return null;
  }
  function authorizeFenixUrl(url, mediaAccess) {
    const value = (url || "").trim();
    if (!value) return "";
    const origin = (mediaAccess && mediaAccess.origin || "").trim().replace(/\/+$/, "");
    const token = (mediaAccess && mediaAccess.token || "").trim();
    if (!origin || !token) return value;
    if (!value.startsWith(origin)) return value;
    if (value.includes("token=")) return value;
    return value + (value.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
  }
  function extractFenix(iframeUrl, sourceLabel, episodeNumber, providerName, isDub = true) {
    return __async(this, null, function* () {
      const fixedUrl = ensureUrl(iframeUrl);
      if (!fixedUrl) return [];
      const html = yield fetchText(fixedUrl, {
        headers: { Referer: "https://anitube.in.ua/" },
        timeoutMs: 12e3
      });
      if (!html) return [];
      const playlistRaw = extractJsObject(html, "window.FENIX_PLAYLIST");
      if (!playlistRaw) return [];
      let playlist = null;
      let mediaAccess = null;
      try {
        playlist = JSON.parse(playlistRaw);
      } catch (_) {
        return [];
      }
      const accessRaw = extractJsObject(html, "window.FENIX_MEDIA_ACCESS");
      if (accessRaw) {
        try {
          mediaAccess = JSON.parse(accessRaw);
        } catch (_) {
        }
      }
      const episodes = [].concat(playlist.episodes || [], playlist.mini_episodes || playlist.miniEpisodes || []);
      if (episodes.length === 0) return [];
      const ep = episodes.find((e) => e && e.number != null && Number(e.number) === Number(episodeNumber)) || episodes[0];
      if (!ep) return [];
      const subtitles = distinctSubtitles((ep.subtitles || []).map((sub) => {
        const subUrl = authorizeFenixUrl(sub.url, mediaAccess);
        if (!subUrl) return null;
        const name = (sub.label || "").trim() || (sub.language || "").trim() || "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438";
        const isForced = sub.is_forced === true || sub.isForced === true || String(sub.kind || "").toLowerCase() === "signs";
        return {
          url: subUrl,
          language: (sub.language || "uk").toLowerCase(),
          name: markForcedSubtitle(name, isForced)
        };
      }).filter(Boolean));
      const streams = [];
      const seenUrls = /* @__PURE__ */ new Set();
      const addFenixStream = (rawUrl, label) => {
        const authorized = authorizeFenixUrl(rawUrl, mediaAccess);
        if (!authorized || seenUrls.has(authorized)) return;
        seenUrls.add(authorized);
        const title = label && label !== sourceLabel ? `${sourceLabel} \u2014 ${label}` : sourceLabel;
        const s = buildNuvioStream({
          providerName,
          name: title,
          title,
          url: authorized,
          quality: "1080p",
          language: buildLanguageLabel(isDub, subtitles),
          headers: { Referer: FENIX_REFERER },
          subtitles,
          type: "hls"
        });
        if (s) streams.push(s);
      };
      for (const track of ep.tracks || []) {
        addFenixStream(track.hls_url || track.hlsUrl, (track.label || "").trim() || sourceLabel);
      }
      addFenixStream(ep.hls_master_url || ep.hlsMasterUrl, sourceLabel);
      return streams;
    });
  }
  var MOON_REFERER, FENIX_REFERER, ASHDI_REFERER;
  var init_anime_extractors = __esm({
    "src/utils/anime-extractors.js"() {
      init_http();
      init_playerjs();
      MOON_REFERER = "https://moonanime.art/";
      FENIX_REFERER = "https://fenixplay.xyz/";
      ASHDI_REFERER = "https://ashdi.vip/";
    }
  });

  // src/animeon/index.js
  var require_index = __commonJS({
    "src/animeon/index.js"(exports, module) {
      init_http();
      init_metadata();
      init_matching();
      init_playerjs();
      init_anime_extractors();
      var MAIN_URL = "https://animeon.club";
      var PROVIDER_NAME = "AnimeON";
      function resolveAnimeOnUrl(rawUrl, label, isDub, episodeNum) {
        return __async(this, null, function* () {
          const url = ensureUrl(rawUrl, MAIN_URL);
          if (!url) return [];
          if (url.includes("ashdi.vip")) {
            return extractAshdi(url, label, PROVIDER_NAME, "https://ashdi.vip/", isDub);
          }
          if (url.includes("moonanime")) {
            return extractMoon(url, label, PROVIDER_NAME, isDub);
          }
          if (url.includes("fenixplay")) {
            return extractFenix(url, label, episodeNum || 1, PROVIDER_NAME, isDub);
          }
          if (/\.m3u8|\.mp4/i.test(url)) {
            const s = makeUkStream({
              providerName: PROVIDER_NAME,
              dubTitle: label,
              url,
              referer: `${MAIN_URL}/`
            });
            return s ? [s] : [];
          }
          return [];
        });
      }
      function getStreams(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          const start = Date.now();
          try {
            const isTv = isTvMediaType(mediaType);
            const meta = yield getMediaMeta(tmdbId, mediaType, season);
            if (!meta || !meta.queries || meta.queries.length === 0) return [];
            const effSeason = season != null ? parseInt(season, 10) : meta.effectiveSeason || 1;
            const effEpisode = episode != null ? parseInt(episode, 10) : 1;
            const searchQueries = [];
            const addQ = (q) => {
              const clean = (q || "").trim();
              if (clean && !searchQueries.some((x) => x.toLowerCase() === clean.toLowerCase())) searchQueries.push(clean);
            };
            if (isTv && effSeason > 1 && meta.titleUk) addQ(`${meta.titleUk} ${effSeason} \u0441\u0435\u0437\u043E\u043D`);
            for (const q of meta.queries) addQ(q);
            const allFound = [];
            const seenIds = /* @__PURE__ */ new Set();
            for (const query of searchQueries.slice(0, 4)) {
              if (Date.now() - start > 2e4) break;
              const res = yield fetchJson(`${MAIN_URL}/api/anime?search=${encodeURIComponent(query)}`, { timeoutMs: 1e4 });
              const list = res && res.results || [];
              for (const item of list) {
                if (!item || !item.id || seenIds.has(item.id)) continue;
                seenIds.add(item.id);
                const title = (item.titleUa || item.titleEn || "").trim();
                const extra = [item.titleEn, item.titleOriginal].filter(Boolean);
                const ym = String(item.releaseDate || item.year || "").match(/\d{4}/);
                allFound.push({
                  id: item.id,
                  title,
                  extraTitles: extra,
                  year: ym ? parseInt(ym[0], 10) : null
                });
              }
              if (pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1).length > 0) break;
            }
            const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
            for (const candidate of candidates) {
              if (Date.now() - start > 42e3) break;
              const trRes = yield fetchJson(`${MAIN_URL}/api/player/${candidate.id}/translations`, { timeoutMs: 1e4 });
              const translations = trRes && trRes.translations || [];
              if (translations.length === 0) continue;
              const tasks = [];
              for (const entry of translations) {
                const tr = entry && entry.translation;
                if (!tr || !tr.id) continue;
                const isDub = !tr.isSub && !/субтитр/i.test(tr.name || "");
                for (const pl of entry.player || []) {
                  if (!pl || !pl.id) continue;
                  const label = `${tr.name || PROVIDER_NAME} (${pl.name || "Player"})`;
                  tasks.push({ trId: tr.id, plId: pl.id, label, isDub, episodesCount: pl.episodesCount || 0 });
                }
              }
              const limitedTasks = tasks.slice(0, 8);
              const streamArrays = yield Promise.all(limitedTasks.map((t) => __async(this, null, function* () {
                let videoUrl = "";
                if (isTv || t.episodesCount > 0) {
                  const epListUrl = `${MAIN_URL}/api/player/${candidate.id}/episodes?take=1000&skip=0&playerId=${t.plId}&translationId=${t.trId}&includeAlternative=true`;
                  const epRes = yield fetchJson(epListUrl, { timeoutMs: 1e4 });
                  const episodes = epRes && epRes.episodes || [];
                  const target = episodes.find((e) => Number(e.episode) === effEpisode || Number(e.sourceEpisode) === effEpisode) || (!isTv ? episodes[0] : null);
                  if (target && target.id) {
                    const epDetail = yield fetchJson(`${MAIN_URL}/api/player/${target.id}/episode`, { timeoutMs: 1e4 });
                    videoUrl = epDetail && (epDetail.videoUrl || epDetail.fileUrl) || "";
                  }
                }
                if (!videoUrl && (!isTv || t.episodesCount === 0)) {
                  const direct = yield fetchJson(`${MAIN_URL}/api/player/${t.plId}/${t.trId}`, { timeoutMs: 1e4 });
                  videoUrl = direct && (direct.videoUrl || direct.fileUrl) || "";
                }
                if (!videoUrl) return [];
                return resolveAnimeOnUrl(videoUrl, t.label, t.isDub, effEpisode);
              })));
              const streams = dedupeStreams(streamArrays.flat());
              if (streams.length > 0) return streams;
            }
            return [];
          } catch (err) {
            console.error("[AnimeON] Error:", err && err.message ? err.message : err);
            return [];
          }
        });
      }
      module.exports = { getStreams };
    }
  });
  return require_index();
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = __provider;
}
if (__provider && __provider.getStreams) {
    if (typeof globalThis !== "undefined") globalThis.getStreams = __provider.getStreams;
    if (typeof global !== "undefined") global.getStreams = __provider.getStreams;
    if (typeof self !== "undefined") self.getStreams = __provider.getStreams;
}
