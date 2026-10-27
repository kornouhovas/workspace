import type { PreparedView } from "./prepared-view.js";
import { retainedProjectAvailability } from "./project-availability.js";
import { useSettingsNavigation } from "./SettingsNavigation.js";
import { ScalarDrafts } from "./ScalarDrafts.js";
import { useWorkspaceSession, WorkspaceSessionGate } from "./WorkspaceSession.js";
import { ProjectFiles } from "./ProjectFiles.js";
import { DailyControlsSurface, DailyControlsTarget } from "./DailyControls.js";
import { useViewScroll } from "./useViewScroll.js";
import type { ArchiveSnapshot } from "../../contracts/project-archive.js";
import { ProjectTabs, useProjectNavigation, navigationLabels, type NavigationMemory } from "./ProjectNavigation.js";
import { AreaResize } from "./AreaResize.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import { ManagementSurface, ManagementTarget, ViewToolsTarget, ViewControlsScope } from "./ManagementSurface.js";
import { ContextTools } from "./ContextTools.js";
import { ViewsPanel } from "./ViewsPanel.js";
import type { WorkspaceView } from "../../contracts/views.js";
import { ProjectArchivePanel, type ArchiveRequest } from "./ProjectArchivePanel.js";
import { CategoryOptionsPanel } from "./CategoryOptionsPanel.js";
import { ProjectCategoryMovePanel } from "./ProjectCategoryMovePanel.js";
import { ProjectRenamePanel } from "./ProjectRenamePanel.js";
import { ProjectCreationPanel } from "./ProjectCreationPanel.js";
import { ProjectOperationDialog } from "./ProjectOperationDialog.js";
import { ProjectRecoveryController } from "./ProjectRecoveryPanel.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  disabled?: boolean;
  applyError?: boolean;
  stale?: boolean;
  validationError?: boolean;
  onApply?(): void;
  onMode?(mode: DiscoveryMode): void;
  onExclude(relativePath: string, excluded: boolean): void;
  onRetry(): void;
  onCancel(): void;
}
const stateLabels: Record<DiscoveryPreview["state"], TranslationKey> = {
  ready: "discoveryReady", empty: "discoveryEmpty", unavailable: "discoveryUnavailable",
  unreadable: "discoveryUnreadable", root_identity_conflict: "discoveryRootConflict", changed: "discoveryChanged",
  association_review_required: "associationReviewRequired", different_volume: "associationDifferentVolume", identity_unverified: "associationUnverified",
};
const reasonLabels = {
  manual: "discoveryManual", link: "discoveryLink", hidden: "discoveryHidden",
  service: "discoveryService", archive: "discoveryArchive", unresolved: "discoveryUnresolved",
} as const;

