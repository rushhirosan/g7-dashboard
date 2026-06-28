import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NewsData } from "./types";
import { mockData } from "./mock-data";

const LOCAL_SNAPSHOT = join(process.cwd(), "data/news-snapshot.json");

function getLocalSnapshot(): NewsData | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!existsSync(LOCAL_SNAPSHOT)) return null;
  return parseNewsData(JSON.parse(readFileSync(LOCAL_SNAPSHOT, "utf-8")));
}

/** Normalize KV payloads from @vercel/kv or legacy cron REST writes. */
export function parseNewsData(raw: unknown): NewsData | null {
  if (raw == null) return null;

  let parsed: unknown = raw;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // Legacy cron wrote {"value": "<json string>"} via incorrect REST body shape.
  if (typeof obj.value === "string" && !Array.isArray(obj.countries)) {
    try {
      parsed = JSON.parse(obj.value);
    } catch {
      return null;
    }
  }

  const data = parsed as NewsData;
  if (!data.updatedAt || !Array.isArray(data.countries) || data.countries.length === 0) {
    return null;
  }

  return data;
}

function ensureKvEnv(): boolean {
  if (!process.env.KV_REST_API_URL && process.env.UPSTASH_REDIS_REST_URL) {
    process.env.KV_REST_API_URL = process.env.UPSTASH_REDIS_REST_URL;
  }
  if (!process.env.KV_REST_API_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN) {
    process.env.KV_REST_API_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  }
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getNewsData(): Promise<NewsData> {
  const local = getLocalSnapshot();
  if (local) return local;

  if (!ensureKvEnv()) return mockData();

  try {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.get("news:latest");
    const data = parseNewsData(raw);
    if (data) return data;
    console.error("[KV] news:latest missing or invalid shape:", typeof raw);
  } catch (e) {
    console.error("[KV] fetch failed:", e);
  }
  return mockData();
}
