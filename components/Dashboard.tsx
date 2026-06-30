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
  const [lang, setLang] = useState<Lang>("ja");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (navigator.language.toLowerCase().startsWith("en")) {
      setLang("en");
    }
    setReady(true);
  }, []);

  return (
    <main className="page">
      <Header lang={lang} onLangChange={setLang} updatedAt={data.updatedAt} />

      <section className="country-section" aria-live="polite" aria-label="Country news">
        <div className="grid">
          {!ready
            ? Array.from({ length: TOTAL_COUNTRY_COUNT }).map((_, i) => (
                <SkeletonCard key={i} />
              ))
            : (data.countries ?? []).map((country, i) => (
                <CountryCard key={country.code} country={country} lang={lang} index={i} />
              ))}
        </div>
      </section>

      <Footer lang={lang} />
    </main>
  );
}
