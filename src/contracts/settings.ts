export const supportedLanguages = ["en", "ru"] as const;

export type Language = (typeof supportedLanguages)[number];

export interface Settings {
  language: Language;
}

export type SettingsQuery = { type: "settings.load" };
export type SettingsCommand = {
  type: "settings.setLanguage";
  language: Language;
};

export type ServiceErrorCode = "invalid_input" | "filesystem" | "storage" | "service_unavailable";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
}

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError };
