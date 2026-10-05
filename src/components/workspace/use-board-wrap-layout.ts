import { useLayoutEffect, useState, type RefObject } from 'react';

// Observe intrinsic cards, never their positioned wrappers. Moving a card does
// not change its measured height; update only when the geometry actually changes.
export function useBoardWrapLayout(viewportRef: RefObject<HTMLDivElement | null>, enabled: boolean, revision: unknown) {
  const [geometry, setGeometry] = useState<{height: number; heights: Record<string, number>}>({height: 0, heights: {}});
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) return;
    let frame = 0;
    const measure = () => {
      const content = viewport.firstElementChild;
      const style = content ? getComputedStyle(content) : null;
      const padding = style ? parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) : 0;
      const header = viewport.querySelector<HTMLElement>('[data-workspace-column-header]');
      const body = viewport.querySelector<HTMLElement>('[data-workspace-wrap-body]');
      const bodyStyle = body ? getComputedStyle(body) : null;
      const height = Math.max(0, viewport.clientHeight - padding - (header?.offsetHeight ?? 36) - (bodyStyle ? parseFloat(bodyStyle.paddingBottom) : 8));
      const heights: Record<string, number> = {};
      viewport.querySelectorAll<HTMLElement>('[data-workspace-wrap-occurrence]').forEach(wrapper => {
        const card = wrapper.firstElementChild;
        if (card) heights[wrapper.dataset.workspaceWrapOccurrence!] = card.getBoundingClientRect().height;
      });
      setGeometry(previous => previous.height === height && JSON.stringify(previous.heights) === JSON.stringify(heights) ? previous : {height, heights});
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); }); };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport);
    viewport.querySelectorAll('[data-workspace-project-drag]').forEach(card => observer.observe(card));
    measure();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [viewportRef, enabled, revision]);
  return geometry;
}
