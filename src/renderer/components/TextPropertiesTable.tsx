import { Children, cloneElement, type ReactElement, type ReactNode } from "react";
import { useTableLayout, tableColumns, TableLayoutControls, moveTableRow, orderedProjectIds } from "./TableLayout.js";
import { ViewGrouping } from "./ViewGrouping.js";
import type { ViewGroup } from "../../contracts/view-grouping.js";
import { ViewFilters } from "./ViewFilters.js";
import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectSummary, ProjectAssociationSummary, CategoryProperty, CategoryPropertySnapshot, CategorySummary } from "../../contracts/workspaces.js";
import type { TextPropertySnapshot } from "../../contracts/text-properties.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { CategoryPropertyHeader, type CategoryLabelDraft } from "./CategoryPropertyHeader.js";
import { ProjectRevealButton } from "./ProjectRevealButton.js";
import { SelectOptionsEditor } from "./SelectOptionsEditor.js";
import { MultiSelectPropertyCell } from "./MultiSelectPropertyCell.js";
import { TextPropertyCell } from "./TextPropertyCell.js";
import { StatusMessage } from "./bb-foundation.js";

const resolutionLabels = {
  excluded: "projectExcluded", missing: "projectMissing", unresolved: "projectUnresolved", replaced: "projectReplaced",
} as const;

