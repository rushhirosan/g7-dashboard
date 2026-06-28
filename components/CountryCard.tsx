import { CountryNews, Lang } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

interface Props {
  country: CountryNews;
  lang: Lang;
  index: number;
}

export function CountryCard({ country, lang, index }: Props) {
  const sourceLinkText =
    lang === "ja"
      ? `${country.source.name}で続きを読む`
      : `Read on ${country.source.name}`;

  const badgeText =
    lang === "ja"
      ? `原文: ${country.source.originalLang.ja}`
      : `Original: ${country.source.originalLang.en}`;

  return (
    <article className="card" style={{ animationDelay: `${index * 45}ms` }}>
      <header className="card-header">
        <div className="country-wrap">
          <div className="flag" aria-hidden="true">{country.flag}</div>
          <div className="country-text">
            <h2 className="country-name">{country.name[lang]}</h2>
            <div className="source-name">{country.source.name}</div>
          </div>
        </div>
        <div className="translation-badge">{badgeText}</div>
      </header>

      <div className="headline-list">
        {country.headlines.map((headline, i) => (
          <article className="headline" key={i}>
            <div className="number" aria-hidden="true">{i + 1}</div>
            <div>
              <a
                className="headline-title"
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {headline.title[lang]}
              </a>
              <div className="headline-meta">
                <time dateTime={headline.publishedAt}>
                  {relativeTime(headline.publishedAt, lang)}
                </time>
                <a
                  className="read-link"
                  href={headline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={headline.title[lang]}
                >
                  ↗
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <footer className="card-footer">
        <a
          className="source-link"
          href={country.source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {sourceLinkText} ↗
        </a>
      </footer>
    </article>
  );
}
