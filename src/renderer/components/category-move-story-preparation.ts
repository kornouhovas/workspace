import type { Language } from "../../contracts/settings.js";
import { translate } from "../localization.js";

// Fixture preparation only: initial discovery can invalidate an already opened
// read-only review. One fresh review may settle it; repeated instability fails.
export function createInitialCategoryMoveReviewRefresh(language: Language) {
  let refreshed = false;
  let reopen: HTMLButtonElement | null = null;
  return (root: HTMLElement) => {
    const list = root.querySelector(".category-move-operations");
    const review = root.querySelector(".category-move-review");
    if (reopen) {
      if (review) return true;
      if (!showCategoryMoveStoryHistory(root)) return true;
      if (!reopen.isConnected || reopen.disabled || list?.getAttribute("aria-busy") !== "false") return true;
      const trigger = reopen;
      reopen = null;
      trigger.click();
      return true;
    }
    if (refreshed || list?.getAttribute("aria-busy") !== "false" || review?.getAttribute("aria-busy") !== "false") return false;
    const stale = [...review.querySelectorAll(".bb-status__title")].some((node) => node.textContent === translate(language, "moveCategoryReviewStale"));
    const close = [...review.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === translate(language, "moveCategoryReviewClose"));
    const trigger = root.querySelector<HTMLButtonElement>(".category-move-operations > div > button:last-of-type");
    if (!stale || !close || close.disabled || !trigger || trigger.disabled) return false;
    refreshed = true;
    // Separate committed close/open renders restore the ordinary initial heading
    // focus. Refreshing the same selected operation preserves its retry control.
    reopen = trigger;
    close.click();
    return true;
  };
}

// Locate the actual production action while preparing the disposable story.
export function openCategoryMoveStoryAction(root: HTMLElement, language: Language) {
  const prefix = `${translate(language, "moveCategory")}: `;
  const actions = [...root.querySelectorAll<HTMLButtonElement>("button[aria-label]")]
    .filter(button => button.getAttribute("aria-label")?.startsWith(prefix));
  if (actions.length !== 1 || actions[0].disabled) return false;
  const button = actions[0];
  const panel = button.closest<HTMLElement>("[data-context-return]");
  if (panel?.hidden) {
    const trigger = root.ownerDocument.getElementById(panel.dataset.contextReturn!);
    if (trigger?.tagName === "BUTTON" && !(trigger as HTMLButtonElement).disabled) trigger.click();
    return false;
  }
  button.click();
  return true;
}

export function showCategoryMoveStoryHistory(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>(".category-move-operations");
  if (!list) return false;
  const panel = list.closest<HTMLElement>("[data-context-return]");
  if (panel?.hidden) {
    const trigger = root.ownerDocument.getElementById(panel.dataset.contextReturn!);
    if (trigger?.tagName === "BUTTON" && !(trigger as HTMLButtonElement).disabled) trigger.click();
    return false;
  }
  const details = list.closest("details");
  if (details && !details.open) { details.querySelector("summary")?.click(); return false; }
  return true;
}
