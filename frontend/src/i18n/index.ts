import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en, type MessageKey } from "./en";
import { bn } from "./bn";

export type Lang = "en" | "bn";

/** UI preferences kept per browser (not per account). */
export const useUiStore = create<{ lang: Lang; setLang: (l: Lang) => void }>()(
  persist((set) => ({ lang: "en", setLang: (lang) => set({ lang }) }), { name: "renthub-ui" })
);

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;

/** Translate with an explicit language (public pages use the tenant's language, not the viewer's setting). */
export const translate = (lang: Lang, key: MessageKey, vars?: Record<string, string | number>) =>
  fill((lang === "bn" && bn[key]) || en[key] || key, vars);

/** `t(key, vars)` in the current UI language; also keeps <html lang> in step for screen readers and fonts. */
export function useT(override?: Lang) {
  const stored = useUiStore((s) => s.lang);
  const lang = override ?? stored;
  useEffect(() => {
    if (!override) document.documentElement.lang = lang;
  }, [lang, override]);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { t, lang };
}

export type { MessageKey };
