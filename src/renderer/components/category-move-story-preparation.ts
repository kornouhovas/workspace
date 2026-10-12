import type { Language } from "../../contracts/settings.js";
import { translate } from "../localization.js";

// Fixture preparation only: initial discovery can invalidate an already opened
// read-only review. One fresh review may settle it; repeated instability fails.
export function createInitialCategoryMoveReviewRefresh(language: Language) {
  let refreshed = false;
  return (root: HTMLElement) => {
    const list = root.querySelector(".category-move-operations");
    const review = root.querySelector(".category-move-review");
    if (refreshed || list?.getAttribute("aria-busy") !== "false" || review?.getAttribute("aria-busy") !== "false") return false;
    const stale = [...review.querySelectorAll(".bb-status__title")].some((node) => node.textContent === translate(language, "moveCategoryReviewStale"));
    const button = [...review.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent === translate(language, "moveCategoryReviewAgain"));
    if (!stale || !button || button.disabled) return false;
    refreshed = true;
    button.click();
    return true;
  };
}
