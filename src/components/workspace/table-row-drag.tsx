import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { TableRow } from '@/components/ui/table';
import { useI18n } from '@/i18n';
import { reorderTableRows } from '@/workspaceTableOrder.js';
import { tableDragDisplacements } from '@/workspaceDragGeometry.js';
import { resolveStatusDrop } from '@/workspaceStatusDrop.js';
import type { WorkspaceMockProject } from '@/workspaceMockData';
import type { ProjectStatusMoveOption } from '@/workspaceProjectMoveState.js';
import type { ProjectStatusActions } from './project-status-drag';
type Section = {
    readonly id: string;
    readonly rows: readonly WorkspaceMockProject[];
};
type Target = {
    groupId: string;
    projectId: string | null;
    after: boolean;
};
type Drag = {
    projectId: string;
    groupId: string;
    offset: number;
    target: Target | null;
};
type Context = {
    drag: Drag | null;
    disabled: boolean;
    start: (event: ReactPointerEvent, project: WorkspaceMockProject, groupId: string) => void;
    keyboard: (projectId: string, groupId: string, direction: number) => void;
    suppress: () => boolean;
};
const RowDrag = createContext<Context>({ drag: null, disabled: true, start: () => { }, keyboard: () => { }, suppress: () => false });
export function TableRowDragSurface({ children, sections, rowOrder, statusGrouping, onReorderRows, ...actions }: ProjectStatusActions & {
    children: ReactNode;
    sections: readonly Section[];
    rowOrder: readonly string[];
    statusGrouping: boolean;
    onReorderRows?: (ids: readonly string[]) => Promise<void> | void;
}) {
    const { t } = useI18n();
    const root = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [saving, setSaving] = useState(false);
    const [optionsFailed, setOptionsFailed] = useState(false);
    const cleanup = useRef<(() => void) | null>(null);
    const clickUntil = useRef(0);
    const busy = useRef(false);
    useEffect(() => () => cleanup.current?.(), []);
    const disabled = !!actions.statusMovePending || saving || !onReorderRows;
    async function save(ids: string[] | null) { if (!ids || !onReorderRows)
        return; busy.current = true; setSaving(true); try {
        await onReorderRows(ids);
    }
    finally {
        busy.current = false;
        setSaving(false);
    } }
    function reorder(projectId: string, groupId: string, target: Target) {
        const source = sections.find(s => s.id === groupId);
        const destination = sections.find(s => s.id === target.groupId);
        if (!source || !destination || !target.projectId)
            return null;
        const visibleSet = new Set([...source.rows, ...destination.rows].map(p => p.id));
        const visible = rowOrder.filter(id => visibleSet.has(id));
        return reorderTableRows(rowOrder, visible, projectId, target.projectId, target.after);
    }
    function keyboard(projectId: string, groupId: string, direction: number) {
        if (disabled || busy.current)
            return;
        const ids = sections.find(s => s.id === groupId)?.rows.map(p => p.id) || [];
        const index = ids.indexOf(projectId);
        const targetId = ids[index + direction];
        if (targetId)
            void save(reorderTableRows(rowOrder, ids, projectId, targetId, direction > 0));
    }
    function start(event: ReactPointerEvent, project: WorkspaceMockProject, groupId: string) {
        if (disabled || busy.current || event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        cleanup.current?.();
        setOptionsFailed(false);
        const sourceRow = event.currentTarget.closest<HTMLElement>('[data-workspace-project-row]');
        const scroller = root.current?.querySelector<HTMLElement>('[data-table-scroll]');
        if (!sourceRow || !scroller)
            return;
        let active = false, frame = 0, clientX = event.clientX, clientY = event.clientY, target: Target | null = null, options: readonly ProjectStatusMoveOption[] | null = null, cancelled = false;
        const initialY = event.clientY, initialScrollTop = scroller.scrollTop;
        const measuredRows = Array.from(scroller.querySelectorAll<HTMLElement>('tr')).map(node => ({
            node, rect: node.getBoundingClientRect(), transform: node.style.transform,
            transition: node.style.transition, position: node.style.position,
        }));
        const sourceIndex = measuredRows.findIndex(row => row.node === sourceRow);
        const bodies = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-table-section]') || []).map(node => ({ node, rect: node.getBoundingClientRect() }));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        function originalBox(node: HTMLElement) {
            const rect = measuredRows.find(row => row.node === node)?.rect ?? bodies.find(body => body.node === node)!.rect;
            const delta = scroller!.scrollTop - initialScrollTop;
            return { top: rect.top - delta, bottom: rect.bottom - delta, height: rect.height };
        }
        const cursor = document.body.style.cursor, selection = document.body.style.userSelect;
        function findTarget(): Target | null {
            const bounds = scroller!.getBoundingClientRect();
            if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom)
                return null;
            for (const { node: body } of bodies) {
                const rect = originalBox(body);
                if (clientY < rect.top || clientY > rect.bottom)
                    continue;
                const destination = body.dataset.tableSection!;
                if (destination !== groupId && (!statusGrouping || !resolveStatusDrop(options, destination.startsWith('value:') ? destination.slice(6) : null, !!actions.statusMovePending)))
                    return null;
                const rows = Array.from(body.querySelectorAll<HTMLElement>('[data-workspace-project-row]')).filter(row => row !== sourceRow);
                if (!rows.length)
                    return destination === groupId ? null : { groupId: destination, projectId: null, after: true };
                for (const row of rows) {
                    const box = originalBox(row);
                    if (clientY < box.bottom)
                        return { groupId: destination, projectId: row.dataset.workspaceProjectRow!, after: clientY >= box.top + box.height / 2 };
                }
                return { groupId: destination, projectId: rows.at(-1)!.dataset.workspaceProjectRow!, after: true };
            }
            return null;
        }
        function paint() {
            frame = 0;
            if (!active || cancelled)
                return;
            const bounds = scroller!.getBoundingClientRect();
            if (clientY < bounds.top + 32)
                scroller!.scrollTop -= 10;
            else if (clientY > bounds.bottom - 32)
                scroller!.scrollTop += 10;
            target = findTarget();
            const destination = target ? Array.from(root.current?.querySelectorAll<HTMLElement>('[data-table-section]') || []).find(e => e.dataset.tableSection === target!.groupId) : null;
            const insertion = target?.projectId ? Array.from(destination?.querySelectorAll<HTMLElement>('[data-workspace-project-row]') || []).find(e => e.dataset.workspaceProjectRow === target!.projectId) : destination?.querySelector<HTMLElement>('[data-table-group-id]');
            const targetIndex = insertion ? measuredRows.findIndex(row => row.node === insertion) : null;
            const offsets = tableDragDisplacements(measuredRows.map(row => ({ height: row.rect.height })), sourceIndex, targetIndex, !!target?.after);
            measuredRows.forEach(({ node, transform, transition }, index) => {
                if (node === sourceRow) return;
                const offset = offsets[index];
                node.style.transform = offset ? `translateY(${offset}px)` : transform;
                node.style.transition = reducedMotion ? 'none' : 'transform 180ms ease-out';
                if (offset) node.dataset.tableRowDisplaced = String(offset);
                else delete node.dataset.tableRowDisplaced;
            });
            setDrag({ projectId: project.id, groupId, offset: clientY - initialY + scroller!.scrollTop - initialScrollTop, target });
            frame = requestAnimationFrame(paint);
        }
        function move(e: PointerEvent) { clientX = e.clientX; clientY = e.clientY; if (!active && Math.hypot(clientX - event.clientX, clientY - initialY) >= 6) {
            active = true;
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            if (statusGrouping && actions.onLoadStatusOptions)
                void actions.onLoadStatusOptions(project.id).then(value => { if (!cancelled)
                    options = value; }).catch(() => { if (!cancelled)
                    setOptionsFailed(true); });
            paint();
        } }
        function clear() { cancelled = true; cancelAnimationFrame(frame); measuredRows.forEach(({ node, transform, transition }) => { node.style.transform = transform; node.style.transition = transition; delete node.dataset.tableRowDisplaced; }); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); document.body.style.cursor = cursor; document.body.style.userSelect = selection; setDrag(null); cleanup.current = null; if (active)
            clickUntil.current = performance.now() + 250; }
        function cancel() { clear(); }
        function key(e: KeyboardEvent) { if (e.key === 'Escape') {
            e.preventDefault();
            clear();
        } }
        function finish(e: PointerEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
            target = findTarget();
            const drop = active ? target : null;
            clear();
            if (!drop)
                return;
            if (drop.groupId === groupId) {
                void save(reorder(project.id, groupId, drop));
                return;
            }
            const option = resolveStatusDrop(options, drop.groupId.startsWith('value:') ? drop.groupId.slice(6) : null, !!actions.statusMovePending);
            if (!option || !actions.onStatusChange)
                return;
            busy.current = true;
            setSaving(true);
            void Promise.resolve(actions.onStatusChange(project, option)).then(async (moved) => { if (moved === true && onReorderRows) {
                const ids = reorder(project.id, groupId, drop);
                if (ids)
                    await onReorderRows(ids);
            } }).finally(() => { busy.current = false; setSaving(false); });
        }
        cleanup.current = clear;
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('keydown', key);
    }
    return <RowDrag.Provider value={{ drag, disabled, start, keyboard, suppress: () => performance.now() < clickUntil.current }}><div ref={root} className="h-full min-h-0 w-full" data-table-row-drag={drag?.projectId}><span className="sr-only" role="status">{drag ? t('table.rowDragging') : saving ? t('table.rowSaving') : ''}</span>{optionsFailed && <p role="alert" className="px-2 py-1 text-xs text-destructive">{t('move.optionsFailed')}</p>}{children}</div></RowDrag.Provider>;
}
export function TableDragRow({ project, groupId, ...props }: ComponentProps<typeof TableRow> & {
    project: WorkspaceMockProject;
    groupId: string;
}) {
    const context = useContext(RowDrag);
    const dragging = context.drag?.projectId === project.id && context.drag.groupId === groupId;
    const style: CSSProperties = { ...props.style, ...(dragging ? { transform: `translateY(${context.drag!.offset}px)`, position: 'relative', zIndex: 30, pointerEvents: 'none', backgroundColor: 'var(--popover)', opacity: 1 } : {}) };
    return <TableRow {...props} className={[props.className, dragging ? '[&>td]:bg-popover' : ''].filter(Boolean).join(' ')} style={style} onClickCapture={event => { if (context.suppress()) {
        event.preventDefault();
        event.stopPropagation();
    } }}/>;
}
export function TableDragGroupRow({ groupId, ...props }: ComponentProps<typeof TableRow> & {
    groupId: string;
}) { const { drag } = useContext(RowDrag); const over = drag?.target?.groupId === groupId && !drag.target.projectId; return <TableRow {...props} style={{ ...props.style, ...(over ? { backgroundColor: 'var(--state-active)' } : {}) }}/>; }
export function TableRowHandle({ project, groupId }: {
    project: WorkspaceMockProject;
    groupId: string;
}) { const context = useContext(RowDrag); const { t } = useI18n(); return <button type="button" data-table-row-handle disabled={context.disabled} aria-label={t('table.reorderRow', { name: project.name })} title={t('table.reorderHelp')} className="absolute left-0 top-0 flex h-8 w-6 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover/status-row:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-default" onPointerDown={event => context.start(event, project, groupId)} onClick={event => { event.preventDefault(); event.stopPropagation(); }} onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    event.stopPropagation();
    context.keyboard(project.id, groupId, event.key === 'ArrowUp' ? -1 : 1);
} }}><span aria-hidden="true">⠿</span></button>; }
