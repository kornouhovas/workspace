import { performance } from "node:perf_hooks";
import { withDeadline } from "./runtime-lifecycle.mjs";

// Prepare and measure one stable, loaded surface. Returning false only retries
// readiness/DOM replacement; a real overflow result is returned immediately.
export async function measureDiscoveryLayout(page) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    const ready = await page.waitForFunction(() => globalThis.document.querySelector(".table-view") && !globalThis.document.querySelector('.table-view[aria-busy="true"], .text-properties[aria-busy="true"]'), undefined, { timeout: Math.max(1, deadline - performance.now()) });
    await ready.dispose();
    const result = await withDeadline(page.evaluate(async () => {
      const view = globalThis.document.querySelector(".table-view");
      const ready = () => view && view === globalThis.document.querySelector(".table-view") && !globalThis.document.querySelector('.table-view[aria-busy="true"], .text-properties[aria-busy="true"]');
      if (!ready()) return false;
      const selector = ".text-value-editor, .category-property-header";
      const surfaces = Array.from(globalThis.document.querySelectorAll(selector));
      const table = globalThis.document.querySelector(".project-table-scroll");
      for (const node of surfaces) node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      await new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)));
      const current = Array.from(globalThis.document.querySelectorAll(selector));
      if (!ready() || table !== globalThis.document.querySelector(".project-table-scroll") ||
        current.length !== surfaces.length || current.some((node, index) => node !== surfaces[index])) return false;
      const controls = Array.from(globalThis.document.querySelectorAll(".text-value-editor button, .category-property-header button")).map((node) => {
        const bounds = node.getBoundingClientRect(), scroll = node.closest(".project-table-scroll").getBoundingClientRect();
        return { label: node.textContent, left: bounds.left, right: bounds.right, scrollLeft: scroll.left, scrollRight: scroll.right };
      });
      return {
        document: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
        clippedControls: controls.filter((node) => node.left < node.scrollLeft - 1 || node.right > node.scrollRight + 1).map((node) => node.label),
        elements: Array.from(globalThis.document.querySelectorAll(".discovery-panel, .discovery-effects, .discovery-effects li, .discovery-entries li, .workspace-root, .project-table td, .project-table th, .workspace-form-actions, .text-value-button, .text-value-editor"))
          .filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className || node.tagName),
        controls,
      };
    }), Math.max(1, deadline - performance.now()), "Runtime layout readiness");
    if (result !== false) return result;
  }
  throw new Error("Runtime layout readiness timed out");
}

// A focused native select may still carry the previous editor's draft while
// React commits its passive-effect reset. Observe readiness without authoring it.
export async function waitForCategoryMoveEditor(page, originalCategoryId) {
  const ready = await page.waitForFunction((expected) => {
    const editor = globalThis.document.querySelector("#project-category-move-destination");
    return !!editor && editor.value === expected && editor === globalThis.document.activeElement && !editor.disabled;
  }, originalCategoryId, { timeout: 15000 });
  await ready.dispose();
}
