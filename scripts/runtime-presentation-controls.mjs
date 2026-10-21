import { enterContextFor } from "./runtime-context-tools.mjs";
// The immutable baseline has inline grouping; current Table uses a Radix popover.
export async function openGroupingControls(page, language = "en") {
  const label = language === "en" ? "Grouping" : "Группировка";
  const trigger = page.getByRole("button", {name: label, exact: true, includeHidden:true});
  const panel = page.getByRole("region", {name: label, exact: true, includeHidden:true});
  await trigger.or(panel).first().waitFor({state:"attached"});
  if(await trigger.count()) await enterContextFor(page,trigger);
  else await enterContextFor(page,panel);
  if (await trigger.count() && await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.scrollIntoViewIfNeeded();
    await trigger.press("Enter");
    // DOM actionability can precede the first composited popover frame. Observe
    // its stable pixels before a caller starts timing a choice inside it.
    await panel.screenshot({ animations: "allow" });
  }
  return panel;
}
export async function closeGroupingControls(page, language = "en") {
  const trigger = page.getByRole("button", {name: language === "en" ? "Grouping" : "Группировка", exact: true, includeHidden:true});
  if (await trigger.count() && await trigger.getAttribute("aria-expanded") === "true") await page.keyboard.press("Escape");
  const parent=page.getByRole("button",{name:/^(View settings|Настройки представления)$/});
  if(await parent.count() && await parent.getAttribute("aria-expanded")==="true") await page.keyboard.press("Escape");
}

// Observe final Radix collision placement without authoring focus or scrolling.
export async function waitForPresentationBounds(page, label) {
  await page.waitForFunction(label => {
    const panel = [...globalThis.document.querySelectorAll('[role="dialog"]')].find(element => element.getAttribute("aria-label") === label);
    if (!panel) return false;
    const bounds = panel.getBoundingClientRect();
    const withinViewport=bounds.width > 0 && bounds.left >= 0 && bounds.right <= globalThis.innerWidth && bounds.top >= 0 && bounds.bottom <= globalThis.innerHeight;
    if(!withinViewport) return false;
    // A portal can fit the viewport while its owning tools panel paints over it.
    const inset=Math.min(16,bounds.width/2,bounds.height/2);
    return [[bounds.left+inset,bounds.top+inset],[bounds.right-inset,bounds.top+inset],
      [bounds.left+inset,bounds.bottom-inset],[bounds.right-inset,bounds.bottom-inset],
      [bounds.left+bounds.width/2,bounds.top+bounds.height/2]].every(([x,y])=>panel.contains(globalThis.document.elementFromPoint(x,y)));
  }, label);
}
