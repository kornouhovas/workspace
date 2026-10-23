import { enterContextFor } from './runtime-context-tools.mjs';

export async function activateProjectContextAction(page, control) {
  await enterContextFor(page, control);
  const enabled = control.and(page.locator(':enabled'));
  await enabled.focus();
  await enabled.press('Enter');
}
