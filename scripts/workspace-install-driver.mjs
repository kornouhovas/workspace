// Installed-app acceptance enters the form with the same keyboard route as a user.
export async function createInstalledWorkspace(page, { name, source }) {
  await page.getByRole("textbox", { name: "Workspace name", exact: true }).fill(name);
  await page.getByRole("button", { name: "Choose project folder", exact: true }).press("Enter");
  await page.getByText(source, { exact: true }).waitFor();
  const create = page.getByRole("button", { name: "Create workspace", exact: true }).and(page.locator(":enabled"));
  await create.focus();
  await create.press("Enter");
  await page.getByRole("heading", { name, exact: true }).waitFor();
}
