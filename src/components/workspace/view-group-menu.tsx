import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EyeIcon, EyeOffIcon, ChevronLeftIcon } from "@/lib/workspace-icons";
import { useI18n } from "@/i18n";
import type { WorkspaceViewState, WorkspaceGroupingState, WorkspaceTableGroup, WorkspacePropertyDefinitionState } from "@/workspaceAppState";
import type { GroupingMutation } from "@/workspaceGroupingMutations";
import { normalizeGrouping, moveGroupingGroup, reorderGroupingGroup } from "@/workspaceGrouping.js";

type Props = {
  readonly view: WorkspaceViewState;
  readonly properties: readonly WorkspacePropertyDefinitionState[];
  readonly groups: readonly WorkspaceTableGroup[];
  readonly onChange: (mutation: GroupingMutation) => void;
  readonly onBack: () => void;
};

export function WorkspaceViewGroupMenu({ view, properties, groups, onChange, onBack }: Props) {
  const { t } = useI18n();
  const grouping = view.grouping;
  const listRef = useRef<HTMLDivElement>(null);
  const cancelDrag = useRef<(() => void) | null>(null);
  const [drag, setDrag] = useState<{ id: string; beforeId: string | null; x: number; y: number; width: number } | null>(null);
  useEffect(() => () => cancelDrag.current?.(), [view.id, grouping?.propertyId]);

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, group: WorkspaceTableGroup) {
    if (event.button !== 0 || !listRef.current) return;
    event.preventDefault();
    cancelDrag.current?.();
    const list = listRef.current;
    const origin = { x: event.clientX, y: event.clientY };
    const propertyId = grouping?.propertyId;
    const ids = groups.filter(item => !item.empty).map(item => item.id);
    let x = origin.x;
    let y = origin.y;
    let active = false;
    let beforeId: string | null = group.id;
    let frame = 0;
    const width = list.getBoundingClientRect().width;
    event.currentTarget.setPointerCapture(event.pointerId);
    function inside() {
      const rect = list.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }
    function update() {
      if (!active) return;
      if (inside()) {
        const rect = list.getBoundingClientRect();
        const speed = y < rect.top + 24 ? -8 : y > rect.bottom - 24 ? 8 : 0;
        if (speed) list.scrollTop += speed;
        const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-group-option-id]"));
        beforeId = rows.find(row => row.dataset.groupOptionId !== "empty" && y < row.getBoundingClientRect().top + row.offsetHeight / 2)?.dataset.groupOptionId ?? null;
      }
      setDrag({ id: group.id, beforeId, x, y, width });
    }
    function tick() {
      update();
      frame = requestAnimationFrame(tick);
    }
    function move(event: PointerEvent) {
      x = event.clientX;
      y = event.clientY;
      if (!active && Math.hypot(x - origin.x, y - origin.y) > 5) {
        active = true;
        tick();
      }
      update();
    }
    function cleanup() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("keydown", key, true);
      cancelDrag.current = null;
      setDrag(null);
    }
    function finish(event: PointerEvent) {
      x = event.clientX;
      y = event.clientY;
      update();
      const changed = active && inside() && reorderGroupingGroup(grouping ?? null, ids, group.id, beforeId) !== grouping;
      cleanup();
      if (changed) onChange(current => current?.propertyId === propertyId ? reorderGroupingGroup(current, ids, group.id, beforeId) : current);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cleanup();
      }
    }
    cancelDrag.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("keydown", key, true);
  }

  const update = (patch: Partial<WorkspaceGroupingState>) => onChange(current => current ? { ...current, ...patch } : null);
  const label = (group: WorkspaceTableGroup) => group.empty
    ? t(grouping?.propertyId === "property:status" ? "property.noStatus" : "group.noValue") : group.name;

  function move(id: string, direction: number) {
    onChange(current => moveGroupingGroup(current, groups.map(group => group.id), id, direction));
  }

  return <div data-workspace-group-menu="true" className="grid gap-1 p-2">
    <div className="mb-1 flex items-center gap-2">
      <Button variant="ghost" size="icon" className="size-6" aria-label={t("group.back")} onClick={onBack}><ChevronLeftIcon className="size-3" /></Button>
      <span className="text-xs font-semibold">{t("group.title")}</span>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-2 px-1 text-xs">
      <span className="shrink-0">{t("group.by")}</span>
      <Select value={grouping?.propertyId ?? "none"} onValueChange={propertyId => onChange(propertyId === "none" ? null : normalizeGrouping({ propertyId }))}>
        <SelectTrigger autoFocus aria-label={t("group.by")} className="h-7 w-40 min-w-0 border-0 bg-transparent text-xs shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent data-workspace-group-menu="true" className="max-h-72 max-w-64">
          <SelectItem value="none">{t("group.none")}</SelectItem>
          {properties.map(property => <SelectItem key={property.id} value={property.id}><span className="truncate" title={property.name}>{property.name}</span></SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div className="flex min-w-0 items-center justify-between gap-2 px-1 text-xs">
      <span>{t("group.sort")}</span>
      <Select disabled={!grouping} value={grouping?.sort ?? "default"} onValueChange={sort => update({ sort: sort as WorkspaceGroupingState["sort"] })}>
        <SelectTrigger aria-label={t("group.sort")} className="h-7 w-40 min-w-0 border-0 bg-transparent text-xs shadow-none"><SelectValue /></SelectTrigger>
        <SelectContent data-workspace-group-menu="true">
          {(["default", "ascending", "descending", "manual"] as const).map(sort => <SelectItem value={sort} key={sort}>{t(`group.sort.${sort}`)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    {grouping && <>
      <label className="flex h-8 items-center justify-between gap-2 px-1 text-xs">
        {t("group.hideEmpty")}<Checkbox aria-label={t("group.hideEmpty")} checked={grouping.hideEmpty} onCheckedChange={hideEmpty => update({ hideEmpty: hideEmpty === true })} />
      </label>
      <div className="my-1 border-t border-border/70" />
      <div className="flex gap-1">
        <Button variant="ghost" className="h-7 flex-1 px-1 text-xs" onClick={() => update({ collapsedGroupIds: groups.map(group => group.id) })}>{t("group.collapseAll")}</Button>
        <Button variant="ghost" className="h-7 flex-1 px-1 text-xs" onClick={() => update({ collapsedGroupIds: [] })}>{t("group.expandAll")}</Button>
      </div>
      <div className="flex h-7 items-center justify-between px-1 text-xs text-muted-foreground">
        <span>{t("group.groups")}</span><Button variant="ghost" className="h-6 px-1 text-xs" onClick={() => update({ hiddenGroupIds: [] })}>{t("group.showAll")}</Button>
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto">
        {groups.map((group, index) => <div data-group-option-id={group.id} className={`relative flex h-8 min-w-0 items-center gap-1 px-1 text-xs ${drag?.id === group.id ? "opacity-40" : ""} ${drag && (drag.beforeId === group.id || (group.empty && drag.beforeId === null)) ? "shadow-[inset_0_2px_0_var(--primary)]" : ""}`} key={group.id}>
          {!group.empty ? <Button variant="ghost" size="icon" className="size-6 shrink-0 touch-none cursor-grab active:cursor-grabbing" aria-label={t("group.reorder", { name: label(group) })} title={t("group.reorderHelp")} onPointerDown={event => startDrag(event, group)} onKeyDown={event => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); move(group.id, event.key === "ArrowUp" ? -1 : 1); }
          }}><svg viewBox="0 0 12 16" className="h-4 w-3" aria-hidden="true"><g fill="currentColor">{[4,8,12].map(y => <g key={y}><circle cx="4" cy={y} r="1"/><circle cx="8" cy={y} r="1"/></g>)}</g></svg></Button> : <span className="w-6 shrink-0"/>}
          {group.color ? <span data-color={group.color} className="size-2 shrink-0 rounded-full" /> : null}
          <span className="min-w-0 flex-1 truncate" title={label(group)}>{label(group)}</span><span className="text-muted-foreground">{group.count}</span>
          <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t(group.hidden ? "group.show" : "group.hide", { name: label(group) })} onClick={() => onChange(current => current ? {
            ...current, hiddenGroupIds: current.hiddenGroupIds.includes(group.id) ? current.hiddenGroupIds.filter(id => id !== group.id) : [...current.hiddenGroupIds, group.id],
          } : null)}>{group.hidden ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}</Button>
        </div>)}
        {drag && drag.beforeId === null && !groups.some(group => group.empty) ? <div className="h-0.5 bg-primary" /> : null}
      </div>
      {drag ? createPortal(<div data-group-drag-preview="true" className="pointer-events-none fixed z-[100] flex h-8 items-center gap-2 rounded-md border bg-popover px-2 text-xs shadow-lg" style={{ left: Math.max(8, drag.x + 12 + drag.width > window.innerWidth ? drag.x - drag.width - 12 : drag.x + 12), top: Math.min(drag.y + 12, window.innerHeight - 40), width: drag.width }}><span className="truncate">{label(groups.find(group => group.id === drag.id)!)}</span></div>, document.body) : null}
      <p className="px-1 py-1 text-[11px] text-muted-foreground">{t("group.emptyLast")}</p>
      <div className="my-1 border-t border-border/70" />
      <Button variant="ghost" className="h-7 justify-start px-1 text-xs" onClick={() => onChange(null)}>{t("group.remove")}</Button>
    </>}
  </div>;
}
