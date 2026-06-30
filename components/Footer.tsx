"use client";

import { useState } from "react";
import {
  getFooterLabel,
  getTrendsDashboardLabel,
  InfoPanel,
  TRENDS_DASHBOARD_URL,
} from "@/lib/site-info";
import { Lang } from "@/lib/types";
import { InfoModal } from "./InfoModal";

const PANELS: InfoPanel[] = ["about", "privacy", "sources"];

interface Props {
  lang: Lang;
}

export function Footer({ lang }: Props) {
  const [openPanel, setOpenPanel] = useState<InfoPanel | null>(null);

  return (
    <>
      <footer className="footer">
        {PANELS.map((panel, i) => (
          <span key={panel} className="footer-item">
            {i > 0 && <span aria-hidden="true">|</span>}
            <button type="button" onClick={() => setOpenPanel(panel)}>
              {getFooterLabel(panel, lang)}
            </button>
          </span>
        ))}
        <span className="footer-item">
          <span aria-hidden="true">|</span>
          <a href={TRENDS_DASHBOARD_URL[lang]} target="_blank" rel="noopener noreferrer">
            {getTrendsDashboardLabel(lang)} ↗
          </a>
        </span>
      </footer>

      <InfoModal panel={openPanel} lang={lang} onClose={() => setOpenPanel(null)} />
    </>
  );
}
