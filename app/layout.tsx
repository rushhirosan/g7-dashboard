import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSiteUrl } from "@/lib/site-url";

const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;
const siteUrl = getSiteUrl();

const description =
  "Top news headlines from major media across the G7, China and India — readable in Japanese and English, updated 4 times daily. G7・中国・インドの主要メディアのトップニュース見出しを日本語と英語で。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "World Front Page — G7 · China · India top headlines",
    template: "%s | World Front Page",
  },
  description,
  keywords: [
    "world news",
    "G7 news",
    "top headlines",
    "China news",
    "India news",
    "bilingual news",
    "世界のニュース",
    "海外ニュース",
    "トップニュース",
  ],
  applicationName: "World Front Page",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "World Front Page — G7 · China · India top headlines",
    description,
    url: siteUrl,
    siteName: "World Front Page",
    type: "website",
    locale: "ja_JP",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "World Front Page — G7 · China · India top headlines",
    description,
  },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
    </html>
  );
}