export function DiscoveryPanel({ language, preview, pending, error, applying, disabled, applyError, stale, validationError, onApply, onMode, onExclude, onRetry, onCancel }: PanelProps) {
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
  return <section className="discovery-panel" aria-labelledby="discovery-title" aria-busy={pending}
    onKeyDown={(event) => { if (event.key === "Escape" && !applying) { event.preventDefault(); onCancel(); } }}>
    <h3 id="discovery-title" ref={heading} tabIndex={-1}>{t(preview?.mode === "grouped" ? "discoveryGroupedTitle" : "discoveryTitle")}</h3>
    {preview && onMode && <label className="discovery-mode">
      <span>{t("discoveryMode")}</span>
      <select ref={(element) => {
        if (!element && document.activeElement === modeControl.current) modeFocus.current = true;
        modeControl.current = element;
      }} value={preview.mode} disabled={pending} onChange={(event) => {
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
    {validationError && <StatusMessage kind="error" title={t("discoveryValidation")} />}
    {error && <StatusMessage kind="error" title={t("discoveryError")} />}
    {preview && <>
      <p className="workspace-root">{preview.canonicalRoot}</p>
      <StatusMessage kind={pending || preview.previewToken ? "info" : "error"} title={t(stateLabels[preview.state])} />
      <div className="discovery-effects">
        <p>{t("discoverySharedScope")}</p>
        {preview.currentMode && <p>{t("discoveryCurrentMode")}: {t(preview.currentMode === "direct" ? "discoveryDirectMode" : "discoveryGroupedMode")}</p>}
        <p>{t(preview.categoryAvailability.target ? "discoveryCategoryAvailable" : "discoveryCategoryHidden")}</p>
        {preview.categoryAvailability.name !== null && <p className="discovery-name">{preview.categoryAvailability.name}</p>}
        <p>{t("discoveryMetadataRetained")}</p>
        {(["added", "retained", "noLongerRecognized", "alreadyRetained"] as const).map((effect) => <div key={effect}>
          <h4>{t(({ added: "discoveryAdded", retained: "discoveryRetained", noLongerRecognized: "discoveryNoLongerRecognized", alreadyRetained: "discoveryAlreadyRetained" } as const)[effect])} ({preview.projectEffects[effect].length})</h4>
          {preview.projectEffects[effect].length > 0 ? <ul>{preview.projectEffects[effect].map((project) => <li key={"projectId" in project ? project.projectId : project.relativePath}>
            <span className="discovery-name">{project.relativePath}</span>
          </li>)}</ul> : <p>{t("discoveryNoEffects")}</p>}
        </div>)}
        <h4>{t("discoveryEffectiveExclusions")}</h4>
        <p>{t(preview.mode === "grouped" ? "discoveryGroupedExclusionScope" : "discoveryDirectExclusionScope")}</p>
        {preview.effectiveExcludedRelativePaths.length > 0 ? <ul>{preview.effectiveExcludedRelativePaths.map((path) => <li className="discovery-name" key={path}>{path}</li>)}</ul> : <p>{t("discoveryNoEffects")}</p>}
        <h4>{t("discoveryInactiveExclusions")}</h4>
        <p>{t("discoveryInactiveExclusionHint")}</p>
        {preview.inactiveExcludedRelativePaths.length > 0 ? <ul>{preview.inactiveExcludedRelativePaths.map((path) => <li className="discovery-name" key={path}>{path}</li>)}</ul> : <p>{t("discoveryNoEffects")}</p>}
      </div>
      {preview.entries.length > 0 ? <ul className="discovery-entries">
        {preview.entries.filter((entry) => entry.kind === "category" || entry.categoryPath === null).map(renderEntry)}
      </ul> : preview.previewToken && <EmptyStatePanel>{t("discoveryEmptyDescription")}</EmptyStatePanel>}
    </>}
    <div className="workspace-form-actions">
      {onApply && <button type="button" className="workspace-button" disabled={disabled || pending || !preview?.previewToken} onClick={onApply}>{t("discoveryApply")}</button>}
      <button ref={retry} type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={onRetry}>{t("discoveryRefresh")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={applying} onClick={onCancel}>{t("cancelRenameWorkspace")}</button>
    </div>
  </section>;
}

export function DiscoveryController({ client, workspaceId, sourceId, minimumRevision, observationVersion, invalidation, language, disabled, onApplied, onPendingChange, onPostpone }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; minimumRevision: { current: number }; observationVersion: { current: number }; invalidation: number; language: Language; disabled: boolean; onApplied?(projects: ProjectList, observedVersion: number): void;
  onPendingChange?(pending: boolean): void; onPostpone?(): void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DiscoveryPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [applying, setApplying] = useState(false);
  useEffect(() => { onPendingChange?.(applying); }, [applying, onPendingChange]);
  useEffect(() => () => { onPendingChange?.(false); }, [onPendingChange]);
  const [applyError, setApplyError] = useState(false);
  const [stale, setStale] = useState(false);
  const [validationError, setValidationError] = useState(false);
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
    setPreview(null); setStale(true); setError(false); setApplyError(false); setValidationError(false);
  }, [invalidation]);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    if (!open && returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; }
  }, [open]);
  const request = async (draft?: string[]) => {
    const current = ++version.current;
    exclusions.current = draft;
    setPending(true);
    setError(false); setValidationError(false);
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
      } else { setPreview(null); setValidationError(!result.ok && result.error.code === "invalid_input"); setError(result.ok || result.error.code !== "invalid_input"); }
    } catch { if (current === version.current) { setPreview(null); setError(true); } }
    finally { if (current === version.current) setPending(false); }
  };
  const apply = async () => {
    if (disabled || pending || applyingRef.current || !preview?.previewToken || preview.revision < minimumRevision.current) return;
    const current = ++version.current;
    const observedVersion = observationVersion.current;
    applyingRef.current = true;
    setApplying(true); setPending(true); setApplyError(false); setValidationError(false); setStale(false);
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
      else if (result.error.code === "invalid_input") setValidationError(true);
      else setApplyError(true);
    } catch { if (current === version.current) setApplyError(true); }
    finally {
      applyingRef.current = false;
      setApplying(false);
      if (current === version.current) setPending(false);
    }
  };
  const content = <div className="source-tools">
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || open}
      onClick={() => { mode.current = undefined; setOpen(true); setApplyError(false); setValidationError(false); setStale(false); void request(); }}>{translate(language, "discoveryAction")}</button>
    {onPostpone && <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || applying}
      onClick={() => { version.current++; if (open) returnFocus.current = true; else trigger.current?.focus(); setOpen(false); setPreview(null); setPending(false); onPostpone(); }}>{translate(language, "setupLater")}</button>}
    {open && <DiscoveryPanel language={language} preview={preview && preview.revision >= minimumRevision.current ? preview : null} pending={pending} error={error} applying={applying} disabled={disabled} applyError={applyError} stale={stale} validationError={validationError} onApply={() => void apply()}
      onMode={(value) => { mode.current = value; setApplyError(false); setValidationError(false); setStale(false); void request(exclusions.current); }}
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
  </div>;
  return content;
}


