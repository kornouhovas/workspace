import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectList, ProjectSummary } from "../../contracts/workspaces.js";
import type { ProjectCategoryMoveResult, ProjectCategoryMoveOperation, ProjectCategoryMoveRecoveryPreview, ProjectCategoryMoveRecoveryAction, ProjectCategoryMovePlacementState } from "../../contracts/project-category-move.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

const placementLabels: Record<ProjectCategoryMovePlacementState, TranslationKey> = {
  matching: "moveCategoryPlacementMatching", missing: "moveCategoryPlacementMissing", replaced: "moveCategoryPlacementReplaced",
  link: "moveCategoryPlacementLink", unavailable: "moveCategoryPlacementUnavailable", conflicting: "moveCategoryPlacementConflicting",
};
const actionLabels: Record<ProjectCategoryMoveRecoveryAction, TranslationKey> = {
  retry_original: "moveCategoryRetryOriginal", complete_destination: "moveCategoryCompleteDestination", keep_original: "moveCategoryKeepOriginal",
};
const stageLabels: Record<ProjectCategoryMoveOperation["stage"], TranslationKey> = {
  intent: "moveCategoryStageIntent", destination_recorded: "moveCategoryStageDestination", uncertain: "moveCategoryStageUncertain",
  completed: "moveCategoryStageCompleted", failed: "moveCategoryStageFailed",
};
const problemLabels: Record<NonNullable<ProjectCategoryMoveOperation["problem"]>, TranslationKey> = {
  invalid_name: "moveCategoryFailed", unconfigured: "moveCategoryUnavailable", stale_configuration: "moveCategoryStale",
  category_unavailable: "moveCategoryUnavailable", project_unavailable: "moveCategoryUnavailable", excluded: "moveCategoryUnavailable",
  archive: "moveCategoryUnavailable", reserved_destination: "moveCategoryCollision", occupied: "moveCategoryCollision",
  source_unavailable: "moveCategoryUnavailable", permission_denied: "moveCategoryUnavailable", filesystem_changed: "moveCategoryStale",
  filesystem_error: "moveCategoryFilesystemError", ownership_uncertain: "moveCategoryOwnership", destination_missing: "moveCategoryDestinationMissing",
  destination_replaced: "moveCategoryDestinationReplaced", destination_link: "moveCategoryDestinationLink", native_conflict: "moveCategoryCollision",
  native_unavailable: "moveCategoryUnavailable", busy: "moveCategoryUnavailable", cross_device: "moveCategoryUnavailable", unsupported: "moveCategoryUnavailable",
  storage_error: "moveCategoryStorageError", kept_original: "moveCategoryKeptOriginal",
};
function OperationEvidence({ operation, language }: { operation: ProjectCategoryMoveOperation; language: Language }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <dl>
    <dt>{t("moveCategoryStage")}</dt><dd>{t(stageLabels[operation.stage])}</dd>
    <dt>{t("moveCategoryLastVerified")}</dt><dd>{t(operation.lastVerifiedPlacement === "original" ? "moveCategoryVerifiedOriginal" : "moveCategoryVerifiedDestination")}</dd>
    <dt>{t("moveCategoryProblem")}</dt><dd>{t(operation.problem ? problemLabels[operation.problem] : "moveCategoryNoProblem")}</dd>
  </dl>;
}
const sameOperation = (a: ProjectCategoryMoveOperation, b: ProjectCategoryMoveOperation) =>
  a.operationId === b.operationId && a.sourceId === b.sourceId && a.projectId === b.projectId &&
  a.initiatingWorkspaceId === b.initiatingWorkspaceId && a.name === b.name &&
  a.originalRelativePath === b.originalRelativePath && a.requestedRelativePath === b.requestedRelativePath &&
  a.originalCategoryId === b.originalCategoryId && a.destinationCategoryId === b.destinationCategoryId && a.expectedRevision === b.expectedRevision;
