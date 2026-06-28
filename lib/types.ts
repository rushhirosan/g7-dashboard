export type Lang = "ja" | "en";

export type LocalizedString = {
  ja: string;
  en: string;
};

export type Headline = {
  title: {
    original: string;
    ja: string;
    en: string;
  };
  publishedAt: string;
  url: string;
};

export type CountryNews = {
  code: string;
  flag: string;
  name: LocalizedString;
  source: {
    name: string;
    url: string;
    originalLang: LocalizedString;
  };
  headlines: Headline[];
};

export type NewsData = {
  updatedAt: string;
  countries: CountryNews[];
};
