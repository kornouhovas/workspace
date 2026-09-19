export function formatDateForDisplay(value, locale) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(year, month - 1, day));
}