type MoveCommand = Parameters<WorkspaceServiceClient["moveProjectCategory"]>[0];
interface SubmittedMove { command: MoveCommand; sourceId: string; project: ProjectSummary; requestedPath: string; operation?: ProjectCategoryMoveOperation; uncertain?: boolean }
function matchesSubmission(operation: ProjectCategoryMoveOperation, binding: SubmittedMove) {
  const command = binding.command;
  return operation.sourceId === binding.sourceId && operation.operationId === command.operationId && operation.projectId === command.projectId &&
    operation.initiatingWorkspaceId === command.workspaceId && operation.expectedRevision === command.expectedRevision &&
    operation.name === binding.project.name && operation.originalRelativePath === binding.project.relativePath &&
    operation.originalCategoryId === binding.project.categoryId && operation.destinationCategoryId === command.destinationCategoryId &&
    operation.requestedRelativePath === binding.requestedPath && (!binding.operation || sameOperation(operation, binding.operation));
}
// App remounts its Table on backend restart and selection changes. Keep unknown
// operation bindings for this client/source until an explicit status resolves them.
// This is presentation memory only; it never queues or replays a mutation.
const submittedMoves = new WeakMap<WorkspaceServiceClient, Map<string, SubmittedMove>>();
function sourceRequests(client: WorkspaceServiceClient) {
  let requests = submittedMoves.get(client);
  if (!requests) { requests = new Map(); submittedMoves.set(client, requests); }
  return requests;
}
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; language: Language;
  project: ProjectSummary | null; projects: ProjectList | null; disabled: boolean;
  invalidation?: number; onRestoreFocus?(): void;
  minimumRevision: { current: number }; observationVersion: { current: number }; sourceLifetime: { current: number };
  onClose(restoreFocus?: boolean): void; onCompleted(): void; onBlockedChange(blocked: boolean): void;
}
export function ProjectCategoryMovePanel(props: Props) {
  return <CategoryMoveContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function CategoryMoveContent({ client, workspaceId, sourceId, language, project, projects, disabled, invalidation = 0, minimumRevision, observationVersion, sourceLifetime, onClose, onCompleted, onBlockedChange, onRestoreFocus }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const requests = sourceRequests(client);
  const binding = useRef<SubmittedMove | null>(requests.get(sourceId) ?? null);
  const [destination, setDestination] = useState(""), [pending, setPending] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(binding.current ? "moveCategoryUncertain" : null);
  // The accepted request outlives the editor. Dismissal never cancels or replays it.
  const submitted = useRef<MoveCommand | null>(binding.current?.command ?? null);
  const [unresolved, setUnresolved] = useState(!!submitted.current);
  const busy = useRef(false), mounted = useRef(true), generation = useRef(0), request = useRef(0), ready = useRef(true);
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLSelectElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const restoreInput = useRef(false);
  const [operations, setOperations] = useState<ProjectCategoryMoveOperation[]>([]);
  const [listLoading, setListLoading] = useState(true), [listError, setListError] = useState(false);
  const listVersion = useRef(0), reviewVersion = useRef(0);
  const knownOperations = useRef(new Map<string, ProjectCategoryMoveOperation>());
  const resolvedOperations = useRef(new Set<string>());
  const [reviewed, setReviewed] = useState<ProjectCategoryMoveOperation | null>(null);
  const selectedReview = useRef<ProjectCategoryMoveOperation | null>(null);
  const [preview, setPreview] = useState<ProjectCategoryMoveRecoveryPreview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false), [reviewMessage, setReviewMessage] = useState<TranslationKey | null>(null);
  const previewBinding = useRef<{ observation: number; lifetime: number; revision: number; backend: number } | null>(null);
  const reviewTrigger = useRef<HTMLButtonElement | null>(null), reviewHeading = useRef<HTMLHeadingElement>(null), reviewAgain = useRef<HTMLButtonElement>(null);
  const reviewRoot = useRef<HTMLElement>(null), dismissReview = useRef<HTMLButtonElement>(null);
  const restoreReviewFocus = useRef(false);
  const restoreReviewControl = useRef(false);
  const invalidateReview = () => {
    restoreReviewControl.current = !!selectedReview.current && (document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement));
    reviewVersion.current++; setPreview(null); previewBinding.current = null; setReviewLoading(false);
    if (selectedReview.current) setReviewMessage("moveCategoryReviewStale");
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
  const loadMoves = async () => {
    const current = ++listVersion.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current, revision = minimumRevision.current;
    invalidateReview(); setListLoading(true); setListError(false);
    try {
      const result = await client.listProjectCategoryMoves(workspaceId);
      if (!mounted.current || current !== listVersion.current || backend !== generation.current) return;
      if (observed !== observationVersion.current || lifetime !== sourceLifetime.current || revision !== minimumRevision.current) { setListError(true); return; }
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.operations.every((operation) => operation.sourceId === sourceId && !["completed", "failed"].includes(operation.stage) &&
          !resolvedOperations.current.has(operation.operationId) &&
          (!knownOperations.current.has(operation.operationId) || sameOperation(operation, knownOperations.current.get(operation.operationId)!)) &&
          (operation.operationId !== submitted.current?.operationId || !!binding.current && matchesSubmission(operation, binding.current))) &&
        new Set(result.value.operations.map((operation) => operation.operationId)).size === result.value.operations.length) {
        for (const operation of result.value.operations) knownOperations.current.set(operation.operationId, { ...operation });
        setOperations(result.value.operations.map((operation) => ({ ...operation })));
      }
      else { setListError(true); }
    } catch { if (mounted.current && current === listVersion.current && backend === generation.current) { setListError(true); } }
    finally { if (mounted.current && current === listVersion.current && backend === generation.current) setListLoading(false); }
  };
  useEffect(() => { void loadMoves(); return () => { listVersion.current++; }; }, [client, workspaceId, sourceId, invalidation]);
  const [editorState, setEditorState] = useState({ revision: -1, observation: -1, lifetime: -1 });
  useEffect(() => {
    if (project) { setEditorState({ revision: projects?.revision ?? -1, observation: observationVersion.current, lifetime: sourceLifetime.current }); restoreInput.current = true; setDestination(project.categoryId ?? ""); if (!submitted.current) setMessage(null); input.current?.focus(); }
  }, [project]);
  useEffect(() => { onBlockedChange(pending || unresolved || reviewed !== null || operations.length > 0); }, [pending, unresolved, reviewed, operations, onBlockedChange]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.onBackendStatus((status) => {
      generation.current++; request.current++; busy.current = false; ready.current = status.state === "ready"; setPending(false);
      invalidateReview(); listVersion.current++; setListLoading(false); setListError(status.state !== "ready");
      if (status.state === "ready") void loadMoves();
      if (submitted.current) { if (binding.current) binding.current.uncertain = true; setUnresolved(true); setMessage("moveCategoryUncertain"); }
    });
    return () => { mounted.current = false; generation.current++; request.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  useEffect(() => {
    if (pending && project) cancel.current?.focus();
    if (!pending && restoreInput.current && project && !disabled && !unresolved && !input.current?.disabled) { input.current?.focus(); restoreInput.current = false; }
  }, [pending, project, disabled, unresolved, editorState]);
  const editorCurrent = () => !!projects && projects.revision >= minimumRevision.current && projects.revision === editorState.revision &&
    observationVersion.current === editorState.observation && sourceLifetime.current === editorState.lifetime;
  const available = !!projects && projects.workspaceId === workspaceId && projects.sourceId === sourceId && projects.configured && projects.mode === "grouped" &&
    ["ready", "empty"].includes(projects.state) && editorCurrent() && !!project &&
    projects.projects.some((row) => row.associationState === "active" && row.resolution === "active" && row.projectId === project.projectId && row.name === project.name && row.relativePath === project.relativePath && row.categoryId === project.categoryId);
  const destinationCategory = projects?.categories.find((category) => category.categoryId === destination);
  // Display paths explain the move; the service authorizes placement from IDs.
  const destinationPath = destinationCategory && project ? `${destinationCategory.relativePath}/${project.name}` : "";
  const review = async (operation: ProjectCategoryMoveOperation) => {
    if (busy.current || !ready.current || disabled || (unresolved && (binding.current?.uncertain || submitted.current?.operationId !== operation.operationId))) return;
    selectedReview.current = operation; setReviewed(operation); setPreview(null); previewBinding.current = null; setReviewMessage(null); setReviewLoading(true);
    const current = ++reviewVersion.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current, revision = minimumRevision.current;
    try {
      const result = await client.previewProjectCategoryMoveRecovery(workspaceId, operation.operationId);
      if (!mounted.current || current !== reviewVersion.current || backend !== generation.current || selectedReview.current !== operation) return;
      if (observed !== observationVersion.current || lifetime !== sourceLifetime.current || revision !== minimumRevision.current) { setReviewMessage("moveCategoryReviewStale"); return; }
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && sameOperation(result.value.operation, operation) &&
        result.value.operation.stage === operation.stage && result.value.operation.lastVerifiedPlacement === operation.lastVerifiedPlacement && result.value.operation.problem === operation.problem &&
        result.value.revision >= minimumRevision.current && !["completed", "failed"].includes(result.value.operation.stage) &&
        result.value.actions.every((action) => Object.hasOwn(actionLabels, action))) {
        setPreview(result.value); previewBinding.current = { observation: observed, lifetime, revision: result.value.revision, backend };
      } else setReviewMessage("moveCategoryReviewError");
    } catch { if (mounted.current && current === reviewVersion.current && backend === generation.current) setReviewMessage("moveCategoryReviewError"); }
    finally { if (mounted.current && current === reviewVersion.current && backend === generation.current) setReviewLoading(false); }
  };
  const accept = (result: ProjectCategoryMoveResult, status: boolean) => {
    const authored = submitted.current;
    if (!authored) return false;
    const operation = result.operation;
    if (status && !operation) return false;
    if (operation && (operation.sourceId !== sourceId || !binding.current || !matchesSubmission(operation, binding.current))) return false;
    if (result.outcome === "completed" || result.outcome === "unchanged") {
      if (!operation || operation.stage !== "completed" || operation.resultKind !== result.outcome || operation.completedRevision !== result.project.revision ||
        result.project.operationId !== authored.operationId || result.project.projectId !== authored.projectId || result.project.sourceId !== sourceId ||
        result.project.name !== binding.current?.project.name || result.project.relativePath !== operation.requestedRelativePath || result.project.categoryId !== operation.destinationCategoryId) return false;
      setMessage(result.project.revision < minimumRevision.current ? "moveCategoryNewer" : result.outcome === "unchanged" ? "moveCategoryUnchanged" : "moveCategorySaved");
      resolvedOperations.current.add(authored.operationId); setOperations((current) => current.filter((item) => item.operationId !== authored.operationId));
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false); closeReview(document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement)); void loadMoves(); onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement));
    } else if (result.outcome === "recoverable") {
      if (!operation || ["completed", "failed"].includes(operation.stage)) return false;
      if (binding.current) { binding.current.operation = { ...operation }; binding.current.uncertain = false; }
      invalidateReview(); setMessage("moveCategoryRecoverable"); setUnresolved(true); void loadMoves();
    }
    else if (result.outcome === "rejected") {
      if (operation && operation.stage !== "failed") return false;
      if (result.problem === "kept_original" && (!operation || operation.resultKind !== "rejected" || operation.problem !== "kept_original" || operation.lastVerifiedPlacement !== "original")) return false;
      resolvedOperations.current.add(authored.operationId); setOperations((current) => current.filter((item) => item.operationId !== authored.operationId));
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false);
      if (result.problem === "kept_original") {
        setMessage("moveCategoryKeptOriginal"); closeReview(document.activeElement === document.body || !!reviewRoot.current?.contains(document.activeElement)); void loadMoves(); onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement)); return true;
      }
      setMessage(
        ["occupied", "reserved_destination", "native_conflict"].includes(result.problem) ? "moveCategoryCollision" :
        ["stale_configuration", "filesystem_changed"].includes(result.problem) ? "moveCategoryStale" :
        ["source_unavailable", "category_unavailable", "project_unavailable", "unconfigured", "excluded", "archive", "permission_denied", "native_unavailable", "unsupported", "busy", "cross_device"].includes(result.problem) ? "moveCategoryUnavailable" : "moveCategoryFailed");
    }
    return true;
  };
  const bindOperation = (operation: ProjectCategoryMoveOperation) => {
    submitted.current = { workspaceId: operation.initiatingWorkspaceId, projectId: operation.projectId, operationId: operation.operationId, destinationCategoryId: operation.destinationCategoryId, expectedRevision: operation.expectedRevision };
    binding.current = { command: submitted.current, sourceId, project: { projectId: operation.projectId, name: operation.name, relativePath: operation.originalRelativePath, categoryId: operation.originalCategoryId }, requestedPath: operation.requestedRelativePath, operation: { ...operation }, uncertain: true };
    requests.set(sourceId, binding.current);
  };
  const run = async (status: boolean, action?: ProjectCategoryMoveRecoveryAction) => {
    if (busy.current || !ready.current || (status ? !submitted.current : action ? disabled || reviewLoading || !preview?.previewToken || !preview.actions.includes(action) : disabled || !available || !destinationCategory || unresolved || reviewed !== null || operations.length > 0)) return;
    if (action) {
      const state = previewBinding.current;
      if (!preview || !state || !selectedReview.current || !sameOperation(preview.operation, selectedReview.current) ||
        state.observation !== observationVersion.current || state.lifetime !== sourceLifetime.current || state.revision < minimumRevision.current || state.backend !== generation.current ||
        unresolved && (binding.current?.uncertain || submitted.current?.operationId !== preview.operation.operationId)) { invalidateReview(); return; }
      bindOperation(preview.operation);
    } else if (!status) {
      // Source refs advance before React renders disabled controls. An older
      // event handler must recheck them before authoring any operation ID.
      if (!editorCurrent()) { setMessage("moveCategoryStale"); return; }
      submitted.current = { workspaceId, projectId: project!.projectId, operationId: crypto.randomUUID(), destinationCategoryId: destination, expectedRevision: projects!.revision };
      binding.current = { command: submitted.current, sourceId, project: { ...project! }, requestedPath: destinationPath, uncertain: true };
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
      const result = await (status ? client.getProjectCategoryMove(workspaceId, authored.operationId) : action ? client.recoverProjectCategoryMove(workspaceId, authored.operationId, recoveryToken!, action) : client.moveProjectCategory(authored));
      if (!mounted.current || current !== request.current || backend !== generation.current || submitted.current !== authored) return;
      if (!result.ok && action && result.error.code === "stale_preview") {
        if (binding.current) binding.current.uncertain = false;
        setMessage("moveCategoryRecoverable"); setReviewMessage("moveCategoryReviewStale");
      } else if (!result.ok || !accept(result.value, status || !!action)) setMessage("moveCategoryUncertain");
      else if (observed !== observationVersion.current || lifetime !== sourceLifetime.current) {
        if (result.value.outcome === "completed" || result.value.outcome === "unchanged") setMessage("moveCategoryNewer");
        else if (result.value.outcome === "rejected" && result.value.problem !== "kept_original") setMessage("moveCategoryStale");
      }
    } catch { if (mounted.current && current === request.current && backend === generation.current) setMessage("moveCategoryUncertain"); }
    finally {
      if (mounted.current && current === request.current && backend === generation.current) {
        busy.current = false; restoreInput.current = document.activeElement === document.body || !!cancel.current?.parentElement?.contains(document.activeElement); setPending(false); onCompleted();
      }
    }
  };
  return <section ref={root} className="project-category-move" aria-label={t("moveCategory")} aria-busy={pending}>
    {project && <form onSubmit={(event) => { event.preventDefault(); void run(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Enter" && event.target === input.current) { event.preventDefault(); void run(false); }
      }}>
      <label htmlFor="project-category-move-destination">{t("moveCategoryDestination")}</label>
      <select ref={input} id="project-category-move-destination" value={destination} disabled={disabled || pending || unresolved || !available}
        onChange={(event) => setDestination(event.currentTarget.value)}>
        {projects?.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}
      </select>
      <dl><dt>{t("moveCategoryCurrentPlacement")}</dt><dd>{project.relativePath}</dd>
        <dt>{t("moveCategoryDestinationPlacement")}</dt><dd>{destinationPath}</dd></dl>
      <p>{t("moveCategoryHint")}</p>
      {!available && !pending && !unresolved && message !== "moveCategoryStale" && <StatusMessage kind="error" title={t("moveCategoryStale")} />}
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending || unresolved || !available || !destinationCategory || operations.length > 0}>{t("moveCategorySubmit")}</button>
        <button ref={cancel} type="button" className="workspace-button workspace-button--secondary" onClick={() => onClose()}>{t("cancelRenameWorkspace")}</button>
      </div>
      <p>{t("moveCategoryDismissHint")}</p>
    </form>}
    <section className="category-move-operations" aria-label={t("moveCategoryListTitle")} aria-busy={listLoading}>
      <h3>{t("moveCategoryListTitle")}</h3>
      {listLoading && <StatusMessage kind="info" title={t("moveCategoryListLoading")} />}
      {listError && <StatusMessage kind="error" title={t("moveCategoryListError")} />}
      {!listLoading && !listError && operations.length === 0 && <p>{t("moveCategoryListEmpty")}</p>}
      {operations.map((operation) => <div key={operation.operationId}>
        <dl><dt>{t("moveCategoryOriginalPlacement")}</dt><dd>{operation.originalRelativePath}</dd><dt>{t("moveCategoryDestinationPlacement")}</dt><dd>{operation.requestedRelativePath}</dd></dl>
        <p>{t(operation.stage === "uncertain" ? "moveCategoryOperationUncertain" : "moveCategoryOperationInterrupted")}</p>
        <OperationEvidence operation={operation} language={language} />
        {!submitted.current && <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || !ready.current}
          aria-label={`${t("moveCategoryStatus")}: ${operation.originalRelativePath}`}
          onClick={() => {
            if (busy.current || !ready.current || submitted.current || resolvedOperations.current.has(operation.operationId)) return;
            bindOperation(operation); void run(true);
          }}>{t("moveCategoryStatus")}</button>}
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || disabled || listLoading || listError || !ready.current || unresolved && (binding.current?.uncertain || submitted.current?.operationId !== operation.operationId)}
          onClick={(event) => { reviewTrigger.current = event.currentTarget; void review(operation); }}
          aria-label={`${t("moveCategoryReview")}: ${operation.originalRelativePath} → ${operation.requestedRelativePath}`}>{t("moveCategoryReview")}</button>
      </div>)}
      <button type="button" className="workspace-button workspace-button--secondary" disabled={listLoading || pending || !ready.current} onClick={() => void loadMoves()}>{t("moveCategoryListReload")}</button>
    </section>
    {reviewed && <section ref={reviewRoot} className="category-move-review" aria-labelledby="category-move-review-title" aria-busy={reviewLoading || pending}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeReview(); } }}>
      <h3 id="category-move-review-title" ref={reviewHeading} tabIndex={-1}>{t("moveCategoryReviewTitle")}</h3>
      <p>{t("moveCategoryReviewHint")}</p>
      <dl><dt>{t("moveCategoryOriginalPlacement")}</dt><dd>{reviewed.originalRelativePath}</dd><dt>{t("moveCategoryDestinationPlacement")}</dt><dd>{reviewed.requestedRelativePath}</dd></dl>
      <OperationEvidence operation={preview?.operation ?? reviewed} language={language} />
      {reviewLoading && <StatusMessage kind="info" title={t("moveCategoryReviewLoading")} />}
      {reviewMessage && <StatusMessage kind="error" title={t(reviewMessage)} />}
      {preview && <>
        <dl className="category-move-placements">
          <dt>{t("moveCategoryOriginalEvidence")}</dt><dd>{t(placementLabels[preview.originalState])}</dd>
          <dt>{t("moveCategoryDestinationEvidence")}</dt><dd>{t(placementLabels[preview.destinationState])}</dd>
        </dl>
        {preview.problem && <StatusMessage kind="error" title={t(problemLabels[preview.problem])} />}
        {(!preview.previewToken || preview.actions.length === 0) && <StatusMessage kind="error" title={t("moveCategoryRecoveryBlocked")} />}
        <div className="workspace-form-actions">{preview.previewToken && [...new Set(preview.actions)].map((action) =>
          <button key={action} type="button" className="workspace-button" disabled={disabled || pending || reviewLoading || !ready.current}
            onClick={() => void run(false, action)}>{t(actionLabels[action])}</button>)}</div>
      </>}
      <div className="workspace-form-actions">
        <button ref={reviewAgain} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || reviewLoading || !ready.current || unresolved && !!binding.current?.uncertain}
          onClick={() => void review(operations.find((operation) => operation.operationId === reviewed.operationId) ?? reviewed)}>{t("moveCategoryReviewAgain")}</button>
        <button ref={dismissReview} type="button" className="workspace-button workspace-button--secondary" onClick={() => closeReview()}>{t("moveCategoryReviewClose")}</button>
      </div>
    </section>}
    {unresolved && binding.current && !operations.some((operation) => operation.operationId === submitted.current?.operationId) &&
      <dl><dt>{t("moveCategoryOriginalPlacement")}</dt><dd>{binding.current.project.relativePath}</dd><dt>{t("moveCategoryDestinationPlacement")}</dt><dd>{binding.current.requestedPath}</dd></dl>}
    {unresolved && binding.current?.operation && !operations.some((operation) => operation.operationId === binding.current?.operation?.operationId) &&
      <OperationEvidence operation={binding.current.operation} language={language} />}
    {pending && <StatusMessage kind="info" title={t("moveCategoryPending")} />}
    {message && <StatusMessage kind={["moveCategorySaved", "moveCategoryUnchanged", "moveCategoryNewer", "moveCategoryRecoverable", "moveCategoryKeptOriginal"].includes(message) ? "info" : "error"} title={t(message)} />}
    {unresolved && <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || !ready.current}
      onClick={() => void run(true)}>{t("moveCategoryStatus")}</button>}
  </section>;
}
