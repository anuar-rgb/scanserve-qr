"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";
import kz from "@/locales/kz.json";

const DICTS = { en, ru, kz } as const;

export type Lang = keyof typeof DICTS;
export type Dict = typeof en;

const STORAGE_KEY = "scanserve-lang";
const DEFAULT_LANG: Lang = "en";

function detectLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && saved in DICTS) return saved;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser === "ru") return "ru";
  if (browser === "kk") return "kz";
  return DEFAULT_LANG;
}

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
};

const I18nContext = createContext<I18nContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations() {
  return useContext(I18nContext);
}

export function getName(
  name: { en?: string; ru?: string; kz?: string } | null,
  lang: Lang = "en"
): string {
  if (!name) return "—";
  if (lang === "ru" || lang === "kz") return name.ru ?? name.kz ?? name.en ?? "—";
  return name.en ?? name.ru ?? name.kz ?? "—";
}
