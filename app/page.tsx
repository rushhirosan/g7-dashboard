import { getNewsData } from "@/lib/kv";
import { buildStructuredData } from "@/lib/structured-data";
import { Dashboard } from "@/components/Dashboard";

// Revalidate every 6 hours — aligns with 4x/day cron (01:00 / 07:00 / 13:00 / 19:00 JST)
export const revalidate = 21600;

export default async function Home() {
  const data = await getNewsData();
  const structuredData = buildStructuredData(data);

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD is server-rendered so crawlers and LLM agents see headlines without executing JS.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Dashboard data={data} />
    </>
  );
}
