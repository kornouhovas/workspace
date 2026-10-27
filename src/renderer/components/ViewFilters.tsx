import type { PreparedView } from "./prepared-view.js";
import { ViewControls, useViewControlsVisible } from "./ManagementSurface.js";
import { contextOwner } from "./ContextTools.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";
import { filterOperators, type FilterRule, type FilterType, type ViewFilterConfig } from "../../contracts/view-filters.js";
import type { Language } from "../../contracts/settings.js";
import type { PropertySnapshot } from "../../contracts/text-properties.js";
import type { CategoryProperty, CategorySummary } from "../../contracts/workspaces.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { categoryPropertyName, translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  showEmpty?: boolean; client: WorkspaceServiceClient; workspaceId: string; viewId: string; archived: boolean; language: Language;
  snapshot: PropertySnapshot | null; categoryProperty?: CategoryProperty | null; categories: CategorySummary[];
  projection?: import("../../contracts/view-filters.js").ViewProjectProjection; prepared?: PreparedView; transitionPending?: boolean;
  refreshKey: string; refreshToken?: number; disabled: boolean; onResults(ids: string[] | null): void; onGroups?(groups: import("../../contracts/view-grouping.js").ViewGroup[] | null, propertyId: string | null, refreshToken: number): void;
}
const clearConfig = (): ViewFilterConfig => ({ search: "", rules: [] });
export function ViewFilters(props: Props) { return <FilterContent key={`${props.workspaceId}:${props.viewId}:${props.archived}`} {...props} />; }
function FilterContent({ showEmpty = true, client, workspaceId, viewId, archived, language, snapshot, categoryProperty, categories, projection, prepared, transitionPending = false, refreshKey, refreshToken = 0, disabled, onResults, onGroups }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const [open, setOpen] = useState(false);
  const [owner,setOwner]=useState<string | undefined>(undefined);
  const visible=useViewControlsVisible();
  useEffect(()=>{if(!visible)setOpen(false);},[visible]);
  const toggle = useRef<HTMLButtonElement>(null);
  const initial = prepared?.workspaceId === workspaceId && prepared.viewId === viewId && prepared.archived === archived ? prepared : undefined;
  const [draft, setDraft] = useState<ViewFilterConfig>(() => initial?.filter ?? clearConfig());
  const [loading, setLoading] = useState(!initial), [saving, setSaving] = useState(false);
  const [error, setError] = useState<"filterLoadError" | "filterSaveError" | "filterQueryError" | null>(null);
  const [empty, setEmpty] = useState(!!initial && initial.result.projectIds.length === 0);
  const skipInitialRefresh = useRef(!!initial);
  const usedPrepared = useRef(!!initial);
  const reloadAfterSave = useRef(false);
  const transitionRef = useRef(transitionPending); transitionRef.current = transitionPending;
  const refreshAfterTransition = useRef(false);
  const appliedPrepared = useRef(initial);
  const configRequestVersion = useRef(0), projectionReady = useRef(false);
  const queryRequestVersion = useRef(0), mountGeneration = useRef(0), saveInFlight = useRef(false), hasDraft = useRef(false);
  const results = useRef(onResults); results.current = onResults;
  const groupResults = useRef(onGroups); groupResults.current = onGroups;
  const properties: { id: string; name: string; type: FilterType }[] = [
    { id: "name", name: t("projectName"), type: "name" },
    ...(categoryProperty ? [{ id: categoryProperty.propertyId, name: categoryPropertyName(categoryProperty, language), type: "category" as const }] : []),
    ...(snapshot?.definitions.map(p => ({ id: p.propertyId, name: p.name, type: p.propertyType })) ?? []),
  ];
  const latestProjection = useRef(projection); latestProjection.current = projection;
  const previousSnapshot = useRef(snapshot);
  const latestRefreshToken = useRef(refreshToken); latestRefreshToken.current = refreshToken;
  const query = async () => {
    const projectionToken = latestRefreshToken.current;
    const request = ++queryRequestVersion.current;
    setLoading(true); setEmpty(false);
    try {
      const result = await client.queryView(workspaceId, viewId, archived, latestProjection.current);
      if (request !== queryRequestVersion.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId && result.value.archived === archived) {
        groupResults.current?.(result.value.groups ?? null, result.value.groupPropertyId ?? null, projectionToken); results.current(result.value.projectIds); setEmpty(!result.value.projectIds.length);
        setError(current => current === "filterQueryError" ? null : current);
      } else { groupResults.current?.(null, null, projectionToken); results.current(null); setError("filterQueryError"); }
    } catch { if (request === queryRequestVersion.current) { groupResults.current?.(null, null, projectionToken); results.current(null); setError("filterQueryError"); } }
    finally { if (request === queryRequestVersion.current) setLoading(false); }
  };
  const load = async (preserveError = false) => {
    const started = mountGeneration.current, request = ++configRequestVersion.current;
    queryRequestVersion.current++;
    setLoading(true); if (!preserveError) setError(null);
    try {
      const result = await client.getViewFilter(workspaceId, viewId);
      if (started !== mountGeneration.current || request !== configRequestVersion.current) return;
      if (!result.ok || result.value.workspaceId !== workspaceId || result.value.viewId !== viewId) { groupResults.current?.(null, null, refreshToken); results.current(null); setError("filterLoadError"); setLoading(false); return; }
      projectionReady.current = true;
      if (!hasDraft.current) setDraft(result.value.config);
      await query();
    } catch { if (started === mountGeneration.current && request === configRequestVersion.current) { groupResults.current?.(null, null, refreshToken); results.current(null); setError("filterLoadError"); setLoading(false); } }
  };
  useEffect(() => {
    if (initial) { projectionReady.current = true; groupResults.current?.(initial.result.groups ?? null, initial.result.groupPropertyId ?? null, refreshToken); results.current(initial.result.projectIds); }
    else void load();
    const stop = client.onWorkspaceChange(event => {
      // Source property events are owned by TextPropertiesContent. Its accepted
      // snapshot revision arrives through refreshKey; a second subscription here
      // was issuing duplicate full-source queries for the same committed edit.
      if (event.type !== "workspace.listChanged") return;
      if (transitionRef.current) { refreshAfterTransition.current = true; return; }
      if (!saveInFlight.current) void load(true);
    });
    return () => { mountGeneration.current++; queryRequestVersion.current++; configRequestVersion.current++; stop(); };
  }, [client, workspaceId, viewId, archived]);
  useEffect(() => {
    if (transitionPending || !refreshAfterTransition.current) return;
    refreshAfterTransition.current = false;
    if (saveInFlight.current) reloadAfterSave.current = true;
    else void load(true);
  }, [transitionPending]);
  useEffect(() => {
    if (prepared && prepared.workspaceId === workspaceId && prepared.viewId === viewId && prepared.archived === archived) {
      if (appliedPrepared.current !== prepared) {
        configRequestVersion.current++; queryRequestVersion.current++;
        appliedPrepared.current = prepared; usedPrepared.current = true; projectionReady.current = true;
        if (!hasDraft.current) setDraft(prepared.filter);
        setLoading(false); setError(null); setEmpty(prepared.result.projectIds.length === 0);
        groupResults.current?.(prepared.result.groups ?? null, prepared.result.groupPropertyId ?? null, latestRefreshToken.current);
        results.current(prepared.result.projectIds);
      }
      return;
    }
    if (!usedPrepared.current) return;
    usedPrepared.current = false; appliedPrepared.current = undefined;
    if (saveInFlight.current) { reloadAfterSave.current = true; return; }
    projectionReady.current = false;
    groupResults.current?.(null, null, latestRefreshToken.current); results.current(null);
    void load(true);
  }, [prepared]);
  useEffect(() => {
    if (skipInitialRefresh.current) { skipInitialRefresh.current = false; return; }
    const previous = previousSnapshot.current;
    if (snapshot) previousSnapshot.current = snapshot;
    // Metadata removal rewrites saved filters in the service. Reload that
    // configuration when references disappear; ordinary value edits only need
    // a result query, and load() still preserves an authored draft.
    const properties = new Set(snapshot?.definitions.map(property => property.propertyId));
    const options = new Set(snapshot?.selectOptions?.map(option => option.optionId));
    const removed = snapshot && previous && (
      previous.definitions.some(property => !properties.has(property.propertyId)) ||
      previous.selectOptions?.some(option => !options.has(option.optionId))
    );
    if (removed) void load();
    else if (projectionReady.current) void query();
  }, [refreshKey]);
  const change = (config: ViewFilterConfig) => { hasDraft.current = true; setDraft(config); };
  const save = async (config = draft) => {
    if (saveInFlight.current || disabled) return;
    saveInFlight.current = true; configRequestVersion.current++; queryRequestVersion.current++;
    setLoading(false); setSaving(true); setError(null);
    const started = mountGeneration.current;
    let saved = false;
    try {
      const result = await client.setViewFilter(workspaceId, viewId, config);
      if (started !== mountGeneration.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) {
        saved = true; projectionReady.current = true; hasDraft.current = false; setDraft(result.value.config); await query();
      } else setError("filterSaveError");
    } catch { if (started === mountGeneration.current) setError("filterSaveError"); }
    finally { if (started === mountGeneration.current) { saveInFlight.current = false; setSaving(false); if (reloadAfterSave.current) { reloadAfterSave.current = false; if (saved) void load(true); else void query(); } } }
  };
  const ruleChange = (index: number, rule: FilterRule) => change({ ...draft, rules: draft.rules.map((current, i) => i === index ? rule : current) });
  return <section className="view-filters" aria-label={t("filtersTitle")} aria-busy={loading || saving}>
    <ViewControls><div className="view-filter-controls"><form onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => {
      if (event.key === "Escape" && !saving) { event.preventDefault(); hasDraft.current = false; void load(); }
    }}>
      <label className="search-field"><span className="sr-only">{t("filterSearch")}</span><input placeholder={t("filterSearch")} className="workspace-input" type="search" maxLength={1000} value={draft.search} disabled={disabled || saving} onChange={event => change({ ...draft, search: event.currentTarget.value })} /></label>
      <Popover.Root open={visible && open} onOpenChange={open=>{if(open)setOwner(contextOwner(toggle.current));setOpen(open);}}>
        <Popover.Trigger asChild><button ref={toggle} className="workspace-button workspace-button--secondary" type="button" disabled={disabled || saving}
          aria-label={t("filtersTitle")}>{t("filtersTitle")} ({draft.rules.length})</button></Popover.Trigger>
        <Popover.Content data-context-owner={owner} className="contextual-panel filter-popover" align="end" sideOffset={4} collisionPadding={8} aria-label={t("filtersTitle")}
          onEscapeKeyDown={event => { event.stopPropagation(); if (saving) event.preventDefault(); }}
          onInteractOutside={event => { if (saving) event.preventDefault(); }}>
          <p>{t("filterSemantics")}</p>
      {draft.rules.map((rule, index) => {
        const property = properties.find(p => p.id === rule.propertyId);
        const type = property?.type ?? "text";
        const selecting = ["category", "single_select", "multi_select"].includes(type);
        const options = type === "category" ? categories.map(c => ({ id: c.categoryId, name: c.name })) : (snapshot?.selectOptions ?? []).filter(o => o.propertyId === rule.propertyId).map(o => ({ id: o.optionId, name: o.name }));
        const selected = Array.isArray(rule.operand) ? rule.operand : [];
        const unknown = selected.filter(id => id !== null && !options.some(o => o.id === id));
        return <fieldset className="filter-rule" key={index} disabled={disabled || saving}>
          <legend>{t("filterCondition")} {index + 1}</legend>
          <label>{t("filterProperty")} <select className="workspace-input" aria-label={t("filterProperty")} value={rule.propertyId} onChange={event => {
            const next = properties.find(p => p.id === event.currentTarget.value)!;
            ruleChange(index, { propertyId: next.id, operator: filterOperators(next.type)[0], operand: next.type === "number" ? 0 : ["category", "single_select", "multi_select"].includes(next.type) ? [null] : "" });
          }}>
            {!property && <option value={rule.propertyId}>{t("filterUnavailable")}</option>}
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
          <label>{t("filterOperator")} <select className="workspace-input" aria-label={t("filterOperator")} value={rule.operator} onChange={event => {
            const operator = event.currentTarget.value as FilterRule["operator"];
            ruleChange(index, { ...rule, operator, operand: operator === "empty" || operator === "not_empty" ? null : rule.operand ?? (selecting ? [null] : type === "number" ? 0 : "") });
          }}>{filterOperators(type).map(op => <option key={op} value={op}>{t(`filterOp_${op}`)}</option>)}</select></label>
          {rule.operator !== "empty" && rule.operator !== "not_empty" && (selecting ? <label>{t("filterOperand")} <select className="workspace-input" aria-label={t("filterOperand")} multiple value={selected.map(id => id ?? "")} onChange={event => ruleChange(index, { ...rule, operand: Array.from(event.currentTarget.selectedOptions, o => o.value || null) })}>
            <option value="">{t("filterOp_empty")}</option>
            {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            {unknown.map(id => <option key={id} value={id!}>{t("filterUnavailable")}</option>)}
          </select><span>{t("filterSelectionHint")}</span></label> : <label>{t("filterOperand")} <input className="workspace-input" aria-label={t("filterOperand")} type={type === "number" ? "number" : type === "date" ? "date" : "text"} step={type === "number" ? "any" : undefined}
            value={typeof rule.operand === "string" || typeof rule.operand === "number" ? rule.operand : ""} onChange={event => ruleChange(index, { ...rule, operand: type === "number" && event.currentTarget.value !== "" ? Number(event.currentTarget.value) : event.currentTarget.value })} /></label>)}
          <button type="button" className="workspace-button workspace-button--secondary" onClick={() => change({ ...draft, rules: draft.rules.filter((_, i) => i !== index) })}>{t("filterRemove")}</button>
        </fieldset>;
      })}
        <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || saving || draft.rules.length >= 100} onClick={() => change({ ...draft, rules: [...draft.rules, { propertyId: "name", operator: "contains", operand: "" }] })}>{t("filterAdd")}</button>
        </Popover.Content>
      </Popover.Root>
      <div className="workspace-form-actions">

        <Hint label={t(saving ? "filterSaving" : "filterApply")}><button className="workspace-button icon-button" aria-label={t(saving ? "filterSaving" : "filterApply")} type="submit" disabled={disabled || saving || !snapshot}><Icon name="check"/></button></Hint>
        <Hint label={t("filterClear")}><button className="workspace-button workspace-button--secondary icon-button" aria-label={t("filterClear")} type="button" disabled={disabled || saving} onClick={() => void save(clearConfig())}><Icon name="close"/></button></Hint>
      </div>
    </form></div></ViewControls>
    {loading && <StatusMessage kind="info" title={t("filterLoading")} />}
    {error && <><StatusMessage kind="error" title={t(error)} /><button type="button" className="workspace-button workspace-button--secondary" disabled={saving || loading} onClick={() => void load()}>{t("viewsRetry")}</button></>}
    {showEmpty && empty && !loading && !error && <StatusMessage kind="info" title={t("filterEmpty")}>{t("filterEmptyHint")}</StatusMessage>}
  </section>;
}
