import { getNewsData } from "@/lib/kv";
import { getSiteUrl } from "@/lib/site-url";
import { getHeaderDescription } from "@/lib/site-info";

// Keep in sync with the 4x/day cron so LLM crawlers get fresh summaries.
export const revalidate = 21600;

/**
 * /llms.txt — an LLM-friendly plaintext summary (GEO convention).
 * Generative engines that skip JS can read today's headlines and source links here.
 */
export async function GET() {
  const data = await getNewsData();
  const siteUrl = getSiteUrl();

  const lines: string[] = [
    "# World Front Page",
    "",
    `> ${getHeaderDescription("en")}`,
    `> ${getHeaderDescription("ja")}`,
    "",
    `Site: ${siteUrl}`,
    `Last updated: ${data.updatedAt}`,
    "",
    "This site hosts headline titles only (bilingual: English / Japanese) and links out to the original articles on each source.",
    "本サイトは見出しタイトルのみ（英語・日本語）を掲載し、各ソースの元記事へリンクします。",
    "",
    "## Today's headlines by country / 国別トップ見出し",
    "",
  ];

  for (const country of data.countries ?? []) {
    lines.push(`### ${country.name.en} / ${country.name.ja} — ${country.source.name}`);
    lines.push("");
    country.headlines.forEach((h, i) => {
      const en = h.title.en || h.title.original;
      lines.push(`${i + 1}. [${en}](${h.url})`);
      if (h.title.ja && h.title.ja !== en) {
        lines.push(`   - ja: ${h.title.ja}`);
      }
    });
    lines.push("");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
