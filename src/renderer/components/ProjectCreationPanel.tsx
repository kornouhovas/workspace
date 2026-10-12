import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectList } from "../../contracts/workspaces.js";
import type { ProjectCreationOperation, ProjectCreationResult, ProjectCreationRecoveryPreview, ProjectCreationRecoveryAction } from "../../contracts/project-creation.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; language: Language;
  projects: ProjectList | null; disabled: boolean; invalidation: number;
  minimumRevision: { current: number }; observationVersion: { current: number };
  onCompleted(): void;
  onBlockedChange?(blocked: boolean): void;
}
const actions: Record<ProjectCreationRecoveryAction, TranslationKey> = {
  retry_missing: "creationRetryMissing", complete_recorded: "creationCompleteRecorded", associate_reviewed: "creationAssociateReviewed",
};
export function ProjectCreationPanel(props: Props) {
  return <CreationContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function CreationContent({ client, workspaceId, sourceId, language, projects, disabled, invalidation, minimumRevision, observationVersion, onCompleted, onBlockedChange }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [categoryId, setCategoryId] = useState("");
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [listError, setListError] = useState(false);
  const [operations, setOperations] = useState<ProjectCreationOperation[]>([]);
  const originalRequest = useRef<Parameters<WorkspaceServiceClient["createProject"]>[0] | null>(null);
  const [unknownId, setUnknownId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProjectCreationRecoveryPreview | null>(null);
  useEffect(() => { onBlockedChange?.(pending || unknownId !== null || operations.length > 0); }, [pending, unknownId, operations, onBlockedChange]);
  useEffect(() => () => { onBlockedChange?.(false); }, [onBlockedChange]);
  const reviewing = useRef(false);
  const request = useRef(0), lists = useRef(0), busy = useRef(false), mounted = useRef(true);
  const generation = useRef(0), ready = useRef(true), trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null);
  const restoreInputFocus = useRef(false);
  const formCancel = useRef<HTMLButtonElement>(null), pendingFocus = useRef(false);
  const reviewReturnFocus = useRef(false), reviewCancel = useRef<HTMLButtonElement>(null), reviewHeading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false), root = useRef<HTMLElement>(null);
  const lastInvalidation = useRef(invalidation);
  const previewVersion = useRef(0), previewObservation = useRef(0);
  const load = async () => {
    const current = ++lists.current, backend = generation.current, observed = observationVersion.current;
    setLoading(true);
    try {
      const result = await client.listProjectCreations(workspaceId);
      if (!mounted.current || current !== lists.current || backend !== generation.current || observed !== observationVersion.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.operations.every((operation) => operation.sourceId === sourceId)) {
        setOperations(result.value.operations.filter((operation) => operation.stage !== "completed" && operation.stage !== "failed"));
        setListError(false);
      } else setListError(true);
    } catch { if (mounted.current && current === lists.current && backend === generation.current && observed === observationVersion.current) setListError(true); }
    finally { if (mounted.current && current === lists.current && backend === generation.current) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.onBackendStatus((status) => {
      generation.current++; request.current++; lists.current++; busy.current = false; reviewing.current = false;
      ready.current = status.state === "ready"; setPending(false); setPreview(null);
      if (ready.current) void load();
      else setMessage("creationUncertain");
    });
    void load();
    return () => { mounted.current = false; request.current++; lists.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  useEffect(() => {
    if (lastInvalidation.current === invalidation) return;
    lastInvalidation.current = invalidation; previewVersion.current++; setPreview(null); void load();
  }, [invalidation]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open && !pending && !disabled && restoreFocus.current) { (trigger.current?.disabled ? root.current : trigger.current)?.focus(); restoreFocus.current = false; }
  }, [open, pending, disabled]);
  useEffect(() => {
    if (!pending && restoreInputFocus.current) {
      if (open && !disabled) (input.current?.disabled ? root.current : input.current)?.focus();
      restoreInputFocus.current = false;
    }
  }, [pending, open, disabled]);
  useEffect(() => {
    if (pending && reviewing.current) reviewCancel.current?.focus();
    else if (pending && open && pendingFocus.current) formCancel.current?.focus();
    if (preview && root.current?.contains(document.activeElement)) reviewHeading.current?.focus();
  }, [pending, preview, open]);
  useEffect(() => {
    if (!pending && !disabled && reviewReturnFocus.current) {
      (trigger.current?.disabled ? root.current : trigger.current)?.focus(); reviewReturnFocus.current = false;
    }
  }, [pending, preview, disabled]);
  const dismissReview = () => {
    if (reviewing.current) { request.current++; reviewing.current = false; busy.current = false; setPending(false); }
    reviewReturnFocus.current = true; setPreview(null);
  };
  const close = (focus = true) => {
    // Closing only dismisses the form. The accepted command may still create a folder.
    restoreFocus.current = focus; setOpen(false); setPreview(null);
  };
  const accept = (value: ProjectCreationResult, operationId: string) => {
    if (value.operation && (value.operation.operationId !== operationId || value.operation.sourceId !== sourceId)) return false;
    if (value.outcome === "completed" && (value.project.sourceId !== sourceId || value.project.operationId !== operationId || value.project.projectId !== value.operation.projectId)) return false;
    if (value.operation) {
      lists.current++; setLoading(false);
      setOperations((current) => [...current.filter((operation) => operation.operationId !== operationId),
        ...(["completed", "failed"].includes(value.operation!.stage) ? [] : [value.operation!])]);
    }
    const resolvesDraft = !originalRequest.current || originalRequest.current.operationId === operationId;
    if (originalRequest.current?.operationId === operationId) originalRequest.current = null;
    setUnknownId((current) => current === operationId ? null : current); setPreview(null);
    if (value.outcome === "completed") {
      setMessage("creationSaved");
      if (resolvesDraft) { setName(""); close(restoreFocus.current || !!root.current?.contains(document.activeElement)); }
      onCompleted();
    }
    else if (value.outcome === "recoverable") setMessage("creationRecoverable");
    else setMessage(value.problem === "invalid_name" ? "creationInvalid" :
      ["occupied", "case_alias", "reserved_destination", "native_conflict"].includes(value.problem) ? "creationCollision" :
      ["source_unavailable", "category_unavailable", "unconfigured", "stale_configuration", "permission_denied"].includes(value.problem) ? "creationUnavailable" : "creationFailed");
    return true;
  };
  const run = async (operationId: string, command: () => ReturnType<WorkspaceServiceClient["getProjectCreation"]>) => {
    if (busy.current || disabled || !ready.current) return;
    pendingFocus.current = !!root.current?.contains(document.activeElement);
    busy.current = true; setPending(true); setMessage(null); setUnknownId((current) => current ?? operationId);
    const current = ++request.current, backend = generation.current;
    try {
      const result = await command();
      if (!mounted.current || current !== request.current || backend !== generation.current) return;
      if (!result.ok || !accept(result.value, operationId)) setMessage("creationUncertain");
    } catch { if (mounted.current && current === request.current && backend === generation.current) setMessage("creationUncertain"); }
    finally {
      if (mounted.current && current === request.current && backend === generation.current) { busy.current = false; setPending(false); if (open && (document.activeElement === document.body || root.current?.contains(document.activeElement))) restoreInputFocus.current = true; }
    }
  };
  const available = projects?.configured && projects.mode && ["ready", "empty"].includes(projects.state) && projects.revision >= minimumRevision.current;
  const categoryAvailable = projects?.mode !== "grouped" || projects.categories.some((category) => category.categoryId === categoryId);
  const review = async (operationId: string) => {
    if (busy.current || disabled || !ready.current) return;
    busy.current = true; reviewing.current = true; setPending(true); setPreview(null); setMessage(null);
    const current = ++request.current, backend = generation.current, version = previewVersion.current, observed = observationVersion.current;
    try {
      const result = await client.previewProjectCreationRecovery(workspaceId, operationId);
      if (!mounted.current || current !== request.current || backend !== generation.current) return;
      if (version === previewVersion.current && observed === observationVersion.current && result.ok &&
        result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.operation.operationId === operationId &&
        result.value.operation.sourceId === sourceId && result.value.revision >= minimumRevision.current) {
        previewObservation.current = observed; setPreview(result.value);
      } else setMessage("creationReviewChanged");
    } catch { if (mounted.current && current === request.current && backend === generation.current) setMessage("creationFailed"); }
    finally { if (mounted.current && current === request.current && backend === generation.current) { busy.current = false; reviewing.current = false; setPending(false); } }
  };
  return <section ref={root} tabIndex={-1} className="project-creation" aria-label={t("createProject")} aria-busy={pending} onKeyDown={(event) => {
      if (event.key === "Escape" && (preview || reviewing.current)) { event.preventDefault(); dismissReview(); }
    }}>
    <button ref={trigger} type="button" className="workspace-button" disabled={disabled || pending || !available || (projects?.mode === "grouped" && !projects.categories.length)}
      onClick={() => { setOpen(true); setMessage(null); }}>{t("createProject")}</button>
    {!projects?.configured && <p>{t("creationUnconfigured")}</p>}
    {projects?.configured && !available && <p>{t("creationUnavailable")}</p>}
    {available && projects?.mode === "grouped" && !projects.categories.length && <p>{t("creationNoCategory")}</p>}
    {available && projects?.projects.length === 0 && <p>{t("creationEmpty")}</p>}
    {open && <form onSubmit={(event) => {
      event.preventDefault();
      if (!available || !categoryAvailable || busy.current || unknownId) return;
      if (!name.length) { setMessage("creationInvalid"); input.current?.focus(); return; }
      const operationId = crypto.randomUUID();
      const common = { workspaceId, operationId, name, expectedRevision: projects.revision };
      const authoredRequest: Parameters<WorkspaceServiceClient["createProject"]>[0] = projects.mode === "grouped" ? { ...common, mode: "grouped", categoryId } : { ...common, mode: "direct" };
      originalRequest.current = authoredRequest;
      void run(operationId, () => client.createProject(authoredRequest));
    }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <label htmlFor="project-creation-name">{t("creationName")}</label>
      <input ref={input} id="project-creation-name" className="workspace-input" value={name} disabled={disabled || pending || !!unknownId}
        onChange={(event) => setName(event.currentTarget.value)} aria-invalid={message === "creationInvalid"} />
      {projects?.mode === "grouped" && <label>{t("creationCategory")}
        <select value={categoryId} disabled={disabled || pending || !!unknownId} onChange={(event) => setCategoryId(event.currentTarget.value)}>
          <option value="">{t("creationChooseCategory")}</option>
          {projects.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}
        </select>
      </label>}
      <p>{t(projects?.mode === "grouped" ? "creationGroupedHint" : "creationDirectHint")}</p>
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending || !!unknownId || !available || !categoryAvailable}>{t("creationSubmit")}</button>
        <button ref={formCancel} type="button" className="workspace-button workspace-button--secondary" onClick={() => close()}>{t("cancelRenameWorkspace")}</button>
      </div>
      <p>{t("creationCancelHint")}</p>
    </form>}
    {pending && <StatusMessage kind="info" title={t("creationPending")} />}
    {pending && reviewing.current && <button ref={reviewCancel} type="button" className="workspace-button workspace-button--secondary" onClick={dismissReview}>{t("cancelRenameWorkspace")}</button>}
    {message && <StatusMessage kind={message === "creationSaved" || message === "creationRecoverable" ? "info" : "error"} title={t(message)} />}
    {listError && <StatusMessage kind="error" title={t("creationListError")} />}
    {unknownId && !operations.some((operation) => operation.operationId === unknownId) && <div>
      <p>{t("creationUncertain")}</p><button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending}
        onClick={() => void run(unknownId, () => client.getProjectCreation(workspaceId, unknownId))}>{t("creationStatus")}</button>
    </div>}
    {unknownId && originalRequest.current?.operationId === unknownId && <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || !ready.current}
      onClick={() => {
        // Reconcile exactly the accepted payload, including its original revision.
        // No reconnect/list/cancel path replays it or allocates a replacement ID.
        const authoredRequest = originalRequest.current;
        if (authoredRequest?.operationId === unknownId) void run(unknownId, () => client.createProject(authoredRequest));
      }}>{t("creationRetryRequest")}</button>}
    <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || pending} onClick={() => void load()}>{t("creationReload")}</button>
    {operations.length > 0 && <div><h4>{t("creationOutstanding")}</h4><p>{t("creationRecoverable")}</p>
      <ul>{operations.map((operation) => <li key={operation.operationId}>
        <span className="property-authored">{operation.relativePath}</span>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending}
          onClick={() => void run(operation.operationId, () => client.getProjectCreation(workspaceId, operation.operationId))}>{t("creationStatus")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} onClick={() => void review(operation.operationId)}>{t("creationReview")}</button>
      </li>)}</ul>
    </div>}
    {preview && <div className="creation-review">
      <h4 ref={reviewHeading} tabIndex={-1}>{t("creationReview")}</h4><p className="property-authored">{preview.operation.relativePath}</p>
      <p>{t(({ missing: "creationReviewMissing", recorded: "creationReviewRecorded", unverified: "creationOwnershipWarning", replaced: "creationReviewReplaced", link: "creationReviewLink", unavailable: "creationUnavailable", conflicting: "creationCollision" } as const)[preview.destinationState])}</p>
      {!preview.actions.length && <p>{t("creationRecoveryBlocked")}</p>}
      {preview.actions.map((action) => <button key={action} type="button" className="workspace-button" disabled={disabled || pending || !preview.previewToken}
        onClick={() => {
          if (!preview.previewToken || preview.revision < minimumRevision.current || previewObservation.current !== observationVersion.current) {
            setPreview(null); setMessage("creationReviewChanged"); return;
          }
          void run(preview.operation.operationId, () => client.recoverProjectCreation(workspaceId, preview.operation.operationId, preview.previewToken!, action));
        }}>{t(actions[action])}</button>)}
      <button type="button" className="workspace-button workspace-button--secondary" onClick={dismissReview}>{t("cancelRenameWorkspace")}</button>
    </div>}
  </section>;
}
