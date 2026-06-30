export function getSiteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://g7-dashboard.vercel.app";
  return url.replace(/\/$/, "");
}
