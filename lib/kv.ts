import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NewsData } from "./types";
import { mockData } from "./mock-data";

const LOCAL_SNAPSHOT = join(process.cwd(), "data", "news-snapshot.json");

function getLocalSnapshot(): NewsData | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!existsSync(LOCAL_SNAPSHOT)) return null;
  return JSON.parse(readFileSync(LOCAL_SNAPSHOT, "utf-8")) as NewsData;
}

export async function getNewsData(): Promise<NewsData> {
  const local = getLocalSnapshot();
  if (local) return local;

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return mockData();
  }
  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<NewsData>("news:latest");
    if (data) return data;
  } catch (e) {
    console.error("[KV] fetch failed:", e);
  }
  return mockData();
}
