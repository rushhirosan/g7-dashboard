"use client";

import { useEffect, useRef } from "react";
import {
  getInfoPanelParagraphs,
  getInfoPanelTitle,
  getSourceAttributionItems,
  InfoPanel,
} from "@/lib/site-info";
import { Lang } from "@/lib/types";

interface Props {
  panel: InfoPanel | null;
  lang: Lang;
  onClose: () => void;
}

export function InfoModal({ panel, lang, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (panel) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [panel]);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  if (!panel) return null;

  const title = getInfoPanelTitle(panel, lang);
  const paragraphs = getInfoPanelParagraphs(panel, lang);
  const sources = panel === "sources" ? getSourceAttributionItems() : [];

  return (
    <dialog
      ref={dialogRef}
      className="info-modal"
      onCancel={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
    >
      <div className="info-modal-panel">
        <header className="info-modal-header">
          <h2>{title}</h2>
          <button type="button" className="info-modal-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="info-modal-body">
          {panel === "sources" ? (
            <ul className="source-attribution-list">
              {sources.map((item) => (
                <li key={item.code}>
                  <span className="source-attribution-flag" aria-hidden="true">
                    {item.flag}
                  </span>
                  <div>
                    <p className="source-attribution-country">
                      {item.country[lang]} · {item.media}
                    </p>
                    <p className="source-attribution-meta">
                      {lang === "ja" ? "原文" : "Original"}: {item.originalLang[lang]}
                    </p>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.url} ↗
                    </a>
                    <p className="source-attribution-rss">
                      RSS:{" "}
                      <a href={item.rss} target="_blank" rel="noopener noreferrer">
                        {item.rss}
                      </a>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
          )}
        </div>
      </div>
    </dialog>
  );
}
