import { openSettingsSection, renameActiveWorkspace, returnToWorkspace } from "./runtime-settings.mjs";

// The picker saves the standard workspace first; authored fixture names use Rename.
export async function createInstalledWorkspace(page, { name, source }) {
  await page.getByRole("button", { name: "Choose project folder", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Workspace", exact: true }).and(page.locator('[aria-current="page"]')).waitFor();
  await openSettingsSection(page, "workspaces");
  await page.getByText(source, { exact: true }).and(page.locator(":visible")).waitFor();
  if (name !== "Workspace") await renameActiveWorkspace(page, name);
  else await returnToWorkspace(page);
}
