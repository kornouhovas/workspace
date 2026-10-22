/* global document */
export async function closeBoardLayout(page, label) {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog",{name:label,exact:true}).waitFor({state:"hidden"});
  // Radix returns focus asynchronously. A second Escape or a new editor must
  // follow that return, otherwise the old layer can steal the new draft's focus.
  await page.waitForFunction(label=>document.activeElement?.getAttribute("aria-label")===label,label);
  const parent=page.getByRole("button",{name:/^(View settings|Настройки представления)$/});
  if(await parent.count() && await parent.getAttribute("aria-expanded")==="true") {
    await page.keyboard.press("Escape");
    const parentLabel=await parent.getAttribute("aria-label");
    await page.waitForFunction(label=>document.activeElement?.getAttribute("aria-label")===label&&document.activeElement?.getAttribute("aria-expanded")==="false",parentLabel);
  }
}
