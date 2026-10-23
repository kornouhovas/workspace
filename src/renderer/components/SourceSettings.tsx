import { SourceAssociationPanel } from "./SourceAssociationPanel.js";
import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { SourceSettingsSummary } from "../../contracts/workspaces.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate } from "../localization.js";
import { DiscoveryController } from "./DiscoveryPanel.js";
import { ProjectArchivePanel } from "./ProjectArchivePanel.js";
import { SourceRefresh } from "./SourceRefresh.js";
import { StatusMessage } from "./bb-foundation.js";

export const sourceLabels = {
  en: { exclusions: "Saved exclusions", list: "All sources", workspaces: "Affected workspaces", available: "Available", unavailable: "Unavailable", unfinished: "Setup required", none: "None", shared: "Discovery, exclusions and archive location are shared by every workspace listed here. Views remain independent.", error: "Could not load sources", retry: "Retry", orphan: "No workspaces use this retained source. Add a workspace for this folder to configure it." },
  ru: { exclusions: "Сохранённые исключения", list: "Все источники", workspaces: "Затронутые рабочие пространства", available: "Доступен", unavailable: "Недоступен", unfinished: "Требуется настройка", none: "Нет", shared: "Режим обнаружения, исключения и папка архива общие для всех перечисленных рабочих пространств. Виды остаются независимыми.", error: "Не удалось загрузить источники", retry: "Повторить", orphan: "Этот сохранённый источник не используется. Добавьте рабочее пространство для этой папки, чтобы настроить его." },
};

