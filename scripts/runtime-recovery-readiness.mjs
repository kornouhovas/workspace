// Selecting Sources precedes its asynchronous list response. Observe the exact
// owned root through the visible user-facing control, under the caller deadline.
export async function waitForRuntimeRecoverySource(page, canonicalRoot) {
  await page.locator('.settings-page:not([hidden])')
    .getByRole('button', {name:canonicalRoot, exact:true}).waitFor();
}
