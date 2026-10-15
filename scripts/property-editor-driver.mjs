// Keyboard entry used by runtime acceptance; callers retain their page deadline.
export async function openPropertyCreator(page, { createLabel, propertyNameLabel }) {
  const create = page.getByRole("button", { name: createLabel, exact: true });
  const enabled = create.and(page.locator(":enabled"));
  await enabled.focus();
  await enabled.press("Enter");
  return page.getByLabel(propertyNameLabel, { exact: true });
}
