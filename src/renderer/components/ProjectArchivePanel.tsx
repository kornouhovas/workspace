import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectSummary } from "../../contracts/workspaces.js";
import type { ArchiveSnapshot, ArchiveLocationPreview, ProjectArchivePreview, ProjectArchiveOperation, ProjectArchiveRecoveryPreview } from "../../contracts/project-archive.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; projects: ProjectSummary[];
  language: Language; disabled: boolean; revision: number; invalidation: number;
  onCommitted(): void; onViewChange(archived: boolean): void; onBlockedChange?(blocked: boolean): void;
}
const problemKeys: Record<string, TranslationKey> = {
  occupied: "archiveProblemOccupied", case_alias: "archiveProblemOccupied", reserved_destination: "archiveProblemOccupied",
  missing_parent: "archiveProblemMissingParent", incompatible_mode: "archiveProblemMode", archive_not_empty: "archiveProblemNotEmpty",
  busy: "archiveProblemBusy", owned_location: "archiveProblemOwned",
};
export function ProjectArchivePanel(props: Props) { return <ArchiveContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />; }
function ArchiveContent({ client, workspaceId, sourceId, projects, language, disabled, revision, invalidation, onCommitted, onViewChange, onBlockedChange }: Props) {
  const projectSelectId = useId();
  const t = (key: TranslationKey) => translate(language, key);
  const [archived, setArchived] = useState(false), [snapshot, setSnapshot] = useState<ArchiveSnapshot | null>(null);
  const [operations, setOperations] = useState<ProjectArchiveOperation[]>([]);
  const [locationEditor, setLocationEditor] = useState(false);
  const [location, setLocation] = useState("Archive"), [projectId, setProjectId] = useState("");
  const [name, setName] = useState(""), [createParent, setCreateParent] = useState(false);
  const [locationReview, setLocationReview] = useState<ArchiveLocationPreview | null>(null);
  const [review, setReview] = useState<ProjectArchivePreview | null>(null), [recovery, setRecovery] = useState<ProjectArchiveRecoveryPreview | null>(null);
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [unknown, setUnknown] = useState<{ workspaceId: string; operationId: string; previewToken: string; initial?: boolean } | null>(null);
  const alive = useRef(true), busy = useRef(false), epoch = useRef(0), listVersion = useRef(0), minimumRevision = useRef(revision);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), section = useRef<HTMLElement>(null);
  const blocked = pending || unknown !== null;
  useEffect(() => { onBlockedChange?.(blocked); return () => onBlockedChange?.(false); }, [blocked, onBlockedChange]);
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
  const cancel = () => { if (busy.current || unknown) return; epoch.current++; setReview(null); setLocationReview(null); setRecovery(null); setMessage(null); (returnFocus.current?.isConnected && !returnFocus.current.disabled ? returnFocus.current : section.current)?.focus(); };
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
        const action = archived ? "restore" : "archive";
        const result = await client.previewProjectArchive({ workspaceId, projectId, action, name: archived && name !== "" ? name : null, createParent: archived && createParent });
        if (!alive.current || current !== epoch.current) return;
        if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.projectId === projectId && result.value.action === action && result.value.revision >= minimumRevision.current) setReview(result.value); else setError(true);
      }
    } catch { if (alive.current && current === epoch.current) setError(true); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  function acceptOperation(operation: ProjectArchiveOperation, expectedId: string) {
    if (operation.operationId !== expectedId || operation.sourceId !== sourceId) { setMessage("archiveUnknown"); return false; }
    setUnknown(null); setReview(null); setRecovery(null);
    setMessage(operation.stage === "completed" ? "archiveCompleted" : operation.stage === "failed" ? "archiveBlocked" : "archiveUnfinished");
    void load(); onCommitted(); section.current?.focus(); return true;
  }
  async function apply(original?: { workspaceId: string; operationId: string; previewToken: string }) {
    if (busy.current || disabled || (!original && !review?.previewToken)) return;
    const request = original ?? { workspaceId, operationId: crypto.randomUUID(), previewToken: review!.previewToken! };
    busy.current = true; setPending(true); setUnknown({ ...request, initial: true }); setMessage(null);
    try {
      const result = await client.applyProjectArchive(request);
      if (!alive.current) return;
      if (result.ok) acceptOperation(result.value.operation, request.operationId);
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
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId) { setSnapshot(result.value); onCommitted(); void load(); } else setError(true);
    } catch { if (alive.current) { setError(true); void load(); } }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function check() {
    if (busy.current || !unknown || disabled) return;
    const request = unknown; busy.current = true; setPending(true);
    try { const result = await client.getProjectArchiveOperation(workspaceId, request.operationId);
      if (alive.current) { if (result.ok) acceptOperation(result.value.operation, request.operationId); else setMessage("archiveUnknown"); }
    } catch { if (alive.current) setMessage("archiveUnknown"); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function reviewRecovery(operationId: string) {
    if (busy.current || disabled || unknown) return;
    busy.current = true; setPending(true); const current = ++epoch.current;
    try {
      const result = await client.previewProjectArchiveRecovery(workspaceId, operationId);
      if (alive.current && current === epoch.current) {
        if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.operation.operationId === operationId) setRecovery(result.value); else setError(true);
      }
    } catch { if (alive.current && current === epoch.current) setError(true); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  async function recover(action: "retry_original" | "complete_destination" | "keep_original") {
    if (busy.current || disabled || unknown || !recovery?.previewToken) return;
    const saved = recovery; busy.current = true; setPending(true); setRecovery(null);
    // Recovery requests are never automatically replayed. Unknown outcomes use
    // the same read-only status lookup as initial Apply.
    setUnknown({ workspaceId, operationId: saved.operation.operationId, previewToken: saved.previewToken! });
    try {
      const result = await client.recoverProjectArchive(workspaceId, saved.operation.operationId, saved.previewToken!, action);
      if (alive.current) { if (result.ok) acceptOperation(result.value.operation, saved.operation.operationId); else if (result.error.code === "invalid_input" || result.error.code === "stale_preview") { setUnknown(null); setError(true); } else setMessage("archiveUnknown"); }
    } catch { if (alive.current) setMessage("archiveUnknown"); }
    finally { if (alive.current) { busy.current = false; setPending(false); } }
  }
  const problems = (values: string[]) => values.map((p, i) => <p key={`${p}:${i}`} role="alert">{t(problemKeys[p] ?? "archiveProblemUnavailable")}</p>);
  const controlsDisabled = disabled || blocked || loading || error;
  return <section ref={section} tabIndex={-1} className="project-archive" aria-label={t("archiveTitle")} aria-busy={pending || loading}
    onKeyDown={event => { if (event.key === "Escape" && (review || locationReview || recovery)) { event.preventDefault(); cancel(); } }}>
    <h3>{t("archiveTitle")}</h3>
    <div className="workspace-form-actions">{[false, true].map(value => <button type="button" key={String(value)} className="workspace-button workspace-button--secondary" aria-pressed={archived === value}
      disabled={blocked} onClick={() => changeDraft(() => { setArchived(value); setProjectId(""); setName(""); setCreateParent(false); onViewChange(value); })}>{t(value ? "archiveArchived" : "archiveActive")}</button>)}</div>
    {loading && <StatusMessage kind="info" title={t("archiveLoading")} />}
    {error && <><StatusMessage kind="error" title={t("archiveError")} /><button type="button" disabled={pending} className="workspace-button workspace-button--secondary" onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    {message && <StatusMessage kind={message === "archiveCompleted" ? "info" : "error"} title={t(message)} />}
    {unknown && <div><button type="button" disabled={pending || disabled} className="workspace-button workspace-button--secondary" onClick={() => void check()}>{t("archiveCheck")}</button>
      {unknown.initial && <button type="button" disabled={pending || disabled} className="workspace-button workspace-button--secondary" onClick={() => void apply(unknown)}>{t("archiveRetryOriginalRequest")}</button>}</div>}
    <details onToggle={event => setLocationEditor(event.currentTarget.open)}><summary>{t("archiveLocation")}: {snapshot?.relativePath ?? "Archive"}</summary>
      {locationEditor && <div><p>{t("archiveLocationPolicy")}</p>
      <label className="bb-field"><span>{t("archiveLocation")}</span><input className="bb-input" value={location} disabled={controlsDisabled} onChange={e => changeDraft(() => setLocation(e.currentTarget.value))} /></label>
      <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={event => { returnFocus.current = event.currentTarget; void preview(true); }}>{t("archiveReviewLocation")}</button>
      {locationReview && <div><p>{locationReview.relativePath}</p>{problems(locationReview.blockers)}
        {locationReview.previewToken && <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void confirmLocation()}>{t("archiveConfirmLocation")}</button>}
        <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button></div>}
      </div>}
    </details>
    {!snapshot?.relativePath && <p>{t("archiveNoLocation")}</p>}
    <form onSubmit={e => { e.preventDefault(); returnFocus.current = trigger.current; void preview(false); }}>
      <div className="bb-field"><label htmlFor={projectSelectId}>{t(archived ? "archiveRestoreProject" : "archiveProject")}</label>
        <select id={projectSelectId} className="bb-input" disabled={controlsDisabled} value={projectId} onChange={e => changeDraft(() => setProjectId(e.currentTarget.value))}>
          <option value="">{t("archiveChoose")}</option>{(archived ? snapshot?.projects ?? [] : projects).map(p => <option key={p.projectId} value={p.projectId}>{p.relativePath}</option>)}
        </select></div>
      {archived && <><label className="bb-field"><span>{t("archiveName")}</span><input className="bb-input" value={name} disabled={controlsDisabled} onChange={e => changeDraft(() => setName(e.currentTarget.value))} /></label>
        <label><input type="checkbox" checked={createParent} disabled={controlsDisabled} onChange={e => changeDraft(() => setCreateParent(e.currentTarget.checked))} />{t("archiveCreateParent")}</label></>}
      <button ref={trigger} type="submit" disabled={controlsDisabled || !projectId || !snapshot?.relativePath} className="workspace-button workspace-button--secondary">{t(archived ? "archiveRestoreReview" : "archiveReview")}</button>
    </form>
    {review && <div><p>{t("archiveEffect")}</p><p>{review.originalRelativePath} → {review.requestedRelativePath}</p>{problems(review.blockers)}
      {review.previewToken && <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void apply()}>{t(review.action === "archive" ? "archiveApply" : "archiveRestoreApply")}</button>}
      <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button></div>}
    {operations.length ? <ul>{operations.map(op => <li key={op.operationId}><p>{op.originalRelativePath} → {op.requestedRelativePath}</p><p>{t("archiveUnfinished")}</p>
      <button type="button" disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={event => { returnFocus.current = event.currentTarget; void reviewRecovery(op.operationId); }}>{t("archiveRecovery")}</button></li>)}</ul> : <p>{t("archiveNoOperations")}</p>}
    {recovery && <div>{recovery.problem && problems([recovery.problem])}{recovery.actions.map(action => <button type="button" key={action} disabled={controlsDisabled} className="workspace-button workspace-button--secondary" onClick={() => void recover(action)}>{t(action === "retry_original" ? "archiveRetryOriginal" : action === "complete_destination" ? "archiveCompleteDestination" : "archiveKeepOriginal")}</button>)}
      <button type="button" disabled={blocked} onClick={cancel} className="workspace-button workspace-button--secondary">{t("archiveCancel")}</button></div>}
    {archived && <>{snapshot?.projects.length ? <>
      <ul>{snapshot.projects.map(p => <li key={p.projectId}>{p.name} — {t("archiveOriginal")}: {p.originalRelativePath}{p.categoryName && <> — {t("archiveFrozenCategory")}: {p.categoryName}</>}</li>)}</ul>
      <TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} disabled={disabled} projects={snapshot.projects} hideReveal />
    </> : <p>{t("archiveEmpty")}</p>}</>}
  </section>;
}
