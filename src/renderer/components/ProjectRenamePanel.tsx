import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectList, ProjectSummary } from "../../contracts/workspaces.js";
import type { ProjectRenameResult } from "../../contracts/project-rename.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

type RenameCommand = Parameters<WorkspaceServiceClient["renameProject"]>[0];
interface SubmittedRename { command: RenameCommand; project: ProjectSummary; mode: ProjectList["mode"] }
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
  minimumRevision: { current: number }; observationVersion: { current: number }; sourceLifetime: { current: number };
  onClose(restoreFocus?: boolean): void; onCompleted(): void; onBlockedChange(blocked: boolean): void;
}
export function ProjectRenamePanel(props: Props) {
  return <RenameContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function RenameContent({ client, workspaceId, sourceId, language, project, projects, disabled, minimumRevision, observationVersion, sourceLifetime, onClose, onCompleted, onBlockedChange }: Props) {
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
  const [editorState, setEditorState] = useState({ revision: -1, observation: -1, lifetime: -1 });
  useEffect(() => {
    if (project) { setEditorState({ revision: projects?.revision ?? -1, observation: observationVersion.current, lifetime: sourceLifetime.current }); restoreInput.current = true; setName(project.name); if (!submitted.current) setMessage(null); input.current?.focus(); }
  }, [project]);
  useEffect(() => { onBlockedChange(pending || unresolved); }, [pending, unresolved, onBlockedChange]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.onBackendStatus((status) => {
      generation.current++; request.current++; busy.current = false; ready.current = status.state === "ready"; setPending(false);
      if (submitted.current) { setUnresolved(true); setMessage("renameUncertain"); }
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
  const accept = (result: ProjectRenameResult, status: boolean) => {
    const authored = submitted.current;
    if (!authored) return false;
    const operation = result.operation;
    if (status && !operation) return false;
    if (operation && (operation.operationId !== authored.operationId || operation.projectId !== authored.projectId || operation.sourceId !== sourceId ||
      operation.initiatingWorkspaceId !== authored.workspaceId || operation.name !== authored.name || operation.expectedRevision !== authored.expectedRevision || operation.originalName !== binding.current?.project.name ||
      operation.originalRelativePath !== binding.current?.project.relativePath || operation.categoryId !== binding.current?.project.categoryId || operation.mode !== binding.current?.mode)) return false;
    if (result.outcome === "completed" || result.outcome === "unchanged") {
      if (!operation || operation.stage !== "completed" || operation.resultKind !== result.outcome || operation.completedRevision !== result.project.revision ||
        result.project.operationId !== authored.operationId || result.project.projectId !== authored.projectId || result.project.sourceId !== sourceId ||
        result.project.name !== authored.name || result.project.relativePath !== operation.requestedRelativePath || result.project.categoryId !== operation.categoryId) return false;
      setMessage(result.project.revision < minimumRevision.current ? "renameNewer" : result.outcome === "unchanged" ? "renameUnchanged" : "renameSaved");
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false); onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement)); onCompleted();
    } else if (result.outcome === "recoverable") { setMessage("renameRecoverable"); setUnresolved(true); }
    else if (result.outcome === "rejected") {
      if (operation && operation.stage !== "failed") return false;
      requests.delete(sourceId); binding.current = null; submitted.current = null; setUnresolved(false);
      setMessage(result.problem === "invalid_name" ? "renameInvalid" :
        ["occupied", "reserved_destination", "native_conflict"].includes(result.problem) ? "renameCollision" :
        ["stale_configuration", "filesystem_changed"].includes(result.problem) ? "renameStale" :
        ["source_unavailable", "category_unavailable", "project_unavailable", "unconfigured", "excluded", "archive", "permission_denied", "native_unavailable", "unsupported", "busy", "cross_device"].includes(result.problem) ? "renameUnavailable" : "renameFailed");
    }
    return true;
  };
  const run = async (status: boolean) => {
    if (busy.current || !ready.current || (status ? !submitted.current : disabled || !available || unresolved)) return;
    if (!status) {
      submitted.current = { workspaceId, projectId: project!.projectId, operationId: crypto.randomUUID(), name, expectedRevision: projects!.revision };
      binding.current = { command: submitted.current, project: { ...project! }, mode: projects!.mode };
      requests.set(sourceId, binding.current);
    }
    const authored = submitted.current!;
    busy.current = true; setPending(true); setUnresolved(true); setMessage(null);
    const current = ++request.current, backend = generation.current;
    const observed = observationVersion.current, lifetime = sourceLifetime.current;
    try {
      const result = await (status ? client.getProjectRename(workspaceId, authored.operationId) : client.renameProject(authored));
      if (!mounted.current || current !== request.current || backend !== generation.current || submitted.current !== authored) return;
      if (!result.ok || !accept(result.value, status)) setMessage("renameUncertain");
      else if (observed !== observationVersion.current || lifetime !== sourceLifetime.current) {
        if (result.value.outcome === "completed" || result.value.outcome === "unchanged") setMessage("renameNewer");
        else if (result.value.outcome === "rejected") setMessage("renameStale");
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
    {pending && <StatusMessage kind="info" title={t("renamePending")} />}
    {message && <StatusMessage kind={["renameSaved", "renameUnchanged", "renameNewer", "renameRecoverable"].includes(message) ? "info" : "error"} title={t(message)} />}
    {unresolved && <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || !ready.current}
      onClick={() => void run(true)}>{t("renameStatus")}</button>}
  </section>;
}
