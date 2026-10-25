import { PresentationPopover } from "./PresentationPopover.js";
import { useEffect, useRef, useState } from "react";
import { defaultGroupSettings, type GroupSettings, type ViewGroup, type ViewGroupingConfig } from "../../contracts/view-grouping.js";
import type { CategoryProperty } from "../../contracts/workspaces.js";
import type { Language } from "../../contracts/settings.js";
import type { PropertySnapshot } from "../../contracts/text-properties.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { categoryPropertyName, translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
interface Props {
    client: WorkspaceServiceClient;
    workspaceId: string;
    viewId: string;
    language: Language;
    snapshot: PropertySnapshot | null;
    categoryProperty?: CategoryProperty | null;
    groups: ViewGroup[] | null;
    groupPropertyId?: string | null;
    disabled: boolean;
    contextual?: boolean;
}
export function ViewGrouping(props: Props) { return <GroupingContent key={`${props.workspaceId}:${props.viewId}`} {...props}/>; }
function GroupingContent({ client, workspaceId, viewId, language, snapshot, categoryProperty, groups, groupPropertyId, disabled, contextual }: Props) {
    const t = (key: TranslationKey) => translate(language, key);
    const [config, setConfig] = useState<ViewGroupingConfig | null>(null), [pending, setPending] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const savedFocus = useRef<HTMLElement | null>(null);
    useEffect(() => {
        if (pending || loading) return;
        const element = savedFocus.current; savedFocus.current = null;
        if (element?.isConnected && !element.matches(":disabled") && document.activeElement === document.body) element.focus();
    }, [pending, loading]);
    const version = useRef(0), saving = useRef(false), reloadAfterSave = useRef(false);
    const properties = [{ id: "name", name: t("projectName") }, ...(snapshot?.definitions.map(p => ({ id: p.propertyId, name: p.name })) ?? []), ...(categoryProperty ? [{ id: categoryProperty.propertyId, name: categoryPropertyName(categoryProperty, language) }] : [])];
    const load = async () => {
        const request = ++version.current;
        setLoading(true);
        setError(false);
        try {
            const result = await client.getViewGrouping(workspaceId, viewId);
            if (request !== version.current)
                return;
            if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId)
                setConfig(result.value.config);
            else
                setError(true);
        }
        catch {
            if (request === version.current)
                setError(true);
        }
        finally {
            if (request === version.current)
                setLoading(false);
        }
    };
    useEffect(() => { void load(); const stop = client.onWorkspaceChange(event => { if (event.type === "workspace.listChanged" || (event.type === "workspace.propertiesChanged" && event.workspaceIds.includes(workspaceId))) {
        if (saving.current) { if (event.type === "workspace.propertiesChanged") reloadAfterSave.current = true; } else void load();
    } }); return () => { version.current++; stop(); }; }, [client, workspaceId, viewId]);
    const save = async (next: ViewGroupingConfig) => {
        if (saving.current || disabled)
            return;
        savedFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        saving.current = true;
        const request = ++version.current;
        setPending(true);
        setLoading(false);
        setError(false);
        try {
            const result = await client.setViewGrouping(workspaceId, viewId, next);
            if (request !== version.current)
                return;
            if (result.ok && result.value.workspaceId === workspaceId && result.value.viewId === viewId)
                setConfig(result.value.config);
            else
                setError(true);
        }
        catch {
            if (request === version.current)
                setError(true);
        }
        finally {
            if (request === version.current) {
                saving.current = false;
                setPending(false);
                if (reloadAfterSave.current) { reloadAfterSave.current = false; void load(); }
            }
        }
    };
    const setting = config?.propertyId ? config.settings.find(s => s.propertyId === config.propertyId) ?? defaultGroupSettings(config.propertyId) : null;
    const change = (next: GroupSettings) => { if (config)
        void save({ ...config, settings: [...config.settings.filter(s => s.propertyId !== next.propertyId), next] }); };
    const toggle = (field: "hidden" | "collapsed", key: string) => { if (setting)
        change({ ...setting, [field]: setting[field].includes(key) ? setting[field].filter(k => k !== key) : [...setting[field], key] }); };
    const projectedGroups = config?.propertyId === groupPropertyId ? groups : null;
    const move = (key: string, delta: number) => {
        if (!setting || !projectedGroups)
            return;
        const ordered = projectedGroups.map(g => g.key), index = ordered.indexOf(key), target = index + delta;
        if (index < 0 || target < 0 || target >= ordered.length)
            return;
        [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
        change({ ...setting, order: "manual", manualOrder: [...ordered, ...setting.manualOrder.filter(k => !ordered.includes(k))] });
    };
    const controls = <section className="view-grouping" aria-label={t("groupTitle")} aria-busy={loading || pending}>
    <h3>{t("groupTitle")}</h3><p>{t("groupHint")}</p>
    <fieldset disabled={disabled || pending || loading || !config} onKeyDown={event => { if (!contextual && event.key === "Escape" && !pending) {
        event.preventDefault();
        void load();
    } }}>
      <label>{t("groupProperty")} <select className="workspace-input" aria-label={t("groupProperty")} value={config?.propertyId ?? ""} onChange={event => { if (config)
        void save({ ...config, propertyId: event.currentTarget.value || null }); }}>
        <option value="">{t("groupNone")}</option>
        {config?.propertyId && !properties.some(p => p.id === config.propertyId) && <option value={config.propertyId}>{t("filterUnavailable")}</option>}
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      {setting && <><label>{t("groupOrder")} <select className="workspace-input" aria-label={t("groupOrder")} value={setting.order} onChange={event => change({ ...setting, order: event.currentTarget.value as GroupSettings["order"] })}>
        {(["default", "ascending", "descending", "manual"] as const).map(order => <option key={order} value={order}>{t(`groupOrder_${order}`)}</option>)}
      </select></label><label><input type="checkbox" checked={setting.hideEmpty} onChange={event => change({ ...setting, hideEmpty: event.currentTarget.checked })}/>{t("groupHideEmpty")}</label>
      <ul className="group-settings">{projectedGroups?.map((group, index) => {
                const label = group.value === null ? t("groupNoValue") : (group.label ?? String(group.value)), hidden = setting.hidden.includes(group.key), collapsed = setting.collapsed.includes(group.key);
                return <li key={group.key}><span className="property-authored">{label} ({group.projectIds.length})</span>
          <button type="button" className="workspace-button workspace-button--secondary" aria-label={`${t(hidden ? "groupShow" : "groupHide")}: ${label}`} onClick={() => toggle("hidden", group.key)}>{t(hidden ? "groupShow" : "groupHide")}</button>
          <button type="button" className="workspace-button workspace-button--secondary" aria-label={`${t(collapsed ? "groupExpand" : "groupCollapse")}: ${label}`} aria-expanded={!collapsed} onClick={() => toggle("collapsed", group.key)}>{t(collapsed ? "groupExpand" : "groupCollapse")}</button>
          <button type="button" className="workspace-button workspace-button--secondary" disabled={index === 0} aria-label={`${t("groupEarlier")}: ${label}`} onClick={() => move(group.key, -1)}>{t("groupEarlier")}</button>
          <button type="button" className="workspace-button workspace-button--secondary" disabled={index === projectedGroups.length - 1} aria-label={`${t("groupLater")}: ${label}`} onClick={() => move(group.key, 1)}>{t("groupLater")}</button>
        </li>;
            })}</ul></>}
    </fieldset>
    {loading && <StatusMessage kind="info" title={t("groupLoading")}/>}
    {error && <><StatusMessage kind="error" title={t("groupError")}/><button type="button" className="workspace-button workspace-button--secondary" disabled={pending || loading} onClick={() => void load()}>{t("viewsRetry")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || loading || disabled} onClick={() => void save({ propertyId: null, settings: [] })}>{t("groupReset")}</button></>}
  </section>;
    return contextual ? <div className="table-grouping-controls"><PresentationPopover label={t("groupTitle")} onOpenChange={setOpen}>{controls}</PresentationPopover>
      {!open && loading && <StatusMessage kind="info" title={t("groupLoading")}/>}
      {!open && error && <StatusMessage kind="error" title={t("groupError")}/>}
    </div> : controls;
}
