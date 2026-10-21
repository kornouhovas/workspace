import { enterContextFor } from "./runtime-context-tools.mjs";
import { setInterfaceLanguage } from "./runtime-settings.mjs";
// Runtime view activation covers both the current tabs and the immutable
// performance baseline's original select, without replaying an activation.
export async function activateRuntimeView(page, view) {
  const tabs = page.getByRole("tablist", { name: "Current view", exact: true });
  if (await tabs.count()) await tabs.getByRole("tab", { name: view.name, exact: true }).click();
  else await page.getByRole("combobox", { name: "Current view", exact: true }).selectOption(view.viewId);
}

export async function setRuntimeViewLanguage(page, language) {
  const settings = page.getByRole("button", { name: /^(Settings|Настройки)$/ });
  const general = page.getByRole("tab", { name: /^(General|Основные)$/ });
  if (await settings.count() || await general.count()) return setInterfaceLanguage(page, language);
  // The immutable performance baseline exposes language inline in the workspace.
  await page.locator("#interface-language").selectOption(language);
  await page.waitForFunction(lang => globalThis.document.documentElement.lang === lang && !globalThis.document.querySelector("#interface-language")?.disabled, language);
}

export async function pressRuntimeFilterSave(page) {
  const save=await enterContextFor(page,page.getByRole('button',{name:'Save search and filters',exact:true,includeHidden:true}));
  const enabled=save.and(page.locator(':not(:disabled):not([aria-disabled="true"])'));
  await enabled.focus();
  await enabled.press('Enter');
}
