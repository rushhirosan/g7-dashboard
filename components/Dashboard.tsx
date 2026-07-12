"use client";

import { useEffect, useState } from "react";
import { NewsData, Lang } from "@/lib/types";
import { TOTAL_COUNTRY_COUNT } from "@/lib/countries";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { CountryCard } from "./CountryCard";
import { SkeletonCard } from "./SkeletonCard";

interface Props {
  data: NewsData;
}

export function Dashboard({ data }: Props) {
  // Default to "ja" so server HTML and first client render match (hydration-safe);
  // language auto-detection flips text after mount without hiding content from crawlers.
  const [lang, setLang] = useState<Lang>("ja");

  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith("en")) {
      setLang("en");
    }
  }, []);

  const countries = data.countries ?? [];

  return (
    <main className="page">
      <Header lang={lang} onLangChange={setLang} updatedAt={data.updatedAt} />

      <section className="country-section" aria-live="polite" aria-label="Country news">
        <div className="grid">
          {countries.length === 0
            ? Array.from({ length: TOTAL_COUNTRY_COUNT }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            : countries.map((country, i) => (
                <CountryCard key={country.code} country={country} lang={lang} index={i} />
              ))}
        </div>
      </section>

      <Footer lang={lang} />
    </main>
  );
}
