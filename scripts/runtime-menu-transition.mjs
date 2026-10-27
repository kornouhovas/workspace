// Wait for the closing menu's deferred focus return before opening another menu.
export async function dismissCreationMenu(page, trigger) {
  await page.keyboard.press('Escape');
  await trigger.and(page.locator(':focus')).waitFor();
}
