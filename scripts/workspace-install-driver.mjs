import { renameActiveWorkspace } from "./runtime-settings.mjs";

// The picker saves the standard workspace first; authored fixture names use Rename.
export async function createInstalledWorkspace(page, { name, source }) {
  await page.getByRole("button", { name: "Choose project folder", exact: true }).press("Enter");
  await page.locator("#workspace-title").filter({ hasText: /^Workspace$/ }).waitFor();
  await page.getByText(source, { exact: true }).and(page.locator(":visible")).waitFor();
  if (name !== "Workspace") await renameActiveWorkspace(page, name);
}
