import { withDeadline } from "./runtime-lifecycle.mjs";

// A pending loading history can keep view restoration active. Use ordinary
// keyboard navigation at the already-focused button before programmatic layout
// inspection, just as user input takes ownership of scrolling in the app.
export async function prepareRuntimeControlScroll(page, control) {
  const keyboardOwner = await withDeadline(control.evaluate(node => {
    const owner = node.closest('.saved-view-content[data-scroll-restoring="true"]');
    const focused = node.ownerDocument.activeElement;
    return !!owner && focused?.tagName === 'BUTTON' && owner.contains(focused);
  }),15000,'Runtime scroll input owner');
  if (keyboardOwner) await page.keyboard.press('ArrowRight');
}
