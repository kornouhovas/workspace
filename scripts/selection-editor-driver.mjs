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
