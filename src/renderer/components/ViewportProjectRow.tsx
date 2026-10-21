import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { Language } from "../../contracts/settings.js";
import { translate } from "../localization.js";

// One observer per renderer, released when the last row leaves the view. The
// complete ordered row skeleton stays in the DOM; only its field UI is bounded.
const targets = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | undefined;
function observe(element: Element, changed: (visible: boolean) => void) {
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) targets.get(entry.target)?.(entry.isIntersecting);
  }, { rootMargin: "1000px" });
  targets.set(element, changed); observer.observe(element);
  return () => {
    observer?.unobserve(element); targets.delete(element);
    if (!targets.size) { observer?.disconnect(); observer = undefined; }
  };
}

interface Props {
  as: "tr" | "li"; projectId: string; projectName: string; language: Language;
  columnCount: number; alwaysVisible?: boolean; busy?: boolean;
  backwards: { current: boolean }; className?: string; style?: CSSProperties;
  onDragOver?(event: DragEvent<HTMLElement>): void;
  onDrop?(event: DragEvent<HTMLElement>): void;
  onPreview?(trigger: HTMLElement): void;
  children(): ReactNode;
}
export function ViewportProjectRow({ as: Row, projectId, projectName, language, columnCount, alwaysVisible = false,
  busy = false, backwards, className, style, onDragOver, onDrop, onPreview, children }: Props) {
  const supported = typeof IntersectionObserver !== "undefined";
  const [rendered, setRendered] = useState(!supported || alwaysVisible);
  const element = useRef<HTMLElement | null>(null), visible = useRef(false), focusRequested = useRef(false);
  const height = useRef(Row === "tr" ? 200 : 1500);
  const retain = useRef(busy); retain.current = busy;
  const permanent = useRef(alwaysVisible); permanent.current = alwaysVisible;
  const reconcile = () => {
    const node = element.current;
    setRendered(current => !supported || permanent.current || visible.current || (retain.current && current) || !!node &&
      (node.contains(document.activeElement) || !!node.querySelector('.text-value-editor, [aria-busy="true"]')));
  };
  const reconcileRef = useRef(reconcile); reconcileRef.current = reconcile;
  useEffect(() => {
    if (!supported || !element.current) return;
    return observe(element.current, current => { visible.current = current; reconcileRef.current(); });
  }, [supported]);
  useEffect(() => {
    if (!rendered || !element.current || !supported) return;
    const node = element.current;
    const mutations = new MutationObserver(() => reconcileRef.current());
    mutations.observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    const size = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(entries => {
      const measured = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect.height;
      if (measured > 0) height.current = measured;
    });
    size?.observe(node);
    return () => { mutations.disconnect(); size?.disconnect(); };
  }, [rendered, supported]);
  useEffect(() => {
    // Let modal/operation focus restoration finish before evicting an offscreen
    // row. This schedules rendering cleanup only, never a mutation or retry.
    // An empty identity shell has no fields to evict. Newly pinned first rows
    // must still reconcile even before their fields have mounted.
    if (!rendered && !alwaysVisible) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => { second = window.requestAnimationFrame(() => reconcileRef.current()); });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [busy, alwaysVisible, rendered]);
  useLayoutEffect(() => {
    if (!rendered || !focusRequested.current) return;
    focusRequested.current = false;
    const controls = element.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([hidden]), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)');
    const control = backwards.current ? controls?.[controls.length - 1] : controls?.[0];
    control?.focus({ preventScroll: true });
  }, [rendered, backwards]);
  const gate = <button type="button" className="workspace-button workspace-button--secondary"
    aria-label={`${translate(language, "loadProjectFields")}: ${projectName}`}
    onFocus={() => { focusRequested.current = true; setRendered(true); }}>{projectName}</button>;
  return <Row ref={(node: HTMLTableRowElement | HTMLLIElement | null) => { element.current = node; }} data-project-id={projectId} data-fields-ready={rendered}
    className={className} style={rendered ? style : { ...style, height: height.current, boxSizing: "border-box" }}
    onClick={event => { const target = event.target as HTMLElement; if (onPreview && typeof target.closest === "function" && !target.closest('button, input, select, textarea, a, .text-property-cell, [role="button"], [role="menu"], [role="dialog"]')) onPreview(event.currentTarget.querySelector<HTMLButtonElement>(".project-preview-trigger") ?? event.currentTarget); }}
    onDragOver={onDragOver} onDrop={onDrop}
    onBlurCapture={() => { window.requestAnimationFrame(() => reconcileRef.current()); }}>
    {rendered ? children() : Row === "tr" ? <td colSpan={Math.max(1, columnCount)}>{gate}</td> : gate}
  </Row>;
}
