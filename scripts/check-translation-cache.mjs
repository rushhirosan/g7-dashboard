/**
 * Offline check of the translation cache path: stubs DeepL, no KV, no secrets.
 * Run: npx tsx scripts/check-translation-cache.mjs
 */
import { translateOrFallback } from "../lib/fetch-news.ts";

let deeplCalls = 0;
let billedChars = 0;
let failNext = false;

globalThis.fetch = async (_url, init) => {
  deeplCalls++;
  const body = JSON.parse(init.body);
  billedChars += body.text.reduce((n, t) => n + t.length, 0);
  if (failNext) {
    return { ok: false, status: 456, json: async () => ({}) };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ translations: body.text.map((t) => ({ text: `[T]${t}` })) }),
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
  const run1 = ["Alpha headline", "Beta headline"];

  const r1 = await translateOrFallback(run1, "JA", "key:fx", cache);
  assert("first run translates all", r1.texts, ["[T]Alpha headline", "[T]Beta headline"]);
  assert("first run not degraded", r1.degraded, false);
  assert("first run billed both titles", billedChars, 27);

  const callsAfterRun1 = deeplCalls;

  // Same titles again — should be fully served from cache
  const r2 = await translateOrFallback(run1, "JA", "key:fx", cache);
  assert("repeat run uses cache", r2.texts, ["[T]Alpha headline", "[T]Beta headline"]);
  assert("repeat run makes no DeepL call", deeplCalls, callsAfterRun1);

  // One new headline — only the new one is billed
  const before = billedChars;
  const r3 = await translateOrFallback(["Alpha headline", "Gamma"], "JA", "key:fx", cache);
  assert("partial run translates only new title", r3.texts, ["[T]Alpha headline", "[T]Gamma"]);
  assert("partial run bills only new title", billedChars - before, 5);

  // Quota exhausted: cached titles survive, new one falls back to source text
  failNext = true;
  const r4 = await translateOrFallback(["Alpha headline", "Delta"], "JA", "key:fx", cache);
  assert("quota failure keeps cached translation", r4.texts, ["[T]Alpha headline", "Delta"]);
  assert("quota failure marks degraded", r4.degraded, true);

  // Different target language must not collide with the JA cache
  failNext = false;
  const r5 = await translateOrFallback(["Alpha headline"], "EN-US", "key:fx", cache);
  assert("target lang is part of cache key", r5.texts, ["[T]Alpha headline"]);

  console.log(`\ntotal DeepL calls: ${deeplCalls}, billed chars: ${billedChars}`);
}

main();
