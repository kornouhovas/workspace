import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { useEffect, useRef, useState } from "react";
import type { DiscoveryPreview, ProjectList } from "../../contracts/workspaces.js";
import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { EmptyStatePanel, StatusMessage } from "./bb-foundation.js";

interface PanelProps {
  language: Language;
  preview: DiscoveryPreview | null;
  pending: boolean;
  error: boolean;
  applying?: boolean;
  applyError?: boolean;
  stale?: boolean;
  onApply?(): void;
  onExclude(relativePath: string, excluded: boolean): void;
  onRetry(): void;
  onCancel(): void;
}
const stateLabels: Record<DiscoveryPreview["state"], TranslationKey> = {
  ready: "discoveryReady", empty: "discoveryEmpty", unavailable: "discoveryUnavailable",
  unreadable: "discoveryUnreadable", root_identity_conflict: "discoveryRootConflict", changed: "discoveryChanged",
};
const reasonLabels = {
  manual: "discoveryManual", link: "discoveryLink", hidden: "discoveryHidden",
  service: "discoveryService", archive: "discoveryArchive", unresolved: "discoveryUnresolved",
} as const;

export function DiscoveryPanel({ language, preview, pending, error, applying, applyError, stale, onApply, onExclude, onRetry, onCancel }: PanelProps) {
  const t = (key: TranslationKey) => translate(language, key);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef<string | null>(null);
  const controls = useRef(new Map<string, HTMLInputElement>());
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending && requestedFocus.current) {
      (controls.current.get(requestedFocus.current) ?? retry.current)?.focus();
      requestedFocus.current = null;
    }
  }, [pending, preview]);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="discovery-panel" aria-labelledby="discovery-title" aria-busy={pending}>
    <h3 id="discovery-title" ref={heading} tabIndex={-1}>{t("discoveryTitle")}</h3>
    <p>{t("discoveryDescription")}</p>
    {pending && <StatusMessage kind="info" title={t(applying ? "discoveryApplying" : "discoveryLoading")} />}
    {applyError && <StatusMessage kind="error" title={t("discoveryApplyError")} />}
    {stale && <StatusMessage kind="info" title={t("discoveryStale")} />}
    {error && <StatusMessage kind="error" title={t("discoveryError")} />}
    {preview && <>
      <p className="workspace-root">{preview.canonicalRoot}</p>
      <StatusMessage kind={pending || preview.previewToken ? "info" : "error"} title={t(stateLabels[preview.state])} />
      {preview.entries.length > 0 ? <ul className="discovery-entries">
        {preview.entries.map((entry) => {
          const automatic = entry.reason !== null && entry.reason !== "manual";
          return <li key={entry.relativePath}>
            <label>
              <input type="checkbox" ref={(element) => {
                if (element) controls.current.set(entry.relativePath, element);
                else {
                  if (document.activeElement === controls.current.get(entry.relativePath)) requestedFocus.current = entry.relativePath;
                  controls.current.delete(entry.relativePath);
                }
              }} checked={entry.reason !== null} disabled={pending || automatic}
                onChange={(event) => { requestedFocus.current = entry.relativePath; onExclude(entry.relativePath, event.currentTarget.checked); }} />
              <span>{t("discoveryExclude")}: <span className="discovery-name">{entry.name}</span></span>
            </label>
            {entry.reason && <span className="discovery-reason">{t(reasonLabels[entry.reason])}</span>}
          </li>;
        })}
      </ul> : preview.previewToken && <EmptyStatePanel>{t("discoveryEmptyDescription")}</EmptyStatePanel>}
    </>}
    <div className="workspace-form-actions">
      {onApply && <button type="button" className="workspace-button" disabled={pending || !preview?.previewToken} onClick={onApply}>{t("discoveryApply")}</button>}
      <button ref={retry} type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={onRetry}>{t("discoveryRefresh")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={applying} onClick={onCancel}>{t("cancelRenameWorkspace")}</button>
    </div>
  </section>;
}

