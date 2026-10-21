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
        // Client dimensions round to integers. Recover the fractional padding
        // box from the actual bounds, retaining any native scrollbar space.
        const borderLeft = parseFloat(style.borderLeftWidth) || 0, borderRight = parseFloat(style.borderRightWidth) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0, borderBottom = parseFloat(style.borderBottomWidth) || 0;
        const scrollbarX = Math.max(0, parent.offsetHeight - parent.clientHeight - Math.round(borderTop + borderBottom));
        const scrollbarY = Math.max(0, parent.offsetWidth - parent.clientWidth - Math.round(borderLeft + borderRight));
        const scrollbarLeft = Math.max(0, parent.clientLeft - Math.round(borderLeft));
        clip = { x, y, left: bounds.left + borderLeft + scrollbarLeft, top: bounds.top + borderTop,
          right: bounds.right - borderRight - scrollbarY + scrollbarLeft,
          bottom: bounds.bottom - borderBottom - scrollbarX };
        clips.set(parent, clip);
      }
      if (clip.x) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (clip.y) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
    if (right <= left || bottom <= top) continue;
    if (row.getAttribute("data-fields-ready") === "false" || !row.querySelector("button, input, textarea, select")) return false;
  }
  return ids ? rows.length === ids.length && rows.every((row, index) => row.getAttribute("data-project-id") === ids[index]) : rows.length > 0;
}

// Failure-only, readonly and bounded. Never retain authored text, IDs or paths.
export function inspectRuntimeProjectionFailure(ids) {
  const content=document.querySelector('.text-properties');
  const rows=content?[...content.querySelectorAll('[data-project-id]')]:[];
  const save=document.querySelector('.view-filter-controls:not([aria-hidden="true"] *) button[type="submit"], .view-filters button[type="submit"]');
  const search=document.querySelector('.view-filter-controls:not([aria-hidden="true"] *) input[type="search"], .view-filters input[type="search"]');
  return {expectedCount:ids?.length??null,rowCount:rows.length,
    firstMismatch:ids?rows.findIndex((row,index)=>row.getAttribute('data-project-id')!==ids[index]):null,
    unloadedCount:rows.filter(row=>row.getAttribute('data-fields-ready')==='false').length,
    pendingCount:document.querySelectorAll('[aria-busy="true"]').length,
    groupCount:content?.querySelectorAll('.project-group').length??0,
    saveDisabled:save?save.matches(':disabled,[aria-disabled="true"]'):null,
    searchEmpty:search?search.value==='':null};
}
