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
