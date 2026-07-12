import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  readStoredLocale,
  translate,
  writeStoredLocale,
  type AppLocale,
  type TranslationParams,
} from "@/i18n/core.js";

type I18nContextValue = {
  readonly locale: AppLocale;
  readonly setLocale: (locale: AppLocale) => void;
  readonly t: (key: string, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      setLocaleState(writeStoredLocale(nextLocale));
    },
    t(key, params) {
      return translate(locale, key, params);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export type { AppLocale } from "@/i18n/core.js";
