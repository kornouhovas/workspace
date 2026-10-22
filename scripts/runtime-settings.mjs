import { enterContextFor } from "./runtime-context-tools.mjs";
// User-facing navigation shared by inherited native smoke journeys.
export async function openSettingsSection(page, section = "general") {
  await restoreRuntimeSidebar(page);
  const entry = page.getByRole("button", { name: /^(Settings|Настройки)$/ });
  if (await entry.isVisible()) await entry.click();
  const labels = { general: /^(General|Основные)$/, workspaces: /^(Workspaces|Рабочие пространства)$/, appearance: /^(Appearance|Оформление)$/, sources: /^(Sources|Источники)$/, about: /^(About|О приложении)$/, backup: /^(Backup and recovery|Резервные копии и восстановление)$/ };
  await page.getByRole("tab", { name: labels[section] }).click();
}
export async function returnToWorkspace(page) {
  await restoreRuntimeSidebar(page);
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
  await restoreRuntimeSidebar(page);
  const entry=page.locator(`.sidebar-workspace-row > button[data-workspace-id=${JSON.stringify(workspaceId)}]`);
  if(await entry.count()) await entry.click();
  else await page.locator('#workspace-switcher').selectOption(workspaceId);
  await waitForWorkspaceNavigation(page);
}
export async function selectedRuntimeWorkspace(page) {
  return page.evaluate(()=>globalThis.document.querySelector('.sidebar-workspace-row > button[aria-current="page"]')?.getAttribute('data-workspace-id') ?? globalThis.document.querySelector('#workspace-switcher')?.value ?? null);
}
export async function waitForSelectedRuntimeWorkspace(page, {workspaceId,name}) {
  await page.locator(`.sidebar-workspace-row > button[data-workspace-id=${JSON.stringify(workspaceId)}][aria-current="page"]`)
    .and(page.getByRole('button',{name,exact:true})).waitFor();
  await waitForWorkspaceNavigation(page);
}
export async function waitForWorkspaceNavigation(page) {
  await page.waitForFunction(()=>{
    const control=globalThis.document.querySelector('.sidebar-workspace-row > button[aria-current="page"]') ?? globalThis.document.querySelector('#workspace-switcher');
    return !control?.disabled;
  });
}

// Retained 420px stress captures use the accepted shell's real hide/restore action.
// Required desktop captures keep their expanded sidebar.
export async function setRuntimeCaptureViewport(page, size) {
  const collapse = page.getByRole('button', {name:/^(Collapse sidebar|Свернуть боковую панель)$/});
  const restore = page.getByRole('button', {name:/^(Restore sidebar|Восстановить боковую панель)$/});
  if(size.width === 420) {
    // Keep the real toggle reachable before a clamped source popup can cover
    // the sidebar in the below-minimum stress viewport. Keyboard activation
    // also preserves an open nonmodal tools surface (no outside pointerdown).
    if(await collapse.isVisible()) await collapse.press("Enter");
    await page.setViewportSize(size);
    await restore.waitFor();
    if(await restore.getAttribute('aria-expanded') !== 'false') throw new Error('Stress capture sidebar must be collapsed');
  } else {
    await page.setViewportSize(size);
    if(await restore.isVisible()) await restore.press("Enter");
    await collapse.waitFor();
    if(await collapse.getAttribute('aria-expanded') !== 'true') throw new Error('Desktop capture sidebar must be expanded');
  }
}

async function restoreRuntimeSidebar(page) {
  const restore=page.getByRole('button',{name:/^(Restore sidebar|Восстановить боковую панель)$/});
  if(await restore.isVisible()) await restore.click();
}

// Observe the selected source through its actual tools surface.
export async function showRuntimeSourceRoot(page, canonicalRoot) {
  await returnToWorkspace(page);
  const root=page.getByRole("dialog",{name:/^(Source tools|Инструменты источника)$/,includeHidden:true})
    .locator(":scope > .workspace-root").and(page.getByText(canonicalRoot,{exact:true}));
  return enterContextFor(page,root);
}

// Dismiss nonmodal tools before selecting another workspace.
export async function dismissRuntimeTools(page) {
  // Locator.all() entries are live nth locators: close from the end so a
  // removed earlier entry cannot invalidate the next one. Keyboard activation
  // also avoids outside pointer handlers closing another surface mid-iteration.
  for(const trigger of (await page.locator('.context-tools-trigger[aria-expanded="true"]').all()).reverse()) {
    await trigger.focus();await trigger.press("Enter");
  }
}
