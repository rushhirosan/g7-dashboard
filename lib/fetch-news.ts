import Parser from "rss-parser";
import { CountryNews, Headline, NewsData } from "./types";
import {
  NEWS_SOURCES,
  NewsSourceConfig,
  RSS_FALLBACKS,
  RSS_FETCH_TIMEOUT_MS,
} from "./news-sources";

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const USER_AGENT = "g7-dashboard/0.1 (+https://github.com/g7-dashboard)";

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

async function translate(
  texts: string[],
  targetLang: string,
  apiKey: string
): Promise<string[]> {
  const resp = await fetch(DEEPL_FREE_URL, {
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

async function processCountry(
  src: NewsSourceConfig,
  deeplKey: string
): Promise<CountryNews | null> {
  console.info(`[fetch-news] Processing ${src.code} (${src.source.name})...`);
  const { entries, source } = await fetchRssForCountry(src);
  if (entries.length === 0) {
    console.warn(`[fetch-news] No entries for ${src.code}`);
    return null;
  }

  const titles = entries.map((e) => e.title);
  let jaTitles: string[];
  let enTitles: string[];

  if (src.lang === "JA") {
    jaTitles = titles;
    enTitles = await translate(titles, "EN-US", deeplKey);
  } else if (src.lang === "EN") {
    jaTitles = await translate(titles, "JA", deeplKey);
    enTitles = titles;
  } else {
    jaTitles = await translate(titles, "JA", deeplKey);
    await sleep(500);
    enTitles = await translate(titles, "EN-US", deeplKey);
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
    code: src.code,
    flag: src.flag,
    name: src.name,
    source,
    headlines,
  };
}

export type FetchNewsResult = {
  countriesWritten: number;
  totalSources: number;
  updatedAt: string;
};

export async function fetchAndStoreNews(): Promise<FetchNewsResult> {
  const deeplKey = process.env.DEEPL_API_KEY;
  if (!deeplKey) {
    throw new Error("Missing DEEPL_API_KEY");
  }

  console.info("[fetch-news] === World Front Page cron started ===");

  const settled = await Promise.allSettled(
    NEWS_SOURCES.map((src, index) =>
      sleep(index * 100).then(() => processCountry(src, deeplKey))
    )
  );

  const countries: CountryNews[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      countries.push(result.value);
    } else if (result.status === "rejected") {
      console.error("[fetch-news] Country failed:", result.reason);
    }
  }

  if (countries.length === 0) {
    throw new Error("Nothing processed — aborting KV write");
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

  console.info(
    `[fetch-news] === Done: ${countries.length}/${NEWS_SOURCES.length} countries written ===`
  );

  return {
    countriesWritten: countries.length,
    totalSources: NEWS_SOURCES.length,
    updatedAt: payload.updatedAt,
  };
}