export function DiscoveryController({ client, workspaceId, sourceId, minimumRevision, invalidation, language, disabled, onApplied }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; minimumRevision: { current: number }; invalidation: number; language: Language; disabled: boolean; onApplied?(projects: ProjectList): void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DiscoveryPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);
  const [stale, setStale] = useState(false);
  const applyingRef = useRef(false);
  const version = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const exclusions = useRef<string[] | undefined>(undefined);
  const lastInvalidation = useRef(invalidation);
  useEffect(() => {
    if (lastInvalidation.current === invalidation) return;
    lastInvalidation.current = invalidation;
    // A committed event can precede our Apply response. Keep that request alive,
    // but require its result to meet the latest observed source revision.
    if (!applyingRef.current) { version.current++; setPending(false); }
    setPreview(null); setStale(true); setError(false); setApplyError(false);
  }, [invalidation]);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    if (!open && returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; }
  }, [open]);
  const request = async (draft?: string[]) => {
    const current = ++version.current;
    exclusions.current = draft;
    setPending(true);
    setError(false);
    setPreview((current) => current ? { ...current, previewToken: null } : null);
    try {
      let result = await client.previewDiscovery(workspaceId, draft);
      if (current !== version.current) return;
      if (!result.ok && result.error.code === "invalid_input" && draft) {
        // A vanished or automatically excluded unsaved choice can invalidate a draft.
        // Rebuild it from an authoritative preview, preserving the remaining choices.
        const saved = await client.previewDiscovery(workspaceId);
        if (current !== version.current) return;
        result = saved;
        if (saved.ok && saved.value.workspaceId === workspaceId && saved.value.sourceId === sourceId &&
          saved.value.revision >= minimumRevision.current && saved.value.previewToken) {
          const available = new Set([...saved.value.excludedRelativePaths, ...saved.value.entries
            .filter((entry) => entry.reason === null || entry.reason === "manual").map((entry) => entry.relativePath)]);
          result = await client.previewDiscovery(workspaceId, draft.filter((name) => available.has(name)));
        }
      }
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.revision >= minimumRevision.current) {
        setPreview(result.value);
        exclusions.current = result.value.previewToken ? result.value.excludedRelativePaths : draft ?? result.value.excludedRelativePaths;
      } else { setPreview(null); setError(true); }
    } catch { if (current === version.current) { setPreview(null); setError(true); } }
    finally { if (current === version.current) setPending(false); }
  };
  const apply = async () => {
    if (pending || applyingRef.current || !preview?.previewToken || preview.revision < minimumRevision.current) return;
    const current = ++version.current;
    applyingRef.current = true;
    setApplying(true); setPending(true); setApplyError(false); setStale(false);
    try {
      const result = await client.applyDiscovery(workspaceId, preview.previewToken);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.revision >= minimumRevision.current) {
        onApplied?.(result.value);
        returnFocus.current = true; setOpen(false); setPreview(null);
      } else if (!result.ok && result.error.code === "stale_preview") {
        setStale(true);
        await request(exclusions.current);
      } else if (result.ok) { setPreview(null); setStale(true); }
      else setApplyError(true);
    } catch { if (current === version.current) setApplyError(true); }
    finally {
      applyingRef.current = false;
      setApplying(false);
      if (current === version.current) setPending(false);
    }
  };
  return <>
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || open}
      onClick={() => { setOpen(true); setApplyError(false); setStale(false); void request(); }}>{translate(language, "discoveryAction")}</button>
    {open && <DiscoveryPanel language={language} preview={preview && preview.revision >= minimumRevision.current ? preview : null} pending={pending} error={error} applying={applying} applyError={applyError} stale={stale} onApply={() => void apply()}
      onRetry={() => { setApplyError(false); void request(exclusions.current); }}
      onExclude={(name, excluded) => {
        const draft = new Set(exclusions.current ?? []);
        if (excluded) draft.add(name); else draft.delete(name);
        void request([...draft]);
      }}
      onCancel={() => { version.current++; returnFocus.current = true; setOpen(false); setPreview(null); setPending(false); }} />}
  </>;
}


export function DiscoveryWorkspace({ client, workspaceId, sourceId, sourceState, language, disabled }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; sourceState?: string; language: Language; disabled: boolean;
}) {
  const [projects, setProjects] = useState<ProjectList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const minimumRevision = useRef(0);
  const [invalidation, setInvalidation] = useState(0);
  const t = (key: TranslationKey) => translate(language, key);
  const load = async () => {
    const current = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await client.listProjects(workspaceId);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.revision >= minimumRevision.current) {
        if (result.value.revision > minimumRevision.current) {
          minimumRevision.current = result.value.revision;
          setInvalidation((value) => value + 1);
        }
        setProjects(result.value);
      }
      else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (event.type === "workspace.listChanged" || event.type === "workspace.propertiesChanged") return;
      const affectedSource = event.type === "workspace.projectsChanged" ? event.sourceId : event.source.sourceId;
      const references = event.type === "workspace.projectsChanged" ? event.workspaceIds : event.source.workspaceIds;
      if (affectedSource !== sourceId || !references.includes(workspaceId)) return;
      if (event.type === "workspace.projectsChanged") {
        if (event.revision <= minimumRevision.current) return;
        minimumRevision.current = event.revision;
      }
      setInvalidation((value) => value + 1);
      void load();
    });
    void load();
    return () => { version.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  return <>
    <DiscoveryController key={sourceState} client={client} workspaceId={workspaceId} sourceId={sourceId} minimumRevision={minimumRevision}
      invalidation={invalidation} language={language} disabled={disabled}
      onApplied={(value) => { version.current++; minimumRevision.current = value.revision; setProjects(value); setError(false); setLoading(false); }} />
    <section className="table-view" aria-labelledby="table-title" aria-busy={loading}>
      <div className="table-view__heading"><div>
        <h3 id="table-title">{t("tableViewTitle")}</h3>
        <p>{t(projects?.configured ? "projectsApplied" : "emptyTableDescription")}</p>
      </div><span className="view-badge">{t("tableViewLabel")}</span></div>
      {loading && <StatusMessage kind="info" title={t("projectsLoading")} />}
      {error && <><StatusMessage kind="error" title={t("projectsError")} />
        <button type="button" className="workspace-button workspace-button--secondary" disabled={loading} onClick={() => void load()}>{t("projectsRetry")}</button></>}
      {!loading && !error && projects && <>
        {projects.state !== "ready" && projects.state !== "empty" && <StatusMessage kind="error" title={t(stateLabels[projects.state])} />}
        {projects.retainedCount > 0 && <StatusMessage kind="info" title={t("projectsRetained")} />}
        {projects.projects.length === 0 && <EmptyStatePanel>{t(projects.configured ? "projectsEmpty" : "emptyTableGuidance")}</EmptyStatePanel>}
      </>}
      <TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId}
        projects={projects?.projects ?? []} language={language} disabled={disabled} />
    </section>
  </>;
}
