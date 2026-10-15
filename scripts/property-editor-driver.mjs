// Keyboard entry used by runtime acceptance; callers retain their page deadline.
export async function openPropertyCreator(page, { createLabel, propertyNameLabel }) {
  const create = page.getByRole("button", { name: createLabel, exact: true });
  const enabled = create.and(page.locator(":enabled"));
  await enabled.focus();
  await enabled.press("Enter");
  return page.getByLabel(propertyNameLabel, { exact: true });
}

// Observe app-owned focus without filling or focusing the editor from the driver.
export async function waitForFocusedInput(page, selector) {
  await page.waitForFunction(selector => {
    const input = globalThis.document.querySelector(selector);
    if (!(input instanceof globalThis.HTMLInputElement)) return false;
    const bounds = input.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && globalThis.getComputedStyle(input).visibility === "visible"
      && input === globalThis.document.activeElement;
  }, selector);
}
