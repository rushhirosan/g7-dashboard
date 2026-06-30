"use client";

import { useState } from "react";
import { getFooterLabel, InfoPanel } from "@/lib/site-info";
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
      </footer>

      <InfoModal panel={openPanel} lang={lang} onClose={() => setOpenPanel(null)} />
    </>
  );
}
