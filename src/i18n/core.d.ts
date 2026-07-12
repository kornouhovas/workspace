export type AppLocale = "en" | "ru";
export type TranslationParams = Readonly<Record<string, string | number>>;

export const DEFAULT_LOCALE: AppLocale;
export const SUPPORTED_LOCALES: readonly AppLocale[];
export const LOCALE_STORAGE_KEY: string;
export const localeCatalogs: Readonly<Record<AppLocale, Readonly<Record<string, unknown>>>>;

export function normalizeLocale(value: unknown): AppLocale;
export function readStoredLocale(storage?: Pick<Storage, "getItem">): AppLocale;
export function writeStoredLocale(locale: unknown, storage?: Pick<Storage, "setItem">): AppLocale;
export function translate(locale: AppLocale, key: string, params?: TranslationParams): string;
export function getMissingTranslationKeys(locale: AppLocale): string[];
