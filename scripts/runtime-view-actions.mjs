import { enterContextFor } from "./runtime-context-tools.mjs";

// Open the real keyboard menu; callers retain their ordinary page deadline.
export async function openRuntimeViewActions(page, trigger) {
  // Dismiss the owning tools before Radix can return focus into them.
  await enterContextFor(page,trigger);
  const enabled=trigger.and(page.locator(':not(:disabled):not([aria-disabled="true"])'));
  await enabled.focus();await enabled.press('Enter');
}
