import { ManagementHistory } from "./ManagementSurface.js";
import { contextReturnTarget } from "./ContextTools.js";
import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectList, ProjectSummary } from "../../contracts/workspaces.js";
import type { ProjectRenameResult, ProjectRenameOperation, ProjectRenameRecoveryPreview, ProjectRenameRecoveryAction, ProjectRenamePlacementState } from "../../contracts/project-rename.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

const placementLabels: Record<ProjectRenamePlacementState, TranslationKey> = {
  matching: "renamePlacementMatching", missing: "renamePlacementMissing", replaced: "renamePlacementReplaced",
  link: "renamePlacementLink", unavailable: "renamePlacementUnavailable", conflicting: "renamePlacementConflicting",
};
const actionLabels: Record<ProjectRenameRecoveryAction, TranslationKey> = {
  retry_original: "renameRetryOriginal", finish_staged: "renameFinishStaged", complete_destination: "renameCompleteDestination", keep_original: "renameKeepOriginal",
};
const sameOperation = (a: ProjectRenameOperation, b: ProjectRenameOperation) =>
  a.operationId === b.operationId && a.sourceId === b.sourceId && a.projectId === b.projectId &&
  a.initiatingWorkspaceId === b.initiatingWorkspaceId && a.originalName === b.originalName && a.name === b.name &&
  a.originalRelativePath === b.originalRelativePath && a.requestedRelativePath === b.requestedRelativePath &&
  a.mode === b.mode && a.categoryId === b.categoryId && a.expectedRevision === b.expectedRevision;
