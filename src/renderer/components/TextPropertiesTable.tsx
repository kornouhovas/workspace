import { useScalarDraftActive } from "./ScalarDrafts.js";
import { navigationLabels } from "./ProjectNavigation.js";
import { ViewControls } from "./ManagementSurface.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import { ContextTools, contextReturnTarget, contextOwner } from "./ContextTools.js";
import { ViewportProjectRow } from "./ViewportProjectRow.js";
import { PropertyControls } from "./PropertyControls.js";
import { GroupAssignment, groupAssignmentMime, readGroupDrop } from "./GroupAssignment.js";
import type { AssignProjectGroupCommand } from "../../contracts/group-assignment.js";
import { BoardLayoutControls, useBoardLayout, boardColumnWidth } from "./BoardLayout.js";
import { Children, cloneElement, type ReactElement, type ReactNode } from "react";
import { useTableLayout, tableColumns, TableLayoutControls, moveTableRow, orderedProjectIds } from "./TableLayout.js";
import { ViewGrouping } from "./ViewGrouping.js";
import type { ViewGroup } from "../../contracts/view-grouping.js";
import { ViewFilters } from "./ViewFilters.js";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectSummary, ProjectAssociationSummary, CategoryProperty, CategoryPropertySnapshot, CategorySummary } from "../../contracts/workspaces.js";
import type { TextPropertySnapshot, TextPropertyDefinition } from "../../contracts/text-properties.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { CategoryPropertyHeader, type CategoryLabelDraft } from "./CategoryPropertyHeader.js";
import { ProjectRevealButton } from "./ProjectRevealButton.js";
import { SelectOptionsEditor } from "./SelectOptionsEditor.js";
import type { SelectionOptionsEditor } from "./SelectionPropertyCell.js";
import { MultiSelectPropertyCell } from "./MultiSelectPropertyCell.js";
import { TextPropertyCell } from "./TextPropertyCell.js";
import { StatusMessage } from "./bb-foundation.js";

const resolutionLabels = {
  excluded: "projectExcluded", missing: "projectMissing", unresolved: "projectUnresolved", replaced: "projectReplaced",
} as const;

