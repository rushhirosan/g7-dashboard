import { NewsData } from "./types";
import { getSiteUrl } from "./site-url";
import { getHeaderDescription } from "./site-info";

/**
 * JSON-LD graph for SEO + GEO (Generative Engine Optimization).
 * We host headline titles only and link out, so headlines are modeled as an
 * ItemList of external links rather than NewsArticle bodies.
 */
export function buildStructuredData(data: NewsData) {
  const siteUrl = getSiteUrl();

  const website = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: "World Front Page",
    description: getHeaderDescription("en"),
    inLanguage: ["ja", "en"],
    publisher: { "@id": `${siteUrl}/#organization` },
  };

  const organization = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "World Front Page",
    url: siteUrl,
  };

  const headlines = (data.countries ?? []).flatMap((country) =>
    country.headlines.map((h) => ({
      name: h.title.en || h.title.original,
      url: h.url,
      country: country.name.en,
      publishedAt: h.publishedAt,
    })),
  );

  const itemList = {
    "@type": "ItemList",
    "@id": `${siteUrl}/#headlines`,
    name: "Top headlines across G7, China and India",
    description: getHeaderDescription("en"),
    numberOfItems: headlines.length,
    itemListElement: headlines.map((h, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: h.url,
      name: h.name,
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website, itemList],
  };
}
