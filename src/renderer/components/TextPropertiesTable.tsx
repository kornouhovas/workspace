import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { ProjectSummary, CategoryProperty, CategorySummary } from "../../contracts/workspaces.js";
import type { TextPropertySnapshot } from "../../contracts/text-properties.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { TextPropertyCell } from "./TextPropertyCell.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  client: WorkspaceServiceClient;
  workspaceId: string;
  sourceId: string;
  projects: ProjectSummary[];
  categoryProperty?: CategoryProperty | null;
  categories?: CategorySummary[];
  language: Language;
  disabled: boolean;
}
export function TextPropertiesTable(props: Props) {
  return <TextPropertiesContent key={`${props.workspaceId}:${props.sourceId}`} {...props} />;
}
function TextPropertiesContent({ client, workspaceId, sourceId, projects, categoryProperty, categories = [], language, disabled }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const [snapshot, setSnapshot] = useState<TextPropertySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<{ propertyId: string | null; name: string; originalName: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"propertyValidation" | "propertySaveError" | "propertySaved" | "propertyNewerChange" | null>(null);
  const minimumRevision = useRef(0);
  const listVersion = useRef(0);
  const lifetime = useRef(0);
  const saving = useRef(false);
  const savedRevision = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const renameButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusTarget = useRef<string | null | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (snapshot && snapshot.revision > savedRevision.current) {
      setMessage((current) => current === "propertySaved" ? "propertyNewerChange" : current);
    }
  }, [snapshot?.revision]);
  useEffect(() => {
    if (draft) input.current?.focus();
    else if (focusTarget.current !== undefined) {
      (focusTarget.current === null ? trigger.current : renameButtons.current.get(focusTarget.current) ?? trigger.current)?.focus();
      focusTarget.current = undefined;
    }
  }, [draft?.propertyId, draft === null]);
  const accepts = (value: TextPropertySnapshot) => value.workspaceId === workspaceId && value.sourceId === sourceId && value.revision >= minimumRevision.current;
  const load = async () => {
    const current = ++listVersion.current;
    setLoading(true); setLoadError(false);
    try {
      const result = await client.listTextProperties(workspaceId);
      if (current !== listVersion.current) return;
      if (result.ok && accepts(result.value)) {
        minimumRevision.current = result.value.revision;
        setSnapshot(result.value);
      } else setLoadError(true);
    } catch { if (current === listVersion.current) setLoadError(true); }
    finally { if (current === listVersion.current) setLoading(false); }
  };
  useEffect(() => {
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (event.type !== "workspace.propertiesChanged" || event.sourceId !== sourceId || !event.workspaceIds.includes(workspaceId) || event.revision <= minimumRevision.current) return;
      minimumRevision.current = event.revision;
      void load();
    });
    void load();
    return () => { listVersion.current++; lifetime.current++; unsubscribe(); };
  }, [client, workspaceId, sourceId]);
  const cancel = () => {
    if (saving.current || !draft) return;
    focusTarget.current = draft.propertyId;
    setDraft(null); setMessage(null);
  };
  const save = async () => {
    if (!draft || saving.current || disabled) return;
    if (!draft.name.trim()) { setMessage("propertyValidation"); input.current?.focus(); return; }
    const current = lifetime.current;
    saving.current = true; setPending(true); setMessage(null);
    try {
      const result = draft.propertyId === null
        ? await client.createProperty(workspaceId, draft.name)
        : await client.renameProperty(workspaceId, draft.propertyId, draft.name);
      if (current !== lifetime.current) return;
      if (result.ok && result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
        savedRevision.current = result.value.snapshot.revision;
        if (accepts(result.value.snapshot)) {
          // Supersede older lists while preserving an own event-before-response success.
          listVersion.current++; setLoading(false); setLoadError(false);
          minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot);
          setMessage("propertySaved");
        } else setMessage("propertyNewerChange");
        focusTarget.current = draft.propertyId; setDraft(null);
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "propertyValidation" : "propertySaveError");
    } catch { if (current === lifetime.current) setMessage("propertySaveError"); }
    finally {
      if (current === lifetime.current) { saving.current = false; setPending(false); }
    }
  };
  const saveValue = async (projectId: string, propertyId: string, value: string | null) => {
    const current = lifetime.current;
    const result = await client.setTextValue(workspaceId, projectId, propertyId, value);
    if (current === lifetime.current && result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId && accepts(result.value.snapshot)) {
      listVersion.current++; setLoading(false); setLoadError(false);
      minimumRevision.current = result.value.snapshot.revision; setSnapshot(result.value.snapshot);
    }
    return result;
  };
  return <div className="text-properties" aria-busy={pending || loading}>
    {loading && <StatusMessage kind="info" title={t("propertiesLoading")} />}
    {loadError && <><StatusMessage kind="error" title={t("propertiesLoadError")} />
      <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading} onClick={() => void load()}>{t("propertiesRetry")}</button></>}
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || loading || loadError || draft !== null}
      onClick={() => { setMessage(null); setDraft({ propertyId: null, name: "", originalName: "" }); }}>{t("createTextProperty")}</button>
    {draft && <form className="property-form" onSubmit={(event) => { event.preventDefault(); void save(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
      <label htmlFor="property-name">{t("propertyName")}</label>
      <input ref={input} id="property-name" className="workspace-input" value={draft.name} disabled={disabled || pending}
        aria-invalid={message === "propertyValidation"} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} />
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending}>{t(pending ? "propertySaving" : "savePropertyName")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelRenameWorkspace")}</button>
      </div>
    </form>}
    {draft?.propertyId && !pending && snapshot?.definitions.find((property) => property.propertyId === draft.propertyId)?.name !== draft.originalName &&
      <StatusMessage kind="info" title={t("propertyExternalChange")} />}
    {message && <StatusMessage kind={message === "propertyValidation" || message === "propertySaveError" ? "error" : "info"} title={t(message)} />}
    {snapshot && snapshot.definitions.length === 0 && <p>{t("propertiesEmpty")}</p>}
    <div className="project-table-scroll">
      <table className="project-table" style={{ minWidth: `${Math.max(1, (snapshot?.definitions.length ?? 0) + 1 + (categoryProperty ? 1 : 0)) * 14}rem` }}><thead><tr><th scope="col">{t("projectName")}</th>
        {categoryProperty && <th key={categoryProperty.propertyId} scope="col">{categoryProperty.name ?? t("discoveryCategory")}</th>}
        {snapshot?.definitions.map((property) => <th scope="col" key={property.propertyId}>
          <span className="property-authored">{property.name}</span>
          <button type="button" ref={(element) => { if (element) renameButtons.current.set(property.propertyId, element); else renameButtons.current.delete(property.propertyId); }}
            className="workspace-button workspace-button--secondary property-rename" aria-label={`${t("renameProperty")}: ${property.name}`}
            disabled={disabled || draft !== null} onClick={() => { setMessage(null); setDraft({ propertyId: property.propertyId, name: property.name, originalName: property.name }); }}>{t("renameProperty")}</button>
        </th>)}
      </tr></thead><tbody>{projects.map((project) => <tr key={project.projectId}><td key="project-name">{project.name}</td>
        {categoryProperty && <td key={categoryProperty.propertyId}>{categories.find((category) => category.categoryId === project.categoryId)?.name}</td>}
        {snapshot?.definitions.map((property) => <td key={property.propertyId}>
          <TextPropertyCell workspaceId={workspaceId} sourceId={sourceId} projectId={project.projectId} propertyId={property.propertyId}
            revision={snapshot.revision} minimumRevision={minimumRevision}
            projectName={project.name} propertyName={property.name} language={language} disabled={disabled || loadError || draft !== null}
            value={snapshot.values.find((entry) => entry.projectId === project.projectId && entry.propertyId === property.propertyId)?.value ?? null}
            onSave={(value) => saveValue(project.projectId, property.propertyId, value)} />
        </td>)}
      </tr>)}</tbody></table>
    </div>
  </div>;
}
