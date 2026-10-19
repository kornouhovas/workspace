// User-facing navigation shared by inherited native smoke journeys.
export async function openSettingsSection(page, section = "general") {
  const entry = page.getByRole("button", { name: /^(Settings|Настройки)$/ });
  if (await entry.isVisible()) await entry.click();
  const labels = { general: /^(General|Основные)$/, workspaces: /^(Workspaces|Рабочие пространства)$/, appearance: /^(Appearance|Оформление)$/, sources: /^(Sources|Источники)$/, backup: /^(Backup and recovery|Резервные копии и восстановление)$/ };
  await page.getByRole("tab", { name: labels[section] }).click();
}
export async function returnToWorkspace(page) {
  const back = page.getByRole("button", { name: /^(Back to workspace|Вернуться к работе)$/ });
  if (await back.isVisible()) await back.click();
}
export async function setInterfaceLanguage(page, language) {
  await openSettingsSection(page);
  const select = page.locator("#interface-language");
  await select.selectOption(language);
  await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
  await returnToWorkspace(page);
}
