import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EyeIcon, EyeOffIcon, ChevronUpIcon, ChevronDownIcon, ChevronLeftIcon } from "@/lib/workspace-icons";
import { useI18n } from "@/i18n";
import type { WorkspaceViewState, WorkspaceGroupingState, WorkspaceTableGroup, WorkspacePropertyDefinitionState } from "@/workspaceAppState";
import type { GroupingMutation } from "@/workspaceGroupingMutations";
import { normalizeGrouping, moveGroupingGroup } from "@/workspaceGrouping.js";

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
      <div className="max-h-64 overflow-y-auto">
        {groups.map((group, index) => <div className="flex h-8 min-w-0 items-center gap-1 px-1 text-xs" key={group.id}>
          {grouping.sort === "manual" && !group.empty && <>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" disabled={index === 0} aria-label={t("group.moveUp", { name: label(group) })} onClick={() => move(group.id, -1)}><ChevronUpIcon className="size-3" /></Button>
            <Button variant="ghost" size="icon" className="size-6 shrink-0" disabled={index >= groups.filter(item => !item.empty).length - 1} aria-label={t("group.moveDown", { name: label(group) })} onClick={() => move(group.id, 1)}><ChevronDownIcon className="size-3" /></Button>
          </>}
          {group.color ? <span data-color={group.color} className="size-2 shrink-0 rounded-full" /> : null}
          <span className="min-w-0 flex-1 truncate" title={label(group)}>{label(group)}</span><span className="text-muted-foreground">{group.count}</span>
          <Button variant="ghost" size="icon" className="size-6 shrink-0" aria-label={t(group.hidden ? "group.show" : "group.hide", { name: label(group) })} onClick={() => onChange(current => current ? {
            ...current, hiddenGroupIds: current.hiddenGroupIds.includes(group.id) ? current.hiddenGroupIds.filter(id => id !== group.id) : [...current.hiddenGroupIds, group.id],
          } : null)}>{group.hidden ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}</Button>
        </div>)}
      </div>
      <p className="px-1 py-1 text-[11px] text-muted-foreground">{t("group.emptyLast")}</p>
      <div className="my-1 border-t border-border/70" />
      <Button variant="ghost" className="h-7 justify-start px-1 text-xs" onClick={() => onChange(null)}>{t("group.remove")}</Button>
    </>}
  </div>;
}