export function DiscoveryWorkspace(props: Parameters<typeof DiscoveryWorkspaceContent>[0]) {
  return <ScalarDrafts><WorkspaceSessionGate language={props.language}><DiscoveryWorkspaceContent {...props}/></WorkspaceSessionGate></ScalarDrafts>;
}
function DiscoveryWorkspaceContent({ memory, client, workspaceId, sourceId, refreshVersion = 0, onSourceState, onRecoveryPending, language, disabled, sourcePath, sourceStatus, onRefreshSource }: {
  onRefreshSource?(): void;
  memory?: NavigationMemory; sourceStatus?: ReactNode; sourcePath?: string; client: WorkspaceServiceClient; workspaceId: string; sourceId: string; refreshVersion?: number;
  onSourceState?(workspaceId: string, state: ProjectList["state"]): void; language: Language; disabled: boolean;
  onRecoveryPending?(pending: boolean): void;
}) {
  const settingsNavigation = useSettingsNavigation();
  const [view, setView] = useState<WorkspaceView | null>(null);
  const [preparedView, setPreparedView] = useState<PreparedView | undefined>();
  const preparedStop = useRef<(() => void) | null>(null);
  const preparingStops = useRef(new Set<() => void>());
  const preparationGeneration = useRef(0);
  useEffect(() => {
    preparationGeneration.current++;
    return () => {
      preparationGeneration.current++;
      preparedStop.current?.(); preparedStop.current = null;
      for (const stop of preparingStops.current) stop();
      preparingStops.current.clear();
    };
  }, [client, workspaceId]);
  const [viewTransitioning, setViewTransitioning] = useState(false);
  const displayedPrepared = useRef<PreparedView | undefined>(undefined);
  const navigation = useProjectNavigation(view?.viewId,memory);
  const labels = navigationLabels[language];
  const session = useWorkspaceSession();
  const [localProjectWidth, setLocalProjectWidth] = useState(memory?.width ?? 360);
  const projectWidth = session?.state?.projectWidth ?? localProjectWidth;
  const setProjectWidth = (width: number) => { setLocalProjectWidth(width); session?.update({ projectWidth: width }); };
  const workBody=useRef<HTMLDivElement>(null);
  const [maximumProjectWidth,setMaximumProjectWidth]=useState(600);
  useLayoutEffect(()=>{
    const element=workBody.current;if(!element)return;
    const resize=()=>{if(element.clientWidth>0)setMaximumProjectWidth(Math.max(280,Math.min(600,element.clientWidth-285)));};
    resize();const observer=typeof ResizeObserver === "undefined"?null:new ResizeObserver(resize);observer?.observe(element);return ()=>observer?.disconnect();
  },[]);
  const effectiveProjectWidth=Math.min(projectWidth,maximumProjectWidth);
  useEffect(()=>{if(memory)memory.width=projectWidth;},[memory,projectWidth]);
  const scrolls = useRef(memory?.scrolls ?? new Map());
  const scroll = useViewScroll(view?.viewId,!!navigation.expanded,scrolls.current);
  const saveScroll = scroll.save;
  const [showArchived, setShowArchived] = useState(false);
  const [archiveSnapshot,setArchiveSnapshot]=useState<ArchiveSnapshot|null>(null);
  const [archiveHasProjects,setArchiveHasProjects]=useState(false);
  if (preparedView?.valid && preparedView.viewId === view?.viewId && preparedView.archived === showArchived) displayedPrepared.current = preparedView;
  const visiblePrepared = preparedView?.valid && preparedView.viewId === view?.viewId && preparedView.archived === showArchived ? preparedView :
    viewTransitioning && displayedPrepared.current?.viewId === view?.viewId && displayedPrepared.current?.archived === showArchived ? displayedPrepared.current : undefined;
  const [setupDeferred, setSetupDeferred] = useState(false);
  const [sourceToolsOpen, setSourceToolsOpen] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<"name" | "category" | null>(null);
  useEffect(() => {
    if (!sourceToolsOpen || !assignmentHistory) return;
    const history = workBody.current?.querySelector<HTMLDetailsElement>(`details[data-assignment-history="${assignmentHistory}"]`);
    if (history) { history.open = true; history.querySelector("summary")?.focus({preventScroll:true}); }
    setAssignmentHistory(null);
  }, [sourceToolsOpen, assignmentHistory]);
  const [archiveBlocked, setArchiveBlocked] = useState(false);
  const [archiveRequest, setArchiveRequest] = useState<ArchiveRequest | null>(null);
  const [projects, setProjects] = useState<ProjectList | null>(null);
  const committedProjects = useRef<ProjectList | null>(null);
  const committedCategoryLabel = useRef<{ property: NonNullable<ProjectList["categoryProperty"]>; revision: number } | null>(null);
  const [recoveryProject, setRecoveryProject] = useState<ProjectAssociationSummary | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [recoveryUncertain, setRecoveryUncertain] = useState(false);
  const recoveryOrigin = useRef<string | null>(null);
  const recoverySaving = useRef(false);
  const [renameProject, setRenameProject] = useState<Pick<ProjectAssociationSummary, "projectId" | "name" | "relativePath" | "categoryId"> | null>(null);
  const [categoryMoveProject, setCategoryMoveProject] = useState<Pick<ProjectAssociationSummary, "projectId" | "name" | "relativePath" | "categoryId"> | null>(null);
  const [statusOnly, setStatusOnly] = useState(false);
  const [categoryMoveBlocked, setCategoryMoveBlocked] = useState(false);
  const [categoryOptionsBlocked, setCategoryOptionsBlocked] = useState(false);
  const [showHiddenCategories, setShowHiddenCategories] = useState(false);
  const [creationBlocked, setCreationBlocked] = useState(false);
  const [discoveryPending, setDiscoveryPending] = useState(false);
  const categoryMoveTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreCategoryMoveFocus = useRef(false);
  const [renameBlocked, setRenameBlocked] = useState(false);
  const renameTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreRenameFocus = useRef(false);
  const recoveryTrigger = useRef<HTMLButtonElement | null>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);
  const restoreRecoveryFocus = useRef(false);
  useEffect(() => {
    if (!recoveryProject && restoreRecoveryFocus.current) {
      const trigger = recoveryTrigger.current;
      (trigger?.isConnected && !trigger.disabled && !trigger.closest("[hidden]") ? trigger : workBody.current?.querySelector<HTMLElement>(".project-area-header button:not(:disabled)") ?? tableHeading.current)?.focus();
      restoreRecoveryFocus.current = false;
    }
  }, [recoveryProject]);
  useEffect(() => {
    if (!renameProject && restoreRenameFocus.current) {
      const trigger = renameTrigger.current;
      (trigger?.isConnected && !trigger.disabled ? trigger : tableHeading.current)?.focus();
      restoreRenameFocus.current = false;
    }
  }, [renameProject, renameBlocked]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (categoryMoveProject || !restoreCategoryMoveFocus.current) return;
    const trigger = categoryMoveTrigger.current;
    if (!statusOnly) {
      (trigger?.isConnected && !trigger.disabled ? trigger : tableHeading.current)?.focus();
      restoreCategoryMoveFocus.current = false;
      return;
    }
    // Source observation can replace/disable the originating status cell while
    // the dialog closes. Retain its project identity until the current row is ready.
    if (loading) return;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active !== trigger && active !== tableHeading.current) {
        restoreCategoryMoveFocus.current = false;
        return;
      }
      const id = trigger?.dataset.statusProjectId;
      const current = trigger?.isConnected && !trigger.disabled ? trigger :
        [...(workBody.current?.querySelectorAll<HTMLButtonElement>("button[data-status-project-id]") ?? [])]
          .find(button => button.dataset.statusProjectId === id && !button.disabled && !button.closest("[hidden], [inert]"));
      const target = current ?? tableHeading.current;
      target?.focus();
      if (target instanceof HTMLButtonElement) target.addEventListener("focusout", () => {
        // A later source refresh may temporarily disable the restored control.
        // Keep its return intent only when that disable drops focus to the body.
        if (target.disabled && document.activeElement === document.body) restoreCategoryMoveFocus.current = true;
      }, { once: true });
      restoreCategoryMoveFocus.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categoryMoveProject, categoryMoveBlocked, statusOnly, loading, projects]);

  const version = useRef(0);
  const minimumRevision = useRef(0);
  const minimumCategoryPropertyRevision = useRef(0);
  const minimumObservationRevision = useRef(0);
  const observationVersion = useRef(0);
  const sourceLifetime = useRef(0);
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
    committedCategoryLabel.current = { property: { propertyId: value.propertyId, sourceId, name: value.name }, revision: value.revision };
    const updated = { ...current, categoryProperty: { propertyId: value.propertyId, sourceId, name: value.name }, categoryPropertyRevision: value.revision };
    committedProjects.current = updated; setProjects(updated);
  };
  const load = async () => {
    const current = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await client.listProjects(workspaceId, { observed: true });
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
            sourceLifetime.current++;
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
          minimumCategoryPropertyRevision.current = value.categoryPropertyRevision;
          if (value.categoryProperty) committedCategoryLabel.current = { property: value.categoryProperty, revision: value.categoryPropertyRevision };
        }
        updated.categoryPropertyRevision = Math.max(value.categoryPropertyRevision, currentProjects?.categoryPropertyRevision ?? 0);
        const label = committedCategoryLabel.current;
        if (updated.mode === "grouped" && updated.categoryProperty && label?.property.propertyId === updated.categoryProperty.propertyId && label.revision >= updated.categoryPropertyRevision) {
          updated.categoryProperty = label.property;
        }
        if (discoveryCurrent && value.revision > minimumRevision.current) {
          minimumRevision.current = value.revision;
          setInvalidation((value) => value + 1);
        }
        if (updated.mode !== "grouped") updated.categoryProperty = null;
        committedProjects.current = updated; setProjects(updated);
        setError(updated.revision < minimumRevision.current);
      } else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (event.type === "workspace.categoryPresentationChanged") {
        if (event.sourceId === sourceId && event.workspaceIds.includes(workspaceId)) void load();
        return;
      }
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
        if (event.type === "workspace.sourceChanged" || !["ready", "empty"].includes(event.state)) sourceLifetime.current++;
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
  const sourceAvailable = !!projects && ["ready", "empty"].includes(projects.state);
  const selectedId = navigation.expanded ?? navigation.preview;
  useEffect(() => {
    if (!recoveryProject || recoveryOrigin.current === selectedId && settingsNavigation?.workspaceVisible !== false) return;
    if (recoverySaving.current) setRecoveryUncertain(true);
    restoreRecoveryFocus.current = false;
    setRecoveryProject(null);
  }, [selectedId, recoveryProject, settingsNavigation?.workspaceVisible]);
  const locate = (project: ProjectAssociationSummary, trigger: HTMLButtonElement) => {
    recoveryOrigin.current = selectedId;
    recoveryTrigger.current = trigger;
    setRecoverySaved(false); setRecoveryUncertain(false); setRecoveryProject(project);
  };
  const closeRecovery = () => {
    restoreRecoveryFocus.current = true; setRecoveryProject(null);
  };
  const selectedProject = [...(projects?.projects ?? []), ...(projects?.retainedProjects ?? []),...(archiveSnapshot?.projects ?? [])].find(project=>project.projectId===selectedId);
  const selectedRetained = projects?.retainedProjects.find(project => project.projectId === selectedId);
  const selectedAvailability = selectedRetained ? retainedProjectAvailability(selectedRetained, sourceAvailable) : null;
  const knownNames = useRef(memory?.names ?? new Map<string,string>());
  for(const project of [...(projects?.projects ?? []),...(projects?.retainedProjects ?? []),...(archiveSnapshot?.projects ?? [])]) knownNames.current.set(project.projectId,project.name);
  const projectName = (id:string)=>knownNames.current.get(id) ?? id;
  return <DailyControlsSurface><ManagementSurface><div className={`daily-workspace project-navigation${navigation.expanded ? " project-navigation--expanded" : ""}`}>

    {sourceStatus}
    {recoveryUncertain && <StatusMessage kind="error" title={t("recoveryUncertain")} />}
    <ViewsPanel onWillLoad={scroll.suspend} onTransitionChange={setViewTransitioning} onPrepareView={async target => {
      const source = committedProjects.current;
      if (!source?.configured || (showArchived && !archiveSnapshot?.projects.length)) { preparedStop.current?.(); preparedStop.current = null; setPreparedView(undefined); return true; }
      const generation = preparationGeneration.current;
      let invalidated = false, accepted = false, stopped = false;
      let data: PreparedView | undefined;
      const unsubscribe = client.onWorkspaceChange(event => {
        if (event.type === "workspace.sourceObserved" && ["ready", "empty"].includes(event.state)) return;
        if (event.type === "workspace.sourceChanged" && event.source.sourceId !== sourceId) return;
        if (event.type !== "workspace.listChanged" && event.type !== "workspace.sourceChanged" && event.sourceId !== sourceId) return;
        invalidated = true;
        if (data) { data.valid = false; setPreparedView(current => current === data ? undefined : current); }
      });
      const stop = () => { if (!stopped) { stopped = true; unsubscribe(); } };
      preparingStops.current.add(stop);
      const archived = showArchived;
      const projection = !archived && source.revision > 0 ? { revision: source.revision, projectIds: [...new Set([...source.projects, ...source.retainedProjects].map(project => project.projectId))] } : undefined;
      try {
        const [filter, result, layout] = await Promise.all([
          client.getViewFilter(workspaceId, target.viewId), client.queryView(workspaceId, target.viewId, archived, projection),
          target.kind === "board" ? client.getBoardLayout(workspaceId, target.viewId) : client.getTableLayout(workspaceId, target.viewId),
        ]);
        if (generation !== preparationGeneration.current || invalidated || committedProjects.current !== source || !filter.ok || !result.ok || !layout.ok ||
            filter.value.workspaceId !== workspaceId || filter.value.viewId !== target.viewId ||
            result.value.workspaceId !== workspaceId || result.value.viewId !== target.viewId || result.value.archived !== archived ||
            layout.value.workspaceId !== workspaceId || layout.value.viewId !== target.viewId) return false;
        data = { valid: true, workspaceId, viewId: target.viewId, archived, filter: filter.value.config, result: result.value,
          layout: target.kind === "board" ? { kind: "board", config: layout.value.config as import("../../contracts/board-layout.js").BoardLayoutConfig } : { kind: "table", config: layout.value.config as import("../../contracts/table-layout.js").TableLayoutConfig } };
        preparedStop.current?.(); preparedStop.current = stop; accepted = true;
        setPreparedView(data); return true;
      } catch { return false; } finally { preparingStops.current.delete(stop); if (!accepted) stop(); }
    }} projectActive={!!navigation.expanded} onSelectView={()=>{saveScroll();navigation.selectView();}}
      projectTabs={<ProjectTabs session={navigation} language={language} name={projectName} disabled={disabled || viewTransitioning}/>}
      tools={<><DailyControlsTarget hidden={!!navigation.expanded} inert={viewTransitioning}/>{projects?.configured && <ViewToolsTarget label={t("viewSettings")} hidden={showArchived && !archiveHasProjects} />}</>} panelId={`${showArchived ? "archived" : "active"}-view-panel-${workspaceId}`} client={client} workspaceId={workspaceId} language={language} onChange={next=>{setView(next);scroll.resume();}}
      disabled={disabled || categoryOptionsBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameProject !== null || renameBlocked || categoryMoveProject !== null || categoryMoveBlocked || archiveBlocked} />
    <ProjectRenamePanel onReviewProject={setRenameProject} client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} project={renameProject}
      projects={projects} disabled={disabled || archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || recoveryProject !== null || categoryMoveProject !== null || categoryMoveBlocked} minimumRevision={minimumRevision}
      observationVersion={observationVersion} sourceLifetime={sourceLifetime} invalidation={invalidation} onBlockedChange={setRenameBlocked}
      onRestoreFocus={() => tableHeading.current?.focus()}
      onClose={(focus = true) => { restoreRenameFocus.current = focus; setRenameProject(null); }} onCompleted={() => void load()} />
    <div className="project-work-body" ref={workBody}>
    <div className="saved-view-content" ref={scroll.element} onScrollCapture={saveScroll} onWheelCapture={scroll.cancelRestore} onPointerDownCapture={scroll.cancelRestore} onKeyDownCapture={scroll.cancelRestore} hidden={!!navigation.expanded}>
    <ContextTools label={t("sourceTools")} icon="settings" compact daily open={sourceToolsOpen} onOpenChange={setSourceToolsOpen}>
    {sourcePath && <p className="workspace-root">{sourcePath}</p>}
    <DiscoveryController onPostpone={projects && !projects.configured && !setupDeferred ? () => setSetupDeferred(true) : undefined} client={client} workspaceId={workspaceId} sourceId={sourceId} minimumRevision={minimumRevision}
      observationVersion={observationVersion}
      invalidation={invalidation} language={language} onPendingChange={setDiscoveryPending} disabled={disabled || archiveBlocked || categoryOptionsBlocked || creationBlocked || recoveryProject !== null || renameProject !== null || renameBlocked || categoryMoveProject !== null || categoryMoveBlocked}
      onApplied={(value, observedVersion) => {
        // The command can succeed while a newer runtime observation changes
        // resolution without a persisted revision. Keep success, reload placement.
        if (value.revision < minimumRevision.current || observedVersion !== observationVersion.current) { void load(); return; }
        version.current++; minimumRevision.current = value.revision;
        if (value.categoryPropertyRevision >= minimumCategoryPropertyRevision.current) {
          minimumCategoryPropertyRevision.current = value.categoryPropertyRevision;
          if (value.categoryProperty) committedCategoryLabel.current = { property: value.categoryProperty, revision: value.categoryPropertyRevision };
          committedProjects.current = value; setProjects(value);
        } else { void load(); return; }
        setError(false); setLoading(false);
      }} />
    {projects?.mode === "grouped" && <CategoryOptionsPanel key={workspaceId} client={client} workspaceId={workspaceId} sourceId={sourceId}
      categories={projects.categories} language={language} revision={projects.revision} invalidation={invalidation}
      disabled={disabled || archiveBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameProject !== null || renameBlocked || categoryMoveProject !== null || categoryMoveBlocked}
      onBlockedChange={setCategoryOptionsBlocked} onCommitted={() => void load()} />}
    <ManagementTarget />
    </ContextTools>
    <ProjectCreationPanel client={client} workspaceId={workspaceId} sourceId={sourceId} language={language}
      projects={projects} onBlockedChange={setCreationBlocked} disabled={disabled || archiveBlocked || categoryOptionsBlocked || discoveryPending || loading || error || recoveryProject !== null || renameProject !== null || renameBlocked}
      effectsBlocked={categoryMoveProject !== null || categoryMoveBlocked} invalidation={invalidation}
      minimumRevision={minimumRevision} observationVersion={observationVersion} onCompleted={() => void load()} />
    <div className="operation-panels">
    <ProjectCategoryMovePanel statusOnly={statusOnly} client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} project={categoryMoveProject}
      projects={projects} disabled={disabled || archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || recoveryProject !== null || renameProject !== null || renameBlocked}
      minimumRevision={minimumRevision} observationVersion={observationVersion} sourceLifetime={sourceLifetime} invalidation={invalidation}
      onRestoreFocus={() => tableHeading.current?.focus()} onBlockedChange={setCategoryMoveBlocked} onCompleted={() => void load()}
      onClose={(focus = true) => { restoreCategoryMoveFocus.current = focus; setCategoryMoveProject(null); }} />
    </div>
    {recoveryProject && <ProjectOperationDialog open labelledBy="recovery-title" title={t("recoveryTitle")} onClose={() => { if (!recoverySaving.current) closeRecovery(); }}>
    <ProjectRecoveryController client={client} workspaceId={workspaceId} sourceId={sourceId}
      project={recoveryProject} minimumRevision={minimumRevision} observationVersion={observationVersion} sourceLifetime={sourceLifetime} invalidation={invalidation} observation={observation} language={language} disabled={disabled}
      onPendingChange={pending => { recoverySaving.current = pending; onRecoveryPending?.(pending); }}
      onReload={() => void load()} onClose={closeRecovery}
      onCommitted={(value, observedVersion) => {
        setRecoverySaved(true);
        // Live observations advance synchronously, before recovery's effects.
        // Keep confirmed success while reloading any newer placement/resolution.
        if (value.revision < minimumRevision.current || observedVersion !== observationVersion.current) { void load(); return; }
        version.current++; minimumRevision.current = value.revision;
        const current = committedProjects.current;
        const updated = value.categoryPropertyRevision >= minimumCategoryPropertyRevision.current || !current ? value
          : { ...value, categoryProperty: value.mode === "grouped" && value.categoryProperty?.propertyId === current.categoryProperty?.propertyId ? current.categoryProperty : value.categoryProperty, categoryPropertyRevision: current.categoryPropertyRevision };
        if (updated.mode !== "grouped") updated.categoryProperty = null;
        committedProjects.current = updated; setProjects(updated); setLoading(false); setError(false);
        if (updated.categoryPropertyRevision < minimumCategoryPropertyRevision.current) void load();
      }} /></ProjectOperationDialog>}
    {recoverySaved && <StatusMessage kind="info" title={t("recoverySaved")} />}
    <ProjectArchivePanel transitionPending={viewTransitioning} request={archiveRequest} onRequestClosed={() => setArchiveRequest(null)}
      onRestoreFocus={() => workBody.current?.querySelector<HTMLElement>(".project-area-header button:not(:disabled)")?.focus()}
      onPreview={(id,trigger)=>navigation.show(id,trigger)} onSnapshot={setArchiveSnapshot} categoryProperty={projects?.categoryProperty} categories={projects?.categories} prepared={visiblePrepared} viewId={view?.viewId} layout={view?.kind} client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects?.projects ?? []}
      language={language} revision={projects?.revision ?? 0} invalidation={invalidation} onViewChange={setShowArchived} onProjectAvailability={setArchiveHasProjects}
      onBlockedChange={setArchiveBlocked} onCommitted={() => void load()}
      disabled={disabled || viewTransitioning || categoryOptionsBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameProject !== null || renameBlocked || categoryMoveProject !== null || categoryMoveBlocked} />
    <ViewControlsScope visible={!showArchived}><section id={`active-view-panel-${workspaceId}`} role="tabpanel" hidden={showArchived} className="table-view" aria-labelledby={view ? `saved-view-${view.viewId}` : "table-title"} aria-busy={loading || viewTransitioning}>
      <div className="table-view__heading sr-only"><div>
        <h3 id="table-title" ref={tableHeading} tabIndex={-1}>{view?.name ?? t("tableViewTitle")}</h3>
        <p>{t(projects?.configured ? "projectsApplied" : "emptyTableDescription")}</p>
      </div><span className="view-badge">{t(view?.kind === "board" ? "boardViewLabel" : "tableViewLabel")}</span></div>
      {loading && <StatusMessage kind="info" title={t("projectsLoading")} />}
      {error && <><StatusMessage kind="error" title={t("projectsError")} />
        <button type="button" className="workspace-button workspace-button--secondary" disabled={loading} onClick={() => void load()}>{t("projectsRetry")}</button></>}
      {!loading && !error && projects && <>
        {!onSourceState && projects.state !== "ready" && projects.state !== "empty" && <StatusMessage kind="error" title={t(stateLabels[projects.state])} />}
        {projects.retainedCount > 0 && <StatusMessage kind="info" title={t("projectsRetained")} />}
        {!projects.configured ? <EmptyStatePanel><p>{t(setupDeferred ? "setupDeferred" : "setupOffer")}</p>
          <button type="button" className="workspace-button" disabled={disabled} onClick={() => setSourceToolsOpen(true)}>{t("setupSource")}</button></EmptyStatePanel>
          : projects.projects.length === 0 && projects.retainedProjects.length === 0 && <EmptyStatePanel>{t("projectsEmpty")}</EmptyStatePanel>}
      </>}
      {projects?.mode === "grouped" && <details className="saved-categories"><summary>{t("savedCategories")}</summary>
        <p>{t("discoveryGroupedMode")}</p>
        <p>{t("savedCategories")}</p>
        {projects.categories.some(c => c.presentation?.hidden) && <label><input type="checkbox" checked={showHiddenCategories} onChange={e => setShowHiddenCategories(e.currentTarget.checked)} />{t("categoryShowHidden")}</label>}
        {projects.categories.length > 0 ? <ul>{projects.categories.filter(c => showHiddenCategories || !c.presentation?.hidden).map((category) => <li key={category.categoryId}><span className="category-chip" data-color={category.presentation?.color ?? "default"}>{category.name}</span></li>)}</ul>
          : <p>{t("savedCategoriesEmpty")}</p>}
      </details>}
      {view && projects?.configured && <TextPropertiesTable prepared={visiblePrepared} transitionPending={viewTransitioning} sourceAvailable={sourceAvailable} onPreview={(id,trigger)=>navigation.show(id,trigger)} viewId={view.viewId} layout={view.kind} sourceLifetime={sourceLifetime} discoveryRevision={projects?.revision ?? 0} minimumDiscoveryRevision={minimumRevision} categoryPropertyRevision={projects?.categoryPropertyRevision ?? 0} minimumCategoryPropertyRevision={minimumCategoryPropertyRevision}
        onFilesystemAssignmentDetails={kind => { setAssignmentHistory(kind); setSourceToolsOpen(true); }}
        onFilesystemAssignmentObserved={() => { setInvalidation(value => value + 1); void load(); }}
        onCategoryPropertyCommitted={commitLabel} categoryProperty={projects?.categoryProperty ?? null} categories={projects?.categories ?? []} client={client} workspaceId={workspaceId} sourceId={sourceId}
        renameDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || renameBlocked || renameProject !== null || recoveryProject !== null || categoryMoveProject !== null || categoryMoveBlocked || !projects?.configured ||
          !["ready", "empty"].includes(projects?.state ?? "") || (projects?.revision ?? -1) < minimumRevision.current}
        categoryMoveDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || categoryMoveBlocked || categoryMoveProject !== null || renameBlocked || renameProject !== null || recoveryProject !== null || !projects?.configured ||
          !["ready", "empty"].includes(projects?.state ?? "") || (projects?.revision ?? -1) < minimumRevision.current}
        onMoveCategory={projects?.mode === "grouped" ? (project, trigger, status = false) => { setStatusOnly(status); categoryMoveTrigger.current = trigger; setCategoryMoveProject(project); } : undefined}
        onArchive={(project, action, trigger) => setArchiveRequest({project, action, trigger})} archiveDisabled={!archiveSnapshot || archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || renameBlocked || renameProject !== null || categoryMoveBlocked || categoryMoveProject !== null || recoveryProject !== null || !sourceAvailable}
        onRename={(project, trigger) => { renameTrigger.current = trigger; setRenameProject(project); }}
        locateDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameBlocked || renameProject !== null || categoryMoveProject !== null || categoryMoveBlocked}
        onLocate={projects?.configured ? locate : undefined}
        projects={projects?.projects ?? []} retainedProjects={projects?.retainedProjects ?? []} language={language} disabled={disabled || viewTransitioning} />}
    </section></ViewControlsScope>
    </div>
    {selectedId && <div className={navigation.expanded ? "project-host project-host--expanded" : "project-host project-host--overlay"} inert={viewTransitioning} style={navigation.expanded ? undefined : {width: effectiveProjectWidth + 5}}>
      {!navigation.expanded && <AreaResize label={labels.projectWidth} value={effectiveProjectWidth} min={280} max={maximumProjectWidth} reverse onChange={setProjectWidth}/>}
      <section className="project-area" role="region" aria-label={`${labels.project}: ${projectName(selectedId)}`}>
        <header className="project-area-header"><h2 title={projectName(selectedId)}>{projectName(selectedId)}</h2>
          <div className="project-area-actions">
            <Hint label={navigation.expanded ? labels.returnRight : labels.expand}><button type="button" className="workspace-button workspace-button--secondary icon-button" disabled={disabled} aria-label={navigation.expanded ? labels.returnRight : labels.expand}
              onClick={()=>{saveScroll();if(navigation.expanded){navigation.close([selectedId],true);}else navigation.expand(selectedId);}}><Icon name={navigation.expanded ? "returnRight":"expand"}/></button></Hint>
            <Hint label={navigation.expanded ? labels.close : labels.closePreview}><button type="button" className="workspace-button workspace-button--secondary icon-button" disabled={disabled} aria-label={navigation.expanded ? labels.close : labels.closePreview}
              onClick={()=>{if(navigation.expanded){navigation.close([selectedId]);}else navigation.closePreview();}}><Icon name="close"/></button></Hint>
          </div>
        </header>
        <div className="project-area-scroll">
          {selectedProject && <p className="project-area-path">{selectedProject.relativePath}</p>}
          {loading && <StatusMessage kind="info" title={t("projectsLoading")} />}
          {error && <StatusMessage kind="error" title={t("projectsError")} />}
          {projects && !sourceAvailable && <StatusMessage kind="info" title={t(stateLabels[projects.state])} />}
          {selectedProject && "originalRelativePath" in selectedProject && <StatusMessage kind="info" title={t("archiveArchived")} />}
          {selectedAvailability?.label && <StatusMessage kind="info" title={t(selectedAvailability.label)} />}
          {selectedAvailability?.excluded && <StatusMessage kind="info" title={t("projectExcluded")} />}
          {(!sourceAvailable || selectedAvailability || error || selectedProject && "originalRelativePath" in selectedProject || !selectedProject) && <div className="workspace-form-actions project-status-actions">
          {selectedRetained && selectedAvailability?.canLocate && <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || error || archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameBlocked || renameProject !== null || categoryMoveProject !== null || categoryMoveBlocked}
            aria-label={`${t("recoveryLocate")}: ${selectedRetained.name}`} onClick={event => locate(selectedRetained, event.currentTarget)}>{t("recoveryLocate")}</button>}
            <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || recoveryProject !== null} onClick={() => { if (onRefreshSource) onRefreshSource(); else void load(); }}>{t(loading ? "refreshingSource" : "refreshSourceAction")}</button>
            {settingsNavigation && <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || recoveryProject !== null} onClick={() => settingsNavigation.open("sources")}>{t("recoverySourceSettings")}</button>}
          </div>}
          {selectedProject ? <>
            <TextPropertiesTable sourceAvailable={sourceAvailable} key={selectedId} detail hideReveal={"originalRelativePath" in selectedProject} client={client} workspaceId={workspaceId} sourceId={sourceId} projects={[selectedProject]}
              retainedProjects={projects?.retainedProjects.filter(project=>project.projectId===selectedId)} categories={projects?.categories} categoryProperty={projects?.categoryProperty}
              language={language} disabled={disabled || loading || error}
              locateDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || recoveryProject !== null || renameBlocked || renameProject !== null || categoryMoveProject !== null || categoryMoveBlocked}
              discoveryRevision={projects?.revision} minimumDiscoveryRevision={minimumRevision} sourceLifetime={sourceLifetime}
              renameDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || renameBlocked || renameProject !== null || recoveryProject !== null || categoryMoveProject !== null || categoryMoveBlocked || !projects?.configured || !sourceAvailable}
              onArchive={(project, action, trigger) => setArchiveRequest({project, action, trigger})} archiveDisabled={!archiveSnapshot || archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || renameBlocked || renameProject !== null || categoryMoveBlocked || categoryMoveProject !== null || recoveryProject !== null || !sourceAvailable}
              categoryMoveDisabled={archiveBlocked || categoryOptionsBlocked || creationBlocked || discoveryPending || loading || error || categoryMoveBlocked || categoryMoveProject !== null || renameBlocked || renameProject !== null || recoveryProject !== null || !projects?.configured || !["ready", "empty"].includes(projects?.state ?? "") || (projects?.revision ?? -1) < minimumRevision.current}
              onMoveCategory={projects?.mode === "grouped" ? (project, trigger, status = false) => { setStatusOnly(status); categoryMoveTrigger.current = trigger; setCategoryMoveProject(project); } : undefined}
              onRename={(project, trigger) => { renameTrigger.current = trigger; setRenameProject(project); }}/>
            <ProjectFiles key={`${workspaceId}:${selectedId}:${selectedProject.relativePath}:${sourceLifetime.current}:${invalidation}:${observationVersion}`}
              client={client} workspaceId={workspaceId} projectId={selectedId} language={language} disabled={disabled || loading || error || !sourceAvailable || "originalRelativePath" in selectedProject || "resolution" in selectedProject && (selectedProject.resolution !== "active" || selectedProject.retentionReason === "mode_change")}/></> : <StatusMessage kind="info" title={labels.unavailable}/>}
        </div>
      </section>
    </div>}
    </div>
  </div></ManagementSurface></DailyControlsSurface>;
}
