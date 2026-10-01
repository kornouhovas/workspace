import { createContext, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { getStatusDisplayName } from '@/i18n/status';
import type { WorkspaceMockProject } from '@/workspaceMockData';
import type { ProjectStatusMoveOption } from '@/workspaceProjectMoveState.js';
import { resolveStatusDrop } from '@/workspaceStatusDrop.js';
import { ProjectStatusPicker } from './project-status-picker';

export type ProjectStatusActions = {
  readonly statusMovePending?: boolean;
  readonly onLoadStatusOptions?: (projectId: string) => Promise<readonly ProjectStatusMoveOption[]>;
  readonly onStatusChange?: (project: WorkspaceMockProject, option: ProjectStatusMoveOption) => void;
};
type DragState = { project: WorkspaceMockProject; options: readonly ProjectStatusMoveOption[] | null; failed: boolean };
const StatusDrag = createContext<ProjectStatusActions & { drag: DragState | null; suppressClick: () => boolean }>({ drag: null, suppressClick: () => false });

export function ProjectStatusDragSurface({ children, table = false, ...actions }: ProjectStatusActions & { children: ReactNode; table?: boolean }) {
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
      const token = ++operation.current;
      optionsRef.current = null;
      setDrag({ project, options: null, failed: false });
      void actions.onLoadStatusOptions(project.id).then(options => {
        if (token !== operation.current) return;
        optionsRef.current = options; setDrag({ project, options, failed: false });
      }).catch(() => { if (token === operation.current) setDrag({ project, options: null, failed: true }); });
    }} onDragCancel={clear} onDragEnd={({ active, over }) => {
      const option = resolveStatusDrop(optionsRef.current, over?.data.current?.statusValueId ?? null, !!actions.statusMovePending);
      const project = active.data.current?.project as WorkspaceMockProject | undefined;
      clear();
      if (project && option) actions.onStatusChange?.(project, option);
    }}>
      {children}
      {table && drag && createPortal(<div data-workspace-status-zones className="fixed inset-x-4 top-16 z-50 flex max-h-[40vh] flex-wrap gap-2 overflow-auto rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg" role="region" aria-label={t('move.chooseStatus')}>
        {drag.options ? drag.options.map(option => <StatusDropZone key={option.id} option={option} />) : <span role="status" className="text-sm">{t(drag.failed ? 'move.optionsFailed' : 'move.loading')}</span>}
      </div>, document.body)}
      {drag && !table && <div role="status" className="sr-only">{t(drag.failed ? 'move.optionsFailed' : drag.options ? 'move.chooseStatus' : 'move.loading')}</div>}
      <DragOverlay dropAnimation={null}>{drag ? <div data-workspace-project-drag-preview className="max-w-72 truncate rounded-lg border border-ring bg-card px-3 py-2 text-sm text-card-foreground shadow-lg">{drag.project.name}{drag.failed && <span className="block whitespace-normal text-xs text-destructive">{t('move.optionsFailed')}</span>}</div> : null}</DragOverlay>
    </DndContext>
  </StatusDrag.Provider>;
}
function StatusDropZone({ option }: { option: ProjectStatusMoveOption }) {
  const { t } = useI18n();
  const disabled = option.current || !!option.disabledReason || !option.to;
  const { setNodeRef, isOver } = useDroppable({ id: `status:${option.id}`, disabled, data: { statusValueId: option.id } });
  return <div ref={setNodeRef} data-workspace-status-target={option.id} data-disabled={disabled || undefined} data-over={isOver || undefined}
    className={`flex min-w-28 max-w-64 flex-col gap-1 rounded-md border px-3 py-2 text-sm ${disabled ? 'border-border text-muted-foreground opacity-60' : isOver ? 'border-ring bg-accent' : 'border-dashed border-border bg-background'}`}>
    <span className="flex min-w-0 items-center gap-2"><span data-color={option.color || 'gray'} className="size-2 shrink-0 rounded-full bg-muted-foreground" /><span className="truncate" title={option.name}>{getStatusDisplayName(t, option)}</span></span>
    {option.disabledReason && !option.current && <span className="text-xs">{t(option.disabledReason === 'no-status-target' ? 'move.noStatusReason' : 'move.nestedStatusReason')}</span>}
    {option.current && <span className="text-xs">{t('move.currentStatus')}</span>}
  </div>;
}
export function StatusDropColumn({ statusValueId, children, ...props }: ComponentProps<'section'> & { statusValueId: string }) {
  const { drag, statusMovePending } = useContext(StatusDrag);
  const option = resolveStatusDrop(drag?.options ?? null, statusValueId, !!statusMovePending);
  const { setNodeRef, isOver } = useDroppable({ id: `status:${statusValueId}`, disabled: !option, data: { statusValueId } });
  return <section {...props} ref={setNodeRef} data-workspace-status-target={statusValueId} data-over={isOver || undefined}
    style={{ ...props.style, minHeight: drag ? 120 : undefined, outline: drag && option ? `1px ${isOver ? 'solid' : 'dashed'} var(--${isOver ? 'ring' : 'border'})` : undefined, borderRadius: 8 }}>{children}</section>;
}
export function StatusDragCard({ project, children, ...props }: ComponentProps<'article'> & { project: WorkspaceMockProject }) {
  const context = useContext(StatusDrag);
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: `project:${project.id}`, data: { project }, disabled: context.statusMovePending || !context.onLoadStatusOptions });
  return <article {...props} ref={setNodeRef} data-workspace-project-drag={project.id} style={{ ...props.style, opacity: isDragging ? .45 : undefined }}
    onPointerDown={event => {
      // Editors and the status picker retain their own pointer interactions.
      const target = event.target as Element;
      if (target.closest('[data-workspace-status-picker], input, textarea, [data-workspace-select-value-trigger]') || (target.closest('button') && !target.closest('[data-workspace-card-open]'))) return;
      listeners?.onPointerDown?.(event);
    }} onClickCapture={event => { if (context.suppressClick()) { event.preventDefault(); event.stopPropagation(); } }}>{children}</article>;
}
export function StatusRowHandle({ project, occurrenceId }: { project: WorkspaceMockProject; occurrenceId: string }) {
  const context = useContext(StatusDrag);
  const { t } = useI18n();
  const { listeners, setNodeRef } = useDraggable({ id: `project:${occurrenceId}:${project.id}`, data: { project }, disabled: context.statusMovePending || !context.onLoadStatusOptions });
  if (!context.onLoadStatusOptions || !context.onStatusChange) return null;
  return <div ref={setNodeRef} className="absolute left-0 top-0 flex h-8 w-6 items-center justify-center opacity-0 group-hover/status-row:opacity-100 focus-within:opacity-100"
    onPointerDownCapture={event => listeners?.onPointerDown?.(event)} onClickCapture={event => {
      if (context.suppressClick()) { event.preventDefault(); event.stopPropagation(); }
    }}>
    <ProjectStatusPicker project={project} pending={!!context.statusMovePending} loadOptions={context.onLoadStatusOptions} onSelect={context.onStatusChange}
      trigger={<span aria-hidden="true" className="block cursor-grab px-1 text-muted-foreground">⠿</span>} label={t('move.dragOrChooseStatus')} />
  </div>;
}
