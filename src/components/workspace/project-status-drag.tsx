import { createContext, useContext, useRef, useState, useLayoutEffect, type ComponentProps, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import type { WorkspaceMockProject } from '@/workspaceMockData';
import type { ProjectStatusMoveOption } from '@/workspaceProjectMoveState.js';
import { resolveStatusDrop } from '@/workspaceStatusDrop.js';
import { captureDragSnapshot } from './drag-snapshot';

export type ProjectStatusActions = {
  readonly statusMovePending?: boolean;
  readonly onLoadStatusOptions?: (projectId: string) => Promise<readonly ProjectStatusMoveOption[]>;
  readonly onStatusChange?: (project: WorkspaceMockProject, option: ProjectStatusMoveOption) => void | Promise<boolean | void>;
};
type DragState = { project: WorkspaceMockProject; options: readonly ProjectStatusMoveOption[] | null; failed: boolean; snapshot: ReturnType<typeof captureDragSnapshot> };
const StatusDrag = createContext<ProjectStatusActions & { drag: DragState | null; suppressClick: () => boolean }>({ drag: null, suppressClick: () => false });

export function ProjectStatusDragSurface({ children, ...actions }: ProjectStatusActions & { children: ReactNode }) {
  const { t } = useI18n();
  const [drag, setDrag] = useState<DragState | null>(null);
  const operation = useRef(0);
  const optionsRef = useRef<readonly ProjectStatusMoveOption[] | null>(null);
  const clickUntil = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function clear() { operation.current++; optionsRef.current = null; setDrag(null); clickUntil.current = performance.now() + 250; }
  return <StatusDrag.Provider value={{ ...actions, drag, suppressClick: () => performance.now() < clickUntil.current }}>
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active }) => {
      const project = active.data.current?.project as WorkspaceMockProject | undefined;
      if (!project || actions.statusMovePending || !actions.onLoadStatusOptions) return;
      const source = active.data.current?.node?.current as HTMLElement | null;
      if (!source) return;
      const snapshot = captureDragSnapshot(source);
      const token = ++operation.current;
      optionsRef.current = null;
      setDrag({ project, options: null, failed: false, snapshot });
      void actions.onLoadStatusOptions(project.id).then(options => {
        if (token !== operation.current) return;
        optionsRef.current = options; setDrag({ project, options, failed: false, snapshot });
      }).catch(() => { if (token === operation.current) setDrag({ project, options: null, failed: true, snapshot }); });
    }} onDragCancel={clear} onDragEnd={({ active, over }) => {
      const option = resolveStatusDrop(optionsRef.current, over?.data.current?.statusValueId ?? null, !!actions.statusMovePending);
      const project = active.data.current?.project as WorkspaceMockProject | undefined;
      clear();
      if (project && option) actions.onStatusChange?.(project, option);
    }}>
      {children}
      {drag && <div role="status" className="sr-only">{t(drag.failed ? 'move.optionsFailed' : drag.options ? 'move.chooseStatus' : 'move.loading')}</div>}
      <DragOverlay dropAnimation={null} adjustScale={false}>{drag ? <CapturedCard snapshot={drag.snapshot} /> : null}</DragOverlay>
    </DndContext>
  </StatusDrag.Provider>;
}
function CapturedCard({ snapshot }: { snapshot: ReturnType<typeof captureDragSnapshot> }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { host.current?.replaceChildren(snapshot.node); return () => snapshot.node.remove(); }, [snapshot]);
  return <div ref={host} data-workspace-project-drag-preview aria-hidden="true" inert style={{ width: snapshot.width, height: snapshot.height, pointerEvents: 'none' }} />;
}
export function StatusDropColumn({ statusValueId, children, ...props }: ComponentProps<'section'> & { statusValueId: string }) {
  const { drag, statusMovePending } = useContext(StatusDrag);
  const option = resolveStatusDrop(drag?.options ?? null, statusValueId, !!statusMovePending);
  const { setNodeRef, isOver } = useDroppable({ id: `status:${statusValueId}`, disabled: !option, data: { statusValueId } });
  return <section {...props} ref={setNodeRef} data-workspace-status-target={statusValueId} data-over={isOver || undefined} data-status-drop-state={drag ? option ? isOver ? "active" : "available" : "unavailable" : undefined}
    style={{ ...props.style, backgroundColor: drag && option ? isOver ? "var(--state-active)" : "var(--state-hover)" : undefined, borderRadius: 8 }}>{children}</section>;
}
export function StatusDragCard({ project, children, ...props }: ComponentProps<'article'> & { project: WorkspaceMockProject }) {
  const context = useContext(StatusDrag);
  const node = useRef<HTMLElement | null>(null);
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `project:${project.id}`, data: { project, node }, disabled: context.statusMovePending || !context.onLoadStatusOptions });
  return <article {...props} ref={element => { node.current = element; setNodeRef(element); }} data-workspace-project-drag={project.id} style={{ ...props.style, opacity: isDragging ? .45 : undefined }}
    onPointerDown={event => {
      // Editors and the status picker retain their own pointer interactions.
      const target = event.target as Element;
      if (target.closest('[data-workspace-status-picker], input, textarea, [data-workspace-select-value-trigger]') || (target.closest('button') && !target.closest('[data-workspace-card-open]'))) return;
      listeners?.onPointerDown?.(event);
    }} onClickCapture={event => { if (context.suppressClick()) { event.preventDefault(); event.stopPropagation(); } }}>{children}</article>;
}
