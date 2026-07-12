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
    "",
    `Site: ${siteUrl}`,
    `Last updated: ${data.updatedAt}`,
    "",
    "This site hosts headline titles only and links out to the original articles on each source.",
    "",
    "## Today's headlines by country",
    "",
  ];

  for (const country of data.countries ?? []) {
    lines.push(`### ${country.name.en} (${country.name.ja}) — ${country.source.name}`);
    lines.push("");
    country.headlines.forEach((h, i) => {
      const title = h.title.en || h.title.original;
      lines.push(`${i + 1}. [${title}](${h.url})`);
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
