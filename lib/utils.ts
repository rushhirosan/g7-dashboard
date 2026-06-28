import { Lang } from "./types";

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
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const wd = weekdays[d.getDay()];
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `最終更新：${m}月${day}日（${wd}）${hh}:${mm} JST`;
  }
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `Last updated: ${months[d.getMonth()]} ${d.getDate()} (${weekdays[d.getDay()]}) ${hh}:${mm} JST`;
}
