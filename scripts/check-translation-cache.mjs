/**
 * Offline check of the translation cache path: stubs Azure Translator, no KV, no secrets.
 * Run: npx tsx scripts/check-translation-cache.mjs
 */
import { translateOrFallback } from "../lib/fetch-news.ts";

let translateCalls = 0;
let billedChars = 0;
let failNext = false;

globalThis.fetch = async (_url, init) => {
  translateCalls++;
  const body = JSON.parse(init.body);
  billedChars += body.reduce((n, item) => n + item.Text.length, 0);
  if (failNext) {
    return { ok: false, status: 429, text: async () => "rate limited", json: async () => ({}) };
  }
  return {
    ok: true,
    status: 200,
    json: async () =>
      body.map((item) => ({ translations: [{ text: `[T]${item.Text}`, to: "ja" }] })),
  };
};

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) {
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
    process.exitCode = 1;
  }
}

async function main() {
  const cache = new Map();
  const config = { key: "test-key", region: "japaneast" };
  const run1 = ["Alpha headline", "Beta headline"];

  const r1 = await translateOrFallback(run1, "JA", config, cache);
  assert("first run translates all", r1.texts, ["[T]Alpha headline", "[T]Beta headline"]);
  assert("first run not degraded", r1.degraded, false);
  assert("first run billed both titles", billedChars, 27);

  const callsAfterRun1 = translateCalls;

  // Same titles again — should be fully served from cache
  const r2 = await translateOrFallback(run1, "JA", config, cache);
  assert("repeat run uses cache", r2.texts, ["[T]Alpha headline", "[T]Beta headline"]);
  assert("repeat run makes no translator call", translateCalls, callsAfterRun1);

  // One new headline — only the new one is billed
  const before = billedChars;
  const r3 = await translateOrFallback(["Alpha headline", "Gamma"], "JA", config, cache);
  assert("partial run translates only new title", r3.texts, ["[T]Alpha headline", "[T]Gamma"]);
  assert("partial run bills only new title", billedChars - before, 5);

  // Quota exhausted: cached titles survive, new one falls back to source text
  failNext = true;
  const r4 = await translateOrFallback(["Alpha headline", "Delta"], "JA", config, cache);
  assert("quota failure keeps cached translation", r4.texts, ["[T]Alpha headline", "Delta"]);
  assert("quota failure marks degraded", r4.degraded, true);
  assert(
    "quota failure keeps the Azure status",
    r4.error.includes("Azure Translator HTTP 429"),
    true
  );

  // Different target language must not collide with the JA cache
  failNext = false;
  const r5 = await translateOrFallback(["Alpha headline"], "EN-US", config, cache);
  assert("target lang is part of cache key", r5.texts, ["[T]Alpha headline"]);

  console.log(`\ntotal translator calls: ${translateCalls}, billed chars: ${billedChars}`);
}

main();
