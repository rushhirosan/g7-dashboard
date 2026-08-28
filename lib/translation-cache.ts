/**
 * KV-backed cache of translated titles.
 *
 * The cron runs every 6h but the top-5 headlines change slowly, so most runs
 * re-translate text DeepL has already billed us for. Caching by source title
 * keeps monthly usage well under the free-tier limit.
 */

const CACHE_KEY = "news:tx-cache";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CacheEntry = { text: string; lastSeen: number };

export type TranslationCache = Map<string, CacheEntry>;

export function cacheKey(targetLang: string, sourceText: string): string {
  return `${targetLang}\u0000${sourceText}`;
}

export async function loadTranslationCache(): Promise<TranslationCache> {
  try {
    const { kv } = await import("@vercel/kv");
    const raw = await kv.get(CACHE_KEY);
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== "object") return new Map();

    const cache: TranslationCache = new Map();
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Partial<CacheEntry>;
      if (typeof entry.text !== "string" || typeof entry.lastSeen !== "number") continue;
      if (entry.lastSeen < cutoff) continue;
      cache.set(key, { text: entry.text, lastSeen: entry.lastSeen });
    }
    console.info(`[tx-cache] Loaded ${cache.size} cached translations`);
    return cache;
  } catch (err) {
    console.warn("[tx-cache] Load failed, starting empty:", err);
    return new Map();
  }
}

export async function saveTranslationCache(cache: TranslationCache): Promise<void> {
  try {
    const cutoff = Date.now() - MAX_AGE_MS;
    const obj: Record<string, CacheEntry> = {};
    for (const [key, entry] of cache) {
      if (entry.lastSeen < cutoff) continue;
      obj[key] = entry;
    }
    const { kv } = await import("@vercel/kv");
    await kv.set(CACHE_KEY, obj);
    console.info(`[tx-cache] Saved ${Object.keys(obj).length} translations`);
  } catch (err) {
    console.warn("[tx-cache] Save failed:", err);
  }
}

export function getCached(
  cache: TranslationCache,
  targetLang: string,
  sourceText: string
): string | null {
  const entry = cache.get(cacheKey(targetLang, sourceText));
  if (!entry) return null;
  entry.lastSeen = Date.now();
  return entry.text;
}

export function putCached(
  cache: TranslationCache,
  targetLang: string,
  sourceText: string,
  translated: string
): void {
  cache.set(cacheKey(targetLang, sourceText), { text: translated, lastSeen: Date.now() });
}
