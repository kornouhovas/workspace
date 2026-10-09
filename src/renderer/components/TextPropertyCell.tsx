import { useEffect, useId, useRef, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { TextPropertyMutation } from "../../contracts/text-properties.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  workspaceId: string;
  sourceId: string;
  projectId: string;
  propertyId: string;
  projectName: string;
  propertyName: string;
  value: string | null;
  language: Language;
  disabled: boolean;
  onSave(value: string | null): Promise<ServiceResult<TextPropertyMutation>>;
}

export function TextPropertyCell({ workspaceId, sourceId, projectId, propertyId, projectName, propertyName, value, language, disabled, onSave }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const label = `${t("editTextValue")}: ${projectName} / ${propertyName}`;
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"textValueValidation" | "textValueSaveError" | "textValueSaved" | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);
  const lifetime = useRef(0);
  const restoreFocus = useRef(false);
  const editing = draft !== null;
  useEffect(() => {
    if (editing) editor.current?.focus();
    else if (restoreFocus.current) { button.current?.focus(); restoreFocus.current = false; }
  }, [editing]);
  useEffect(() => () => { lifetime.current++; }, []);
  const cancel = () => {
    if (saving.current) return;
    restoreFocus.current = true; setDraft(null); setMessage(null);
  };
  const save = async (next: string | null) => {
    if (!editing || saving.current || disabled) return;
    const current = lifetime.current;
    saving.current = true; setPending(true); setMessage(null);
    try {
      const result = await onSave(next);
      if (current !== lifetime.current) return;
      if (result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId &&
        result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
        restoreFocus.current = true; setDraft(null); setMessage("textValueSaved");
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "textValueValidation" : "textValueSaveError");
    } catch { if (current === lifetime.current) setMessage("textValueSaveError"); }
    finally { if (current === lifetime.current) { saving.current = false; setPending(false); } }
  };
  return <div className="text-property-cell" aria-busy={pending}>
    <button ref={button} type="button" className="text-value-button" aria-label={label} hidden={editing} disabled={disabled}
      onClick={() => { setDraft(value ?? ""); setMessage(null); }}>{value === null ? t("textValueAbsent") : value === "" ? t("textValueEmpty") : value}</button>
    {editing && <div className="text-value-editor" onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
      else if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void save(draft); }
    }}>
      <label className="text-value-label" htmlFor={id}>{label}</label>
      <textarea ref={editor} id={id} className="workspace-input" rows={3} value={draft} disabled={disabled || pending}
        aria-invalid={message === "textValueValidation"} onChange={(event) => setDraft(event.currentTarget.value)} />
      <p className="text-value-hint">{t("textValueKeyboardHint")}</p>
      <div className="workspace-form-actions">
        <button type="button" className="workspace-button" disabled={disabled || pending} onClick={() => void save(draft)}>{t(pending ? "textValueSaving" : "saveTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} onClick={() => void save(null)}>{t("clearTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelTextValue")}</button>
      </div>
    </div>}
    {message && <StatusMessage kind={message === "textValueSaved" ? "info" : "error"} title={t(message)} />}
  </div>;
}