interface Props {
  detail?: boolean;
  onPreview?(projectId: string, trigger: HTMLElement): void;
  viewId?: string;
  layout?: "table" | "board";
  client: WorkspaceServiceClient;
  workspaceId: string;
  sourceId: string;
  projects: (ProjectSummary & { originalRelativePath?: string; categoryName?: string | null })[];
  retainedProjects?: ProjectAssociationSummary[];
  hideReveal?: boolean;
  locateDisabled?: boolean;
  renameDisabled?: boolean;
  categoryMoveDisabled?: boolean;
  onFilesystemAssignmentObserved?(): void;
  onMoveCategory?(project: ProjectSummary, trigger: HTMLButtonElement): void;
  onRename?(project: ProjectSummary, trigger: HTMLButtonElement): void;
  onLocate?(project: ProjectAssociationSummary, trigger: HTMLButtonElement): void;
  categoryProperty?: CategoryProperty | null;
  categories?: CategorySummary[];
  discoveryRevision?: number;
  minimumDiscoveryRevision?: { current: number };
  sourceLifetime?: { current: number };
  categoryPropertyRevision?: number;
  minimumCategoryPropertyRevision?: { current: number };
  onCategoryPropertyCommitted?(snapshot: CategoryPropertySnapshot): void;
  language: Language;
  disabled: boolean;
}
export function TextPropertiesTable(props: Props) {
  return <TextPropertiesContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function TextPropertiesContent({ detail, onPreview, viewId, layout = "table", hideReveal, client, workspaceId, sourceId, projects, retainedProjects = [], onLocate, locateDisabled, onRename, renameDisabled, onMoveCategory, onFilesystemAssignmentObserved, categoryMoveDisabled, categoryProperty, categories = [], categoryPropertyRevision = 0, discoveryRevision = 0, minimumDiscoveryRevision, sourceLifetime, minimumCategoryPropertyRevision, onCategoryPropertyCommitted, language, disabled }: Props) {
  const [observedGroups, setGrouped] = useState<{viewId:string; groups:ViewGroup[]|null;propertyId:string|null;refreshToken:number}|null>(null);
  const [observedFilter, setFilteredIds] = useState<{ viewId: string; ids: string[] | null } | null>(null);
  const editingScalar = useScalarDraftActive();
  // Notifications still update values and revisions. Defer projection relocation
  // while an editor owns a draft, so filtering/regrouping cannot unmount it.
  // Admit newly observed rows without relocating existing editor owners.
  const projection = useRef({ grouped: observedGroups, filteredIds: observedFilter });
  if (!editingScalar) projection.current = { grouped: observedGroups, filteredIds: observedFilter };
  else {
    const previous = projection.current;
    if (observedFilter?.viewId === previous.filteredIds?.viewId && observedFilter?.ids && previous.filteredIds?.ids) {
      const known = new Set(previous.filteredIds.ids);
      const added = observedFilter.ids.filter(id => !known.has(id));
      if (added.length) projection.current = { ...projection.current, filteredIds: { ...previous.filteredIds, ids: [...previous.filteredIds.ids, ...added] } };
    }
    if (observedGroups?.viewId === previous.grouped?.viewId && observedGroups?.propertyId === previous.grouped?.propertyId && observedGroups?.groups && previous.grouped?.groups) {
      const known = new Set(previous.grouped.groups.flatMap(group => group.projectIds));
      const additions = observedGroups.groups.map(group => ({ ...group, projectIds: group.projectIds.filter(id => !known.has(id)) })).filter(group => group.projectIds.length);
      if (additions.length) {
        const byKey = new Map(additions.map(group => [group.key, group]));
        const groups = previous.grouped.groups.map(group => {
          const added = byKey.get(group.key);
          return added ? { ...(group.empty ? added : group), projectIds: [...group.projectIds, ...added.projectIds], empty: false } : group;
        });
        const existing = new Set(groups.map(group => group.key));
        groups.push(...additions.filter(added => !existing.has(added.key)));
        projection.current = { ...projection.current, grouped: { ...previous.grouped, groups } };
      }
    }
  }
  const { grouped, filteredIds } = projection.current;
  const [assignmentPending, setAssignmentPending] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<TranslationKey | null>(null);
  const [assignmentRefresh, setAssignmentRefresh] = useState(0);
  const assigning = useRef(false);
  const valueSaves = useRef(0);
  const valueReloadNeeded = useRef(false);
  const assignmentSequence = useRef(0);
  const assignmentFocus = useRef<{token:number; projectId:string; toKey:string; owner:string} | null>(null);
  const assignmentControls = useRef(new Map<string, HTMLSelectElement>());
  const assignmentStatus = useRef<HTMLDivElement>(null);
  const assignmentOwner = `${viewId}:${layout}:${!!hideReveal}`;
  const currentAssignmentOwner = useRef(assignmentOwner); currentAssignmentOwner.current = assignmentOwner;
  useEffect(() => { setAssignmentMessage(null); assignmentFocus.current = null; }, [assignmentOwner]);
  const backwards = useRef(false);
  const categoryDrafts = useRef(new Map<string, CategoryLabelDraft>());
  const t = (key: TranslationKey) => translate(language, key);
  const [snapshot, setSnapshot] = useState<TextPropertySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const request = assignmentFocus.current;
    if (!request || assignmentPending || loading || grouped?.refreshToken !== request.token || request.owner !== assignmentOwner) return;
    const visible = grouped.groups?.some(group => !group.hidden && !group.collapsed && group.projectIds.includes(request.projectId));
    const control = visible ? assignmentControls.current.get(`${request.toKey}:${request.projectId}`)
      ?? [...assignmentControls.current.entries()].find(([key]) => key.endsWith(`:${request.projectId}`))?.[1] : null;
    const target = control && !control.disabled ? control : assignmentStatus.current;
    if (target) { target.focus({preventScroll:true}); assignmentFocus.current = null; }
  }, [grouped, assignmentPending, assignmentOwner, loading]);
  const [message, setMessage] = useState<"propertySaved" | "propertyNewerChange" | null>(null);
  const savedRevision = useRef(0);
  useEffect(() => { if (snapshot && snapshot.revision > savedRevision.current) setMessage(current => current === "propertySaved" ? "propertyNewerChange" : current); }, [snapshot?.revision]);
  const minimumRevision = useRef(0);
  const listVersion = useRef(0);
  const lifetime = useRef(0);
  const accepts = (value: TextPropertySnapshot) => value.workspaceId === workspaceId && value.sourceId === sourceId && value.revision >= minimumRevision.current;
  const load = async () => {
    const current = ++listVersion.current;
    setLoading(true); setLoadError(false);
    try {
      const result = await client.listTextProperties(workspaceId);
      if (current !== listVersion.current) return;
      if (result.ok && accepts(result.value)) {
        minimumRevision.current = result.value.revision;
        setSnapshot(result.value);
      } else setLoadError(true);
    } catch { if (current === listVersion.current) setLoadError(true); }
    finally { if (current === listVersion.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (event.type !== "workspace.propertiesChanged" || event.sourceId !== sourceId || !event.workspaceIds.includes(workspaceId) || event.revision <= minimumRevision.current) return;
      minimumRevision.current = event.revision;
      // In-flight value and assignment commands return complete revisioned snapshots. Defer
      // observation until that reply is accepted or its fallback read is needed.
      if (valueSaves.current) valueReloadNeeded.current = true;
      else if (!assigning.current) void load();
    });
    void load();
    return () => { listVersion.current++; lifetime.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  const boardState = useBoardLayout(client, workspaceId, layout === "board" ? viewId : undefined);
  const layoutTrigger = useRef<HTMLButtonElement>(null);
  const tableState = useTableLayout(client, workspaceId, layout === "table" ? viewId : undefined);
  const fields = [{propertyId: "name", name: t("projectName"), text: false}, ...(categoryProperty ? [{propertyId:categoryProperty.propertyId, name:categoryProperty.name ?? t("discoveryCategory"), text:false}] : []), ...(snapshot?.definitions.map(p => ({propertyId:p.propertyId, name:p.name, text:p.propertyType === "text"})) ?? [])];
  const columns = tableColumns(tableState.config, fields);
  const projectById = new Map([...projects, ...retainedProjects].map(p => [p.projectId,p]));
  const retainedById = new Map(retainedProjects.map(p => [p.projectId, p]));
  const filteredSet = new Set(filteredIds?.viewId === viewId ? filteredIds?.ids ?? [] : []);
  // Index the committed snapshot once, rather than scanning every source value
  // for every visible cell. Snapshot replacement preserves revision guards.
  const propertyValues = useMemo(() => {
    const key = (row: {projectId:string; propertyId:string}) => `${row.projectId}:${row.propertyId}`;
    const multi = new Map<string, string[]>();
    for (const row of snapshot?.multiSelectValues ?? []) {
      const id = key(row), values = multi.get(id) ?? [];
      values.push(row.optionId); multi.set(id, values);
    }
    return {
      text: new Map(snapshot?.values.map(row => [key(row), row.value])),
      number: new Map(snapshot?.numberValues?.map(row => [key(row), row.value])),
      date: new Map(snapshot?.dateValues?.map(row => [key(row), row.value])),
      select: new Map(snapshot?.selectValues?.map(row => [key(row), row.optionId])), multi,
      options: new Map(snapshot?.definitions.map(property => [property.propertyId, snapshot.selectOptions?.filter(option => option.propertyId === property.propertyId) ?? []])),
    };
  }, [snapshot]);
  const rowIds = orderedProjectIds(tableState.config?.rowOrder ?? [], [...projectById.keys()]);
  const rowBusy = disabled || tableState.pending || tableState.loading || !tableState.config;
  const presentCells = (fragment: ReactElement<{children: ReactNode}>, card = false) => {
    if (layout === "board") {
      if (!card) return fragment;
      const hidden = new Set(boardState.config?.properties.filter(p => p.hidden).map(p => p.propertyId));
      return <>{(Children.toArray(fragment.props.children) as ReactElement<Record<string, unknown>>[]).filter(child => !hidden.has(child.props?.["data-column-id"] as string))}</>;
    }
    if (!viewId) return fragment;
    const children = Children.toArray(fragment.props.children) as ReactElement<Record<string, unknown>>[];
    return <>{columns.filter(c => !c.hidden).map(c => {
      const cell = children.find(child => child.props?.["data-column-id"] === c.propertyId);
      return cell ? cloneElement(cell, {children: !card ? <>{cell.props.children as ReactNode}<TableLayoutControls propertyId={c.propertyId} layoutTrigger={layoutTrigger} state={tableState} fields={fields} language={language} disabled={disabled || loadError || loading}/></> : cell.props.children, style:{width:c.width}, className:`${cell.props.className ?? ""} ${fields.find(f => f.propertyId === c.propertyId)?.text ? c.wrap ? "table-text-wrap" : "table-text-nowrap" : ""}`}) : null;
    })}{children.filter(child => !child.props?.["data-column-id"])}</>;
  };
  const moveRow = (id: string, target: string) => {
    if (rowBusy || !tableState.config) return;
    void tableState.save(moveTableRow(tableState.config, rowIds, id, target));
  };
  const tableStyle = viewId ? {width:columns.filter(c=>!c.hidden).reduce((sum,c)=>sum+c.width, hideReveal ? 0 : 48), minWidth:"100%"} : {minWidth:`${fields.length * 14}rem`};
  const committed = (value: TextPropertySnapshot) => {
    savedRevision.current = value.revision;
    setMessage(accepts(value) ? "propertySaved" : "propertyNewerChange");
    if (accepts(value)) { listVersion.current++; minimumRevision.current = value.revision; setSnapshot(value); setLoading(false); setLoadError(false); }
  };
  const propertyCreationTrigger = useRef<HTMLButtonElement>(null);
  const propertyRetry = useRef<HTMLButtonElement>(null);
  const [propertyFocus, setPropertyFocus] = useState<{trigger: HTMLButtonElement | null; origin: Element | null} | null>(null);
  useLayoutEffect(() => {
    if (!propertyFocus) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== propertyFocus.origin && active !== propertyFocus.trigger) {
      setPropertyFocus(null); return;
    }
    let target: HTMLElement | null = propertyFocus.trigger?.isConnected ? propertyFocus.trigger : propertyCreationTrigger.current;
    const owners = new Set<string>();
    while (target?.closest('[hidden], [aria-hidden="true"]')) {
      const owner = contextOwner(target);
      if (!owner || owners.has(owner)) { target = null; break; }
      owners.add(owner); target = document.getElementById(owner);
    }
    if (target?.hasAttribute("disabled") && loadError && !loading) target = propertyRetry.current;
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
    target.focus({preventScroll:true});
    if (document.activeElement === target) setPropertyFocus(null);
  }, [propertyFocus, loading, loadError, disabled, snapshot?.revision]);

  useEffect(() => {
    if (!propertyFocus) return;
    const cancel = (event: FocusEvent) => {
      if (event.target !== propertyFocus.origin && event.target !== document.body && event.target !== propertyFocus.trigger) setPropertyFocus(null);
    };
    document.addEventListener("focusin", cancel);
    return () => document.removeEventListener("focusin", cancel);
  }, [propertyFocus]);
  const propertyControl = (property?: TextPropertyDefinition) => <PropertyControls client={client} workspaceId={workspaceId} sourceId={sourceId}
    fallbackFocus={propertyCreationTrigger} snapshot={snapshot} property={property} language={language} disabled={disabled || loadError || loading} onCommitted={committed} onObserved={load} onReturnFocus={trigger => setPropertyFocus({trigger, origin: document.activeElement})}/>;
  const categoryHeader = categoryProperty && (onCategoryPropertyCommitted && minimumCategoryPropertyRevision ? <CategoryPropertyHeader client={client} workspaceId={workspaceId} sourceId={sourceId} property={categoryProperty}
    discoveryRevision={discoveryRevision} minimumDiscoveryRevision={minimumDiscoveryRevision} revision={categoryPropertyRevision} minimumRevision={minimumCategoryPropertyRevision}
    preservedDraft={categoryDrafts.current.get(categoryProperty.propertyId)} onDraftChange={draft => {
      if (draft) categoryDrafts.current.set(categoryProperty.propertyId, draft); else categoryDrafts.current.delete(categoryProperty.propertyId);
    }} onCommitted={onCategoryPropertyCommitted} language={language} disabled={disabled || (minimumDiscoveryRevision !== undefined && minimumDiscoveryRevision.current > discoveryRevision)}/>
    : <span className="property-authored">{categoryProperty.name ?? t("discoveryCategory")}</span>);
  const propertyTools = <div className="property-context-controls">{propertyControl()}{categoryHeader}
    {snapshot?.definitions.map(property => <span key={property.propertyId} className="property-control-item"><span className="property-authored">{property.name}</span>{propertyControl(property)}</span>)}
  </div>;
  const optionEditor = (property: TextPropertyDefinition): SelectionOptionsEditor => (onStateChange, valuePending) => <SelectOptionsEditor onStateChange={onStateChange}
    client={client} workspaceId={workspaceId} property={property} snapshot={snapshot!} language={language} disabled={disabled || loadError || valuePending}
    onCommitted={value => { if (accepts(value)) { listVersion.current++; minimumRevision.current = value.revision; setSnapshot(value); setLoading(false); setLoadError(false); } }} />;
  const saveValue = async (projectId: string, propertyId: string, value: string | null | string[], propertyType: "text" | "number" | "date" | "single_select" | "multi_select") => {
    const current = lifetime.current;
    valueSaves.current++;
    let accepted = false;
    try {
      const result = Array.isArray(value) ? await client.selectCommand({ type: "workspace.setMultiSelectValue", workspaceId, projectId, propertyId, optionIds: value }) : propertyType === "single_select" ? await client.selectCommand({ type: "workspace.setSelectValue", workspaceId, projectId, propertyId, optionId: value }) : propertyType === "date" ? await client.setDateValue(workspaceId, projectId, propertyId, value) : propertyType === "number" ? await client.setNumberValue(workspaceId, projectId, propertyId, value) : await client.setTextValue(workspaceId, projectId, propertyId, value);
      if (current === lifetime.current && result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId && accepts(result.value.snapshot)) {
        listVersion.current++; setLoading(false); setLoadError(false);
        minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot);
        accepted = true; valueReloadNeeded.current = false;
      }
      return result;
    } finally {
      if (!accepted) valueReloadNeeded.current = true;
      valueSaves.current--;
      if (current === lifetime.current && !valueSaves.current && valueReloadNeeded.current) {
        valueReloadNeeded.current = false;
        void load();
      }
    }
  };
  const assignmentProperty = grouped?.viewId !== viewId ? undefined
    : grouped?.propertyId === "name" ? {propertyId:"name"}
    : categoryProperty && grouped?.propertyId === categoryProperty.propertyId ? categoryProperty
    : snapshot?.definitions.find(p => p.propertyId === grouped?.propertyId);
  const filesystemAssignment = assignmentProperty?.propertyId === "name" || !!categoryProperty && assignmentProperty?.propertyId === categoryProperty.propertyId;
  const assignmentBusy = disabled || loading || loadError || assignmentPending || filesystemAssignment && (!!hideReveal || !!renameDisabled || !!categoryMoveDisabled);
  const assign = async (command: AssignProjectGroupCommand) => {
    if (assignmentBusy || assigning.current) return;
    const owner = assignmentOwner, generation = lifetime.current;
    assigning.current = true; setAssignmentPending(true); setAssignmentMessage(null);
    let observedSnapshot = false;
    try {
      const result = await client.assignProjectGroup(command);
      if (generation !== lifetime.current || owner !== currentAssignmentOwner.current) return;
      if (result.ok && result.value.projectId === command.projectId && result.value.propertyId === command.propertyId && result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
        if (accepts(result.value.snapshot)) {
          listVersion.current++; minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot); setLoading(false); setLoadError(false);
          observedSnapshot = !filesystemAssignment;
        }
        const effect = result.value.filesystem;
        if (!effect || effect.outcome === "completed" || effect.outcome === "unchanged") setAssignmentMessage("groupAssignmentSaved");
        else if (effect.outcome === "recoverable") setAssignmentMessage("groupAssignmentRecovery");
        else if (effect.outcome === "rejected") setAssignmentMessage(effect.problem === "invalid_name" ? "renameInvalid"
          : ["occupied", "reserved_destination", "native_conflict"].includes(effect.problem) ? "renameCollision" : "groupAssignmentError");
      } else setAssignmentMessage(!result.ok && result.error.code === "invalid_input" ? "groupAssignmentInvalid" : "groupAssignmentError");
    } catch {
      if (generation === lifetime.current && owner === currentAssignmentOwner.current) setAssignmentMessage("groupAssignmentError");
    } finally {
      assigning.current = false;
      if (generation === lifetime.current) {
        setAssignmentPending(false);
        // Ordinary metadata replies already carry the actual complete snapshot.
        // Lost/stale replies and filesystem outcomes still require observation.
        // Never replay a mutation.
        if (!observedSnapshot) void load();
        if (filesystemAssignment && owner === currentAssignmentOwner.current) onFilesystemAssignmentObserved?.();
        const token = ++assignmentSequence.current;
        if (owner === currentAssignmentOwner.current) assignmentFocus.current = {token,projectId:command.projectId,toKey:command.toKey,owner};
        setAssignmentRefresh(token);
      }
    }
  };
  const Header = layout === "board" ? "div" : "th";
  const Cell = layout === "board" ? "div" : "td";
  const headers = presentCells(<><Header data-column-id="name" className="board-field-placeholder">{t("projectName")}</Header>
        {categoryProperty && <Header data-column-id={categoryProperty.propertyId} key={categoryProperty.propertyId} aria-label={categoryProperty.name ?? t("discoveryCategory")}>
          {categoryHeader}
        </Header>}
        {snapshot?.definitions.map((property) => <Header data-column-id={property.propertyId} key={property.propertyId}>
          <span className="property-authored">{property.name}</span>
{propertyControl(property)}
        </Header>)}
        {!hideReveal && <Header className="board-field-placeholder" style={{width:48}}><span className="sr-only">{t("projectActions")}</span></Header>}
      </>);
  const rows = (ids?: string[], groupKey?: string) => {
    const groupIds = ids ? new Set(ids) : null;
    const visibleIds = rowIds.filter(id => (!groupIds || groupIds.has(id)) && (!viewId || filteredSet.has(id)));
    const rowPositions = new Map(visibleIds.map((id, index) => [id, index]));
    return (layout === "table" ? rowIds.map(id => projectById.get(id)!) : [...projects, ...retainedProjects])
      .filter(project => (!groupIds || groupIds.has(project.projectId)) && (!viewId || filteredSet.has(project.projectId))).map((project) => {
        const retained = retainedById.get(project.projectId);
        const reason = retained?.associationState === "excluded" && retained.retentionReason !== "mode_change" ? "excluded" : retained?.resolution ?? retained?.associationState;
        const label = retained?.retentionReason === "mode_change" ? "projectModeRetained" : reason && reason !== "active" ? resolutionLabels[reason] : null;
        const rowIndex = rowPositions.get(project.projectId) ?? -1;
        const revealLocator = JSON.stringify([project.relativePath, project.categoryId, categories.find(category => category.categoryId === project.categoryId)?.relativePath, retained?.retentionReason]);
        return <ViewportProjectRow as={layout === "board" ? "li" : "tr"} key={project.projectId} projectId={project.projectId} projectName={project.name} language={language}
          onPreview={onPreview ? trigger => onPreview(project.projectId, trigger) : undefined}
          columnCount={(viewId && layout === "table" ? columns.filter(column => !column.hidden).length : fields.length) + (hideReveal ? 0 : 1)}
          alwaysVisible={project.projectId === rowIds[0]} backwards={backwards} busy={disabled || !!renameDisabled || !!categoryMoveDisabled || !!locateDisabled || assignmentPending} className={layout === "board" ? `project-card ${boardState.config?.wrap === false ? "board-content-nowrap" : "board-content-wrap"}` : undefined}
          onDragOver={event => {if (layout === "table" && !rowBusy && event.dataTransfer.types.includes("application/x-workspace-table-row")) event.preventDefault();}}
          onDrop={event => {
            if (layout !== "table" || rowBusy) return;
            const raw = event.dataTransfer.getData("application/x-workspace-table-row");
            if (!raw) return;
            event.preventDefault(); event.stopPropagation();
            try { const payload = JSON.parse(raw); if (payload.workspaceId === workspaceId && payload.viewId === viewId && visibleIds.includes(payload.projectId)) moveRow(payload.projectId, project.projectId); } catch { /* Ignore unrelated drags. */ }
          }}>{() => presentCells(<><Cell data-column-id="name" data-label={t("projectName")} key="project-name" aria-label={retained ? undefined : project.name}><span className="property-authored">{onPreview ? <button type="button" className="project-preview-trigger" disabled={disabled} aria-label={`${navigationLabels[language].preview}: ${project.name}`} onClick={event => onPreview(project.projectId,event.currentTarget)}>{project.name}</button> : project.name}</span>
          {viewId && assignmentProperty && grouped?.groups && (() => {
            const origin = grouped.groups.find(group => group.key === groupKey && group.projectIds.includes(project.projectId));
            return origin ? <GroupAssignment command={{type:"workspace.assignProjectGroup",workspaceId,viewId,propertyId:assignmentProperty.propertyId,projectId:project.projectId,fromKey:origin.key,toKey:origin.key,archived:!!hideReveal}}
              groups={grouped.groups} projectName={project.name} language={language} disabled={assignmentBusy} controlRef={element => {
                if (element) assignmentControls.current.set(`${origin.key}:${project.projectId}`, element);
                else assignmentControls.current.delete(`${origin.key}:${project.projectId}`);
              }} onAssign={command => void assign(command)}/> : null;
          })()}
          {"originalRelativePath" in project && typeof project.originalRelativePath === "string" && <span className="archive-row-details">{t("archiveOriginal")}: {project.originalRelativePath}{project.categoryName && <> — {t("archiveFrozenCategory")}: {project.categoryName}</>}</span>}
          {label && <span className="project-resolution">{t(label)}</span>}
          {retained?.retentionReason === "mode_change" && reason === "excluded" && <span className="project-resolution">{t("projectExcluded")}</span>}
          {retained && <span className="project-previous-path">{retained.relativePath}</span>}
          {onLocate && retained && reason && (["missing", "unresolved", "replaced"].includes(reason) || (retained.retentionReason === "mode_change" && reason !== "excluded")) &&
            <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || locateDisabled}
              aria-label={`${t("recoveryLocate")}: ${project.name}`} onClick={(event) => onLocate(retained, event.currentTarget)}>{t("recoveryLocate")}</button>}
        </Cell>
        {categoryProperty && <Cell data-column-id={categoryProperty.propertyId} data-label={categoryProperty.name ?? t("discoveryCategory")} key={categoryProperty.propertyId} className="category-cell" data-color={categories.find(category => category.categoryId === project.categoryId)?.presentation?.color ?? "default"}>{layout === "board" ? <span className="board-category-value">{retained?.categoryName ?? categories.find((category) => category.categoryId === project.categoryId)?.name}</span> : retained?.categoryName ?? categories.find((category) => category.categoryId === project.categoryId)?.name}

        </Cell>}
        {snapshot?.definitions.map((property) => <Cell data-column-id={property.propertyId} key={property.propertyId} data-label={property.name} data-custom-property={detail || undefined}>
          {detail && <div className="detail-property-label"><span className="property-authored">{property.name}</span>{propertyControl(property)}</div>}
          {property.propertyType === "multi_select" ? <MultiSelectPropertyCell workspaceId={workspaceId} sourceId={sourceId} projectId={project.projectId} propertyId={property.propertyId}
            revision={snapshot.revision} minimumRevision={minimumRevision} projectName={project.name} propertyName={property.name} language={language} disabled={disabled || loadError}
            optionsEditor={optionEditor(property)} options={propertyValues.options.get(property.propertyId) ?? []}
            value={propertyValues.multi.get(`${project.projectId}:${property.propertyId}`) ?? []}
            onSave={value => saveValue(project.projectId, property.propertyId, value, property.propertyType)} /> : <TextPropertyCell workspaceId={workspaceId} sourceId={sourceId} projectId={project.projectId} propertyId={property.propertyId}
            revision={snapshot.revision} minimumRevision={minimumRevision}
            projectName={project.name} propertyName={property.name} language={language} disabled={disabled || loadError}
            optionsEditor={property.propertyType === "single_select" ? optionEditor(property) : undefined} propertyType={property.propertyType} options={propertyValues.options.get(property.propertyId)}
            value={property.propertyType === "single_select" ? propertyValues.select.get(`${project.projectId}:${property.propertyId}`) ?? null : property.propertyType === "number" ? (() => {
              const numeric = propertyValues.number.get(`${project.projectId}:${property.propertyId}`);
              return numeric === undefined ? null : String(numeric);
            })() : property.propertyType === "date" ? propertyValues.date.get(`${project.projectId}:${property.propertyId}`) ?? null : propertyValues.text.get(`${project.projectId}:${property.propertyId}`) ?? null}
            onSave={(value) => saveValue(project.projectId, property.propertyId, value, property.propertyType)} />}
        </Cell>)}
        {!hideReveal && <Cell className="project-card-actions" key="project-actions" data-label={t("projectActions")}><ContextTools label={`${t("projectActions")}: ${project.name}`} compact>
          {layout === "table" && viewId && <div className="table-row-controls">
            <Hint label={`${t("tableDrag")}: ${project.name}`}><button type="button" draggable={!rowBusy} disabled={rowBusy} aria-label={`${t("tableDrag")}: ${project.name}`} onDragStart={event => {event.stopPropagation(); event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("application/x-workspace-table-row",JSON.stringify({workspaceId,viewId,projectId:project.projectId}));}}><Icon name="drag"/></button></Hint>
            <Hint label={`${t("tableRowEarlier")}: ${project.name}`}><button type="button" disabled={rowBusy || rowIndex <= 0} aria-label={`${t("tableRowEarlier")}: ${project.name}`} onClick={() => moveRow(project.projectId, visibleIds[rowIndex-1])}><Icon name="up"/></button></Hint>
            <Hint label={`${t("tableRowLater")}: ${project.name}`}><button type="button" disabled={rowBusy || rowIndex < 0 || rowIndex >= visibleIds.length-1} aria-label={`${t("tableRowLater")}: ${project.name}`} onClick={() => moveRow(project.projectId, visibleIds[rowIndex+1])}><Icon name="down"/></button></Hint>
          </div>}
          {!retained && onRename && <button type="button" className="workspace-button workspace-button--secondary property-rename"
            aria-label={`${t("renameProject")}: ${project.name}`} disabled={disabled || renameDisabled || ("associationState" in project && (project.associationState !== "active" || ("resolution" in project && project.resolution !== "active")))}
            data-close-context onClick={(event) => onRename(project, contextReturnTarget(event.currentTarget))}>{t("renameProject")}</button>}
          {!retained && onMoveCategory && project.categoryId && "associationState" in project && project.associationState === "active" &&
            "resolution" in project && project.resolution === "active" && <button type="button" className="workspace-button workspace-button--secondary property-rename"
              aria-label={`${t("moveCategory")}: ${project.name}`} disabled={disabled || categoryMoveDisabled}
              data-close-context onClick={(event) => onMoveCategory(project, contextReturnTarget(event.currentTarget))}>{t("moveCategory")}</button>}<ProjectRevealButton client={client} workspaceId={workspaceId} projectId={project.projectId} name={project.name} language={language} disabled={disabled} minimumRevision={minimumDiscoveryRevision} sourceLifetime={sourceLifetime}
          locatorKey={revealLocator} targetKey={JSON.stringify([revealLocator, retained?.associationState, retained?.resolution])} /></ContextTools></Cell>}
      </>, true)}</ViewportProjectRow>; });
  };
  if (detail) return <div className="project-detail-fields" aria-busy={loading}>
    <h3 className="project-properties-heading">{t("propertyTools")}</h3>
    {propertyControl()}
    {loading && <StatusMessage kind="info" title={t("propertiesLoading")}/>}
    {loadError && <><StatusMessage kind="error" title={t("propertiesLoadError")}/><button ref={propertyRetry} type="button" className="workspace-button" onClick={()=>void load()}>{t("propertiesRetry")}</button></>}
    <table className="project-table"><tbody>{rows()}</tbody></table>
  </div>;
  return <div className="text-properties" aria-busy={loading} onKeyDownCapture={event => { if (event.key === "Tab") backwards.current = event.shiftKey; }}>
    {viewId && <ViewFilters client={client} workspaceId={workspaceId} viewId={viewId} archived={!!hideReveal} language={language}
      showEmpty={projects.length + retainedProjects.length > 0} snapshot={snapshot} categoryProperty={categoryProperty} categories={categories} disabled={disabled || loadError}
      projection={discoveryRevision > 0 && !hideReveal ? {revision:discoveryRevision,projectIds:[...projectById.keys()]} : undefined}
      refreshToken={assignmentRefresh} refreshKey={JSON.stringify([assignmentRefresh, snapshot?.revision, discoveryRevision, projects.map(p => [p.projectId, p.name, p.categoryId]), retainedProjects.map(p => [p.projectId, p.name, p.categoryId])])}
      onResults={ids => setFilteredIds({ viewId, ids })} onGroups={(groups,propertyId,refreshToken) => setGrouped({viewId,groups,propertyId,refreshToken})} />
    }
    <ViewControls><div className="table-presentation-toolbar">
    {viewId && layout === "board" && <BoardLayoutControls layoutTrigger={layoutTrigger} state={boardState} fields={fields} groups={grouped?.viewId === viewId ? grouped.groups : null} groupPropertyId={grouped?.viewId === viewId ? grouped.propertyId : null} language={language} disabled={disabled || loadError || loading}>{assignmentProperty && <p>{t(filesystemAssignment ? "groupAssignmentFilesystemHint" : "groupAssignmentHint")}</p>}</BoardLayoutControls>}{viewId && layout === "table" && <TableLayoutControls layoutTrigger={layoutTrigger} state={tableState} fields={fields} language={language} disabled={disabled || loadError || loading}/> }
    {viewId && <ViewGrouping contextual client={client} workspaceId={workspaceId} viewId={viewId} language={language} snapshot={snapshot} categoryProperty={categoryProperty} groups={grouped?.viewId===viewId ? grouped.groups : null} groupPropertyId={grouped?.viewId===viewId ? grouped.propertyId : null} disabled={disabled||loadError} />}
    </div></ViewControls>
    {viewId && layout === "board" && <>
      {boardState.pending && <StatusMessage kind="info" title={t("boardLayoutSaving")}/>}
      {boardState.error && <StatusMessage kind="error" title={t("boardLayoutError")}/>}
    </>}
    {loading && <StatusMessage kind="info" title={t("projectsLoading")} />}
    {loadError && <><StatusMessage kind="error" title={t("propertiesLoadError")} />
      <button ref={propertyRetry} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading} onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    <ViewControls>{layout === "board" ? <ContextTools label={t("propertyTools")} icon="properties">{propertyTools}</ContextTools> : propertyControl()}</ViewControls>
    {message && <StatusMessage kind="info" title={t(message)}/>}
    {assignmentProperty && layout !== "board" && <p>{t(filesystemAssignment ? "groupAssignmentFilesystemHint" : "groupAssignmentHint")}</p>}
    <div ref={assignmentStatus} tabIndex={-1} aria-label={t("groupAssignmentChoose")}>
    {assignmentPending && <StatusMessage kind="info" title={t("groupAssignmentSaving")}/>}
    {assignmentMessage && <StatusMessage kind={assignmentMessage === "groupAssignmentSaved" ? "info" : "error"} title={t(assignmentMessage)}/>}
    </div>

    {grouped?.viewId===viewId && grouped?.groups ? <>
      {grouped.groups.length>0 && grouped.groups.every(group=>group.hidden) && <p role="status">{t("groupAllHidden")}</p>}
      {grouped.groups.length===0 && <p role="status">{t("groupEmpty")}</p>}
      <div className={layout === "board" ? "grouped-board" : "grouped-table"}>
      {grouped.groups.filter(group=>!group.hidden).map(group=><section className="project-group" onDragOver={event => {
          if (assignmentProperty && !assignmentBusy && event.dataTransfer.types.includes(groupAssignmentMime)) event.preventDefault();
        }} onDrop={event => {
          if (!viewId || !assignmentProperty || assignmentBusy) return;
          const raw = event.dataTransfer.getData(groupAssignmentMime);
          if (!raw) return;
          event.preventDefault(); event.stopPropagation();
          const command = readGroupDrop(raw, {workspaceId,viewId,propertyId:assignmentProperty.propertyId,archived:!!hideReveal}, group.key);
          if (command) void assign(command);
        }} style={layout === "board" ? {flexBasis:boardColumnWidth(boardState.config, grouped.propertyId, group.key)} : undefined} key={group.key} aria-label={group.value===null?t("groupNoValue"):(group.label ?? String(group.value))}>
        <div className="project-group-header"><h3 className="property-authored">{group.value===null?t("groupNoValue"):(group.label ?? String(group.value))} ({group.projectIds.length})</h3>
        {layout === "board" && viewId && <BoardLayoutControls column={group} layoutTrigger={layoutTrigger} state={boardState} fields={fields} groups={null} groupPropertyId={grouped.propertyId} language={language} disabled={disabled || loadError || loading}/>}
        </div>
        {!group.collapsed && (group.empty ? <p>{t("groupEmpty")}</p> : layout === "board" ? <ul className="project-board" aria-label={t("boardProjects")}>{rows(group.projectIds, group.key)}</ul> :
          <div className="project-table-scroll"><table className="project-table" style={tableStyle}><thead><tr>{headers}</tr></thead><tbody>{rows(group.projectIds, group.key)}</tbody></table></div>)}
      </section>)}
      </div>
    </> : layout === "board" ? <>
      <ul className="project-board" aria-label={t("boardProjects")}>{rows()}</ul>
    </> : <div className="project-table-scroll">
      <table className="project-table" style={tableStyle}>
        <thead><tr>{headers}</tr></thead><tbody>{rows()}</tbody>
      </table>
    </div>}
  </div>;
}
