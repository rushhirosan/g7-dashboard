/**
 * Register (or overwrite) the QStash schedule for World Front Page.
 *
 * Usage:
 *   QSTASH_TOKEN=... SITE_URL=https://g7-dashboard.vercel.app node scripts/setup-qstash.mjs
 *
 * Requires QStash from console.upstash.com/qstash (same Upstash account as KV).
 */

import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
const siteUrl = (process.env.SITE_URL ?? "https://g7-dashboard.vercel.app").replace(/\/$/, "");
const destination = `${siteUrl}/api/cron/fetch`;
const scheduleId = "world-front-page-fetch";
const cron = "CRON_TZ=Asia/Tokyo 0 1,7,13,19 * * *";

if (!token) {
  console.error("Missing QSTASH_TOKEN");
  process.exit(1);
}

const client = new Client({
  token,
  baseUrl: process.env.QSTASH_URL,
});

const schedule = await client.schedules.create({
  scheduleId,
  destination,
  cron,
});

console.log("QStash schedule registered:");
console.log("  scheduleId:", schedule.scheduleId);
console.log("  destination:", destination);
console.log("  cron:", cron);
console.log("  (JST 01:00 / 07:00 / 13:00 / 19:00)");
