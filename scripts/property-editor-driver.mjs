import { enterContextFor } from "./runtime-context-tools.mjs";
// Keyboard entry used by runtime acceptance; callers retain their page deadline.
export async function openPropertyCreator(page, { createLabel, propertyNameLabel }) {
  const create = page.getByRole("button", { name: /^(Add property|Добавить свойство)$/, includeHidden: true });
  await enterContextFor(page,create);
  const enabled = create.and(page.locator(":enabled"));
  await enabled.focus();
  await enabled.press("Enter");
  const type = createLabel.includes("MultiSelect") ? "multi_select" : createLabel.includes("Single Select") ? "single_select" : createLabel.includes("Number") ? "number" : createLabel.includes("Date") ? "date" : "text";
  await page.getByRole("combobox", { name: /^(Property type|Тип свойства)$/ }).selectOption(type);
  await page.getByRole("combobox", { name: /^(Property type|Тип свойства)$/ }).press("Shift+Tab");
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

// Switch once; the following property control belongs to the committed view.
export async function activatePropertyView(page, { name, layout }) {
  const tab = page.getByRole('tab', { name, exact: true });
  const id = await tab.getAttribute('id');
  await tab.click();
  await page.waitForFunction(({id, layout}) => {
    const tab = globalThis.document.getElementById(id);
    const panel = [...globalThis.document.querySelectorAll('.saved-view-content [role="tabpanel"]')].find(panel => panel.getAttribute('aria-labelledby')?.split(' ').includes(id) && !panel.closest('[hidden]'));
    const fields = panel?.querySelector('.text-properties');
    return tab?.getAttribute('aria-selected') === 'true' && fields?.getAttribute('aria-busy') === 'false'
      && fields.querySelector(layout === 'board' ? '.project-board' : 'table.project-table') !== null;
  }, {id, layout});
}
