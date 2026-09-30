/** Preserve pointer hover until keyboard navigation takes ownership of a menu.
 * Scoped to mounted floating menu surfaces; no selection or activation is changed. */
export function installMenuHoverMemory() {
  const remembered = new WeakMap<Element, HTMLElement>();
  function move(event: PointerEvent) {
    if (!(event.target instanceof Element) || event.pointerType === "touch") return;
    const surface = event.target.closest(".workspace-menu-surface, [data-slot=dropdown-menu-content], [data-slot=dropdown-menu-sub-content]");
    if (!surface) return;
    const item = event.target.closest<HTMLElement>("[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], .group\\/workspace-menu-item");
    if (!item || !surface.contains(item) || item.matches("[disabled], [data-disabled], [aria-disabled=true]")) return;
    const previous = remembered.get(surface);
    if (previous !== item) previous?.removeAttribute("data-menu-remembered-hover");
    remembered.set(surface, item);
    item.dataset.menuRememberedHover = "true";
  }
  function key(event: KeyboardEvent) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Tab", "Escape"].includes(event.key)) return;
    document.querySelectorAll("[data-menu-remembered-hover]").forEach(item => item.removeAttribute("data-menu-remembered-hover"));
  }
  document.addEventListener("pointermove", move);
  document.addEventListener("keydown", key, true);
  return () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("keydown", key, true);
    document.querySelectorAll("[data-menu-remembered-hover]").forEach(item => item.removeAttribute("data-menu-remembered-hover"));
  };
}
