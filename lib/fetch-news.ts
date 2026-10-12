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

/** Azure Translator F0 free tier: 2M chars/month. */
const AZURE_TRANSLATOR_ENDPOINT =
  process.env.AZURE_TRANSLATOR_ENDPOINT?.replace(/\/$/, "") ??
  "https://api.cognitive.microsofttranslator.com";

export type TranslatorConfig = {
  key: string;
  region: string;
};

/** Keep cache keys as JA / EN-US (legacy DeepL codes) for hit continuity. */
function toAzureLang(targetLang: string): string {
  if (targetLang === "JA") return "ja";
  if (targetLang.startsWith("EN")) return "en";
  return targetLang.toLowerCase();
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

/** Serialize Azure calls — free tier rate-limits concurrent bursts. */
let translateChain: Promise<unknown> = Promise.resolve();

function enqueueTranslate<T>(fn: () => Promise<T>): Promise<T> {
  const run = translateChain.then(fn, fn);
  translateChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function translateOnce(
  texts: string[],
  targetLang: string,
  config: TranslatorConfig
): Promise<string[]> {
  const to = toAzureLang(targetLang);
  const url = new URL(`${AZURE_TRANSLATOR_ENDPOINT}/translate`);
  url.searchParams.set("api-version", "3.0");
  url.searchParams.set("to", to);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": config.key,
      "Ocp-Apim-Subscription-Region": config.region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(texts.map((text) => ({ Text: text }))),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Azure Translator HTTP ${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await resp.json()) as { translations: { text: string }[] }[];
  return data.map((item, i) => item.translations?.[0]?.text ?? texts[i]);
}

async function translate(
  texts: string[],
  targetLang: string,
  config: TranslatorConfig
): Promise<string[]> {
  return enqueueTranslate(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await translateOnce(texts, targetLang, config);
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Azure Translator HTTP 429") && !msg.includes("Azure Translator HTTP 5")) {
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
export type TranslateFallbackResult = {
  texts: string[];
  degraded: boolean;
  /** Azure status and response snippet. Set only when `degraded` is true. */
  error?: string;
};

function pushUnique(errors: string[], error: string | undefined) {
  if (error && !errors.includes(error)) errors.push(error);
}

export async function translateOrFallback(
  texts: string[],
  targetLang: string,
  config: TranslatorConfig,
  cache: TranslationCache
): Promise<TranslateFallbackResult> {
  const results: (string | null)[] = texts.map((text) => getCached(cache, targetLang, text));

  const missingIndexes = results.flatMap((r, i) => (r === null ? [i] : []));
  if (missingIndexes.length === 0) {
    return { texts: results as string[], degraded: false };
  }

  const missingTexts = missingIndexes.map((i) => texts[i]);
  try {
    const translated = await translate(missingTexts, targetLang, config);
    missingIndexes.forEach((originalIndex, n) => {
      const text = translated[n];
      if (text === undefined) return;
      results[originalIndex] = text;
      putCached(cache, targetLang, texts[originalIndex], text);
    });
    return { texts: results.map((r, i) => r ?? texts[i]), degraded: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[fetch-news] Azure Translator ${targetLang} unavailable, using source titles: ${msg}`
    );
    return { texts: results.map((r, i) => r ?? texts[i]), degraded: true, error: msg };
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
  translationError?: string;
};

async function processCountry(
  src: NewsSourceConfig,
  config: TranslatorConfig,
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
  const translationErrors: string[] = [];

  const take = (outcome: TranslateFallbackResult): string[] => {
    if (outcome.degraded) {
      translationDegraded = true;
      pushUnique(translationErrors, outcome.error);
    }
    return outcome.texts;
  };

  if (src.lang === "JA") {
    jaTitles = titles;
    enTitles = take(await translateOrFallback(titles, "EN-US", config, cache));
  } else if (src.lang === "EN") {
    jaTitles = take(await translateOrFallback(titles, "JA", config, cache));
    enTitles = titles;
  } else {
    jaTitles = take(await translateOrFallback(titles, "JA", config, cache));
    enTitles = take(await translateOrFallback(titles, "EN-US", config, cache));
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
    translationError: translationErrors.join("\n") || undefined,
  };
}

export type FetchNewsResult = {
  countriesWritten: number;
  totalSources: number;
  updatedAt: string;
  translationDegraded: boolean;
  /** Distinct Azure failures from this run. Set only when `translationDegraded` is true. */
  translationError?: string;
};

function getTranslatorConfig(): TranslatorConfig {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;
  if (!key || !region) {
    throw new Error("Missing AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION");
  }
  return { key, region };
}

export async function fetchAndStoreNews(): Promise<FetchNewsResult> {
  const config = getTranslatorConfig();

  console.info("[fetch-news] === World Front Page cron started ===");

  const cache = await loadTranslationCache();

  const settled = await Promise.allSettled(
    NEWS_SOURCES.map((src) => processCountry(src, config, cache))
  );

  const countries: CountryNews[] = [];
  const failures: string[] = [];
  let translationDegraded = false;
  const translationErrors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const code = NEWS_SOURCES[i].code;
    if (result.status === "fulfilled" && result.value) {
      countries.push(result.value.country);
      if (result.value.translationDegraded) {
        translationDegraded = true;
        for (const error of result.value.translationError?.split("\n") ?? []) {
          pushUnique(translationErrors, error);
        }
      }
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

  const translationError = translationErrors.join("\n") || undefined;
  if (translationError) {
    console.warn(`[fetch-news] Translations degraded: ${translationError}`);
  }
  console.info(
    `[fetch-news] === Done: ${countries.length}/${NEWS_SOURCES.length} countries written ===`
  );

  return {
    countriesWritten: countries.length,
    totalSources: NEWS_SOURCES.length,
    updatedAt: payload.updatedAt,
    translationDegraded,
    translationError,
  };
}
