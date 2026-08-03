import { Lang } from "./types";

const JST = "Asia/Tokyo";

export function relativeTime(isoString: string, lang: Lang): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
  if (lang === "ja") {
    if (diff < 60) return `${diff}分前`;
    if (diff < 1440) return `${Math.floor(diff / 60)}時間前`;
    return `${Math.floor(diff / 1440)}日前`;
  }
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export function formatUpdatedAt(isoString: string, lang: Lang): string {
  const d = new Date(isoString);
  if (lang === "ja") {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: JST,
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `最終更新：${get("month")}月${get("day")}日（${get("weekday")}）${get("hour")}:${get("minute")} JST`;
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: JST,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `Last updated: ${formatted} JST`;
}
