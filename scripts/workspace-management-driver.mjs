export async function applyReviewedDiscovery(page) {
  await page.getByRole("button", { name: /^(Apply reviewed projects|Применить проверенные проекты)$/ }).and(page.locator(":enabled")).press("Enter");
}