type RenameCommand = Parameters<WorkspaceServiceClient["renameProject"]>[0];
interface SubmittedRename { command: RenameCommand; project: ProjectSummary; mode: ProjectList["mode"]; operation?: ProjectRenameOperation; uncertain?: boolean }
function matchesSubmission(operation: ProjectRenameOperation, binding: SubmittedRename) {
  const command = binding.command;
  return operation.operationId === command.operationId && operation.projectId === command.projectId &&
    operation.initiatingWorkspaceId === command.workspaceId && operation.name === command.name && operation.expectedRevision === command.expectedRevision &&
    operation.originalName === binding.project.name && operation.originalRelativePath === binding.project.relativePath &&
    operation.categoryId === binding.project.categoryId && operation.mode === binding.mode && (!binding.operation || sameOperation(operation, binding.operation));
}
// App remounts its Table on backend restart and selection changes. Keep unknown
// operation bindings for this client/source until an explicit status resolves them.
// This is presentation memory only; it never queues or replays a mutation.
const submittedRenames = new WeakMap<WorkspaceServiceClient, Map<string, SubmittedRename>>();
function sourceRequests(client: WorkspaceServiceClient) {
  let requests = submittedRenames.get(client);
  if (!requests) { requests = new Map(); submittedRenames.set(client, requests); }
  return requests;
}
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; language: Language;
  project: ProjectSummary | null; projects: ProjectList | null; disabled: boolean;
  invalidation?: number; onRestoreFocus?(): void;
  minimumRevision: { current: number }; observationVersion: { current: number }; sourceLifetime: { current: number };
  onClose(restoreFocus?: boolean): void; onCompleted(): void; onBlockedChange(blocked: boolean): void;
}
export function ProjectRenamePanel(props: Props) {
  return <RenameContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function RenameContent({ client, workspaceId, sourceId, language, project, projects, disabled, invalidation = 0, minimumRevision, observationVersion, sourceLifetime, onClose, onCompleted, onBlockedChange, onRestoreFocus }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const requests = sourceRequests(client);
  const binding = useRef<SubmittedRename | null>(requests.get(sourceId) ?? null);
  const [name, setName] = useState(""), [pending, setPending] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(binding.current ? "renameUncertain" : null);
  // The accepted request outlives the editor. Dismissal never cancels or replays it.
  const submitted = useRef<RenameCommand | null>(binding.current?.command ?? null);
  const [unresolved, setUnresolved] = useState(!!submitted.current);
  const busy = useRef(false), mounted = useRef(true), generation = useRef(0), request = useRef(0), ready = useRef(true);
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const restoreInput = useRef(false);
  const [operations, setOperations] = useState<ProjectRenameOperation[]>([]);
  const [listLoading, setListLoading] = useState(true), [listError, setListError] = useState(false);
  const listVersion = useRef(0), reviewVersion = useRef(0);
  const knownOperations = useRef(new Map<string, ProjectRenameOperation>());
  const [reviewed, setReviewed] = useState<ProjectRenameOperation | null>(null);
  const selectedReview = useRef<ProjectRenameOperation | null>(null);
  const [preview, setPreview] = useState<ProjectRenameRecoveryPreview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false), [reviewMessage, setReviewMessage] = useState<TranslationKey | null>(null);
  const previewBinding = useRef<{ observation: number; lifetime: number; revision: number; backend: number } | null>(null);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null), reviewHeading = useRef<HTMLHeadingElement>(null), reviewAgain = useRef<HTMLButtonElement>(null);
  const reviewRoot = useRef<HTMLElement>(null), dismissReview = useRef<HTMLButtonElement>(null);
  const restoreReviewFocus = useRef(false);
  const restoreReviewControl = useRef(false);
  const invalidateReview = () => {
    restoreReviewControl.current = !!selectedReview.current && (document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement));
    reviewVersion.current++; setPreview(null); previewBinding.current = null; setReviewLoading(false);
    if (selectedReview.current) setReviewMessage("renameReviewStale");
  };
  const closeReview = (focus = true) => {
    restoreReviewControl.current = false;
    reviewVersion.current++; selectedReview.current = null; setReviewed(null); setPreview(null); previewBinding.current = null; setReviewLoading(false); setReviewMessage(null);
    if (focus) {
      const trigger = reviewTrigger.current;
      if (trigger?.isConnected && !trigger.disabled) trigger.focus(); else onRestoreFocus?.();
    }
  };
  useEffect(() => { if (reviewed) reviewHeading.current?.focus(); }, [reviewed?.operationId]);
  useEffect(() => {
    if (reviewMessage && restoreReviewControl.current && !reviewAgain.current?.disabled &&
      (document.activeElement === document.body || reviewRoot.current?.contains(document.activeElement))) {
      reviewAgain.current?.focus(); restoreReviewControl.current = false;
    }
  }, [reviewMessage, disabled, pending, reviewLoading, listLoading, unresolved]);
  useEffect(() => { if (pending && reviewed && restoreReviewFocus.current) { dismissReview.current?.focus(); restoreReviewFocus.current = false; } }, [pending, reviewed]);
  const loadRenames = async () => {
    const current = ++listVersion.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current, revision = minimumRevision.current;
    invalidateReview(); setListLoading(true); setListError(false);
    try {
      const result = await client.listProjectRenames(workspaceId);
      if (!mounted.current || current !== listVersion.current || backend !== generation.current) return;
      if (observed !== observationVersion.current || lifetime !== sourceLifetime.current || revision !== minimumRevision.current) { setOperations([]); setListError(true); return; }
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.operations.every((operation) => operation.sourceId === sourceId && !["completed", "failed"].includes(operation.stage) &&
          (!knownOperations.current.has(operation.operationId) || sameOperation(operation, knownOperations.current.get(operation.operationId)!)) &&
          (operation.operationId !== submitted.current?.operationId || !!binding.current && matchesSubmission(operation, binding.current))) &&
        new Set(result.value.operations.map((operation) => operation.operationId)).size === result.value.operations.length) {
        for (const operation of result.value.operations) knownOperations.current.set(operation.operationId, operation);
        setOperations(result.value.operations);
      }
      else { setOperations([]); setListError(true); }
    } catch { if (mounted.current && current === listVersion.current && backend === generation.current) { setOperations([]); setListError(true); } }
    finally { if (mounted.current && current === listVersion.current && backend === generation.current) setListLoading(false); }
  };
  useEffect(() => { void loadRenames(); return () => { listVersion.current++; }; }, [client, workspaceId, sourceId, invalidation]);
  const [editorState, setEditorState] = useState({ revision: -1, observation: -1, lifetime: -1 });
  useEffect(() => {
    if (project) { setEditorState({ revision: projects?.revision ?? -1, observation: observationVersion.current, lifetime: sourceLifetime.current }); restoreInput.current = true; setName(project.name); if (!submitted.current) setMessage(null); input.current?.focus(); }
  }, [project]);
  useEffect(() => { onBlockedChange(pending || unresolved || reviewed !== null); }, [pending, unresolved, reviewed, onBlockedChange]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.onBackendStatus((status) => {
      generation.current++; request.current++; busy.current = false; ready.current = status.state === "ready"; setPending(false);
      invalidateReview(); listVersion.current++; setOperations([]); setListLoading(false); setListError(status.state !== "ready");
      if (status.state === "ready") void loadRenames();
      if (submitted.current) { if (binding.current) binding.current.uncertain = true; setUnresolved(true); setMessage("renameUncertain"); }
    });
    return () => { mounted.current = false; generation.current++; request.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  useEffect(() => {
    if (pending && project) cancel.current?.focus();
    if (!pending && restoreInput.current && project && !disabled && !unresolved && !input.current?.disabled) { input.current?.focus(); restoreInput.current = false; }
  }, [pending, project, disabled, unresolved, editorState]);
  const available = !!projects && projects.workspaceId === workspaceId && projects.sourceId === sourceId && projects.configured &&
    ["ready", "empty"].includes(projects.state) && projects.revision >= minimumRevision.current && projects.revision === editorState.revision &&
    observationVersion.current === editorState.observation && sourceLifetime.current === editorState.lifetime && !!project &&
    projects.projects.some((row) => row.associationState === "active" && row.resolution === "active" && row.projectId === project.projectId && row.name === project.name && row.relativePath === project.relativePath && row.categoryId === project.categoryId);
  const review = async (operation: ProjectRenameOperation) => {
    if (busy.current || !ready.current || disabled || (unresolved && (binding.current?.uncertain || submitted.current?.operationId !== operation.operationId))) return;
    selectedReview.current = operation; setReviewed(operation); setPreview(null); previewBinding.current = null; setReviewMessage(null); setReviewLoading(true);
    const current = ++reviewVersion.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current, revision = minimumRevision.current;
    try {
      const result = await client.previewProjectRenameRecovery(workspaceId, operation.operationId);
      if (!mounted.current || current !== reviewVersion.current || backend !== generation.current || selectedReview.current !== operation) return;
      if (observed !== observationVersion.current || lifetime !== sourceLifetime.current || revision !== minimumRevision.current) { setReviewMessage("renameReviewStale"); return; }
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && sameOperation(result.value.operation, operation) &&
        result.value.operation.stage === operation.stage && result.value.operation.lastVerifiedPlacement === operation.lastVerifiedPlacement && result.value.operation.problem === operation.problem &&
        result.value.revision >= minimumRevision.current && !["completed", "failed"].includes(result.value.operation.stage) &&
        result.value.actions.every((action) => Object.hasOwn(actionLabels, action))) {
        setPreview(result.value); previewBinding.current = { observation: observed, lifetime, revision: result.value.revision, backend };
      } else setReviewMessage("renameReviewError");
    } catch { if (mounted.current && current === reviewVersion.current && backend === generation.current) setReviewMessage("renameReviewError"); }
    finally { if (mounted.current && current === reviewVersion.current && backend === generation.current) setReviewLoading(false); }
  };
  const accept = (result: ProjectRenameResult, status: boolean) => {
    const authored = submitted.current;
    if (!authored) return false;
    const operation = result.operation;
    if (status && !operation) return false;
    if (operation && (operation.sourceId !== sourceId || !binding.current || !matchesSubmission(operation, binding.current))) return false;
    if (result.outcome === "completed" || result.outcome === "unchanged") {
      if (!operation || operation.stage !== "completed" || operation.resultKind !== result.outcome || operation.completedRevision !== result.project.revision ||
        result.project.operationId !== authored.operationId || result.project.projectId !== authored.projectId || result.project.sourceId !== sourceId ||
        result.project.name !== authored.name || result.project.relativePath !== operation.requestedRelativePath || result.project.categoryId !== operation.categoryId) return false;
      setMessage(result.project.revision < minimumRevision.current ? "renameNewer" : result.outcome === "unchanged" ? "renameUnchanged" : "renameSaved");
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false); closeReview(document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement)); void loadRenames(); onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement)); onCompleted();
    } else if (result.outcome === "recoverable") {
      if (!operation || ["completed", "failed"].includes(operation.stage)) return false;
      if (binding.current) { binding.current.operation = operation; binding.current.uncertain = false; }
      invalidateReview(); setMessage("renameRecoverable"); setUnresolved(true); void loadRenames();
    }
    else if (result.outcome === "rejected") {
      if (operation && operation.stage !== "failed") return false;
      if (result.problem === "kept_original" && (!operation || operation.resultKind !== "rejected" || operation.problem !== "kept_original" || operation.lastVerifiedPlacement !== "original")) return false;
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false);
      if (result.problem === "kept_original") {
        setMessage("renameKeptOriginal"); closeReview(document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement)); void loadRenames(); onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement)); onCompleted(); return true;
      }
      setMessage(result.problem === "invalid_name" ? "renameInvalid" :
        ["occupied", "reserved_destination", "native_conflict"].includes(result.problem) ? "renameCollision" :
        ["stale_configuration", "filesystem_changed"].includes(result.problem) ? "renameStale" :
        ["source_unavailable", "category_unavailable", "project_unavailable", "unconfigured", "excluded", "archive", "permission_denied", "native_unavailable", "unsupported", "busy", "cross_device"].includes(result.problem) ? "renameUnavailable" : "renameFailed");
    }
    return true;
  };
  const run = async (status: boolean, action?: ProjectRenameRecoveryAction) => {
    if (busy.current || !ready.current || (status ? !submitted.current : action ? disabled || reviewLoading || !preview?.previewToken || !preview.actions.includes(action) : disabled || !available || unresolved || reviewed !== null)) return;
    if (action) {
      const state = previewBinding.current;
      if (!preview || !state || !selectedReview.current || !sameOperation(preview.operation, selectedReview.current) ||
        state.observation !== observationVersion.current || state.lifetime !== sourceLifetime.current || state.revision < minimumRevision.current || state.backend !== generation.current ||
        unresolved && (binding.current?.uncertain || submitted.current?.operationId !== preview.operation.operationId)) { invalidateReview(); return; }
      const operation = preview.operation;
      submitted.current = { workspaceId: operation.initiatingWorkspaceId, projectId: operation.projectId, operationId: operation.operationId, name: operation.name, expectedRevision: operation.expectedRevision };
      binding.current = { command: submitted.current, project: { projectId: operation.projectId, name: operation.originalName, relativePath: operation.originalRelativePath, categoryId: operation.categoryId }, mode: operation.mode, operation, uncertain: true };
      requests.set(sourceId, binding.current);
    } else if (!status) {
      submitted.current = { workspaceId, projectId: project!.projectId, operationId: crypto.randomUUID(), name, expectedRevision: projects!.revision };
      binding.current = { command: submitted.current, project: { ...project! }, mode: projects!.mode, uncertain: true };
      requests.set(sourceId, binding.current);
    }
    const authored = submitted.current!;
    if (binding.current) binding.current.uncertain = true;
    restoreReviewFocus.current = !!reviewRoot.current?.contains(document.activeElement);
    const recoveryToken = preview?.previewToken; invalidateReview();
    busy.current = true; setPending(true); setUnresolved(true); setMessage(null);
    const current = ++request.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current;
    try {
      const result = await (status ? client.getProjectRename(workspaceId, authored.operationId) : action ? client.recoverProjectRename(workspaceId, authored.operationId, recoveryToken!, action) : client.renameProject(authored));
      if (!mounted.current || current !== request.current || backend !== generation.current || submitted.current !== authored) return;
      if (!result.ok || !accept(result.value, status || !!action)) setMessage("renameUncertain");
      else if (observed !== observationVersion.current || lifetime !== sourceLifetime.current) {
        if (result.value.outcome === "completed" || result.value.outcome === "unchanged") setMessage("renameNewer");
        else if (result.value.outcome === "rejected" && result.value.problem !== "kept_original") setMessage("renameStale");
      }
    } catch { if (mounted.current && current === request.current && backend === generation.current) setMessage("renameUncertain"); }
    finally {
      if (mounted.current && current === request.current && backend === generation.current) {
        busy.current = false; restoreInput.current = document.activeElement === document.body || !!cancel.current?.parentElement?.contains(document.activeElement); setPending(false);
      }
    }
  };
  return <section ref={root} className="project-rename" aria-label={t("renameProject")} aria-busy={pending}>
    {project && <form onSubmit={(event) => { event.preventDefault(); void run(false); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } }}>
      <label htmlFor="project-rename-name">{t("projectName")}</label>
      <input ref={input} id="project-rename-name" className="bb-input" value={name} disabled={disabled || pending || unresolved || !available}
        aria-invalid={message === "renameInvalid"} onChange={(event) => setName(event.currentTarget.value)} />
      <p>{t("renameHint")}</p>
      {!available && !pending && !unresolved && <StatusMessage kind="error" title={t("renameStale")} />}
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending || unresolved || !available}>{t("renameSubmit")}</button>
        <button ref={cancel} type="button" className="workspace-button workspace-button--secondary" onClick={() => onClose()}>{t("cancelRenameWorkspace")}</button>
      </div>
      <p>{t("renameCancelHint")}</p>
    </form>}
    <ManagementHistory><details className="operation-history"><summary>{t("renameListTitle")} ({operations.length})</summary>
    <section className="rename-operations" aria-label={t("renameListTitle")} aria-busy={listLoading}>
      <h3>{t("renameListTitle")}</h3>
      {listLoading && <StatusMessage kind="info" title={t("renameListLoading")} />}
      {listError && <StatusMessage kind="error" title={t("renameListError")} />}
      {!listLoading && !listError && operations.length === 0 && <p>{t("renameListEmpty")}</p>}
      {operations.map((operation) => <div key={operation.operationId}>
        <dl><dt>{t("renameOriginalName")}</dt><dd>{operation.originalName}</dd><dt>{t("renameRequestedName")}</dt><dd>{operation.name}</dd></dl>
        <p>{t(operation.stage === "uncertain" ? "renameOperationUncertain" : "renameOperationInterrupted")}</p>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || disabled || listLoading || listError || !ready.current || unresolved && (binding.current?.uncertain || submitted.current?.operationId !== operation.operationId)}
          onClick={(event) => { reviewTrigger.current = contextReturnTarget(event.currentTarget); void review(operation); }}
          data-close-context aria-label={`${t("renameReview")}: ${operation.originalName} → ${operation.name}`}>{t("renameReview")}</button>
      </div>)}
      <button type="button" className="workspace-button workspace-button--secondary" disabled={listLoading || pending || !ready.current} onClick={() => void loadRenames()}>{t("renameListReload")}</button>
    </section>
    </details></ManagementHistory>
    {reviewed && <section ref={reviewRoot} className="rename-review" aria-labelledby="rename-review-title" aria-busy={reviewLoading || pending}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeReview(); } }}>
      <h3 id="rename-review-title" ref={reviewHeading} tabIndex={-1}>{t("renameReviewTitle")}</h3>
      <p>{t("renameReviewHint")}</p>
      <dl><dt>{t("renameOriginalName")}</dt><dd>{reviewed.originalName}</dd><dt>{t("renameRequestedName")}</dt><dd>{reviewed.name}</dd></dl>
      {reviewLoading && <StatusMessage kind="info" title={t("renameReviewLoading")} />}
      {reviewMessage && <StatusMessage kind="error" title={t(reviewMessage)} />}
      {preview && <>
        <dl className="rename-placements">
          <dt>{t("renameOriginalPlacement")}</dt><dd>{t(placementLabels[preview.originalState])}</dd>
          <dt>{t("renameStagedPlacement")}</dt><dd>{t(preview.stagedState ? placementLabels[preview.stagedState] : "renamePlacementUnused")}</dd>
          <dt>{t("renameDestinationPlacement")}</dt><dd>{t(placementLabels[preview.destinationState])}</dd>
        </dl>
        {(!preview.previewToken || preview.actions.length === 0) && <StatusMessage kind="error" title={t("renameRecoveryBlocked")} />}
        <div className="workspace-form-actions">{preview.previewToken && [...new Set(preview.actions)].map((action) =>
          <button key={action} type="button" className="workspace-button" disabled={disabled || pending || reviewLoading || !ready.current}
            onClick={() => void run(false, action)}>{t(actionLabels[action])}</button>)}</div>
      </>}
      <div className="workspace-form-actions">
        <button ref={reviewAgain} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || reviewLoading || !ready.current || unresolved && !!binding.current?.uncertain}
          onClick={() => void review(operations.find((operation) => operation.operationId === reviewed.operationId) ?? reviewed)}>{t("renameReviewAgain")}</button>
        <button ref={dismissReview} type="button" className="workspace-button workspace-button--secondary" onClick={() => closeReview()}>{t("renameReviewClose")}</button>
      </div>
    </section>}
    {unresolved && binding.current && !operations.some((operation) => operation.operationId === submitted.current?.operationId) &&
      <dl><dt>{t("renameOriginalName")}</dt><dd>{binding.current.project.name}</dd><dt>{t("renameRequestedName")}</dt><dd>{binding.current.command.name}</dd></dl>}
    {pending && <StatusMessage kind="info" title={t("renamePending")} />}
    {message && <StatusMessage kind={["renameSaved", "renameUnchanged", "renameNewer", "renameRecoverable", "renameKeptOriginal"].includes(message) ? "info" : "error"} title={t(message)} />}
    {unresolved && <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || !ready.current}
      onClick={() => void run(true)}>{t("renameStatus")}</button>}
  </section>;
}
