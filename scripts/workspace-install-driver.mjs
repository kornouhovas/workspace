import { renameActiveWorkspace } from "./runtime-settings.mjs";

// The picker saves the standard workspace first; authored fixture names use Rename.
export async function createInstalledWorkspace(page, { name, source }) {
  await page.getByRole("button", { name: "Choose project folder", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  await page.getByText(source, { exact: true }).waitFor();
  if (name !== "Workspace") await renameActiveWorkspace(page, name);
}
