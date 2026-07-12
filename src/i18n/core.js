import { en } from "./locales/en.js";
import { ru } from "./locales/ru.js";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "ru"];
export const LOCALE_STORAGE_KEY = "workspace.interfaceLocale.v1";

export const localeCatalogs = { en, ru };

export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
}

export function readStoredLocale(storage) {
  try {
    const resolvedStorage = storage ?? globalThis.localStorage;
    return normalizeLocale(resolvedStorage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeStoredLocale(locale, storage) {
  const normalizedLocale = normalizeLocale(locale);
  try {
    const resolvedStorage = storage ?? globalThis.localStorage;
    resolvedStorage?.setItem(LOCALE_STORAGE_KEY, normalizedLocale);
  } catch {
    // The current session still uses the selected locale when storage is unavailable.
  }
  return normalizedLocale;
}

function selectMessage(locale, message, params) {
  if (typeof message === "string") {
    return message;
  }

  const count = Number(params?.count);
  const category = Number.isFinite(count)
    ? new Intl.PluralRules(locale).select(count)
    : "other";
  return message?.[category] || message?.other || "";
}

function interpolate(message, params = {}) {
  return message.replace(/\{\{(\w+)\}\}/g, (_match, key) => (
    Object.hasOwn(params, key) ? String(params[key]) : `{{${key}}}`
  ));
}

export function translate(locale, key, params) {
  const normalizedLocale = normalizeLocale(locale);
  const message = localeCatalogs[normalizedLocale]?.[key] ?? en[key] ?? key;
  return interpolate(selectMessage(normalizedLocale, message, params), params);
}

export function getMissingTranslationKeys(locale) {
  const catalog = localeCatalogs[normalizeLocale(locale)] || {};
  return Object.keys(en).filter((key) => !Object.hasOwn(catalog, key));
}
