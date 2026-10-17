import { useEffect, useRef, useState } from "react";
import { filterOperators, type FilterRule, type FilterType, type ViewFilterConfig } from "../../contracts/view-filters.js";
import type { Language } from "../../contracts/settings.js";
import type { PropertySnapshot } from "../../contracts/text-properties.js";
import type { CategoryProperty, CategorySummary } from "../../contracts/workspaces.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  client: WorkspaceServiceClient; workspaceId: string; viewId: string; archived: boolean; language: Language;
  snapshot: PropertySnapshot | null; categoryProperty?: CategoryProperty | null; categories: CategorySummary[];
  refreshKey: string; disabled: boolean; onResults(ids: string[] | null): void;
}
const clearConfig = (): ViewFilterConfig => ({ search: "", rules: [] });
export function ViewFilters(props: Props) { return <FilterContent key={`${props.workspaceId}:${props.viewId}:${props.archived}`} {...props} />; }
function FilterContent({ client, workspaceId, viewId, archived, language, snapshot, categoryProperty, categories, refreshKey, disabled, onResults }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const [draft, setDraft] = useState<ViewFilterConfig>(clearConfig);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState<"filterLoadError" | "filterSaveError" | "filterQueryError" | null>(null);
  const [empty, setEmpty] = useState(false);
  const configRequestVersion = useRef(0), projectionReady = useRef(false);
  const queryRequestVersion = useRef(0), mountGeneration = useRef(0), saveInFlight = useRef(false), hasDraft = useRef(false);
  const results = useRef(onResults); results.current = onResults;
  const properties: { id: string; name: string; type: FilterType }[] = [
    { id: "name", name: t("projectName"), type: "name" },
    ...(categoryProperty ? [{ id: categoryProperty.propertyId, name: categoryProperty.name ?? t("discoveryCategory"), type: "category" as const }] : []),
    ...(snapshot?.definitions.map(p => ({ id: p.propertyId, name: p.name, type: p.propertyType })) ?? []),
  ];
  const query = async () => {
    const request = ++queryRequestVersion.current;
    setLoading(true); setEmpty(false);
    try {
      const result = await client.queryView(workspaceId, viewId, archived);
      if (request !== queryRequestVersion.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId && result.value.archived === archived) {
        results.current(result.value.projectIds); setEmpty(!result.value.projectIds.length);
        setError(current => current === "filterQueryError" ? null : current);
      } else { results.current(null); setError("filterQueryError"); }
    } catch { if (request === queryRequestVersion.current) { results.current(null); setError("filterQueryError"); } }
    finally { if (request === queryRequestVersion.current) setLoading(false); }
  };
  const load = async () => {
    const started = mountGeneration.current, request = ++configRequestVersion.current;
    queryRequestVersion.current++;
    setLoading(true); setError(null);
    try {
      const result = await client.getViewFilter(workspaceId, viewId);
      if (started !== mountGeneration.current || request !== configRequestVersion.current) return;
      if (!result.ok || result.value.workspaceId !== workspaceId || result.value.viewId !== viewId) { results.current(null); setError("filterLoadError"); setLoading(false); return; }
      projectionReady.current = true;
      if (!hasDraft.current) setDraft(result.value.config);
      await query();
    } catch { if (started === mountGeneration.current && request === configRequestVersion.current) { results.current(null); setError("filterLoadError"); setLoading(false); } }
  };
  useEffect(() => {
    void load();
    const stop = client.onWorkspaceChange(event => { if (event.type === "workspace.listChanged" && !saveInFlight.current) void load(); });
    return () => { mountGeneration.current++; queryRequestVersion.current++; configRequestVersion.current++; stop(); };
  }, [client, workspaceId, viewId, archived]);
  useEffect(() => { if (projectionReady.current) void query(); }, [refreshKey]);
  const change = (config: ViewFilterConfig) => { hasDraft.current = true; setDraft(config); };
  const save = async (config = draft) => {
    if (saveInFlight.current || disabled) return;
    saveInFlight.current = true; configRequestVersion.current++; queryRequestVersion.current++;
    setLoading(false); setSaving(true); setError(null);
    const started = mountGeneration.current;
    try {
      const result = await client.setViewFilter(workspaceId, viewId, config);
      if (started !== mountGeneration.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId) {
        projectionReady.current = true; hasDraft.current = false; setDraft(result.value.config); await query();
      } else setError("filterSaveError");
    } catch { if (started === mountGeneration.current) setError("filterSaveError"); }
    finally { if (started === mountGeneration.current) { saveInFlight.current = false; setSaving(false); } }
  };
  const ruleChange = (index: number, rule: FilterRule) => change({ ...draft, rules: draft.rules.map((current, i) => i === index ? rule : current) });
  return <section className="view-filters" aria-label={t("filtersTitle")} aria-busy={loading || saving}>
    <form onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => {
      if (event.key === "Escape" && !saving) { event.preventDefault(); hasDraft.current = false; void load(); }
    }}>
      <p>{t("filterSemantics")}</p>
      <label>{t("filterSearch")} <input className="workspace-input" type="search" maxLength={1000} value={draft.search} disabled={disabled || saving} onChange={event => change({ ...draft, search: event.currentTarget.value })} /></label>
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
      <div className="workspace-form-actions">
        <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || saving || draft.rules.length >= 100} onClick={() => change({ ...draft, rules: [...draft.rules, { propertyId: "name", operator: "contains", operand: "" }] })}>{t("filterAdd")}</button>
        <button className="workspace-button" type="submit" disabled={disabled || saving || !snapshot}>{t(saving ? "filterSaving" : "filterApply")}</button>
        <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || saving} onClick={() => void save(clearConfig())}>{t("filterClear")}</button>
      </div>
    </form>
    {loading && <StatusMessage kind="info" title={t("filterLoading")} />}
    {error && <><StatusMessage kind="error" title={t(error)} /><button type="button" className="workspace-button workspace-button--secondary" disabled={saving || loading} onClick={() => void load()}>{t("viewsRetry")}</button></>}
    {empty && !loading && !error && <StatusMessage kind="info" title={t("filterEmpty")}>{t("filterEmptyHint")}</StatusMessage>}
  </section>;
}
