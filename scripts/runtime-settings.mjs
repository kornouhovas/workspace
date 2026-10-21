// User-facing navigation shared by inherited native smoke journeys.
export async function openSettingsSection(page, section = "general") {
  const entry = page.getByRole("button", { name: /^(Settings|Настройки)$/ });
  if (await entry.isVisible()) await entry.click();
  const labels = { general: /^(General|Основные)$/, workspaces: /^(Workspaces|Рабочие пространства)$/, appearance: /^(Appearance|Оформление)$/, sources: /^(Sources|Источники)$/, about: /^(About|О приложении)$/, backup: /^(Backup and recovery|Резервные копии и восстановление)$/ };
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

export async function renameActiveWorkspace(page, name) {
  await openSettingsSection(page, "workspaces");
  await page.getByRole("button", { name: /^(Rename workspace|Переименовать рабочее пространство)$/ }).click();
  const input = page.getByRole("textbox", { name: /^(Workspace name|Название рабочего пространства)$/ });
  await input.fill(name);
  await input.press("Enter");
  await input.waitFor({ state: "hidden" });
  await returnToWorkspace(page);
  await page.getByRole("button", { name: name.trim(), exact: true }).and(page.locator('[aria-current="page"]')).waitFor();
}

export async function selectRuntimeWorkspace(page, workspaceId) {
  const entry=page.locator(`.sidebar-workspace-row > button[data-workspace-id=${JSON.stringify(workspaceId)}]`);
  if(await entry.count()) await entry.click();
  else await page.locator('#workspace-switcher').selectOption(workspaceId);
  await waitForWorkspaceNavigation(page);
}
export async function selectedRuntimeWorkspace(page) {
  return page.evaluate(()=>globalThis.document.querySelector('.sidebar-workspace-row > button[aria-current="page"]')?.getAttribute('data-workspace-id') ?? globalThis.document.querySelector('#workspace-switcher')?.value ?? null);
}
export async function waitForWorkspaceNavigation(page) {
  await page.waitForFunction(()=>{
    const control=globalThis.document.querySelector('.sidebar-workspace-row > button[aria-current="page"]') ?? globalThis.document.querySelector('#workspace-switcher');
    return !control?.disabled;
  });
}