export function SourceSettings({ client, language, activeSourceId, disabled, onPendingChange }: {
  client: WorkspaceServiceClient; language: Language; activeSourceId?: string; disabled: boolean; onPendingChange?(pending: boolean): void;
}) {
  const l = sourceLabels[language];
  const [sources, setSources] = useState<SourceSettingsSummary[]>([]);
  const [pending, setPending] = useState(false);
  useEffect(() => { onPendingChange?.(pending); return () => onPendingChange?.(false); }, [pending, onPendingChange]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const load = async () => {
    const current = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await client.listSources();
      if (current !== version.current) return;
      if (result.ok) setSources(result.value.sources); else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => {
    void load();
    const unsubscribe = client.onWorkspaceChange(event => {
      if (["workspace.listChanged", "workspace.sourceChanged", "workspace.projectsChanged", "workspace.sourceObserved"].includes(event.type)) void load();
    });
    return () => { version.current++; unsubscribe(); };
  }, [client]);
  useEffect(() => { if (selected) heading.current?.focus(); }, [selected]);
  const source = sources.find(item => item.sourceId === selected);
  return <div className="source-settings" aria-busy={loading}>
    {loading && <StatusMessage kind="info" title={translate(language, "loading")} />}
    {error && <StatusMessage kind="error" title={l.error}><button type="button" className="workspace-button" onClick={() => void load()}>{l.retry}</button></StatusMessage>}
    <div ref={list} className="source-list" hidden={!!source}>
      {sources.map(item => <button key={item.sourceId} type="button" className="source-list-item" disabled={disabled}
        aria-label={item.canonicalRoot} aria-current={item.sourceId === activeSourceId ? "true" : undefined} onClick={() => setSelected(item.sourceId)}>
        <span className="workspace-root">{item.canonicalRoot}</span><span>{item.sourceAvailable ? l.available : l.unavailable} · {item.workspaces.length}</span>
      </button>)}
      {!loading && !error && !sources.length && <p>{translate(language, "createWorkspaceDescription")}</p>}
    </div>
    {source && <section aria-label={source.canonicalRoot}>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={() => { setSelected(null); queueMicrotask(() => list.current?.querySelector<HTMLButtonElement>("button")?.focus()); }}>{l.list}</button>
      <h2 ref={heading} tabIndex={-1} className="workspace-root">{source.canonicalRoot}</h2>
      <p role="status">{source.sourceAvailable ? l.available : l.unavailable}</p>
      <p>{l.shared}</p>
      <h3>{l.workspaces}</h3><ul>{source.workspaces.map(workspace => <li key={workspace.workspaceId}>{workspace.name}</li>)}</ul>
      <dl className="source-summary">
        <dt>{translate(language, "discoveryMode")}</dt><dd>{source.mode ? translate(language, source.mode === "direct" ? "discoveryDirectMode" : "discoveryGroupedMode") : l.unfinished}</dd>
        <dt>{l.exclusions}</dt><dd>{source.excludedRelativePaths.length ? <ul>{source.excludedRelativePaths.map(path => <li key={path} className="workspace-root">{path}</li>)}</ul> : l.none}</dd>
        <dt>{translate(language, "archiveLocation")}</dt><dd className="workspace-root">{source.archiveRelativePath ?? l.none}</dd>
      </dl>
      {source.workspaces.length ? <SourceOperations key={`${source.sourceId}:${source.workspaces[0].workspaceId}`} client={client} source={source} language={language} disabled={disabled} onPendingChange={setPending} onCommitted={() => void load()} /> : <p>{l.orphan}</p>}
    </section>}
  </div>;
}

function SourceOperations({ client, source, language, disabled, onCommitted, onPendingChange }: {
  client: WorkspaceServiceClient; source: SourceSettingsSummary; language: Language; disabled: boolean; onCommitted(): void; onPendingChange(pending: boolean): void;
}) {
  const workspaceId = source.workspaces[0].workspaceId;
  const minimumRevision = useRef(0), observationVersion = useRef(0), lifetime = useRef(0);
  const [invalidation, setInvalidation] = useState(0);
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const [discoveryPending, setDiscoveryPending] = useState(false), [archivePending, setArchivePending] = useState(false);
  useEffect(() => { onPendingChange(discoveryPending || archivePending); return () => onPendingChange(false); }, [discoveryPending, archivePending, onPendingChange]);
  const [degraded, setDegraded] = useState(false);
  useEffect(() => {
    let current = true;
    const requestedAt = observationVersion.current;
    let observedRevision = -1;
    const unsubscribe = client.onWorkspaceChange(event => {
      if (event.type === "workspace.sourceChanged") {
        if (event.source.sourceId === source.sourceId && event.source.workspaceIds.includes(workspaceId)) {
          observationVersion.current++; setInvalidation(value => value + 1);
        }
        return;
      }
      if (!("sourceId" in event) || event.sourceId !== source.sourceId || !event.workspaceIds.includes(workspaceId)) return;
      if (event.type === "workspace.projectsChanged" || event.type === "workspace.sourceObserved") {
        if (event.type === "workspace.projectsChanged") minimumRevision.current = Math.max(minimumRevision.current, event.revision);
        else {
          if (event.observationRevision <= observedRevision) return;
          observedRevision = event.observationRevision;
          setDegraded(event.automaticUpdates === "degraded");
        }
        observationVersion.current++; setInvalidation(value => value + 1);
      }
    });
    void client.getSourceObservation(workspaceId).then(result => {
      if (current && requestedAt === observationVersion.current && result.ok && result.value.observation?.sourceId === source.sourceId && result.value.observation.workspaceIds.includes(workspaceId)) setDegraded(result.value.observation.automaticUpdates === "degraded");
    }).catch(() => {});
    return () => { current = false; lifetime.current++; unsubscribe(); };
  }, [client, source.sourceId, workspaceId]);
  const refresh = async () => {
    if (refreshing || disabled || discoveryPending || archivePending) return;
    const current = lifetime.current;
    setRefreshing(true); setRefreshError(false);
    try {
      const result = await client.refreshSource(workspaceId);
      if (current !== lifetime.current) return;
      if (!result.ok || result.value.sourceId !== source.sourceId) setRefreshError(true);
      else { observationVersion.current++; setInvalidation(value => value + 1); onCommitted(); }
    } catch { if (current === lifetime.current) setRefreshError(true); }
    finally { if (current === lifetime.current) setRefreshing(false); }
  };
  return <>
    <SourceRefresh language={language} pending={refreshing} error={refreshError} degraded={degraded} unavailable={!source.sourceAvailable}
      disabled={disabled || discoveryPending || archivePending} onRefresh={() => void refresh()} />
    <SourceAssociationPanel client={client} workspaceId={workspaceId} language={language} disabled={disabled || refreshing} invalidation={invalidation} onCommitted={onCommitted} />
    <DiscoveryController client={client} workspaceId={workspaceId} sourceId={source.sourceId} minimumRevision={minimumRevision}
      observationVersion={observationVersion} invalidation={invalidation} language={language} disabled={disabled || refreshing || archivePending}
      onPendingChange={setDiscoveryPending} onApplied={onCommitted} />
    <ProjectArchivePanel locationOnly client={client} workspaceId={workspaceId} sourceId={source.sourceId} projects={[]}
      language={language} revision={minimumRevision.current} invalidation={invalidation} disabled={disabled || refreshing || discoveryPending}
      onCommitted={onCommitted} onViewChange={() => {}} onBlockedChange={setArchivePending} />
  </>;
}
