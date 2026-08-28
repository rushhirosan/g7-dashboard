import Parser from "rss-parser";
import { CountryNews, Headline, NewsData } from "./types";
import {
  NEWS_SOURCES,
  NewsSourceConfig,
  RSS_FALLBACKS,
  RSS_FETCH_TIMEOUT_MS,
} from "./news-sources";
import {
  getCached,
  loadTranslationCache,
  putCached,
  saveTranslationCache,
  TranslationCache,
} from "./translation-cache";

const USER_AGENT = "g7-dashboard/0.1 (+https://github.com/g7-dashboard)";

function getDeepLTranslateUrl(apiKey: string): string {
  // Free keys end with :fx and must use api-free.deepl.com
  return apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

type RssEntry = {
  title: string;
  url: string;
  publishedAt: string;
};

const rssParser = new Parser({
  timeout: RSS_FETCH_TIMEOUT_MS,
  headers: { "User-Agent": USER_AGENT },
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serialize DeepL calls — free tier rejects concurrent bursts with 429. */
let deeplChain: Promise<unknown> = Promise.resolve();

function enqueueDeepL<T>(fn: () => Promise<T>): Promise<T> {
  const run = deeplChain.then(fn, fn);
  deeplChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function translateOnce(
  texts: string[],
  targetLang: string,
  apiKey: string
): Promise<string[]> {
  const resp = await fetch(getDeepLTranslateUrl(apiKey), {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts, target_lang: targetLang }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(`DeepL HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

async function translate(
  texts: string[],
  targetLang: string,
  apiKey: string
): Promise<string[]> {
  return enqueueDeepL(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await translateOnce(texts, targetLang, apiKey);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("DeepL HTTP 429") && !msg.includes("DeepL HTTP 5")) {
          throw err;
        }
        await sleep(1000 * (attempt + 1));
      }
    }
    throw lastErr;
  });
}

/**
 * Translates only titles missing from the cache. On quota/outage, keeps
 * headlines in the source language rather than dropping the country.
 */
export async function translateOrFallback(
  texts: string[],
  targetLang: string,
  apiKey: string,
  cache: TranslationCache
): Promise<{ texts: string[]; degraded: boolean }> {
  const results: (string | null)[] = texts.map((text) => getCached(cache, targetLang, text));

  const missingIndexes = results.flatMap((r, i) => (r === null ? [i] : []));
  if (missingIndexes.length === 0) {
    return { texts: results as string[], degraded: false };
  }

  const missingTexts = missingIndexes.map((i) => texts[i]);
  try {
    const translated = await translate(missingTexts, targetLang, apiKey);
    missingIndexes.forEach((originalIndex, n) => {
      const text = translated[n];
      if (text === undefined) return;
      results[originalIndex] = text;
      putCached(cache, targetLang, texts[originalIndex], text);
    });
    return { texts: results.map((r, i) => r ?? texts[i]), degraded: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch-news] DeepL ${targetLang} unavailable, using source titles: ${msg}`);
    return { texts: results.map((r, i) => r ?? texts[i]), degraded: true };
  }
}

async function fetchRss(url: string, limit = 5): Promise<RssEntry[]> {
  const feed = await rssParser.parseURL(url);
  return (feed.items ?? []).slice(0, limit).map((item) => {
    const rawDate = item.isoDate ?? item.pubDate;
    const publishedAt = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    return {
      title: (item.title ?? "").trim(),
      url: item.link ?? "",
      publishedAt,
    };
  });
}

async function fetchRssForCountry(
  src: NewsSourceConfig
): Promise<{ entries: RssEntry[]; source: NewsSourceConfig["source"] }> {
  const candidates = [{ rss: src.rss, source: src.source }, ...(RSS_FALLBACKS[src.code] ?? [])];

  for (const candidate of candidates) {
    try {
      const entries = await fetchRss(candidate.rss);
      if (entries.length > 0) {
        if (candidate.rss !== src.rss) {
          console.warn(`[fetch-news] Using fallback RSS for ${src.code}: ${candidate.rss}`);
        }
        return { entries, source: candidate.source };
      }
    } catch (err) {
      console.warn(`[fetch-news] RSS failed ${src.code} (${candidate.rss}):`, err);
    }
  }

  return { entries: [], source: src.source };
}

type ProcessCountryResult = {
  country: CountryNews;
  translationDegraded: boolean;
};

async function processCountry(
  src: NewsSourceConfig,
  deeplKey: string,
  cache: TranslationCache
): Promise<ProcessCountryResult | null> {
  console.info(`[fetch-news] Processing ${src.code} (${src.source.name})...`);
  const { entries, source } = await fetchRssForCountry(src);
  if (entries.length === 0) {
    console.warn(`[fetch-news] No entries for ${src.code}`);
    return null;
  }

  const titles = entries.map((e) => e.title);
  let jaTitles: string[];
  let enTitles: string[];
  let translationDegraded = false;

  if (src.lang === "JA") {
    jaTitles = titles;
    const en = await translateOrFallback(titles, "EN-US", deeplKey, cache);
    enTitles = en.texts;
    translationDegraded ||= en.degraded;
  } else if (src.lang === "EN") {
    const ja = await translateOrFallback(titles, "JA", deeplKey, cache);
    jaTitles = ja.texts;
    translationDegraded ||= ja.degraded;
    enTitles = titles;
  } else {
    const ja = await translateOrFallback(titles, "JA", deeplKey, cache);
    jaTitles = ja.texts;
    translationDegraded ||= ja.degraded;
    const en = await translateOrFallback(titles, "EN-US", deeplKey, cache);
    enTitles = en.texts;
    translationDegraded ||= en.degraded;
  }

  const headlines: Headline[] = entries.map((entry, i) => ({
    title: {
      original: entry.title,
      ja: jaTitles[i] ?? entry.title,
      en: enTitles[i] ?? entry.title,
    },
    publishedAt: entry.publishedAt,
    url: entry.url,
  }));

  return {
    country: {
      code: src.code,
      flag: src.flag,
      name: src.name,
      source,
      headlines,
    },
    translationDegraded,
  };
}

export type FetchNewsResult = {
  countriesWritten: number;
  totalSources: number;
  updatedAt: string;
  translationDegraded: boolean;
};

export async function fetchAndStoreNews(): Promise<FetchNewsResult> {
  const deeplKey = process.env.DEEPL_API_KEY;
  if (!deeplKey) {
    throw new Error("Missing DEEPL_API_KEY");
  }

  console.info("[fetch-news] === World Front Page cron started ===");

  const cache = await loadTranslationCache();

  const settled = await Promise.allSettled(
    NEWS_SOURCES.map((src) => processCountry(src, deeplKey, cache))
  );

  const countries: CountryNews[] = [];
  const failures: string[] = [];
  let translationDegraded = false;
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const code = NEWS_SOURCES[i].code;
    if (result.status === "fulfilled" && result.value) {
      countries.push(result.value.country);
      translationDegraded ||= result.value.translationDegraded;
    } else if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error(`[fetch-news] Country failed ${code}:`, result.reason);
      failures.push(`${code}: ${reason}`);
    } else {
      failures.push(`${code}: no entries`);
    }
  }

  if (countries.length === 0) {
    const detail = failures.length > 0 ? ` (${failures.join("; ")})` : "";
    throw new Error(`Nothing processed — aborting KV write${detail}`);
  }

  countries.sort(
    (a, b) =>
      NEWS_SOURCES.findIndex((s) => s.code === a.code) -
      NEWS_SOURCES.findIndex((s) => s.code === b.code)
  );

  const payload: NewsData = {
    updatedAt: new Date().toISOString(),
    countries,
  };

  const { kv } = await import("@vercel/kv");
  await kv.set("news:latest", payload);
  await saveTranslationCache(cache);

  console.info(
    `[fetch-news] === Done: ${countries.length}/${NEWS_SOURCES.length} countries written ===`
  );

  return {
    countriesWritten: countries.length,
    totalSources: NEWS_SOURCES.length,
    updatedAt: payload.updatedAt,
    translationDegraded,
  };
}
