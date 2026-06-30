import { NEWS_SOURCES } from "./news-sources";
import { Lang, LocalizedString } from "./types";

export const UPDATE_SCHEDULE_JST = ["01:00", "07:00", "13:00", "19:00"] as const;

export type InfoPanel = "about" | "privacy" | "sources";

const scheduleLabel = (lang: Lang) =>
  lang === "ja"
    ? UPDATE_SCHEDULE_JST.join(" / ") + " JST"
    : UPDATE_SCHEDULE_JST.join(", ") + " JST";

export function getHeaderDescription(lang: Lang): string {
  if (lang === "ja") {
    return `G7各国・中国・インドの主要メディアからトップニュース見出しを集約し、日本語・英語で読めます。1日4回（${scheduleLabel("ja")}）自動更新。`;
  }
  return `Top headlines from major media across G7 countries, China, and India — in Japanese or English. Updated 4 times daily at ${scheduleLabel("en")}.`;
}

export const TRENDS_DASHBOARD_URL: Record<Lang, string> = {
  ja: "https://trends-dashboard.fly.dev/",
  en: "https://trends-dashboard.fly.dev/us",
};

export function getFooterLabel(panel: InfoPanel, lang: Lang): string {
  const labels: Record<InfoPanel, LocalizedString> = {
    about: { ja: "About", en: "About" },
    privacy: { ja: "Privacy", en: "Privacy" },
    sources: { ja: "Source Attribution", en: "Source Attribution" },
  };
  return labels[panel][lang];
}

export function getTrendsDashboardLabel(lang: Lang): string {
  return lang === "ja" ? "トレンドダッシュボード" : "Trends Dashboard";
}

export function getInfoPanelTitle(panel: InfoPanel, lang: Lang): string {
  const titles: Record<InfoPanel, LocalizedString> = {
    about: { ja: "World Front Page について", en: "About World Front Page" },
    privacy: { ja: "プライバシー", en: "Privacy" },
    sources: { ja: "ソース表示", en: "Source Attribution" },
  };
  return titles[panel][lang];
}

export function getInfoPanelParagraphs(panel: InfoPanel, lang: Lang): string[] {
  const schedule = scheduleLabel(lang);

  if (panel === "about") {
    return lang === "ja"
      ? [
          "World Front Page は、G7（日本・アメリカ・イギリス・ドイツ・フランス・イタリア・カナダ）に加え、中国・インドの主要メディアからトップニュース見出しを集約するダッシュボードです。",
          "各国・地域ごとに最大5件の見出しを表示し、選択した言語（日本語 / English）で読めます。見出しをクリックすると、各メディアの元記事が新しいタブで開きます。",
          `ニュースデータは Upstash QStash により1日4回（${schedule}）自動取得されます。RSS から取得した見出しは DeepL API で翻訳され、Vercel KV に保存された最新データがこのページに表示されます。`,
          "ブラウザをリロードしても RSS の再取得は行われません。表示されている「最終更新」は、直近の自動取得が成功した時刻です。",
        ]
      : [
          "World Front Page aggregates top news headlines from major media in G7 countries (Japan, United States, United Kingdom, Germany, France, Italy, Canada) plus China and India.",
          "Up to five headlines are shown per country or region. Read them in your chosen language (Japanese / English). Click a headline to open the original article in a new tab.",
          `News data is fetched automatically four times daily (${schedule}) via Upstash QStash. Headlines from RSS feeds are translated with the DeepL API and stored in Vercel KV; this page shows the latest snapshot.`,
          "Reloading your browser does not re-fetch RSS feeds. The “last updated” time reflects the most recent successful scheduled fetch.",
        ];
  }

  if (panel === "privacy") {
    return lang === "ja"
      ? [
          "アカウント登録やログインは不要です。氏名・メールアドレスなどの個人情報は収集しません。",
          "ライト / ダークモードの設定は、お使いのブラウザのローカルストレージに保存されます。",
          "見出しやメディア名のリンクをクリックすると、NHK・BBC など外部サイトへ移動します。それぞれのサイトには独自のプライバシーポリシーが適用されます。",
          "ニュース取得・翻訳・保存はサーバー側で行われ、訪問者のブラウザから RSS や DeepL API へ直接アクセスすることはありません。",
          "アクセス解析に Google Analytics 4（GA4）を使用しています。Google Analytics は Cookie を使用し、匿名の利用状況データを収集します。詳細は Google のプライバシーポリシー（https://policies.google.com/privacy）をご覧ください。",
        ]
      : [
          "No account or login is required. We do not collect personal information such as names or email addresses.",
          "Your light / dark theme preference is stored in your browser’s local storage.",
          "Clicking headline or media links takes you to external sites (e.g. NHK, BBC), each governed by its own privacy policy.",
          "News fetching, translation, and storage run on the server. Your browser does not contact RSS feeds or the DeepL API directly.",
          "We use Google Analytics 4 (GA4) for traffic analysis. Google Analytics uses cookies to collect anonymous usage data. See Google’s privacy policy at https://policies.google.com/privacy.",
        ];
  }

  return [];
}

export function getSourceAttributionItems() {
  return NEWS_SOURCES.map((source) => ({
    code: source.code,
    flag: source.flag,
    country: source.name,
    media: source.source.name,
    url: source.source.url,
    originalLang: source.source.originalLang,
    rss: source.rss,
  }));
}
