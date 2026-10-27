import type { PreparedView } from "./prepared-view.js";
import { ContextTools } from "./ContextTools.js";
import { DailyControl } from "./DailyControls.js";
import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { CategoryProperty, CategorySummary, ProjectSummary } from "../../contracts/workspaces.js";
import type { ArchiveSnapshot, ArchiveLocationPreview, ProjectArchivePreview, ProjectArchiveOperation, ProjectArchiveRecoveryPreview } from "../../contracts/project-archive.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { useDraftGuard } from "./ScalarDrafts.js";
import { ProjectOperationDialog } from "./ProjectOperationDialog.js";
export interface ArchiveRequest { project: ProjectSummary; action: "archive" | "restore"; trigger: HTMLButtonElement }
interface Props {
  request?: ArchiveRequest | null;
  onRequestClosed?(): void;
  onRestoreFocus?(): void;
  onPreview?(projectId:string,trigger:HTMLElement):void;
  onSnapshot?(snapshot:ArchiveSnapshot|null):void;
  locationOnly?: boolean;
  prepared?: PreparedView;
  transitionPending?: boolean;
  viewId?: string;
  categoryProperty?: CategoryProperty | null; categories?: CategorySummary[];
  layout?: "table" | "board";
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; projects: ProjectSummary[];
  language: Language; disabled: boolean; revision: number; invalidation: number;
  onCommitted(): void; onViewChange(archived: boolean): void; onBlockedChange?(blocked: boolean): void; onProjectAvailability?(available:boolean):void;
}
const problemKeys: Record<string, TranslationKey> = {
  occupied: "archiveProblemOccupied", case_alias: "archiveProblemOccupied", reserved_destination: "archiveProblemOccupied",
  missing_parent: "archiveProblemMissingParent", incompatible_mode: "archiveProblemMode", archive_not_empty: "archiveProblemNotEmpty",
  busy: "archiveProblemBusy", owned_location: "archiveProblemOwned",
};
export function ProjectArchivePanel(props: Props) { return <ArchiveContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />; }
function ArchiveContent({ request, onRequestClosed, onRestoreFocus, onPreview, onSnapshot, locationOnly = false, prepared, transitionPending = false, viewId, categoryProperty, categories, layout = "table", client, workspaceId, sourceId, projects, language, disabled, revision, invalidation, onCommitted, onViewChange, onBlockedChange, onProjectAvailability }: Props) {
  const projectSelectId = useId();
  const draftGuard = useDraftGuard();
  const dialogRoot = useRef<HTMLDivElement>(null);
  const t = (key: TranslationKey) => translate(language, key);
  const [archived, setArchived] = useState(false), [snapshot, setSnapshot] = useState<ArchiveSnapshot | null>(null);
  const [contextual, setContextual] = useState<ArchiveRequest | null>(null);
  const action = contextual?.action ?? (archived ? "restore" : "archive");
  const restoring = action === "restore";
  useEffect(()=>{onSnapshot?.(snapshot);},[snapshot,onSnapshot]);
  useEffect(()=>{onProjectAvailability?.(!!snapshot?.projects.length);},[snapshot,onProjectAvailability]);
  const [operations, setOperations] = useState<ProjectArchiveOperation[]>([]);
  const [locationEditor, setLocationEditor] = useState(false);
  const [location, setLocation] = useState("Archive"), [projectId, setProjectId] = useState("");
  const [name, setName] = useState(""), [createParent, setCreateParent] = useState(false);
  const [locationReview, setLocationReview] = useState<ArchiveLocationPreview | null>(null);
  const [review, setReview] = useState<ProjectArchivePreview | null>(null), [recovery, setRecovery] = useState<ProjectArchiveRecoveryPreview | null>(null);
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  type SavedRequest = { workspaceId: string; operationId: string; previewToken: string; projectId: string; action: "archive" | "restore"; originalRelativePath: string; requestedRelativePath: string; initial?: boolean };
  const [unknown, setUnknown] = useState<SavedRequest | null>(null);
  const alive = useRef(true), busy = useRef(false), epoch = useRef(0), listVersion = useRef(0), minimumRevision = useRef(revision);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), section = useRef<HTMLElement>(null);
  const blocked = pending || unknown !== null;
  useEffect(() => { onBlockedChange?.(blocked || contextual !== null); return () => onBlockedChange?.(false); }, [blocked, contextual, onBlockedChange]);
  useEffect(() => {
    if (!request || busy.current || unknown) return;
    epoch.current++; setContextual(request); setProjectId(request.project.projectId); setName(""); setCreateParent(false);
    setReview(null); setLocationReview(null); setLocation(snapshot?.relativePath ?? ""); setRecovery(null); setMessage(null); returnFocus.current = request.trigger;
  }, [request]);
  const load = async () => {
    const version = ++listVersion.current; setLoading(true); setError(false);
    try {
      const [state, outstanding] = await Promise.all([client.listArchivedProjects(workspaceId), client.listProjectArchiveOperations(workspaceId)]);
      if (!alive.current || version !== listVersion.current) return;
      if (!state.ok || !outstanding.ok || state.value.workspaceId !== workspaceId || state.value.sourceId !== sourceId || state.value.revision < minimumRevision.current || outstanding.value.sourceId !== sourceId || outstanding.value.workspaceId !== workspaceId) { setError(true); return; }
      minimumRevision.current = state.value.revision; setSnapshot(state.value); setOperations(outstanding.value.operations);
    } catch { if (alive.current && version === listVersion.current) setError(true); }
    finally { if (alive.current && version === listVersion.current) setLoading(false); }
  };
  useEffect(() => {
    alive.current = true;
    const unsubscribe = client.onWorkspaceChange(event => {
      if (!("sourceId" in event) || event.sourceId !== sourceId || !event.workspaceIds.includes(workspaceId)) return;
      if (event.type === "workspace.projectsChanged" || event.type === "workspace.sourceObserved") {
        epoch.current++; setReview(null); setLocationReview(null); setRecovery(null);
        if (event.type === "workspace.projectsChanged") minimumRevision.current = Math.max(minimumRevision.current, event.revision);
        void load();
      }
    });
    void load();
    return () => { alive.current = false; epoch.current++; listVersion.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  useEffect(() => {
    minimumRevision.current = Math.max(minimumRevision.current, revision);
    epoch.current++; setReview(null); setLocationReview(null); setRecovery(null); void load();
  }, [revision, invalidation]);
  const cancel = () => {
    if (busy.current || unknown) return;
    epoch.current++; setReview(null); setLocationReview(null); setRecovery(null); setMessage(null);
    if (contextual) { setContextual(null); onRequestClosed?.(); }
    const target = returnFocus.current;
    // A completed archive/restore removes its origin row when the list catches
    // up. Return to a stable owner even if that row is still connected for now.
    if (message !== "archiveCompleted" && target?.isConnected && !target.disabled && !target.closest("[hidden]")) target.focus();
    else if (section.current && !section.current.closest("[hidden]")) section.current.focus();
    else if (onRestoreFocus) onRestoreFocus();
    else section.current?.focus();
  };
  const changeDraft = (fn: () => void) => { epoch.current++; fn(); setReview(null); setLocationReview(null); setRecovery(null); setMessage(null); };
  async function preview(locationOnly: boolean) {
    if (busy.current || disabled || unknown) return;
    busy.current = true; setPending(true); setError(false); setMessage(null);
    const current = ++epoch.current;
    try {
      if (locationOnly) {
        const result = await client.previewArchiveLocation(workspaceId, location);
        if (!alive.current || current !== epoch.current) return;
        if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.relativePath === location && result.value.revision >= minimumRevision.current) setLocationReview(result.value); else setError(true);
      } else {
        const result = await client.previewProjectArchive({ workspaceId, projectId, action, name: restoring && name !== "" ? name : null, createParent: restoring && createParent });
        if (!alive.current || current !== epoch.current) return;
        if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.projectId === projectId && result.value.action === action && result.value.revision >= minimumRevision.current) setReview(result.value); else setError(true);
      }
    } catch { if (alive.current && current === epoch.current) setError(true); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  function acceptOperation(operation: ProjectArchiveOperation, expected: SavedRequest) {
    if (operation.operationId !== expected.operationId || operation.sourceId !== sourceId || operation.projectId !== expected.projectId || operation.action !== expected.action || operation.originalRelativePath !== expected.originalRelativePath || operation.requestedRelativePath !== expected.requestedRelativePath) { setMessage("archiveUnknown"); return false; }
    setUnknown(null); setReview(null); setRecovery(null);
    setMessage(operation.stage === "completed" ? "archiveCompleted" : operation.stage === "failed" ? "archiveBlocked" : "archiveUnfinished");
    void load(); onCommitted();
    const owner = contextual ? dialogRoot.current : section.current;
    if (owner?.contains(document.activeElement) || document.activeElement === document.body) owner?.focus();
    return true;
  }
  async function apply(original?: SavedRequest) {
    if (busy.current || disabled || (!original && !review?.previewToken)) return;
    const request = original ?? { workspaceId, operationId: crypto.randomUUID(), previewToken: review!.previewToken!, projectId: review!.projectId, action: review!.action, originalRelativePath: review!.originalRelativePath, requestedRelativePath: review!.requestedRelativePath };
    busy.current = true; setPending(true); setUnknown({ ...request, initial: true }); setMessage(null);
    try {
      const result = await client.applyProjectArchive({ workspaceId: request.workspaceId, operationId: request.operationId, previewToken: request.previewToken });
      if (!alive.current) return;
      if (result.ok) acceptOperation(result.value.operation, request);
      else if (result.error.code === "invalid_input") { setUnknown(null); setReview(null); setError(true); } else setMessage("archiveUnknown");
    } catch { if (alive.current) setMessage("archiveUnknown"); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function confirmLocation() {
    if (busy.current || disabled || unknown || !locationReview?.previewToken) return;
    const token = locationReview.previewToken;
    busy.current = true; setPending(true);
    try {
      const result = await client.applyArchiveLocation(workspaceId, crypto.randomUUID(), token);
      if (!alive.current) return;
      setLocationReview(null);
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.relativePath === locationReview.relativePath && result.value.revision >= minimumRevision.current) { minimumRevision.current = result.value.revision; setSnapshot(result.value); onCommitted(); void load(); } else { setError(true); void load(); }
    } catch { if (alive.current) { setError(true); void load(); } }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function check() {
    if (busy.current || !unknown || disabled) return;
    const request = unknown; busy.current = true; setPending(true);
    try { const result = await client.getProjectArchiveOperation(workspaceId, request.operationId);
      if (alive.current) { if (result.ok) acceptOperation(result.value.operation, request); else setMessage("archiveUnknown"); }
    } catch { if (alive.current) setMessage("archiveUnknown"); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function reviewRecovery(operationId: string) {
    if (busy.current || disabled || unknown) return;
    busy.current = true; setPending(true); const current = ++epoch.current;
    try {
      const result = await client.previewProjectArchiveRecovery(workspaceId, operationId);
      if (alive.current && current === epoch.current) {
        const selected = operations.find(operation => operation.operationId === operationId);
        const candidate = result.ok ? result.value.operation : null;
        if (result.ok && selected && candidate && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
          candidate.operationId === selected.operationId && candidate.sourceId === sourceId && candidate.projectId === selected.projectId && candidate.action === selected.action &&
          candidate.originalRelativePath === selected.originalRelativePath && candidate.requestedRelativePath === selected.requestedRelativePath) setRecovery(result.value); else setError(true);
      }
    } catch { if (alive.current && current === epoch.current) setError(true); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function recover(action: "retry_original" | "complete_destination" | "keep_original") {
    if (busy.current || disabled || unknown || !recovery?.previewToken) return;
    const saved = recovery; busy.current = true; setPending(true); setRecovery(null);
    // Recovery requests are never automatically replayed. Unknown outcomes use
    // the same read-only status lookup as initial Apply.
    const expected = { workspaceId, operationId: saved.operation.operationId, previewToken: saved.previewToken!, projectId: saved.operation.projectId, action: saved.operation.action, originalRelativePath: saved.operation.originalRelativePath, requestedRelativePath: saved.operation.requestedRelativePath };
    setUnknown(expected);
    try {
      const result = await client.recoverProjectArchive(workspaceId, saved.operation.operationId, saved.previewToken!, action);
      if (alive.current) { if (result.ok) acceptOperation(result.value.operation, expected); else if (result.error.code === "invalid_input" || result.error.code === "stale_preview") { setUnknown(null); setError(true); } else setMessage("archiveUnknown"); }
    } catch { if (alive.current) setMessage("archiveUnknown"); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  const problems = (values: string[]) => values.map((p, i) => <p key={`${p}:${i}`} role="alert">{t(problemKeys[p] ?? "archiveProblemUnavailable")}</p>);
  const controlsDisabled = disabled || blocked || loading || error;
  const locationFields = <div><p>{t("archiveLocationPolicy")}</p>
      <label className="bb-field"><span>{t("archiveLocation")}</span><input className="bb-input" value={location} disabled={controlsDisabled} onChange={e => changeDraft(() => setLocation(e.currentTarget.value))} /></label>
      <button type="button" disabled={controlsDisabled || !location} className="workspace-button workspace-button--secondary" onClick={event => { if (!contextual) returnFocus.current = event.currentTarget; void preview(true); }}>{t("archiveReviewLocation")}</button>
      {locationReview && <div><p>{locationReview.relativePath}</p>{problems(locationReview.blockers)}
        {locationReview.previewToken && <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void confirmLocation()}>{t("archiveConfirmLocation")}</button>}
        {!contextual && <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button>}</div>}
      </div>;
  return <section ref={section} tabIndex={-1} className="project-archive" aria-label={t("archiveTitle")} aria-busy={pending || loading}
    onKeyDown={event => { if (!contextual && !event.defaultPrevented && event.key === "Escape" && (review || locationReview || recovery)) { event.preventDefault(); cancel(); } }}>
    {locationOnly && <h3>{t("archiveLocation")}</h3>}
    {!locationOnly && <DailyControl><div className="workspace-form-actions">{[false, true].map(value => <button type="button" key={String(value)} className="workspace-button workspace-button--secondary" aria-pressed={archived === value}
      disabled={blocked || contextual !== null || transitionPending} onClick={() => { const run = () => changeDraft(() => { setArchived(value); setProjectId(""); setName(""); setCreateParent(false); onViewChange(value); }); if (draftGuard) draftGuard.run(run); else run(); }}>{t(value ? "archiveArchived" : "archiveActive")}</button>)}</div></DailyControl>}
    {loading && <StatusMessage kind="info" title={t("archiveLoading")} />}
    {error && <><StatusMessage kind="error" title={t("archiveError")} /><button type="button" disabled={pending} className="workspace-button workspace-button--secondary" onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    <ContextTools label={t("archiveTitle")} compact={!locationOnly} inline={locationOnly} daily={!locationOnly} onEscape={event=>{if(review || locationReview || recovery){event.preventDefault();cancel();}}}>
    <details hidden={!!contextual} onToggle={event => { setLocationEditor(event.currentTarget.open); if (event.currentTarget.open) changeDraft(() => setLocation(snapshot?.relativePath ?? "Archive")); }}><summary>{t("archiveLocation")}: {snapshot?.relativePath ?? t("archiveNotConfigured")}</summary>
      {locationEditor && locationFields}
    </details>
    {!snapshot?.relativePath && <p>{t("archiveNoLocation")}</p>}
    <ProjectOperationDialog open={contextual !== null} contentRef={dialogRoot} className="project-archive-dialog" title={t(restoring ? "archiveRestoreApply" : "archiveApply")} onClose={cancel}>
    {pending && <StatusMessage kind="info" title={t("archivePending")} />}
    {contextual && error && <><StatusMessage kind="error" title={t("archiveError")} /><button type="button" disabled={pending} className="workspace-button workspace-button--secondary" onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    {message && <StatusMessage kind={message === "archiveCompleted" ? "info" : "error"} title={t(message)} />}
    {unknown && <div><button type="button" disabled={pending || disabled} className="workspace-button workspace-button--secondary" onClick={() => void check()}>{t("archiveCheck")}</button>
      {unknown.initial && <button type="button" disabled={pending || disabled} className="workspace-button workspace-button--secondary" onClick={() => void apply(unknown)}>{t("archiveRetryOriginalRequest")}</button>}</div>}
    {contextual && !restoring && !snapshot?.relativePath && <div><p>{t("archiveFirstUse")}</p>{locationFields}</div>}
    <form hidden={locationOnly || !!contextual && !restoring && !snapshot?.relativePath} onSubmit={e => { e.preventDefault(); if (!contextual) returnFocus.current = trigger.current; void preview(false); }}>
      <div className="bb-field" hidden={!!contextual}><label htmlFor={projectSelectId}>{t(restoring ? "archiveRestoreProject" : "archiveProject")}</label>
        <select id={projectSelectId} className="bb-input" disabled={controlsDisabled} value={projectId} onChange={e => changeDraft(() => setProjectId(e.currentTarget.value))}>
          <option value="">{t("archiveChoose")}</option>{(restoring ? snapshot?.projects ?? [] : projects).map(p => <option key={p.projectId} value={p.projectId}>{p.relativePath}</option>)}
        </select></div>
      {contextual && <p>{contextual.project.relativePath}</p>}
      {restoring && <><label className="bb-field"><span>{t("archiveName")}</span><input className="bb-input" value={name} disabled={controlsDisabled} onChange={e => changeDraft(() => setName(e.currentTarget.value))} /></label>
        <label><input type="checkbox" checked={createParent} disabled={controlsDisabled} onChange={e => changeDraft(() => setCreateParent(e.currentTarget.checked))} />{t("archiveCreateParent")}</label></>}
      <button ref={trigger} type="submit" disabled={controlsDisabled || !projectId || !snapshot?.relativePath} className="workspace-button workspace-button--secondary">{t(restoring ? "archiveRestoreReview" : "archiveReview")}</button>
    </form>
    {review && <div><p>{t("archiveEffect")}</p><p>{review.originalRelativePath} → {review.requestedRelativePath}</p>{problems(review.blockers)}
      {review.previewToken && <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void apply()}>{t(review.action === "archive" ? "archiveApply" : "archiveRestoreApply")}</button>}
      {!contextual && <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button>}</div>}
    {operations.length ? <ul>{operations.filter(op => !contextual || op.projectId === contextual.project.projectId).map(op => <li key={op.operationId}><p>{op.originalRelativePath} → {op.requestedRelativePath}</p><p>{t("archiveUnfinished")}</p>
      <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={event => { if (!contextual) returnFocus.current = event.currentTarget; void reviewRecovery(op.operationId); }}>{t("archiveRecovery")}</button></li>)}</ul> : !contextual && <p>{t("archiveNoOperations")}</p>}
    {recovery && <div>{recovery.problem && problems([recovery.problem])}{recovery.actions.map(action => <button type="button" key={action} disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void recover(action)}>{t(action === "retry_original" ? "archiveRetryOriginal" : action === "complete_destination" ? "archiveCompleteDestination" : "archiveKeepOriginal")}</button>)}
      {!contextual && <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button>}</div>}
    {contextual && <button type="button" disabled={blocked} className="workspace-button workspace-button--secondary" onClick={cancel}>{t(message === "archiveCompleted" ? "archiveDone" : "archiveCancel")}</button>}
    </ProjectOperationDialog>
    </ContextTools>
    {!locationOnly && archived && <div id={`archived-view-panel-${workspaceId}`} role="tabpanel" aria-labelledby={viewId ? `saved-view-${viewId}` : undefined}>{snapshot?.projects.length ? <>
      {viewId && <TextPropertiesTable prepared={prepared} transitionPending={transitionPending} onArchive={(project, action, trigger) => { if (blocked || disabled) return; epoch.current++; setContextual({project, action, trigger}); setProjectId(project.projectId); setName(""); setCreateParent(false); setReview(null); setRecovery(null); setMessage(null); returnFocus.current = trigger; }} archiveDisabled={blocked || loading || error || !snapshot?.relativePath} onPreview={onPreview} categoryProperty={categoryProperty} categories={categories} viewId={viewId} layout={layout} client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} disabled={disabled} projects={snapshot.projects} hideReveal />}
    </> : <p>{t("archiveEmpty")}</p>}</div>}
  </section>;
}
