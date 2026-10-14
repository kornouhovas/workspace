import { isCalendarDate } from "../contracts/date-value.js";
import type { Language } from "../contracts/settings.js";

export function formatCalendarDate(value: string, language: Language): string {
  if (!isCalendarDate(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  // UTC is only an Intl adapter. Never parse the stored day as a local instant;
  // setUTCFullYear also avoids Date's special handling of years 00–99.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium", timeZone: "UTC", calendar: "gregory", numberingSystem: "latn",
  }).format(date);
}
