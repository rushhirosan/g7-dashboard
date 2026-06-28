import { getNewsData } from "@/lib/kv";
import { Dashboard } from "@/components/Dashboard";

// Revalidate every 6 hours — aligns with 4x/day cron (01:00 / 07:00 / 13:00 / 19:00 JST)
export const revalidate = 21600;

export default async function Home() {
  const data = await getNewsData();
  return <Dashboard data={data} />;
}
