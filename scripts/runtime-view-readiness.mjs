/* global window, document */
// Readonly predicate serialized into the actual renderer by runtime acceptance.
// A row can overlap the window while being completely clipped by a Board column
// scroller or the shell's working area. Such identity skeletons are offscreen;
// every actually visible row still needs its real field controls.
export function usableRuntimeViewProjection(ids) {
  const content = document.querySelector(".text-properties");
  if (!content || content.getAttribute("aria-busy") !== "false") return false;
  if (document.querySelector('[aria-busy="true"]')) return false;
  const rows = [...content.querySelectorAll("[data-project-id]")];
  const clips = new Map();
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    let left = Math.max(0, rect.left), right = Math.min(window.innerWidth, rect.right);
    let top = Math.max(0, rect.top), bottom = Math.min(window.innerHeight, rect.bottom);
    if (right <= left || bottom <= top) continue;
    for (let parent = row.parentElement; parent && right > left && bottom > top; parent = parent.parentElement) {
      let clip = clips.get(parent);
      if (!clip) {
        const style = window.getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        const x = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
        const y = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        clip = { x, y, left: bounds.left + parent.clientLeft, top: bounds.top + parent.clientTop,
          width: parent.clientWidth, height: parent.clientHeight };
        clips.set(parent, clip);
      }
      if (clip.x) { left = Math.max(left, clip.left); right = Math.min(right, clip.left + clip.width); }
      if (clip.y) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.top + clip.height); }
    }
    if (right <= left || bottom <= top) continue;
    if (row.getAttribute("data-fields-ready") === "false" || !row.querySelector("button, input, textarea, select")) return false;
  }
  return ids ? rows.length === ids.length && rows.every((row, index) => row.getAttribute("data-project-id") === ids[index]) : rows.length > 0;
}
