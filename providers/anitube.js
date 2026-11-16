/**
 * anitube - Nuvio UK Provider (from cloudstream-extensions-uk)
 * Generated: 2026-11-16T23:40:33.963Z
 */
var __provider = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
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
  function encodeForm(params) {
    return Object.keys(params).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k] == null ? "" : String(params[k]))}`).join("&");
  }
  function postFormText(_0, _1) {
    return __async(this, arguments, function* (url, params, headers = {}, timeoutMs = 15e3) {
      const body = typeof params === "string" ? params : encodeForm(params);
      return fetchText(url, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }, headers),
        body,
        timeoutMs
      });
    });
  }
  function extractDleHash(html) {
    if (!html) return "";
    const match = html.match(/dle_login_hash\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1] : "";
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
  function decodeTortuga(encoded) {
    if (!encoded) return null;
    const clean = String(encoded).trim().replace(/\s+/g, "").replace(/=+$/, "");
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
      if (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("[") || text.startsWith("{")) {
        return text;
      }
      return null;
    } catch (_) {
      return null;
    }
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
  function resolvePlayerJsUrls(rawFile) {
    const value = (rawFile || "").trim();
    if (!value) return [];
    const directMatches = value.match(/https?:\/\/[^\s,"'\]]+/g) || [];
    const mediaDirect = directMatches.filter(
      (u) => /\.m3u8|\.mp4|\/vod\//i.test(u)
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
  function extractCsst(iframeUrl, sourceLabel, providerName, isDub = true) {
    return __async(this, null, function* () {
      const fixedUrl = ensureUrl(iframeUrl);
      if (!fixedUrl) return [];
      const html = yield fetchText(fixedUrl, {
        headers: { Referer: "https://anitube.in.ua/" },
        timeoutMs: 12e3
      });
      if (!html) return [];
      const files = extractPlayerJsFiles(html);
      const fileStr = files[files.length - 1] || "";
      if (!fileStr) return [];
      const subtitles = parsePlayerJsSubtitles(extractPlayerJsSubtitleRaw(html));
      const streams = [];
      for (const part of fileStr.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*(https?:\/\/.+)$/);
        const quality = bracketMatch ? bracketMatch[1] : "Auto";
        const url = bracketMatch ? bracketMatch[2].trim() : trimmed;
        if (!/^https?:\/\//i.test(url)) continue;
        const s = buildNuvioStream({
          providerName,
          name: sourceLabel,
          title: sourceLabel,
          url,
          quality,
          language: buildLanguageLabel(isDub, subtitles),
          headers: { Referer: fixedUrl },
          subtitles
        });
        if (s) streams.push(s);
      }
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

  // src/anitube/index.js
  var require_index = __commonJS({
    "src/anitube/index.js"(exports, module) {
      init_http();
      init_metadata();
      init_matching();
      init_playerjs();
      init_anime_extractors();
      var cheerio = __require("cheerio");
      var MAIN_URL = "https://anitube.in.ua";
      var PROVIDER_NAME = "AniTube";
      var ANITUBE_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
        "Referer": `${MAIN_URL}/`
      };
      function extractTrailingInt(str) {
        if (!str) return null;
        const matches = String(str).match(/\d+/g);
        if (!matches || matches.length === 0) return null;
        const raw = matches[matches.length - 1];
        const num = parseInt(raw, 10);
        return Number.isFinite(num) ? num : null;
      }
      function unescapeUnicode(input) {
        return String(input || "").replace(
          /\\u([0-9a-fA-F]{4})/g,
          (_, hex) => String.fromCharCode(parseInt(hex, 16))
        );
      }
      function searchAnitube(query) {
        return __async(this, null, function* () {
          const html = yield postFormText(
            `${MAIN_URL}/`,
            {
              do: "search",
              subaction: "search",
              story: query
            },
            ANITUBE_HEADERS,
            12e3
          );
          if (!html) return [];
          const $ = cheerio.load(html);
          const items = [];
          const seen = /* @__PURE__ */ new Set();
          $("article.story, .story").each((_, el) => {
            const $el = $(el);
            const $link = $el.find(".story_c h2 a, div.text_content a").first();
            const title = $link.text().trim();
            const href = ensureUrl($link.attr("href"), MAIN_URL);
            if (!title || !href || seen.has(href)) return;
            seen.add(href);
            const cardText = $el.text();
            const yearMatch = cardText.match(/\b(19\d{2}|20\d{2})\b/);
            const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
            items.push({ title, href, year });
          });
          return items;
        });
      }
      function parsePlaylistsHtml(rawHtml) {
        const $ = cheerio.load(rawHtml);
        const lists = $(".playlists-lists .playlists-items");
        const categoriesMap = {};
        const studiosMap = {};
        const playersMap = {};
        if (lists.length > 0) {
          lists.eq(0).find("li").each((_, el) => {
            const id = $(el).attr("data-id");
            if (id) categoriesMap[id.trim()] = $(el).text().trim();
          });
        }
        if (lists.length > 1) {
          lists.eq(1).find("li").each((_, el) => {
            const id = $(el).attr("data-id");
            if (id) studiosMap[id.trim()] = $(el).text().trim();
          });
        }
        if (lists.length > 2) {
          lists.eq(2).find("li").each((_, el) => {
            const id = $(el).attr("data-id");
            if (id) playersMap[id.trim()] = $(el).text().trim();
          });
        }
        const items = [];
        $(".playlists-videos .playlists-items li").each((_, el) => {
          const $el = $(el);
          const videoDataId = ($el.attr("data-id") || "").trim();
          const epText = $el.text().trim();
          const epNum = extractTrailingInt(epText);
          const fileUrl = ($el.attr("data-file") || "").trim();
          if (!fileUrl) return;
          const segments = videoDataId.split("_");
          const catId = segments.slice(0, 2).join("_");
          const studioId = segments.slice(0, 3).join("_");
          const categoryName = categoriesMap[catId] || "\u041E\u0417\u0412\u0423\u0427\u0415\u041D\u041D\u042F";
          const isDub = !/субтитри/i.test(categoryName);
          const studioName = studiosMap[studioId] || categoryName;
          const playerName = playersMap[videoDataId] || "\u041F\u043B\u0435\u0454\u0440";
          items.push({
            episodeNum: epNum,
            episodeName: epText,
            url: fileUrl,
            isDub,
            studioName,
            playerName
          });
        });
        return items;
      }
      function parseRalodePlayer(html) {
        const marker = "RalodePlayer.init(";
        const idx = html.indexOf(marker);
        if (idx < 0) return [];
        const afterInit = html.slice(idx + marker.length);
        const endIdx = afterInit.indexOf(");");
        const rawArgs = endIdx >= 0 ? afterInit.slice(0, endIdx) : afterInit;
        const splitIdx = rawArgs.indexOf("],");
        if (splitIdx < 0) return [];
        const namesPart = rawArgs.slice(0, splitIdx + 1).trim();
        const rest = rawArgs.slice(splitIdx + 2).trim();
        const lastComma = rest.lastIndexOf(",");
        const episodesPart = (lastComma >= 0 ? rest.slice(0, lastComma) : rest).trim();
        let playerNames = [];
        try {
          playerNames = JSON.parse(unescapeUnicode(namesPart));
        } catch (_) {
          playerNames = namesPart.replace(/^\[|\]$/g, "").split('","').map((s) => unescapeUnicode(s.replace(/^"|"$/g, "")));
        }
        let jsonEpisodes = [];
        try {
          jsonEpisodes = JSON.parse(episodesPart);
        } catch (_) {
          return [];
        }
        const items = [];
        jsonEpisodes.forEach((group, pIdx) => {
          const playerName = playerNames[pIdx] || "\u041F\u043B\u0435\u0454\u0440";
          let latestNum = 0;
          for (const ep of group || []) {
            const epName = (ep && ep.name || "").trim();
            if (!epName || epName === "\u041F\u041B\u0415\u0419\u041B\u0418\u0421\u0422") continue;
            let epNum = extractTrailingInt(epName);
            if (epNum == null) epNum = latestNum + 1;
            latestNum = epNum;
            const iframeMatch = String(ep.code || "").match(/<iframe[^>]+src=["']([^"']+)["']/i);
            const url = iframeMatch ? iframeMatch[1].trim() : "";
            if (!url) continue;
            items.push({
              episodeNum: epNum,
              episodeName: epName,
              url,
              isDub: !/субтитр/i.test(playerName),
              studioName: playerName,
              playerName
            });
          }
        });
        return items;
      }
      function cleanPlayerName(raw) {
        const cleaned = String(raw || "").replace(/^\s*плеєр\s+/i, "").trim();
        if (!cleaned) return "\u041F\u043B\u0435\u0454\u0440";
        if (/^(ashdi|ahdi)$/i.test(cleaned)) return "Ashdi";
        if (/^moon$/i.test(cleaned)) return "Moon";
        if (/^fenix$/i.test(cleaned)) return "Fenix";
        if (/^trg$/i.test(cleaned)) return "Tortuga";
        return cleaned;
      }
      function formatItemLabel(item) {
        const player = cleanPlayerName(item.playerName);
        const studio = String(item.studioName || "").trim();
        const isGenericStudio = !studio || /^(озвучення|субтитри)$/i.test(studio);
        if (!isGenericStudio && studio.toLowerCase() !== player.toLowerCase()) {
          return `${studio} (${player})`;
        }
        return item.isDub ? `\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (${player})` : `\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 (${player})`;
      }
      function resolveItemStreams(item) {
        return __async(this, null, function* () {
          const rawUrl = ensureUrl(item.url, MAIN_URL);
          if (!rawUrl || rawUrl.includes("video.ufdub")) return [];
          const label = formatItemLabel(item);
          const langLabel = item.isDub ? "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F \u2022 uk" : "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 \u2022 uk";
          if (rawUrl.includes("ashdi.vip")) {
            return extractAshdi(rawUrl, label, PROVIDER_NAME, "https://qeruya.cyou/", item.isDub);
          }
          if (rawUrl.includes("moonanime")) {
            return extractMoon(rawUrl, label, PROVIDER_NAME, item.isDub);
          }
          if (rawUrl.includes("fenixplay")) {
            return extractFenix(rawUrl, label, item.episodeNum, PROVIDER_NAME, item.isDub);
          }
          if (rawUrl.includes("csst.online/embed/") || rawUrl.includes("monstro.site/embed/") || rawUrl.includes("monstro.online/embed/")) {
            return extractCsst(rawUrl, label, PROVIDER_NAME, item.isDub);
          }
          if (rawUrl.includes("udrop.com")) {
            const s = buildNuvioStream({
              providerName: PROVIDER_NAME,
              name: label,
              title: label,
              url: rawUrl,
              quality: "Auto",
              language: langLabel
            });
            return s ? [s] : [];
          }
          if (/tortuga\.(wtf|tw)|hdvbua\.pro/i.test(rawUrl)) {
            const html = yield fetchText(rawUrl, { headers: ANITUBE_HEADERS, timeoutMs: 12e3 });
            if (!html) return [];
            const urls = [];
            for (const rf of extractPlayerJsFiles(html)) {
              for (const u of resolvePlayerJsUrls(rf)) {
                if (!urls.includes(u)) urls.push(u);
              }
            }
            const subs = parsePlayerJsSubtitles(extractPlayerJsSubtitleRaw(html));
            const finalLang = !item.isDub ? "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 \u2022 uk" : subs.length > 0 ? "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (+\u0441\u0443\u0431) \u2022 uk" : "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F \u2022 uk";
            return urls.map((u) => buildNuvioStream({
              providerName: PROVIDER_NAME,
              name: label,
              title: label,
              url: u,
              quality: "1080p",
              language: finalLang,
              headers: { Referer: rawUrl },
              subtitles: subs
            })).filter(Boolean);
          }
          return [];
        });
      }
      function computeAbsoluteEpisode(meta, season, episode) {
        const s = parseInt(season, 10);
        const e = parseInt(episode, 10);
        if (!Number.isFinite(s) || !Number.isFinite(e) || s <= 1) return e;
        const counts = meta && meta.seasonEpisodeCounts || {};
        let total = 0;
        for (let i = 1; i < s; i++) {
          if (!counts[i]) return null;
          total += counts[i];
        }
        return total + e;
      }
      function extractFromPage(candidate, meta, isTv, season, episode) {
        return __async(this, null, function* () {
          const html = yield fetchText(candidate.href, { headers: ANITUBE_HEADERS, timeoutMs: 12e3 });
          if (!html) return [];
          const $ = cheerio.load(html);
          const pageTitle = $(".story_c h2").first().text().trim() || candidate.title;
          const yearText = $(".story_c_r a[href*=/xfsearch/year/]").first().text().trim();
          const pageYear = /^\d{4}$/.test(yearText) ? parseInt(yearText, 10) : candidate.year;
          const score = scoreCandidate(pageTitle, meta, { year: pageYear, season, isTv });
          if (score <= 0) return [];
          const newsIdMatch = candidate.href.split("/").pop().match(/^(\d+)/);
          const newsId = newsIdMatch ? newsIdMatch[1] : "";
          const dleHash = extractDleHash(html);
          let allItems = [];
          if (newsId) {
            const ajaxUrl = `${MAIN_URL}/engine/ajax/playlists.php?news_id=${newsId}&xfield=playlist&user_hash=${encodeURIComponent(dleHash)}`;
            const ajaxJson = yield fetchJson(ajaxUrl, {
              headers: Object.assign({}, ANITUBE_HEADERS, {
                "Referer": candidate.href,
                "X-Requested-With": "XMLHttpRequest"
              }),
              timeoutMs: 12e3
            });
            if (ajaxJson && ajaxJson.success && ajaxJson.response) {
              allItems = parsePlaylistsHtml(ajaxJson.response);
            }
          }
          if (allItems.length === 0) {
            allItems = parseRalodePlayer(html);
          }
          if (allItems.length === 0) return [];
          let targetItems = [];
          if (!isTv) {
            const distinctNums = Array.from(new Set(allItems.map((it) => it.episodeNum).filter((n) => n != null)));
            if (distinctNums.length <= 1) {
              targetItems = allItems;
            } else {
              const firstEp = Math.min(...distinctNums);
              targetItems = allItems.filter((it) => it.episodeNum === firstEp || it.episodeNum == null);
            }
          } else {
            const epNum = parseInt(episode, 10);
            targetItems = allItems.filter((it) => it.episodeNum === epNum);
            if (targetItems.length === 0 && Number(season) > 1) {
              const absEp = computeAbsoluteEpisode(meta, season, epNum);
              if (absEp && absEp !== epNum) {
                targetItems = allItems.filter((it) => it.episodeNum === absEp);
              }
            }
          }
          if (targetItems.length === 0) return [];
          const capped = targetItems.slice(0, 8);
          const results = yield Promise.all(capped.map((it) => resolveItemStreams(it)));
          return dedupeStreams(results.flat());
        });
      }
      function getStreams(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          const start = Date.now();
          try {
            const isTv = isTvMediaType(mediaType);
            const meta = yield getMediaMeta(tmdbId, mediaType, season);
            if (!meta || !meta.queries || meta.queries.length === 0) {
              return [];
            }
            const effSeason = season != null ? parseInt(season, 10) : meta.effectiveSeason || 1;
            const effEpisode = episode != null ? parseInt(episode, 10) : 1;
            const searchQueries = [];
            const addQ = (q) => {
              const clean = (q || "").trim();
              if (clean && !searchQueries.some((x) => x.toLowerCase() === clean.toLowerCase())) {
                searchQueries.push(clean);
              }
            };
            if (isTv && effSeason > 1) {
              if (meta.titleUk) addQ(`${meta.titleUk} ${effSeason} \u0441\u0435\u0437\u043E\u043D`);
              if (meta.titleUk) addQ(`${meta.titleUk} ${effSeason}`);
            }
            for (const q of meta.queries) addQ(q);
            const allFound = [];
            const seenUrls = /* @__PURE__ */ new Set();
            for (const query of searchQueries.slice(0, 4)) {
              if (Date.now() - start > 25e3) break;
              const results = yield searchAnitube(query);
              for (const item of results) {
                if (!seenUrls.has(item.href)) {
                  seenUrls.add(item.href);
                  allFound.push(item);
                }
              }
              const quickMatch = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 1);
              if (quickMatch.length > 0) break;
            }
            if (allFound.length === 0) return [];
            const candidates = pickBestCandidates(allFound, meta, { season: effSeason, isTv }, 3);
            for (const candidate of candidates) {
              if (Date.now() - start > 45e3) break;
              const streams = yield extractFromPage(candidate, meta, isTv, effSeason, effEpisode);
              if (streams.length > 0) {
                return streams;
              }
            }
            return [];
          } catch (err) {
            console.error("[AniTube] Error:", err && err.message ? err.message : err);
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
