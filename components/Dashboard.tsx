"use client";

import { useEffect, useState } from "react";
import { NewsData, Lang } from "@/lib/types";
import { Header } from "./Header";
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

  const sectionTitle = lang === "ja" ? "各国のトップ5" : "Top 5 from each country";

  return (
    <main className="page">
      <Header lang={lang} onLangChange={setLang} updatedAt={data.updatedAt} />

      <section className="intro">
        <h2>{sectionTitle}</h2>
      </section>

      <section className="grid" aria-live="polite" aria-label="Country news">
        {!ready
          ? Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)
          : data.countries.map((country, i) => (
              <CountryCard key={country.code} country={country} lang={lang} index={i} />
            ))}
      </section>

      <footer className="footer">
        <a href="#">About</a>
        <span aria-hidden="true">|</span>
        <a href="#">Privacy</a>
        <span aria-hidden="true">|</span>
        <a href="#">Source Attribution</a>
      </footer>
    </main>
  );
}
