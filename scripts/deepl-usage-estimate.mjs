/**
 * Estimates DeepL characters consumed per cron run from live RSS titles.
 * Run: npx tsx scripts/deepl-usage-estimate.mjs
 */
import Parser from "rss-parser";
import { NEWS_SOURCES, RSS_FALLBACKS, RSS_FETCH_TIMEOUT_MS } from "../lib/news-sources.ts";

const parser = new Parser({
  timeout: RSS_FETCH_TIMEOUT_MS,
  headers: { "User-Agent": "g7-dashboard/0.1" },
});

async function titlesFor(src) {
  const candidates = [src.rss, ...(RSS_FALLBACKS[src.code] ?? []).map((f) => f.rss)];
  for (const rss of candidates) {
    try {
      const feed = await parser.parseURL(rss);
      const items = (feed.items ?? []).slice(0, 5);
      if (items.length > 0) return items.map((i) => (i.title ?? "").trim());
    } catch {
      // try next candidate
    }
  }
  return [];
}

const RUNS_PER_DAY = 4;
const FREE_MONTHLY_LIMIT = 500_000;

async function main() {
  let total = 0;
  for (const src of NEWS_SOURCES) {
    const titles = await titlesFor(src);
    const chars = titles.reduce((sum, t) => sum + t.length, 0);
    // JA/EN sources need 1 translation direction; FR/IT need 2
    const directions = src.lang === "JA" || src.lang === "EN" ? 1 : 2;
    const billed = chars * directions;
    total += billed;
    console.log(
      `${src.code} lang=${src.lang} titles=${titles.length} chars=${chars} x${directions} = ${billed}`
    );
  }

  const perDay = total * RUNS_PER_DAY;
  const perMonth = perDay * 30;
  console.log(`\nper run:   ${total.toLocaleString()} chars`);
  console.log(`per day:   ${perDay.toLocaleString()} chars (${RUNS_PER_DAY} runs)`);
  console.log(`per month: ${perMonth.toLocaleString()} chars`);
  console.log(
    `free limit usage: ${((perMonth / FREE_MONTHLY_LIMIT) * 100).toFixed(1)}% of ${FREE_MONTHLY_LIMIT.toLocaleString()}`
  );
}

main();
