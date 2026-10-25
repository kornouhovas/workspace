import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";
import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { CategoryProperty, CategoryPropertySnapshot } from "../../contracts/workspaces.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { categoryPropertyName, translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

export interface CategoryLabelDraft { name: string; originalRevision: number }

interface Props {
  preservedDraft?: CategoryLabelDraft | null;
  onDraftChange?(draft: CategoryLabelDraft | null): void;
  client: WorkspaceServiceClient;
  workspaceId: string;
  sourceId: string;
  property: CategoryProperty;
  discoveryRevision?: number;
  minimumDiscoveryRevision?: { current: number };
  revision: number;
  minimumRevision: { current: number };
  onCommitted(snapshot: CategoryPropertySnapshot): void;
  language: Language;
  disabled: boolean;
}
export function CategoryPropertyHeader({ client, workspaceId, sourceId, property, revision, minimumRevision, onCommitted, language, disabled, preservedDraft, onDraftChange, discoveryRevision = 0, minimumDiscoveryRevision }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const name = categoryPropertyName(property, language);
  const [draft, setDraft] = useState<string | null>(preservedDraft?.name ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"categoryPropertyValidation" | "categoryPropertySaveError" | "categoryPropertySaved" | "categoryPropertyNewerChange" | null>(null);
  const originalRevision = useRef(preservedDraft?.originalRevision ?? revision);
  const savedRevision = useRef(0);
  const lifetime = useRef(0);
  const saving = useRef(false);
  const restoreFocus = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const restoredDraft = useRef(preservedDraft !== undefined && preservedDraft !== null);
  const editing = draft !== null;
  const updateDraft = (name: string | null) => {
    setDraft(name);
    onDraftChange?.(name === null ? null : { name, originalRevision: originalRevision.current });
  };
  useEffect(() => {
    if (editing && (!restoredDraft.current || document.activeElement === document.body)) input.current?.focus();
    restoredDraft.current = false;
    if (!editing && restoreFocus.current) { trigger.current?.focus(); restoreFocus.current = false; }
  }, [editing]);
  useEffect(() => () => { lifetime.current++; }, []);
  useEffect(() => {
    if (minimumRevision.current > savedRevision.current) setMessage((current) => current === "categoryPropertySaved" ? "categoryPropertyNewerChange" : current);
  }, [revision, minimumRevision.current]);
  const cancel = () => {
    if (saving.current) return;
    restoreFocus.current = true; updateDraft(null); setMessage(null);
  };
  const save = async () => {
    if (draft === null || saving.current || disabled) return;
    if (!draft.trim()) { setMessage("categoryPropertyValidation"); input.current?.focus(); return; }
    const current = lifetime.current;
    saving.current = true; setPending(true); setMessage(null);
    try {
      const result = await client.renameCategoryProperty(workspaceId, property.propertyId, draft);
      if (current !== lifetime.current || (minimumDiscoveryRevision && minimumDiscoveryRevision.current > discoveryRevision)) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId &&
        result.value.propertyId === property.propertyId && result.value.name === draft && Number.isSafeInteger(result.value.revision) && result.value.revision >= 0) {
        savedRevision.current = result.value.revision;
        onCommitted(result.value);
        setMessage(result.value.revision < minimumRevision.current ? "categoryPropertyNewerChange" : "categoryPropertySaved");
        restoreFocus.current = true; updateDraft(null);
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "categoryPropertyValidation" : "categoryPropertySaveError");
    } catch { if (current === lifetime.current) setMessage("categoryPropertySaveError"); }
    finally { if (current === lifetime.current) { saving.current = false; setPending(false); } }
  };
  return <div className="category-property-header" aria-busy={pending}>
    <span className="property-authored">{name}</span>
    <Hint label={`${t("renameCategoryProperty")}: ${name}`}><button ref={trigger} type="button" className="workspace-button workspace-button--secondary property-rename"
      aria-label={`${t("renameCategoryProperty")}: ${name}`} disabled={disabled || editing}
      onClick={() => { originalRevision.current = revision; updateDraft(name); setMessage(null); }}><Icon name="edit" /></button></Hint>
    {editing && <form className="property-form" onSubmit={(event) => { event.preventDefault(); void save(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
      <label htmlFor={id}>{t("categoryPropertyName")}</label>
      <input ref={input} id={id} className="workspace-input" value={draft} disabled={disabled || pending}
        aria-invalid={message === "categoryPropertyValidation"} onChange={(event) => updateDraft(event.currentTarget.value)} />
      <p className="text-value-hint">{t("categoryPropertyHint")}</p>
      <div className="workspace-form-actions">
        <button type="submit" className="workspace-button" disabled={disabled || pending}>{t(pending ? "categoryPropertySaving" : "saveCategoryPropertyName")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelRenameWorkspace")}</button>
      </div>
    </form>}
    {editing && !pending && minimumRevision.current > originalRevision.current && <StatusMessage kind="info" title={t("categoryPropertyExternalChange")} />}
    {message && <StatusMessage kind={message === "categoryPropertyValidation" || message === "categoryPropertySaveError" ? "error" : "info"} title={t(message)} />}
  </div>;
}
