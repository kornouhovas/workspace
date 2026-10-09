import { ProjectRecoveryController } from "./ProjectRecoveryPanel.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { useEffect, useRef, useState } from "react";
import type { ProjectAssociationSummary, CategoryPropertySnapshot, DiscoveryEntry, DiscoveryMode, DiscoveryPreview, ProjectList } from "../../contracts/workspaces.js";
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
  onMode?(mode: DiscoveryMode): void;
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

export function DiscoveryPanel({ language, preview, pending, error, applying, applyError, stale, onApply, onMode, onExclude, onRetry, onCancel }: PanelProps) {
  const t = (key: TranslationKey) => translate(language, key);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef<string | null>(null);
  const controls = useRef(new Map<string, HTMLInputElement>());
  const retry = useRef<HTMLButtonElement>(null);
  const modeControl = useRef<HTMLSelectElement>(null);
  const modeFocus = useRef(false);
  useEffect(() => {
    if (!pending && modeFocus.current) { (modeControl.current ?? retry.current)?.focus(); modeFocus.current = false; }
    if (!pending && requestedFocus.current) {
      (controls.current.get(requestedFocus.current) ?? retry.current)?.focus();
      requestedFocus.current = null;
    }
  }, [pending, preview]);
  useEffect(() => { heading.current?.focus(); }, []);
  const renderEntry = (entry: DiscoveryEntry) => {
    const automatic = entry.reason !== null && entry.reason !== "manual";
    const projects = preview?.entries.filter((project) => project.kind === "project" && project.categoryPath === entry.relativePath) ?? [];
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
        <span>{t("discoveryExclude")}: {preview?.mode === "grouped" && <span>{t(entry.kind === "category" ? "discoveryCategory" : "discoveryProject")}: </span>}
          <span className="discovery-name">{entry.name}</span></span>
      </label>
      {entry.reason && <span className="discovery-reason">{t(reasonLabels[entry.reason])}</span>}
      {entry.kind === "category" && entry.reason === null && entry.empty && <span className="discovery-reason">{t("discoveryEmptyCategory")}</span>}
      {projects.length > 0 && <ul className="discovery-entries discovery-entries--projects">{projects.map(renderEntry)}</ul>}
    </li>;
  };
  return <section className="discovery-panel" aria-labelledby="discovery-title" aria-busy={pending}>
    <h3 id="discovery-title" ref={heading} tabIndex={-1}>{t(preview?.mode === "grouped" ? "discoveryGroupedTitle" : "discoveryTitle")}</h3>
    {preview && !preview.configured && onMode && <label className="discovery-mode">
      <span>{t("discoveryMode")}</span>
      <select ref={modeControl} value={preview.mode} disabled={pending} onChange={(event) => {
        modeFocus.current = true; onMode(event.currentTarget.value as DiscoveryMode);
      }}>
        <option value="direct">{t("discoveryDirectMode")}</option>
        <option value="grouped">{t("discoveryGroupedMode")}</option>
      </select>
    </label>}
    <p>{t(preview?.mode === "grouped" ? "discoveryGroupedDescription" : "discoveryDescription")}</p>
    {pending && <StatusMessage kind="info" title={t(applying ? "discoveryApplying" : "discoveryLoading")} />}
    {applyError && <StatusMessage kind="error" title={t("discoveryApplyError")} />}
    {stale && <StatusMessage kind="info" title={t("discoveryStale")} />}
    {error && <StatusMessage kind="error" title={t("discoveryError")} />}
    {preview && <>
      <p className="workspace-root">{preview.canonicalRoot}</p>
      <StatusMessage kind={pending || preview.previewToken ? "info" : "error"} title={t(stateLabels[preview.state])} />
      {preview.entries.length > 0 ? <ul className="discovery-entries">
        {preview.entries.filter((entry) => entry.kind === "category" || entry.categoryPath === null).map(renderEntry)}
      </ul> : preview.previewToken && <EmptyStatePanel>{t("discoveryEmptyDescription")}</EmptyStatePanel>}
    </>}
    <div className="workspace-form-actions">
      {onApply && <button type="button" className="workspace-button" disabled={pending || !preview?.previewToken} onClick={onApply}>{t("discoveryApply")}</button>}
      <button ref={retry} type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={onRetry}>{t("discoveryRefresh")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={applying} onClick={onCancel}>{t("cancelRenameWorkspace")}</button>
    </div>
  </section>;
}

export function DiscoveryController({ client, workspaceId, sourceId, minimumRevision, observationVersion, invalidation, language, disabled, onApplied }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; minimumRevision: { current: number }; observationVersion: { current: number }; invalidation: number; language: Language; disabled: boolean; onApplied?(projects: ProjectList, observedVersion: number): void;
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
  const mode = useRef<DiscoveryMode | undefined>(undefined);
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
      let result = await client.previewDiscovery(workspaceId, draft, mode.current);
      if (current !== version.current) return;
      if (!result.ok && result.error.code === "invalid_input" && draft) {
        // A vanished or automatically excluded unsaved choice can invalidate a draft.
        // Rebuild it from an authoritative preview, preserving the remaining choices.
        const saved = await client.previewDiscovery(workspaceId, undefined, mode.current);
        if (current !== version.current) return;
        result = saved;
        if (saved.ok && saved.value.workspaceId === workspaceId && saved.value.sourceId === sourceId &&
          saved.value.revision >= minimumRevision.current && saved.value.previewToken) {
          const available = new Set([...saved.value.excludedRelativePaths, ...saved.value.entries
            .filter((entry) => entry.reason === null || entry.reason === "manual").map((entry) => entry.relativePath)]);
          result = await client.previewDiscovery(workspaceId, draft.filter((name) => available.has(name)), mode.current);
        }
      }
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.revision >= minimumRevision.current && (mode.current === undefined || result.value.mode === mode.current)) {
        setPreview(result.value);
        exclusions.current = result.value.previewToken ? result.value.excludedRelativePaths : draft ?? result.value.excludedRelativePaths;
      } else { setPreview(null); setError(true); }
    } catch { if (current === version.current) { setPreview(null); setError(true); } }
    finally { if (current === version.current) setPending(false); }
  };
  const apply = async () => {
    if (pending || applyingRef.current || !preview?.previewToken || preview.revision < minimumRevision.current) return;
    const current = ++version.current;
    const observedVersion = observationVersion.current;
    applyingRef.current = true;
    setApplying(true); setPending(true); setApplyError(false); setStale(false);
    try {
      const result = await client.applyDiscovery(workspaceId, preview.previewToken);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.revision >= minimumRevision.current) {
        onApplied?.(result.value, observedVersion);
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
      onClick={() => { mode.current = undefined; setOpen(true); setApplyError(false); setStale(false); void request(); }}>{translate(language, "discoveryAction")}</button>
    {open && <DiscoveryPanel language={language} preview={preview && preview.revision >= minimumRevision.current ? preview : null} pending={pending} error={error} applying={applying} applyError={applyError} stale={stale} onApply={() => void apply()}
      onMode={(value) => { mode.current = value; setApplyError(false); setStale(false); void request(); }}
      onRetry={() => { setApplyError(false); void request(exclusions.current); }}
      onExclude={(name, excluded) => {
        const draft = new Set(exclusions.current ?? []);
        if (excluded) {
          // A parent exclusion subsumes its child choices without opening them.
          for (const path of draft) if (path.startsWith(`${name}/`)) draft.delete(path);
          draft.add(name);
        } else draft.delete(name);
        void request([...draft]);
      }}
      onCancel={() => { version.current++; returnFocus.current = true; setOpen(false); setPreview(null); setPending(false); }} />}
  </>;
}


export function DiscoveryWorkspace({ client, workspaceId, sourceId, refreshVersion = 0, onSourceState, onRecoveryPending, language, disabled }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; refreshVersion?: number;
  onSourceState?(workspaceId: string, state: ProjectList["state"]): void; language: Language; disabled: boolean;
  onRecoveryPending?(pending: boolean): void;
}) {
  const [projects, setProjects] = useState<ProjectList | null>(null);
  const committedProjects = useRef<ProjectList | null>(null);
  const [recoveryProject, setRecoveryProject] = useState<ProjectAssociationSummary | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const recoveryTrigger = useRef<HTMLButtonElement | null>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);
  const restoreRecoveryFocus = useRef(false);
  useEffect(() => {
    if (!recoveryProject && restoreRecoveryFocus.current) {
      (recoveryTrigger.current?.isConnected ? recoveryTrigger.current : tableHeading.current)?.focus();
      restoreRecoveryFocus.current = false;
    }
  }, [recoveryProject]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const minimumRevision = useRef(0);
  const minimumCategoryPropertyRevision = useRef(0);
  const minimumObservationRevision = useRef(0);
  const observationVersion = useRef(0);
  const [invalidation, setInvalidation] = useState(0);
  const [observation, setObservation] = useState(0);
  const lastScanState = useRef<ProjectList["state"] | null>(null);
  const lastRefreshVersion = useRef(refreshVersion);
  const t = (key: TranslationKey) => translate(language, key);
  const commitLabel = (value: CategoryPropertySnapshot) => {
    const current = committedProjects.current;
    if (!current || value.workspaceId !== workspaceId || value.sourceId !== sourceId ||
      value.propertyId !== current.categoryProperty?.propertyId || value.revision < minimumCategoryPropertyRevision.current) return;
    minimumCategoryPropertyRevision.current = value.revision;
    const updated = { ...current, categoryProperty: { propertyId: value.propertyId, sourceId, name: value.name }, categoryPropertyRevision: value.revision };
    committedProjects.current = updated; setProjects(updated);
  };
  const load = async () => {
    const current = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await client.listProjects(workspaceId);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId) {
        const currentProjects = committedProjects.current;
        const value = result.value;
        const discoveryCurrent = value.revision >= minimumRevision.current;
        const labelCurrent = value.categoryPropertyRevision >= minimumCategoryPropertyRevision.current;
        if (discoveryCurrent && value.state !== lastScanState.current) {
          const available = (state: ProjectList["state"] | null) => state === "ready" || state === "empty";
          if (lastScanState.current !== null && (!available(value.state) || !available(lastScanState.current))) {
            observationVersion.current++;
            setObservation((value) => value + 1); setInvalidation((value) => value + 1);
          }
          lastScanState.current = value.state;
        }
        // The two revisions describe independent data. Preserve a newer committed
        // label when a delayed project list was captured before its save.
        if ((!discoveryCurrent && !currentProjects) || (!labelCurrent &&
          (!currentProjects || currentProjects.categoryPropertyRevision < minimumCategoryPropertyRevision.current))) {
          setError(true); return;
        }
        const updated = discoveryCurrent ? { ...value } : { ...currentProjects! };
        if (labelCurrent) {
          updated.categoryProperty = value.categoryProperty;
          updated.categoryPropertyRevision = value.categoryPropertyRevision;
          minimumCategoryPropertyRevision.current = value.categoryPropertyRevision;
        } else {
          updated.categoryProperty = currentProjects!.categoryProperty;
          updated.categoryPropertyRevision = currentProjects!.categoryPropertyRevision;
        }
        if (discoveryCurrent && value.revision > minimumRevision.current) {
          minimumRevision.current = value.revision;
          setInvalidation((value) => value + 1);
        }
        committedProjects.current = updated; setProjects(updated);
        setError(updated.revision < minimumRevision.current);
      } else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (event.type === "workspace.listChanged" || event.type === "workspace.propertiesChanged") return;
      if (event.type === "workspace.categoryPropertyChanged") {
        if (event.sourceId !== sourceId || !event.workspaceIds.includes(workspaceId) || event.revision <= minimumCategoryPropertyRevision.current) return;
        minimumCategoryPropertyRevision.current = event.revision;
        void load(); return;
      }
      const affectedSource = event.type === "workspace.sourceChanged" ? event.source.sourceId : event.sourceId;
      const references = event.type === "workspace.sourceChanged" ? event.source.workspaceIds : event.workspaceIds;
      if (affectedSource !== sourceId || !references.includes(workspaceId)) return;
      if (event.type === "workspace.projectsChanged") {
        if (event.revision <= minimumRevision.current) return;
        minimumRevision.current = event.revision;
      } else {
        if (event.type === "workspace.sourceObserved") {
          if (event.observationRevision <= minimumObservationRevision.current) return;
          minimumObservationRevision.current = event.observationRevision;
        }
        observationVersion.current++;
        setObservation((value) => value + 1);
      }
      setInvalidation((value) => value + 1);
      void load();
    });
    void load();
    return () => { version.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  useEffect(() => {
    if (lastRefreshVersion.current === refreshVersion) return;
    lastRefreshVersion.current = refreshVersion;
    observationVersion.current++;
    setInvalidation((value) => value + 1); setObservation((value) => value + 1);
    void load();
  }, [refreshVersion]);
  useEffect(() => { if (projects) onSourceState?.(workspaceId, projects.state); }, [projects?.state, workspaceId, onSourceState]);
  return <>
    <DiscoveryController client={client} workspaceId={workspaceId} sourceId={sourceId} minimumRevision={minimumRevision}
      observationVersion={observationVersion}
      invalidation={invalidation} language={language} disabled={disabled || recoveryProject !== null}
      onApplied={(value, observedVersion) => {
        // The command can succeed while a newer runtime observation changes
        // resolution without a persisted revision. Keep success, reload placement.
        if (value.revision < minimumRevision.current || observedVersion !== observationVersion.current) { void load(); return; }
        version.current++; minimumRevision.current = value.revision;
        if (value.categoryPropertyRevision >= minimumCategoryPropertyRevision.current) {
          minimumCategoryPropertyRevision.current = value.categoryPropertyRevision; committedProjects.current = value; setProjects(value);
        } else { void load(); return; }
        setError(false); setLoading(false);
      }} />
    {recoveryProject && <ProjectRecoveryController client={client} workspaceId={workspaceId} sourceId={sourceId}
      project={recoveryProject} minimumRevision={minimumRevision} invalidation={invalidation} observation={observation} language={language} disabled={disabled}
      onPendingChange={onRecoveryPending}
      onReload={() => void load()} onClose={() => { restoreRecoveryFocus.current = true; setRecoveryProject(null); }}
      onCommitted={(value) => {
        setRecoverySaved(true);
        // A confirmed own commit can be older than a sibling commit. Report the
        // success without replacing its newer projection or pending reload.
        if (value.revision < minimumRevision.current) { void load(); return; }
        version.current++; minimumRevision.current = value.revision;
        const current = committedProjects.current;
        const updated = value.categoryPropertyRevision >= minimumCategoryPropertyRevision.current || !current ? value
          : { ...value, categoryProperty: current.categoryProperty, categoryPropertyRevision: current.categoryPropertyRevision };
        committedProjects.current = updated; setProjects(updated); setLoading(false); setError(false);
        if (updated.categoryPropertyRevision < minimumCategoryPropertyRevision.current) void load();
      }} />}
    {recoverySaved && <StatusMessage kind="info" title={t("recoverySaved")} />}
    <section className="table-view" aria-labelledby="table-title" aria-busy={loading}>
      <div className="table-view__heading"><div>
        <h3 id="table-title" ref={tableHeading} tabIndex={-1}>{t("tableViewTitle")}</h3>
        <p>{t(projects?.configured ? "projectsApplied" : "emptyTableDescription")}</p>
      </div><span className="view-badge">{t("tableViewLabel")}</span></div>
      {loading && <StatusMessage kind="info" title={t("projectsLoading")} />}
      {error && <><StatusMessage kind="error" title={t("projectsError")} />
        <button type="button" className="workspace-button workspace-button--secondary" disabled={loading} onClick={() => void load()}>{t("projectsRetry")}</button></>}
      {!loading && !error && projects && <>
        {!onSourceState && projects.state !== "ready" && projects.state !== "empty" && <StatusMessage kind="error" title={t(stateLabels[projects.state])} />}
        {projects.retainedCount > 0 && <StatusMessage kind="info" title={t("projectsRetained")} />}
        {projects.projects.length === 0 && projects.retainedProjects.length === 0 && <EmptyStatePanel>{t(projects.configured ? "projectsEmpty" : "emptyTableGuidance")}</EmptyStatePanel>}
      </>}
      {projects?.mode === "grouped" && <div className="saved-categories">
        <p>{t("discoveryGroupedMode")}</p>
        <p>{t("savedCategories")}</p>
        {projects.categories.length > 0 ? <ul>{projects.categories.map((category) => <li key={category.categoryId}>{category.name}</li>)}</ul>
          : <p>{t("savedCategoriesEmpty")}</p>}
      </div>}
      <TextPropertiesTable categoryPropertyRevision={projects?.categoryPropertyRevision ?? 0} minimumCategoryPropertyRevision={minimumCategoryPropertyRevision}
        onCategoryPropertyCommitted={commitLabel} categoryProperty={projects?.categoryProperty ?? null} categories={projects?.categories ?? []} client={client} workspaceId={workspaceId} sourceId={sourceId}
        locateDisabled={recoveryProject !== null}
        onLocate={projects?.configured ? (project, trigger) => {
          recoveryTrigger.current = trigger; setRecoverySaved(false); setRecoveryProject(project);
        } : undefined}
        projects={projects?.projects ?? []} retainedProjects={projects?.retainedProjects ?? []} language={language} disabled={disabled} />
    </section>
  </>;
}
