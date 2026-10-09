import { useEffect, useRef, useState } from "react";
import type { ProjectRecoveryPreview, ProjectRecoveryTargetStatus } from "../../contracts/project-recovery.js";
import type { ProjectAssociationSummary, ProjectList } from "../../contracts/workspaces.js";
import type { Language } from "../../contracts/settings.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { EmptyStatePanel, StatusMessage } from "./bb-foundation.js";

const conflicts: Record<Exclude<ProjectRecoveryTargetStatus, "selectable">, TranslationKey> = {
  excluded: "recoveryExcluded", unresolved: "recoveryUnresolved", reserved_path: "recoveryReserved",
  native_conflict: "recoveryNativeConflict", category_unavailable: "recoveryCategoryUnavailable",
};
const sourceStates = {
  ready: "discoveryReady", empty: "discoveryEmpty", unavailable: "discoveryUnavailable", unreadable: "discoveryUnreadable",
  root_identity_conflict: "discoveryRootConflict", changed: "discoveryChanged",
} as const;

export function ProjectRecoveryPanel({ language, project, preview, selectedPath, loading, pending, error, stale, uncertain,
  onSelect, onConfirm, onRefresh, onCancel }: {
  language: Language; project: ProjectAssociationSummary; preview: ProjectRecoveryPreview | null; selectedPath: string | null;
  loading: boolean; pending: boolean; error: boolean; stale: boolean; uncertain: boolean;
  onSelect(path: string): void; onConfirm(): void; onRefresh(): void; onCancel(): void;
}) {
  const t = (key: TranslationKey) => translate(language, key);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = preview?.entries.find((entry) => entry.relativePath === selectedPath && entry.status === "selectable");
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="discovery-panel recovery-panel" aria-labelledby="recovery-title" aria-busy={loading || pending}
    onKeyDown={(event) => { if (event.key === "Escape" && !pending) { event.preventDefault(); onCancel(); } }}>
    <h3 id="recovery-title" ref={heading} tabIndex={-1}>{t("recoveryTitle")}</h3>
    <p>{t("recoveryDescription")}</p>
    <dl className="recovery-review">
      <dt>{t("projectName")}</dt><dd>{project.name}</dd>
      <dt>{t("recoveryPreviousPath")}</dt><dd>{project.relativePath}</dd>
      {selected && <><dt>{t("recoveryTargetPath")}</dt><dd>{selected.relativePath}</dd>
        <dt>{t("discoveryCategory")}</dt><dd>{selected.categoryPath ?? t("recoveryNoCategory")}</dd></>}
    </dl>
    {loading && <StatusMessage kind="info" title={t("recoveryLoading")} />}
    {pending && <StatusMessage kind="info" title={t("recoverySaving")} />}
    {error && <StatusMessage kind="error" title={t("recoveryError")} />}
    {stale && <StatusMessage kind="info" title={t("recoveryStale")} />}
    {uncertain && <StatusMessage kind="error" title={t("recoveryUncertain")} />}
    {preview && <>
      {!preview.previewToken && <StatusMessage kind="error" title={t(sourceStates[preview.state])} />}
      {preview.entries.length === 0 ? <EmptyStatePanel>{t("recoveryEmpty")}</EmptyStatePanel>
        : <fieldset className="recovery-candidates" disabled={loading || pending || !preview.previewToken}>
          <legend>{t("recoveryChoose")}</legend>
          {preview.entries.map((entry) => <label key={entry.relativePath}>
            <input type="radio" name="recovery-target" value={entry.relativePath} checked={selectedPath === entry.relativePath}
              disabled={entry.status !== "selectable"} onChange={() => onSelect(entry.relativePath)} />
            <span><span className="recovery-path">{entry.relativePath}</span>
              {entry.status !== "selectable" && <span className="discovery-reason">{t(conflicts[entry.status])}</span>}</span>
          </label>)}
        </fieldset>}
    </>}
    <div className="workspace-form-actions">
      <button type="button" className="workspace-button" disabled={loading || pending || !preview?.previewToken || !selected || stale || uncertain} onClick={onConfirm}>{t("recoveryConfirm")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={loading || pending} onClick={onRefresh}>{t("discoveryRefresh")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={onCancel}>{t("cancelRenameWorkspace")}</button>
    </div>
  </section>;
}

export function ProjectRecoveryController({ client, workspaceId, sourceId, project, minimumRevision, invalidation, language, disabled, onCommitted, onReload, onClose }: {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; project: ProjectAssociationSummary;
  minimumRevision: { current: number }; invalidation: number; language: Language; disabled: boolean;
  onCommitted(value: ProjectList): void; onReload(): void; onClose(): void;
}) {
  const [preview, setPreview] = useState<ProjectRecoveryPreview | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const version = useRef(0);
  const saving = useRef(false);
  const lastInvalidation = useRef(invalidation);
  const request = async () => {
    const current = ++version.current;
    setLoading(true); setPreview(null); setSelectedPath(null); setError(false); setStale(false); setUncertain(false);
    try {
      const result = await client.previewProjectRecovery(workspaceId, project.projectId);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.projectId === project.projectId && result.value.revision >= minimumRevision.current) setPreview(result.value);
      else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setLoading(false); }
  };
  useEffect(() => { void request(); return () => { version.current++; }; }, [client, workspaceId, sourceId, project.projectId]);
  useEffect(() => {
    if (lastInvalidation.current === invalidation) return;
    lastInvalidation.current = invalidation;
    // Our committed event may arrive before the command result.
    if (!saving.current) { version.current++; setLoading(false); setSelectedPath(null); setPreview(null); setStale(true); }
  }, [invalidation]);
  useEffect(() => {
    if (disabled && !saving.current) { version.current++; setLoading(false); setPreview(null); setSelectedPath(null); setStale(true); }
  }, [disabled]);
  const confirm = async () => {
    if (disabled || saving.current || loading || !preview?.previewToken || !selectedPath || preview.revision < minimumRevision.current) return;
    const current = ++version.current;
    saving.current = true; setPending(true); setError(false);
    try {
      const result = await client.reassociateProject(workspaceId, project.projectId, preview.previewToken, selectedPath);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.revision >= minimumRevision.current &&
        result.value.projects.some((row) => row.projectId === project.projectId && row.relativePath === selectedPath && row.resolution === "active")) {
        onCommitted(result.value); onClose();
      } else if (!result.ok && result.error.code === "stale_preview") {
        setStale(true); setPreview(null); setSelectedPath(null);
      } else if (!result.ok && result.error.code !== "service_unavailable") setError(true);
      else { setUncertain(true); setPreview(null); setSelectedPath(null); onReload(); }
    } catch {
      if (current === version.current) { setUncertain(true); setPreview(null); setSelectedPath(null); onReload(); }
    } finally { saving.current = false; if (current === version.current) setPending(false); }
  };
  return <ProjectRecoveryPanel language={language} project={project} preview={preview} selectedPath={selectedPath} loading={loading} pending={pending}
    error={error} stale={stale || disabled} uncertain={uncertain} onSelect={setSelectedPath} onConfirm={() => void confirm()}
    onRefresh={() => { if (!disabled) void request(); }} onCancel={() => { if (!saving.current) { version.current++; onClose(); } }} />;
}
