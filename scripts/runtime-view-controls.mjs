// Runtime view activation covers both the current tabs and the immutable
// performance baseline's original select, without replaying an activation.
export async function activateRuntimeView(page, view) {
  const tabs = page.getByRole("tablist", { name: "Current view", exact: true });
  if (await tabs.count()) await tabs.getByRole("tab", { name: view.name, exact: true }).click();
  else await page.getByRole("combobox", { name: "Current view", exact: true }).selectOption(view.viewId);
}
