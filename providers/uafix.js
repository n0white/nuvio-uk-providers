/**
 * uafix - Nuvio UK Provider (from cloudstream-extensions-uk)
 * Generated: 2026-11-17T00:13:51.595Z
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

  // src/uafix/index.js
  var require_index = __commonJS({
    "src/uafix/index.js"(exports, module) {
      init_http();
      init_metadata();
      init_matching();
      init_playerjs();
      var cheerio = __require("cheerio");
      var MAIN_URL = "https://uafix.net";
      var PROVIDER_NAME = "UAFlix";
      function extractUAFlixFile(text) {
        if (!text) return "";
        const single = text.match(/file\s*:\s*'([^']+)'/);
        if (single && single[1]) return single[1].trim();
        const dbl = text.match(/file\s*:\s*"([^"]+)"/);
        if (dbl && dbl[1]) return dbl[1].trim();
        return "";
      }
      function extractUAFlixSubtitle(text) {
        if (!text) return "";
        const single = text.match(/subtitle\s*:\s*'([^']*)'/);
        if (single && single[1] !== void 0) return single[1].trim();
        const dbl = text.match(/subtitle\s*:\s*"([^"]*)"/);
        if (dbl && dbl[1] !== void 0) return dbl[1].trim();
        return "";
      }
      function getPlayerReferer(playerUrl) {
        try {
          if (/^https?:\/\/zetvideo\.net\b/i.test(playerUrl)) {
            return playerUrl;
          }
        } catch (_) {
        }
        return "https://tortuga.wtf/";
      }
      function extractAllNumbers(str) {
        return (String(str || "").match(/\d+/g) || []).map((n) => parseInt(n, 10));
      }
      function searchUAFlix(query) {
        return __async(this, null, function* () {
          const url = `${MAIN_URL}/index.php?do=search&subaction=search&search_start=0&story=${encodeURIComponent(query)}`;
          const html = yield fetchText(url, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12e3 });
          if (!html) return [];
          const $ = cheerio.load(html);
          const items = [];
          const seen = /* @__PURE__ */ new Set();
          $(".sres-wrap").each((_, el) => {
            const $el = $(el);
            const href = ensureUrl($el.attr("href") || $el.find("a").first().attr("href"), MAIN_URL);
            if (!href || seen.has(href)) return;
            const title = ($el.find(".vi-title").first().text() || $el.find(".sres-img img").first().attr("alt") || $el.find("h2, .sres-text h2").first().text() || "").trim();
            if (!title) return;
            seen.add(href);
            const ym = $el.text().match(/\b(19\d{2}|20\d{2})\b/);
            items.push({
              title: stripSeo(title),
              href,
              year: ym ? parseInt(ym[1], 10) : null
            });
          });
          return items;
        });
      }
      function makeStream(dubTitle, url, rawSub, referer, defaultTitle) {
        const title = (dubTitle || defaultTitle || PROVIDER_NAME).trim();
        const subs = parsePlayerJsSubtitles(rawSub);
        const isSub = /субтитр/i.test(title);
        const langLabel = isSub ? "\u0421\u0443\u0431\u0442\u0438\u0442\u0440\u0438 \u2022 uk" : subs.length > 0 ? "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (+\u0441\u0443\u0431) \u2022 uk" : "\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F \u2022 uk";
        return buildNuvioStream({
          providerName: PROVIDER_NAME,
          name: title,
          title,
          url,
          quality: "1080p",
          language: langLabel,
          headers: { Referer: referer },
          subtitles: subs
        });
      }
      function extractFromPlayerUrl(playerUrl, pageUrl, isTv, season, episode, fallbackTitle) {
        return __async(this, null, function* () {
          const fixedPlayer = ensureUrl(playerUrl, MAIN_URL);
          if (!fixedPlayer || /youtube\.com|youtu\.be/i.test(fixedPlayer)) return [];
          const playerHtml = yield fetchText(fixedPlayer, {
            headers: { Referer: pageUrl || `${MAIN_URL}/` },
            timeoutMs: 12e3
          });
          if (!playerHtml) return [];
          const rawFile = extractUAFlixFile(playerHtml);
          if (!rawFile) return [];
          const referer = getPlayerReferer(fixedPlayer);
          const streams = [];
          if (!isTv || fixedPlayer.includes("/vod/")) {
            if (rawFile.startsWith("[")) {
              try {
                const dubs2 = JSON.parse(rawFile);
                for (const dub of dubs2) {
                  if (dub && dub.file) {
                    const s = makeStream(dub.title, dub.file, dub.subtitle, referer, fallbackTitle);
                    if (s) streams.push(s);
                  }
                }
              } catch (_) {
              }
            } else if (/^https?:\/\//i.test(rawFile)) {
              const subRaw = extractUAFlixSubtitle(playerHtml);
              const s = makeStream(`\u041E\u0437\u0432\u0443\u0447\u0435\u043D\u043D\u044F (${PROVIDER_NAME})`, rawFile, subRaw, referer, PROVIDER_NAME);
              if (s) streams.push(s);
            }
            return dedupeStreams(streams);
          }
          let dubs = null;
          try {
            dubs = JSON.parse(rawFile);
          } catch (_) {
            return [];
          }
          if (!Array.isArray(dubs)) return [];
          const targetS = parseInt(season, 10) || 1;
          const targetE = parseInt(episode, 10) || 1;
          for (const dub of dubs) {
            const dubTitle = dub.title || PROVIDER_NAME;
            for (const sItem of dub.folder || []) {
              const sNum = extractAllNumbers(sItem.title)[0];
              if (sNum !== targetS) continue;
              for (const ep of sItem.folder || []) {
                const eNum = extractAllNumbers(ep.title)[0];
                if (eNum === targetE && ep.file) {
                  const s = makeStream(dubTitle, ep.file, ep.subtitle, referer, fallbackTitle);
                  if (s) streams.push(s);
                }
              }
            }
          }
          return dedupeStreams(streams);
        });
      }
      function extractFromPage(candidate, meta, isTv, season, episode) {
        return __async(this, null, function* () {
          const html = yield fetchText(candidate.href, { headers: { Referer: `${MAIN_URL}/` }, timeoutMs: 12e3 });
          if (!html) return [];
          const $ = cheerio.load(html);
          const rawH1 = $(".fright h1 [itemprop=name]").first().text() || $(".fright h1").first().text() || candidate.title;
          const pageTitle = stripSeo(rawH1);
          const engTitle = $("span.eng-rus").first().text().trim();
          let pageYear = candidate.year;
          $(".fcols4 .finfo li").each((_, el) => {
            const label = $(el).find("span").first().text().trim();
            if (label === "\u0420\u0456\u043A \u0432\u0438\u0445\u043E\u0434\u0443:") {
              const y = parseInt($(el).find(".year").first().text().trim(), 10);
              if (Number.isFinite(y)) pageYear = y;
            }
          });
          const score = scoreCandidate(pageTitle, meta, {
            year: pageYear,
            extraTitles: engTitle ? [engTitle] : [],
            season,
            isTv
          });
          if (score <= 0) return [];
          const playerUrl = ensureUrl(
            $(".video-box iframe").first().attr("src") || $(".video-box iframe").first().attr("data-src"),
            MAIN_URL
          );
          if (playerUrl && !/youtube\.com|youtu\.be/i.test(playerUrl)) {
            const streams = yield extractFromPlayerUrl(playerUrl, candidate.href, isTv, season, episode, pageTitle);
            if (streams.length > 0) return streams;
          }
          if (isTv) {
            const targetS = parseInt(season, 10) || 1;
            const targetE = parseInt(episode, 10) || 1;
            const totalPages = Math.min(5, Math.max(1, $(".pagination li").length));
            for (let p = 1; p <= totalPages; p++) {
              const pageHtml = p === 1 ? html : yield fetchText(`${candidate.href}?page=${p}`, { headers: { Referer: candidate.href }, timeoutMs: 1e4 });
              if (!pageHtml) continue;
              const $p = cheerio.load(pageHtml);
              let matchedEpHref = "";
              $p(".video-item").each((_, el) => {
                if (matchedEpHref) return;
                const nums = extractAllNumbers($p(el).find(".vi-title").text());
                const epSeason = nums.length >= 2 ? nums[0] : 1;
                const epNum = nums.length >= 2 ? nums[1] : nums[0];
                if (epSeason === targetS && epNum === targetE) {
                  matchedEpHref = ensureUrl($p(el).find(".vi-img").attr("href"), MAIN_URL);
                }
              });
              if (matchedEpHref) {
                const epHtml = yield fetchText(matchedEpHref, { headers: { Referer: candidate.href }, timeoutMs: 1e4 });
                if (!epHtml) return [];
                const $ep = cheerio.load(epHtml);
                const epPlayerUrl = ensureUrl(
                  $ep(".video-box iframe").first().attr("src") || $ep(".video-box iframe").first().attr("data-src"),
                  MAIN_URL
                );
                if (epPlayerUrl) {
                  return extractFromPlayerUrl(epPlayerUrl, matchedEpHref, false, null, null, pageTitle);
                }
              }
            }
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
            const allFound = [];
            const seenUrls = /* @__PURE__ */ new Set();
            for (const query of meta.queries.slice(0, 3)) {
              if (Date.now() - start > 25e3) break;
              const results = yield searchUAFlix(query);
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
              if (Date.now() - start > 45e3) break;
              const streams = yield extractFromPage(candidate, meta, isTv, effSeason, effEpisode);
              if (streams.length > 0) return streams;
            }
            return [];
          } catch (err) {
            console.error("[UAFlix] Error:", err && err.message ? err.message : err);
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
