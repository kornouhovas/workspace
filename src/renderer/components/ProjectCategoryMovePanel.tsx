import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectList, ProjectSummary } from "../../contracts/workspaces.js";
import type { ProjectCategoryMoveResult } from "../../contracts/project-category-move.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; language: Language;
  project: ProjectSummary | null; projects: ProjectList | null; disabled: boolean;
  minimumRevision: { current: number }; observationVersion: { current: number }; sourceLifetime: { current: number };
  onClose(restoreFocus?: boolean): void; onCompleted(): void; onBlockedChange(blocked: boolean): void;
}
export function ProjectCategoryMovePanel(props: Props) {
  return <CategoryMoveContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function CategoryMoveContent({ client, workspaceId, sourceId, language, project, projects, disabled, minimumRevision, observationVersion, sourceLifetime, onClose, onCompleted, onBlockedChange }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const [destination, setDestination] = useState("");
  const [pending, setPending] = useState(false);
  const [unresolved, setUnresolved] = useState(false);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const [editorState, setEditorState] = useState({ revision: -1, observation: -1, lifetime: -1 });
  const select = useRef<HTMLSelectElement>(null), cancel = useRef<HTMLButtonElement>(null), root = useRef<HTMLElement>(null);
  const busy = useRef(false), mounted = useRef(true), generation = useRef(0), restoreInput = useRef(false);
  useEffect(() => {
    if (project) {
      setDestination(project.categoryId ?? "");
      setEditorState({ revision: projects?.revision ?? -1, observation: observationVersion.current, lifetime: sourceLifetime.current });
      if (!unresolved) setMessage(null);
      restoreInput.current = true;
    }
  }, [project]);
  useEffect(() => { onBlockedChange(pending || unresolved); }, [pending, unresolved, onBlockedChange]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = client.onBackendStatus(() => {
      generation.current++;
      if (busy.current) { busy.current = false; setPending(false); setUnresolved(true); setMessage("moveCategoryUncertain"); }
    });
    return () => { mounted.current = false; generation.current++; unsubscribe(); };
  }, [client]);
  useEffect(() => {
    if (pending && project) cancel.current?.focus();
    else if (restoreInput.current && project && !disabled && !unresolved && !select.current?.disabled) {
      select.current?.focus(); restoreInput.current = false;
    }
  }, [pending, project, disabled, unresolved, editorState]);
  const available = !!project && !!projects && projects.workspaceId === workspaceId && projects.sourceId === sourceId &&
    projects.configured && projects.mode === "grouped" && ["ready", "empty"].includes(projects.state) &&
    projects.revision >= minimumRevision.current && projects.revision === editorState.revision &&
    observationVersion.current === editorState.observation && sourceLifetime.current === editorState.lifetime &&
    projects.projects.some((row) => row.projectId === project.projectId && row.associationState === "active" && row.resolution === "active" &&
      row.name === project.name && row.relativePath === project.relativePath && row.categoryId === project.categoryId);
  const destinationCategory = projects?.categories.find((category) => category.categoryId === destination);
  // Relative paths explain the effect only. The command contains IDs and a revision;
  // the service alone resolves and authorizes the actual filesystem placement.
  const destinationPath = destinationCategory && project ? `${destinationCategory.relativePath}/${project.name}` : "";
  const submit = async () => {
    if (busy.current || disabled || !available || unresolved || !destinationCategory || !project || !projects) return;
    const command = { workspaceId, projectId: project.projectId, operationId: crypto.randomUUID(), destinationCategoryId: destination, expectedRevision: projects.revision };
    const original = { ...project }, requestedPath = destinationPath;
    const backend = generation.current, observed = observationVersion.current, lifetime = sourceLifetime.current;
    busy.current = true; setPending(true); setUnresolved(true); setMessage(null);
    const accepts = (result: ProjectCategoryMoveResult) => {
      const operation = result.operation;
      if (operation && (operation.operationId !== command.operationId || operation.sourceId !== sourceId ||
        operation.initiatingWorkspaceId !== workspaceId || operation.projectId !== original.projectId || operation.name !== original.name ||
        operation.originalCategoryId !== original.categoryId || operation.destinationCategoryId !== command.destinationCategoryId ||
        operation.originalRelativePath !== original.relativePath || operation.requestedRelativePath !== requestedPath || operation.expectedRevision !== command.expectedRevision)) return false;
      if (result.outcome === "completed" || result.outcome === "unchanged") {
        if (!operation || operation.stage !== "completed" || operation.resultKind !== result.outcome ||
          operation.completedRevision !== result.project.revision || result.project.operationId !== command.operationId ||
          result.project.sourceId !== sourceId || result.project.projectId !== original.projectId || result.project.name !== original.name ||
          result.project.categoryId !== command.destinationCategoryId || result.project.relativePath !== requestedPath) return false;
        setUnresolved(false);
        setMessage(result.project.revision < minimumRevision.current || observed !== observationVersion.current || lifetime !== sourceLifetime.current
          ? "moveCategoryNewer" : result.outcome === "unchanged" ? "moveCategoryUnchanged" : "moveCategorySaved");
        onClose(document.activeElement === document.body || !!root.current?.contains(document.activeElement));
      } else if (result.outcome === "recoverable") {
        if (!operation || ["completed", "failed"].includes(operation.stage)) return false;
        setMessage("moveCategoryRecoverable");
      } else if (result.outcome === "rejected") {
        if (operation && operation.stage !== "failed") return false;
        setUnresolved(false);
        setMessage(["occupied", "reserved_destination", "native_conflict"].includes(result.problem) ? "moveCategoryCollision" :
          ["stale_configuration", "filesystem_changed"].includes(result.problem) ? "moveCategoryStale" :
          ["source_unavailable", "category_unavailable", "project_unavailable", "unconfigured", "excluded", "archive", "permission_denied", "native_unavailable", "busy", "cross_device", "unsupported"].includes(result.problem) ? "moveCategoryUnavailable" : "moveCategoryFailed");
      }
      return true;
    };
    try {
      const result = await client.moveProjectCategory(command);
      if (!mounted.current || backend !== generation.current) return;
      if (!result.ok || !accepts(result.value)) setMessage("moveCategoryUncertain");
      // Reload actual placement instead of painting a potentially older receipt.
      onCompleted();
    } catch {
      if (mounted.current && backend === generation.current) { setMessage("moveCategoryUncertain"); onCompleted(); }
    } finally {
      if (mounted.current && backend === generation.current) {
        busy.current = false; restoreInput.current = document.activeElement === document.body || !!root.current?.contains(document.activeElement); setPending(false);
      }
    }
  };
  return <section ref={root} className="project-category-move" aria-label={t("moveCategory")} aria-busy={pending}>
    {project && <form onSubmit={(event) => { event.preventDefault(); void submit(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Enter" && event.target === select.current) { event.preventDefault(); void submit(); }
      }}>
      <label htmlFor="project-category-move-destination">{t("moveCategoryDestination")}</label>
      <select ref={select} id="project-category-move-destination" value={destination} disabled={disabled || pending || unresolved || !available}
        onChange={(event) => setDestination(event.currentTarget.value)}>
        {projects?.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}
      </select>
      <dl><dt>{t("moveCategoryCurrentPlacement")}</dt><dd>{project.relativePath}</dd>
        <dt>{t("moveCategoryDestinationPlacement")}</dt><dd>{destinationPath}</dd></dl>
      <p>{t("moveCategoryHint")}</p>
      {!available && !pending && !unresolved && message !== "moveCategoryStale" && <StatusMessage kind="error" title={t("moveCategoryStale")} />}
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending || unresolved || !available || !destinationCategory}>{t("moveCategorySubmit")}</button>
        <button ref={cancel} type="button" className="workspace-button workspace-button--secondary" onClick={() => onClose()}>{t("cancelRenameWorkspace")}</button>
      </div>
      <p>{t("moveCategoryDismissHint")}</p>
    </form>}
    {pending && <StatusMessage kind="info" title={t("moveCategoryPending")} />}
    {message && <StatusMessage kind={["moveCategorySaved", "moveCategoryUnchanged", "moveCategoryNewer", "moveCategoryRecoverable"].includes(message) ? "info" : "error"} title={t(message)} />}
  </section>;
}
