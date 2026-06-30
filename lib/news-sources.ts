import { LocalizedString } from "./types";

export type NewsSourceLang = "JA" | "EN" | "FR" | "IT";

export type NewsSourceConfig = {
  code: string;
  flag: string;
  name: LocalizedString;
  source: {
    name: string;
    url: string;
    originalLang: LocalizedString;
  };
  rss: string;
  lang: NewsSourceLang;
};

export type RssFallback = {
  rss: string;
  source: NewsSourceConfig["source"];
};

export const RSS_FETCH_TIMEOUT_MS = 60_000;

export const NEWS_SOURCES: NewsSourceConfig[] = [
  {
    code: "jp",
    flag: "🇯🇵",
    name: { ja: "日本", en: "Japan" },
    source: {
      name: "NHK",
      url: "https://www3.nhk.or.jp",
      originalLang: { ja: "日本語", en: "Japanese" },
    },
    rss: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    lang: "JA",
  },
  {
    code: "us",
    flag: "🇺🇸",
    name: { ja: "アメリカ", en: "United States" },
    source: {
      name: "AP News",
      url: "https://apnews.com",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "https://feeds.apnews.com/rss/apf-topnews",
    lang: "EN",
  },
  {
    code: "gb",
    flag: "🇬🇧",
    name: { ja: "イギリス", en: "United Kingdom" },
    source: {
      name: "BBC",
      url: "https://www.bbc.com",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "http://feeds.bbci.co.uk/news/rss.xml",
    lang: "EN",
  },
  {
    code: "de",
    flag: "🇩🇪",
    name: { ja: "ドイツ", en: "Germany" },
    source: {
      name: "Deutsche Welle",
      url: "https://www.dw.com",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "https://rss.dw.com/rdf/rss-en-top",
    lang: "EN",
  },
  {
    code: "fr",
    flag: "🇫🇷",
    name: { ja: "フランス", en: "France" },
    source: {
      name: "Le Monde",
      url: "https://www.lemonde.fr",
      originalLang: { ja: "フランス語", en: "French" },
    },
    rss: "https://www.lemonde.fr/rss/une.xml",
    lang: "FR",
  },
  {
    code: "it",
    flag: "🇮🇹",
    name: { ja: "イタリア", en: "Italy" },
    source: {
      name: "ANSA",
      url: "https://www.ansa.it",
      originalLang: { ja: "イタリア語", en: "Italian" },
    },
    rss: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
    lang: "IT",
  },
  {
    code: "ca",
    flag: "🇨🇦",
    name: { ja: "カナダ", en: "Canada" },
    source: {
      name: "CBC",
      url: "https://www.cbc.ca",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "https://www.cbc.ca/webfeed/rss/rss-topstories",
    lang: "EN",
  },
  {
    code: "cn",
    flag: "🇨🇳",
    name: { ja: "中国", en: "China" },
    source: {
      name: "SCMP",
      url: "https://www.scmp.com",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "https://www.scmp.com/rss/91/feed/",
    lang: "EN",
  },
  {
    code: "in",
    flag: "🇮🇳",
    name: { ja: "インド", en: "India" },
    source: {
      name: "The Hindu",
      url: "https://www.thehindu.com",
      originalLang: { ja: "英語", en: "English" },
    },
    rss: "https://www.thehindu.com/feeder/default.rss",
    lang: "EN",
  },
];

export const RSS_FALLBACKS: Record<string, RssFallback[]> = {
  us: [
    {
      rss: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
      source: {
        name: "BBC",
        url: "https://www.bbc.com/news/world/us_and_canada",
        originalLang: { ja: "英語", en: "English" },
      },
    },
    {
      rss: "https://feeds.npr.org/1001/rss.xml",
      source: {
        name: "NPR",
        url: "https://www.npr.org",
        originalLang: { ja: "英語", en: "English" },
      },
    },
  ],
  ca: [
    {
      rss: "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/",
      source: {
        name: "The Globe and Mail",
        url: "https://www.theglobeandmail.com/canada/",
        originalLang: { ja: "英語", en: "English" },
      },
    },
  ],
  cn: [
    {
      rss: "https://www.scmp.com/rss/4/feed/",
      source: {
        name: "SCMP",
        url: "https://www.scmp.com/news/china",
        originalLang: { ja: "英語", en: "English" },
      },
    },
    {
      rss: "https://feeds.bbci.co.uk/news/world/asia/china/rss.xml",
      source: {
        name: "BBC",
        url: "https://www.bbc.com/news/world/asia/china",
        originalLang: { ja: "英語", en: "English" },
      },
    },
  ],
};
