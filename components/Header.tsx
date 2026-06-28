"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Lang } from "@/lib/types";
import { formatUpdatedAt } from "@/lib/utils";

interface Props {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  updatedAt: string;
}

export function Header({ lang, onLangChange, updatedAt }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const themeLabel = isDark
    ? lang === "ja" ? "☼ ライトモード" : "☼ Light mode"
    : lang === "ja" ? "☾ ダークモード" : "☾ Dark mode";

  return (
    <header className="topbar">
      <div className="brand-row">
        <div className="logo" aria-hidden="true">WFP</div>
        <div className="title-group">
          <h1>World Front Page</h1>
          <p className="subtitle">
            {lang === "ja" ? "G7 · 中国 · インド" : "G7 · China · India"}
          </p>
          <div className="updated">
            <span aria-hidden="true">◷</span>
            <time dateTime={updatedAt}>{formatUpdatedAt(updatedAt, lang)}</time>
          </div>
        </div>
      </div>

      <div className="actions">
        <div className="segmented" role="group" aria-label="Language selector">
          <button
            type="button"
            className={lang === "ja" ? "active" : ""}
            onClick={() => onLangChange("ja")}
            aria-pressed={lang === "ja"}
          >
            日本語
          </button>
          <button
            type="button"
            className={lang === "en" ? "active" : ""}
            onClick={() => onLangChange("en")}
            aria-pressed={lang === "en"}
          >
            English
          </button>
        </div>
        <button
          className="theme-btn"
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={themeLabel}
          suppressHydrationWarning
        >
          {themeLabel}
        </button>
      </div>
    </header>
  );
}
