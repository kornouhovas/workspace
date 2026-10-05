import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { boardOrderPointerActivated, boardOrderPointerInside, boardOrderDragGeometry, boardOrderScrollSpeed, createBoardOrderSession } from '@/workspaceBoardOrder.js';

type Options = {
  order: readonly string[];
  visibleIds: readonly string[];
  scope: string;
  disabled: boolean;
  viewport: RefObject<HTMLDivElement | null>;
  onReorder?: (order: readonly string[]) => Promise<void>;
};
type Pointer = { id: string; pointerId: number; x: number; y: number; startX: number; startY: number; scrollLeft: number; scrollTop: number; step: number; slotOffsets: number[]; slotIds: string[]; slotWidths: number[]; sourceIndex: number; active: boolean; target: HTMLButtonElement };
export function useBoardColumnOrder(options: Options) {
  const session = useRef(createBoardOrderSession(options.order, options.visibleIds));
  const [snapshot, setSnapshot] = useState(() => session.current.snapshot());
  const pointer = useRef<Pointer | null>(null);
  const current = useRef(options); current.current = options;
  const alive = useRef(true);
  const suppressUntil = useRef(0);
  const scopeKey = options.scope + '\0' + options.visibleIds.join('\0');
  const orderKey = options.order.join('\0');
  const publish = () => {
    if (!alive.current) return;
    const next=session.current.snapshot();
    setSnapshot(previous => previous.activeId===next.activeId && previous.pending===next.pending
      && previous.headers.join('\0')===next.headers.join('\0') && previous.bodies.join('\0')===next.bodies.join('\0')
      ? previous : next);
  };
  function releasePointer() {
    const drag = pointer.current; pointer.current = null;
    if (drag?.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
    if (drag?.active) suppressUntil.current = performance.now() + 250;
  }
  function cancel() { session.current.cancel(); releasePointer(); publish(); }
  async function save(valid: boolean) {
    const drop = session.current.drop(valid);
    releasePointer(); publish();
    if (!drop) return;
    const saveOptions = current.current;
    try {
      await saveOptions.onReorder?.(drop.order);
      if (!alive.current) return;
      session.current.settle(drop.token, true); publish();
    } catch {
      if (!alive.current) return;
      session.current.settle(drop.token, false); publish();
    }
  }
  useLayoutEffect(() => {
    // A retained surface becomes inert as soon as a navigation intent starts.
    // Discard previews and invalidate pending replies even before it unmounts.
    releasePointer(); session.current.reset(options.order, options.visibleIds); publish();
  }, [scopeKey, options.disabled]);
  useLayoutEffect(() => {
    const state = session.current.snapshot();
    if (state.activeId === null && state.pending === null) {
      session.current.reset(options.order, options.visibleIds); publish();
    }
  }, [orderKey]);
  useLayoutEffect(() => {
    alive.current = true;
    let frame = 0;
    function inside(event: { clientX: number; clientY: number }) {
      const rect = current.current.viewport.current?.getBoundingClientRect();
      return boardOrderPointerInside(rect, event.clientX, event.clientY);
    }
    function preview() {
      const drag = pointer.current, viewport = current.current.viewport.current;
      if (!drag?.active || !viewport) return;
      const geometry = boardOrderDragGeometry(drag, drag.x, drag.y, viewport.scrollLeft, viewport.scrollTop);
      // Direct tracking avoids rerendering every card at pointer/frame frequency.
      // React still owns the discrete insertion order and all lifecycle resets.
      const header=drag.target.closest<HTMLElement>('[data-workspace-column-header]');
      if (header) header.style.transform=`translate(${geometry.x}px, ${geometry.y}px)`;
      session.current.preview(geometry.index); publish();
    }
    function tick() {
      const drag = pointer.current, viewport = current.current.viewport.current;
      if (drag?.active && viewport && inside({clientX:drag.x,clientY:drag.y})) {
        const rect=viewport.getBoundingClientRect();
        const speed=boardOrderScrollSpeed(rect,drag.x);
        if (speed) viewport.scrollLeft += speed;
        // Also repaint after wheel/manual scrolling while the pointer is still.
        preview();
      }
      frame=requestAnimationFrame(tick);
    }
    function move(event: globalThis.PointerEvent) {
      const drag=pointer.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.x=event.clientX;drag.y=event.clientY;
      if (!drag.active && boardOrderPointerActivated(drag.startX,drag.startY,drag.x,drag.y)) {
        if (current.current.disabled || !session.current.start(drag.id)) { cancel(); return; }
        drag.active=true;
      }
      if (drag.active) { event.preventDefault(); preview(); }
    }
    function end(event: globalThis.PointerEvent) {
      if (pointer.current?.pointerId !== event.pointerId) return;
      if (!pointer.current.active) { releasePointer(); return; }
      pointer.current.x=event.clientX;pointer.current.y=event.clientY;preview();
      void save(!current.current.disabled && inside(event));
    }
    function cancelled(event: globalThis.PointerEvent) { if(pointer.current?.pointerId === event.pointerId) cancel(); }
    function key(event: globalThis.KeyboardEvent) { if(event.key==='Escape' && pointer.current) { event.preventDefault();cancel(); } }
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',end);
    document.addEventListener('lostpointercapture',cancelled);document.addEventListener('pointercancel',cancelled);document.addEventListener('keydown',key);
    window.addEventListener('blur',cancel);
    frame=requestAnimationFrame(tick);
    return () => {
      alive.current=false;cancelAnimationFrame(frame);
      document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);
      document.removeEventListener('lostpointercapture',cancelled);document.removeEventListener('pointercancel',cancelled);document.removeEventListener('keydown',key);
      window.removeEventListener('blur',cancel);session.current.reset([],[]);
      const drag=pointer.current;pointer.current=null;
      if(drag?.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
    };
  }, []);
  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if(event.button!==0 || !event.isPrimary || options.disabled || !options.onReorder || snapshot.pending!==null || pointer.current) return;
    const viewport=options.viewport.current;
    if(!viewport) return;
    const columns=Array.from(viewport.querySelectorAll<HTMLElement>('[data-workspace-status-target]')).filter(column => options.visibleIds.includes(column.dataset.workspaceStatusTarget!));
    if(columns.length < 2) return;
    const rect=columns[0].getBoundingClientRect();
    const step=columns[1].getBoundingClientRect().left-rect.left;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current={ id, pointerId:event.pointerId, x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY,
      scrollLeft:viewport.scrollLeft, scrollTop:viewport.scrollTop, step,
      slotOffsets:columns.map(column=>column.getBoundingClientRect().left-rect.left),
      slotIds:columns.map(column=>column.dataset.workspaceStatusTarget!), slotWidths:columns.map(column=>column.getBoundingClientRect().width+12), sourceIndex:columns.findIndex(column => column.dataset.workspaceStatusTarget === id), active:false, target:event.currentTarget };
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if(!event.altKey || !['ArrowLeft','ArrowRight'].includes(event.key) || options.disabled || !options.onReorder || pointer.current) return;
    event.preventDefault();event.stopPropagation();
    const ids=snapshot.bodies.filter(value=>options.visibleIds.includes(value));
    if(!session.current.start(id)) return;
    session.current.preview(ids.indexOf(id)+(event.key==='ArrowLeft'?-1:1));
    void save(true);
    // Keyed headers retain their DOM focus when the complete columns move.
    requestAnimationFrame(()=>event.target instanceof HTMLElement && event.target.scrollIntoView({block:'nearest',inline:'nearest'}));
  }
  const bodies=snapshot.bodies.filter(id=>options.visibleIds.includes(id));
  const headers=snapshot.headers.filter(id=>options.visibleIds.includes(id));
  return {
    bodies, headers, activeId:snapshot.activeId, pending:snapshot.pending!==null,
    onPointerDown,onKeyDown,
    suppressClick: () => performance.now() < suppressUntil.current,
    headerStyle(id: string) {
      const from=bodies.indexOf(id),to=headers.indexOf(id);
      const drag=pointer.current;
      const viewport=options.viewport.current;
      const geometry=drag?.active && viewport && id===snapshot.activeId
        ? boardOrderDragGeometry(drag,drag.x,drag.y,viewport.scrollLeft,viewport.scrollTop) : null;
      let displacement = (to-from)*(drag?.step ?? 0);
      if (drag && from >= 0 && to >= 0) {
        const oldOffset=drag.slotOffsets[drag.slotIds.indexOf(id)] ?? 0;
        const nextOffset=headers.slice(0,to).reduce((offset, previousId)=>offset+(drag.slotWidths[drag.slotIds.indexOf(previousId)] ?? 0),0);
        displacement=nextOffset-oldOffset;
      }
      const x=geometry?.x ?? displacement;
      const y=geometry?.y ?? 0;
      return { transform: `translate(${x}px, ${y}px)`,
        position:'relative' as const, zIndex:id===snapshot.activeId ? 1 : undefined };
    },
  };
}
