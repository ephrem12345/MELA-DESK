"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./messages/en.json";
import am from "./messages/am.json";

export type Locale = "en" | "am";
export type NestedDict = { [k: string]: string | NestedDict };

const dictionaries: Record<Locale, NestedDict> = { en: en as NestedDict, am: am as NestedDict };

export function flatten(obj: NestedDict, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") acc[key] = v;
    else Object.assign(acc, flatten(v, key));
    return acc;
  }, {});
}

const flatDictionaries = {
  en: flatten(en as NestedDict),
  am: flatten(am as NestedDict),
};

interface LocaleValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("mela-locale");
    if (stored === "am" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem("mela-locale", l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let msg = flatDictionaries[locale][key] ?? flatDictionaries.en[key];
      if (msg === undefined) {
        if (process.env.NODE_ENV !== "production") console.warn(`[i18n] missing key: ${key}`);
        return key;
      }
      if (vars) {
        for (const [k, v] of Object.entries(vars)) msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
      return msg;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}
