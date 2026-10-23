export const supportedLanguages = ["en", "ru"] as const;

export type Language = (typeof supportedLanguages)[number];

export const supportedAppearances = ["light", "dark", "system"] as const;
export type Appearance = (typeof supportedAppearances)[number];

export interface Settings {
  appearance: Appearance;
  language: Language;
}

export type SettingsQuery = { type: "settings.load" };
export type SettingsCommand = {
  type: "settings.setLanguage";
  language: Language;
} | { type: "settings.setAppearance"; appearance: Appearance };

export type ServiceErrorCode = "invalid_input" | "filesystem" | "storage" | "service_unavailable" | "stale_preview" | "identity_update_required";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
}

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError };
