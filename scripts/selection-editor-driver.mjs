/* global document */
/* global window */
// Chosen hidden options disappear as soon as their removal is committed.
export async function removeChosenOption(choice) {
  // Do not ask Playwright to re-inspect an input that may already be gone.
  // The caller observes the resulting selection through the public service.
  await choice.press("Space");
}

export async function observeSelectionBackend(app, page) {
  await page.waitForFunction(async () => (await window.workspace.getBackendStatus()).state === "ready");
  const pids = await app.evaluate(({ app }) => app.getAppMetrics().filter(metric => metric.type === "Utility" && metric.serviceName?.includes("Node")).map(metric => metric.pid));
  if (!pids.length) throw new Error("Ready selection backend has no owned utility process");
  return pids;
}

export async function waitForSelectionFocus(page, label) {
  // Content dismissal precedes Radix focus restoration; retain the exact trigger.
  await page.waitForFunction(label => document.activeElement?.getAttribute("aria-label") === label, label);
}

// Finish the old grouping layer's focus return before opening a value editor.
export async function closeGroupingForSelection(page, language = "en") {
  const label = language === "en" ? "Grouping" : "Группировка";
  const trigger = page.getByRole("button", {name: label, exact: true, includeHidden:true});
  if (await trigger.count() && await trigger.getAttribute("aria-expanded") === "true") {
    await page.keyboard.press("Escape");
    await page.getByRole("region", {name: label, exact: true}).waitFor({state:"hidden"});
    await page.waitForFunction(label => globalThis.document.activeElement?.getAttribute("aria-label") === label, label);
  }
  const parent=page.getByRole("button",{name:/^(View settings|Настройки представления)$/});
  if(await parent.count() && await parent.getAttribute("aria-expanded")==="true") {
    await page.keyboard.press("Escape");
    const parentLabel=await parent.getAttribute("aria-label");
    await page.waitForFunction(label => globalThis.document.activeElement?.getAttribute("aria-label") === label && globalThis.document.activeElement?.getAttribute("aria-expanded") === "false", parentLabel);
  }
}

// Observe both dismissal and its return before reopening the same value menu.
export async function closeSelectionEditor(page, {label, closeLabel}) {
  await page.getByRole('button',{name:closeLabel,exact:true}).click();
  await page.getByRole('group',{name:label,exact:true}).waitFor({state:'hidden'});
  await waitForSelectionFocus(page,label);
}