interface Props {
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
function TextPropertiesContent({ viewId, layout = "table", hideReveal, client, workspaceId, sourceId, projects, retainedProjects = [], onLocate, locateDisabled, onRename, renameDisabled, onMoveCategory, categoryMoveDisabled, categoryProperty, categories = [], categoryPropertyRevision = 0, discoveryRevision = 0, minimumDiscoveryRevision, sourceLifetime, minimumCategoryPropertyRevision, onCategoryPropertyCommitted, language, disabled }: Props) {
  const [grouped, setGrouped] = useState<{viewId:string; groups:ViewGroup[]|null;propertyId:string|null}|null>(null);
  const [filteredIds, setFilteredIds] = useState<{ viewId: string; ids: string[] | null } | null>(null);
  const categoryDrafts = useRef(new Map<string, CategoryLabelDraft>());
  const t = (key: TranslationKey) => translate(language, key);
  const [snapshot, setSnapshot] = useState<TextPropertySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<{ propertyId: string | null; name: string; originalName: string; propertyType: "text" | "number" | "date" | "single_select" | "multi_select" } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"propertyValidation" | "propertySaveError" | "propertySaved" | "propertyNewerChange" | null>(null);
  const minimumRevision = useRef(0);
  const listVersion = useRef(0);
  const lifetime = useRef(0);
  const saving = useRef(false);
  const savedRevision = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const multiSelectTrigger = useRef<HTMLButtonElement>(null);
  const selectTrigger = useRef<HTMLButtonElement>(null);
  const dateTrigger = useRef<HTMLButtonElement>(null);
  const numberTrigger = useRef<HTMLButtonElement>(null);
  const creationType = useRef<"text" | "number" | "date" | "single_select" | "multi_select">("text");
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusTarget = useRef<string | null | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (snapshot && snapshot.revision > savedRevision.current) {
      setMessage((current) => current === "propertySaved" ? "propertyNewerChange" : current);
    }
  }, [snapshot?.revision]);
  useEffect(() => {
    if (draft) input.current?.focus();
    else if (focusTarget.current !== undefined) {
      (focusTarget.current === null ? (creationType.current === "multi_select" ? multiSelectTrigger.current : creationType.current === "single_select" ? selectTrigger.current : creationType.current === "date" ? dateTrigger.current : creationType.current === "number" ? numberTrigger.current : trigger.current) : renameButtons.current.get(focusTarget.current) ?? trigger.current)?.focus();
      focusTarget.current = undefined;
    }
  }, [draft?.propertyId, draft === null]);
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
      void load();
    });
    void load();
    return () => { listVersion.current++; lifetime.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  const tableState = useTableLayout(client, workspaceId, layout === "table" ? viewId : undefined);
  const fields = [{propertyId: "name", name: t("projectName"), text: false}, ...(categoryProperty ? [{propertyId:categoryProperty.propertyId, name:categoryProperty.name ?? t("discoveryCategory"), text:false}] : []), ...(snapshot?.definitions.map(p => ({propertyId:p.propertyId, name:p.name, text:p.propertyType === "text"})) ?? [])];
  const columns = tableColumns(tableState.config, fields);
  const projectById = new Map([...projects, ...retainedProjects].map(p => [p.projectId,p]));
  const rowIds = orderedProjectIds(tableState.config?.rowOrder ?? [], [...projectById.keys()]);
  const rowBusy = disabled || tableState.pending || tableState.loading || !tableState.config;
  const presentCells = (fragment: ReactElement<{children: ReactNode}>) => {
    if (layout === "board" || !viewId) return fragment;
    const children = Children.toArray(fragment.props.children) as ReactElement<Record<string, unknown>>[];
    return <>{columns.filter(c => !c.hidden).map(c => {
      const cell = children.find(child => child.props?.["data-column-id"] === c.propertyId);
      return cell ? cloneElement(cell, {style:{width:c.width}, className:`${cell.props.className ?? ""} ${fields.find(f => f.propertyId === c.propertyId)?.text ? c.wrap ? "table-text-wrap" : "table-text-nowrap" : ""}`}) : null;
    })}{children.filter(child => !child.props?.["data-column-id"])}</>;
  };
  const moveRow = (id: string, target: string) => {
    if (rowBusy || !tableState.config) return;
    void tableState.save(moveTableRow(tableState.config, rowIds, id, target));
  };
  const tableStyle = viewId ? {width:columns.filter(c=>!c.hidden).reduce((sum,c)=>sum+c.width, hideReveal ? 0 : 224), minWidth:"100%"} : {minWidth:`${fields.length * 14}rem`};
  const cancel = () => {
    if (saving.current || !draft) return;
    focusTarget.current = draft.propertyId;
    setDraft(null); setMessage(null);
  };
  const save = async () => {
    if (!draft || saving.current || disabled) return;
    if (!draft.name.trim()) { setMessage("propertyValidation"); input.current?.focus(); return; }
    const current = lifetime.current;
    saving.current = true; setPending(true); setMessage(null);
    try {
      const result = draft.propertyId === null
        ? await client.createProperty(workspaceId, draft.name, draft.propertyType)
        : await client.renameProperty(workspaceId, draft.propertyId, draft.name);
      if (current !== lifetime.current) return;
      if (result.ok && result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
        savedRevision.current = result.value.snapshot.revision;
        if (accepts(result.value.snapshot)) {
          // Supersede older lists while preserving an own event-before-response success.
          listVersion.current++; setLoading(false); setLoadError(false);
          minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot);
          setMessage("propertySaved");
        } else setMessage("propertyNewerChange");
        focusTarget.current = draft.propertyId; setDraft(null);
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "propertyValidation" : "propertySaveError");
    } catch { if (current === lifetime.current) setMessage("propertySaveError"); }
    finally {
      if (current === lifetime.current) { saving.current = false; setPending(false); }
    }
  };
  const saveValue = async (projectId: string, propertyId: string, value: string | null | string[], propertyType: "text" | "number" | "date" | "single_select" | "multi_select") => {
    const current = lifetime.current;
    const result = Array.isArray(value) ? await client.selectCommand({ type: "workspace.setMultiSelectValue", workspaceId, projectId, propertyId, optionIds: value }) : propertyType === "single_select" ? await client.selectCommand({ type: "workspace.setSelectValue", workspaceId, projectId, propertyId, optionId: value }) : propertyType === "date" ? await client.setDateValue(workspaceId, projectId, propertyId, value) : propertyType === "number" ? await client.setNumberValue(workspaceId, projectId, propertyId, value) : await client.setTextValue(workspaceId, projectId, propertyId, value);
    if (current === lifetime.current && result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId && accepts(result.value.snapshot)) {
      listVersion.current++; setLoading(false); setLoadError(false);
      minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot);
    }
    return result;
  };
  const Header = layout === "board" ? "div" : "th";
  const Row = layout === "board" ? "li" : "tr";
  const Cell = layout === "board" ? "div" : "td";
  const headers = presentCells(<><Header data-column-id="name" className="board-field-placeholder">{t("projectName")}</Header>
        {categoryProperty && <Header data-column-id={categoryProperty.propertyId} key={categoryProperty.propertyId} aria-label={categoryProperty.name ?? t("discoveryCategory")}>
          {onCategoryPropertyCommitted && minimumCategoryPropertyRevision ? <CategoryPropertyHeader client={client} workspaceId={workspaceId} sourceId={sourceId} property={categoryProperty}
            discoveryRevision={discoveryRevision} minimumDiscoveryRevision={minimumDiscoveryRevision} revision={categoryPropertyRevision} minimumRevision={minimumCategoryPropertyRevision}
            preservedDraft={categoryDrafts.current.get(categoryProperty.propertyId)} onDraftChange={(draft) => {
              if (draft) categoryDrafts.current.set(categoryProperty.propertyId, draft);
              else categoryDrafts.current.delete(categoryProperty.propertyId);
            }} onCommitted={onCategoryPropertyCommitted} language={language} disabled={disabled || (minimumDiscoveryRevision !== undefined && minimumDiscoveryRevision.current > discoveryRevision)} /> : <span className="property-authored">{categoryProperty.name ?? t("discoveryCategory")}</span>}
        </Header>}
        {snapshot?.definitions.map((property) => <Header data-column-id={property.propertyId} key={property.propertyId}>
          <span className="property-authored">{property.name}</span>
          <button type="button" ref={(element) => { if (element) renameButtons.current.set(property.propertyId, element); else renameButtons.current.delete(property.propertyId); }}
            className="workspace-button workspace-button--secondary property-rename" aria-label={`${t("renameProperty")}: ${property.name}`}
            disabled={disabled || draft !== null} onClick={() => { setMessage(null); setDraft({ propertyId: property.propertyId, name: property.name, originalName: property.name, propertyType: property.propertyType }); }}>{t("renameProperty")}</button>
        </Header>)}
        {!hideReveal && <Header className="board-field-placeholder">{t("revealProject")}</Header>}
      </>);
  const rows = (ids?: string[]) => (layout === "table" ? rowIds.map(id => projectById.get(id)!) : [...projects, ...retainedProjects]).filter(project => !ids || ids.includes(project.projectId)).filter(project => !viewId || (filteredIds?.viewId === viewId && filteredIds.ids?.includes(project.projectId))).map((project) => {
        const retained = retainedProjects.find((row) => row.projectId === project.projectId);
        const reason = retained?.associationState === "excluded" && retained.retentionReason !== "mode_change" ? "excluded" : retained?.resolution ?? retained?.associationState;
        const label = retained?.retentionReason === "mode_change" ? "projectModeRetained" : reason && reason !== "active" ? resolutionLabels[reason] : null;
        const visibleIds = rowIds.filter(id => (!ids || ids.includes(id)) && (!viewId || filteredIds?.ids?.includes(id)));
        const rowIndex = visibleIds.indexOf(project.projectId);
        const revealLocator = JSON.stringify([project.relativePath, project.categoryId, categories.find(category => category.categoryId === project.categoryId)?.relativePath, retained?.retentionReason]);
        return <Row key={project.projectId} data-project-id={project.projectId} className={layout === "board" ? "project-card" : undefined}
          onDragOver={event => {if (layout === "table" && !rowBusy && event.dataTransfer.types.includes("application/x-workspace-table-row")) event.preventDefault();}}
          onDrop={event => {
            if (layout !== "table" || rowBusy) return;
            const raw = event.dataTransfer.getData("application/x-workspace-table-row");
            if (!raw) return;
            event.preventDefault(); event.stopPropagation();
            try { const payload = JSON.parse(raw); if (payload.workspaceId === workspaceId && payload.viewId === viewId && visibleIds.includes(payload.projectId)) moveRow(payload.projectId, project.projectId); } catch { /* Ignore unrelated drags. */ }
          }}>{presentCells(<><Cell data-column-id="name" data-label={t("projectName")} key="project-name" aria-label={retained ? undefined : project.name}><span className="property-authored">{project.name}</span>
          {layout === "table" && viewId && <div className="table-row-controls">
            <button type="button" draggable={!rowBusy} disabled={rowBusy} aria-label={`${t("tableDrag")}: ${project.name}`} onDragStart={event => {event.stopPropagation(); event.dataTransfer.effectAllowed="move"; event.dataTransfer.setData("application/x-workspace-table-row",JSON.stringify({workspaceId,viewId,projectId:project.projectId}));}}>↕</button>
            <button type="button" disabled={rowBusy || rowIndex <= 0} aria-label={`${t("tableRowEarlier")}: ${project.name}`} onClick={() => moveRow(project.projectId, visibleIds[rowIndex-1])}>↑</button>
            <button type="button" disabled={rowBusy || rowIndex < 0 || rowIndex >= visibleIds.length-1} aria-label={`${t("tableRowLater")}: ${project.name}`} onClick={() => moveRow(project.projectId, visibleIds[rowIndex+1])}>↓</button>
          </div>}
          {"originalRelativePath" in project && typeof project.originalRelativePath === "string" && <span className="archive-row-details">{t("archiveOriginal")}: {project.originalRelativePath}{project.categoryName && <> — {t("archiveFrozenCategory")}: {project.categoryName}</>}</span>}
          {!retained && onRename && <button type="button" className="workspace-button workspace-button--secondary property-rename"
            aria-label={`${t("renameProject")}: ${project.name}`} disabled={disabled || renameDisabled || ("associationState" in project && (project.associationState !== "active" || ("resolution" in project && project.resolution !== "active")))}
            onClick={(event) => onRename(project, event.currentTarget)}>{t("renameProject")}</button>}
          {label && <span className="project-resolution">{t(label)}</span>}
          {retained?.retentionReason === "mode_change" && reason === "excluded" && <span className="project-resolution">{t("projectExcluded")}</span>}
          {retained && <span className="project-previous-path">{retained.relativePath}</span>}
          {onLocate && retained && reason && (["missing", "unresolved", "replaced"].includes(reason) || (retained.retentionReason === "mode_change" && reason !== "excluded")) &&
            <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || locateDisabled}
              aria-label={`${t("recoveryLocate")}: ${project.name}`} onClick={(event) => onLocate(retained, event.currentTarget)}>{t("recoveryLocate")}</button>}
        </Cell>
        {categoryProperty && <Cell data-column-id={categoryProperty.propertyId} data-label={categoryProperty.name ?? t("discoveryCategory")} key={categoryProperty.propertyId} className="category-cell" data-color={categories.find(category => category.categoryId === project.categoryId)?.presentation?.color ?? "default"}>{retained?.categoryName ?? categories.find((category) => category.categoryId === project.categoryId)?.name}
          {!retained && onMoveCategory && project.categoryId && "associationState" in project && project.associationState === "active" &&
            "resolution" in project && project.resolution === "active" && <button type="button" className="workspace-button workspace-button--secondary property-rename"
              aria-label={`${t("moveCategory")}: ${project.name}`} disabled={disabled || categoryMoveDisabled}
              onClick={(event) => onMoveCategory(project, event.currentTarget)}>{t("moveCategory")}</button>}
        </Cell>}
        {snapshot?.definitions.map((property) => <Cell data-column-id={property.propertyId} key={property.propertyId} data-label={property.name}>
          {property.propertyType === "multi_select" ? <MultiSelectPropertyCell workspaceId={workspaceId} sourceId={sourceId} projectId={project.projectId} propertyId={property.propertyId}
            revision={snapshot.revision} minimumRevision={minimumRevision} projectName={project.name} propertyName={property.name} language={language} disabled={disabled || loadError || draft !== null}
            options={snapshot.selectOptions?.filter(option => option.propertyId === property.propertyId) ?? []}
            value={snapshot.multiSelectValues?.filter(entry => entry.projectId === project.projectId && entry.propertyId === property.propertyId).map(entry => entry.optionId) ?? []}
            onSave={value => saveValue(project.projectId, property.propertyId, value, property.propertyType)} /> : <TextPropertyCell workspaceId={workspaceId} sourceId={sourceId} projectId={project.projectId} propertyId={property.propertyId}
            revision={snapshot.revision} minimumRevision={minimumRevision}
            projectName={project.name} propertyName={property.name} language={language} disabled={disabled || loadError || draft !== null}
            propertyType={property.propertyType} options={snapshot.selectOptions?.filter(option => option.propertyId === property.propertyId)}
            value={property.propertyType === "single_select" ? snapshot.selectValues?.find(entry => entry.projectId === project.projectId && entry.propertyId === property.propertyId)?.optionId ?? null : property.propertyType === "number" ? (() => {
              const numeric = snapshot.numberValues?.find(entry => entry.projectId === project.projectId && entry.propertyId === property.propertyId)?.value;
              return numeric === undefined ? null : String(numeric);
            })() : property.propertyType === "date" ? snapshot.dateValues?.find(entry => entry.projectId === project.projectId && entry.propertyId === property.propertyId)?.value ?? null : snapshot.values.find((entry) => entry.projectId === project.projectId && entry.propertyId === property.propertyId)?.value ?? null}
            onSave={(value) => saveValue(project.projectId, property.propertyId, value, property.propertyType)} />}
        </Cell>)}
        {!hideReveal && <Cell key="project-actions" data-label={t("revealProject")}><ProjectRevealButton client={client} workspaceId={workspaceId} projectId={project.projectId} name={project.name} language={language} disabled={disabled} minimumRevision={minimumDiscoveryRevision} sourceLifetime={sourceLifetime}
          locatorKey={revealLocator} targetKey={JSON.stringify([revealLocator, retained?.associationState, retained?.resolution])} /></Cell>}
      </>)}</Row>; });
  return <div className="text-properties" aria-busy={pending || loading}>
    {viewId && <ViewFilters client={client} workspaceId={workspaceId} viewId={viewId} archived={!!hideReveal} language={language}
      snapshot={snapshot} categoryProperty={categoryProperty} categories={categories} disabled={disabled || loadError}
      refreshKey={JSON.stringify([snapshot?.revision, discoveryRevision, projects.map(p => [p.projectId, p.name, p.categoryId]), retainedProjects.map(p => [p.projectId, p.name, p.categoryId])])}
      onResults={ids => setFilteredIds({ viewId, ids })} onGroups={(groups,propertyId) => setGrouped({viewId,groups,propertyId})} />
    }
    {viewId && layout === "table" && <TableLayoutControls state={tableState} fields={fields} language={language} disabled={disabled || loadError || loading}/> }
    {viewId && <ViewGrouping client={client} workspaceId={workspaceId} viewId={viewId} language={language} snapshot={snapshot} categoryProperty={categoryProperty} groups={grouped?.viewId===viewId ? grouped.groups : null} groupPropertyId={grouped?.viewId===viewId ? grouped.propertyId : null} disabled={disabled||loadError} />}
    {loading && <StatusMessage kind="info" title={t("propertiesLoading")} />}
    {loadError && <><StatusMessage kind="error" title={t("propertiesLoadError")} />
      <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading} onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); creationType.current = "text"; setDraft({ propertyId: null, name: "", originalName: "", propertyType: "text" }); }}>{t("createTextProperty")}</button>
    <button ref={numberTrigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); creationType.current = "number"; setDraft({ propertyId: null, name: "", originalName: "", propertyType: "number" }); }}>{t("createNumberProperty")}</button>
    <button ref={dateTrigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); creationType.current = "date"; setDraft({ propertyId: null, name: "", originalName: "", propertyType: "date" }); }}>{t("createDateProperty")}</button>
    <button ref={selectTrigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); creationType.current = "single_select"; setDraft({ propertyId: null, name: "", originalName: "", propertyType: "single_select" }); }}>{t("createSelectProperty")}</button>
    <button ref={multiSelectTrigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); creationType.current = "multi_select"; setDraft({ propertyId: null, name: "", originalName: "", propertyType: "multi_select" }); }}>{t("createMultiSelectProperty")}</button>
    {snapshot?.definitions.filter(property => property.propertyType === "single_select" || property.propertyType === "multi_select").map(property => <SelectOptionsEditor key={property.propertyId}
      client={client} workspaceId={workspaceId} property={property} snapshot={snapshot} language={language} disabled={disabled || loadError || draft !== null}
      onCommitted={value => { if (accepts(value)) { listVersion.current++; minimumRevision.current = value.revision; setSnapshot(value); setLoading(false); setLoadError(false); } }} />)}
    {draft && <form className="property-form" onSubmit={(event) => { event.preventDefault(); void save(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
      <label htmlFor="property-name">{t("propertyName")}</label>
      <input ref={input} id="property-name" className="workspace-input" value={draft.name} disabled={disabled || pending}
        aria-invalid={message === "propertyValidation"} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} />
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending}>{t(pending ? "propertySaving" : "savePropertyName")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelRenameWorkspace")}</button>
      </div>
    </form>}
    {draft?.propertyId && !pending && snapshot?.definitions.find((property) => property.propertyId === draft.propertyId)?.name !== draft.originalName &&
      <StatusMessage kind="info" title={t("propertyExternalChange")} />}
    {message && <StatusMessage kind={message === "propertyValidation" || message === "propertySaveError" ? "error" : "info"} title={t(message)} />}
    {snapshot && snapshot.definitions.length === 0 && <p>{t("propertiesEmpty")}</p>}
    {grouped?.viewId===viewId && grouped?.groups ? <>
      {layout === "board" && <div className="board-property-controls">{headers}</div>}
      {grouped.groups.length>0 && grouped.groups.every(group=>group.hidden) && <p role="status">{t("groupAllHidden")}</p>}
      {grouped.groups.length===0 && <p role="status">{t("groupEmpty")}</p>}
      <div className={layout === "board" ? "grouped-board" : "grouped-table"}>
      {grouped.groups.filter(group=>!group.hidden).map(group=><section className="project-group" key={group.key} aria-label={group.value===null?t("groupNoValue"):(group.label ?? String(group.value))}>
        <h3 className="property-authored">{group.value===null?t("groupNoValue"):(group.label ?? String(group.value))} ({group.projectIds.length})</h3>
        {!group.collapsed && (group.empty ? <p>{t("groupEmpty")}</p> : layout === "board" ? <ul className="project-board" aria-label={t("boardProjects")}>{rows(group.projectIds)}</ul> :
          <div className="project-table-scroll"><table className="project-table" style={tableStyle}><thead><tr>{headers}</tr></thead><tbody>{rows(group.projectIds)}</tbody></table></div>)}
      </section>)}
      </div>
    </> : layout === "board" ? <>
      <div className="board-property-controls">{headers}</div>
      <ul className="project-board" aria-label={t("boardProjects")}>{rows()}</ul>
    </> : <div className="project-table-scroll">
      <table className="project-table" style={tableStyle}>
        <thead><tr>{headers}</tr></thead><tbody>{rows()}</tbody>
      </table>
    </div>}
  </div>;
}
