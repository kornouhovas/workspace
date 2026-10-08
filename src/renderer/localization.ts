import type { Language } from "../contracts/settings.js";

const english = {
  appTitle: "Workspace",
  settingsTitle: "Settings",
  languageLabel: "Interface language",
  loading: "Loading settings…",
  unavailableTitle: "Local service unavailable",
  unavailableDescription: "The local service could not start. Restart the application to try again.",
  loadErrorTitle: "Settings unavailable",
  loadErrorDescription: "The saved language could not be loaded. Restart the application to try again.",
  saveErrorTitle: "Language not saved",
  saveErrorDescription: "The language change could not be saved. Your previous language is still active.",
  emptyState: "Your workspace is ready. Project discovery will be available in a future update.",
} as const;

const russian: Partial<Record<keyof typeof english, string>> = {
  settingsTitle: "Настройки",
  languageLabel: "Язык интерфейса",
  loading: "Загрузка настроек…",
  unavailableTitle: "Локальная служба недоступна",
  unavailableDescription: "Не удалось запустить локальную службу. Перезапустите приложение.",
  loadErrorTitle: "Настройки недоступны",
  loadErrorDescription: "Не удалось загрузить сохранённый язык. Перезапустите приложение.",
  saveErrorTitle: "Язык не сохранён",
  saveErrorDescription: "Не удалось сохранить новый язык. Прежний язык интерфейса остался активен.",
  emptyState: "Рабочее пространство готово. Поиск проектов появится в одном из следующих обновлений.",
};

export type TranslationKey = keyof typeof english;

export function translate(language: Language, key: TranslationKey): string {
  return language === "ru" ? (russian[key] ?? english[key]) : english[key];
}
