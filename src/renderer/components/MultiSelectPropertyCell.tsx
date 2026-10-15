import { useEffect, useId, useRef, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { SelectOption, PropertyMutation } from "../../contracts/text-properties.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  workspaceId: string; sourceId: string; projectId: string; propertyId: string;
  projectName: string; propertyName: string; value: string[]; options: SelectOption[];
  revision: number; minimumRevision: { current: number }; language: Language; disabled: boolean;
  onSave(optionIds: string[]): Promise<ServiceResult<PropertyMutation>>;
}
const signature = (ids: string[]) => [...ids].sort().join(",");
export function MultiSelectPropertyCell({ workspaceId, sourceId, projectId, propertyId, projectName, propertyName, value, options, revision, minimumRevision, language, disabled, onSave }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const label = `${t("editMultiSelectValue")}: ${projectName} / ${propertyName}`;
  const id = useId();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"selectValueValidation" | "textValueSaveError" | "textValueSaved" | "textValueNewerChange" | null>(null);
  const original = useRef("");
  const originalSelection = useRef<string[]>([]);
  const savedRevision = useRef(0), lifetime = useRef(0), saving = useRef(false), restoreFocus = useRef(false);
  const button = useRef<HTMLButtonElement>(null), editor = useRef<HTMLDivElement>(null);
  const editing = draft !== null;
  useEffect(() => () => { lifetime.current++; }, []);
  useEffect(() => {
    if (revision > savedRevision.current) setMessage(current => current === "textValueSaved" ? "textValueNewerChange" : current);
  }, [revision]);
  useEffect(() => {
    if (editing && !pending) editor.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus();
    else if (!editing && restoreFocus.current) { button.current?.focus(); restoreFocus.current = false; }
  }, [editing, pending]);
  const cancel = () => { if (!saving.current) { restoreFocus.current = true; setDraft(null); setMessage(null); } };
  const save = async (optionIds: string[]) => {
    if (!editing || saving.current || disabled) return;
    const current = lifetime.current;
    saving.current = true; setPending(true); setMessage(null);
    try {
      const result = await onSave(optionIds);
      if (current !== lifetime.current) return;
      if (result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId &&
        result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
        savedRevision.current = result.value.snapshot.revision;
        restoreFocus.current = true; setDraft(null);
        setMessage(result.value.snapshot.revision < minimumRevision.current ? "textValueNewerChange" : "textValueSaved");
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "selectValueValidation" : "textValueSaveError");
    } catch { if (current === lifetime.current) setMessage("textValueSaveError"); }
    finally { if (current === lifetime.current) { saving.current = false; setPending(false); } }
  };
  return <div className="text-property-cell" aria-busy={pending}>
    <button ref={button} type="button" className="text-value-button" aria-label={label} hidden={editing} disabled={disabled}
      onClick={() => { original.current = signature(value); originalSelection.current = [...value]; setDraft([...value]); setMessage(null); }}>
      {value.length === 0 ? t("textValueAbsent") : <span className="multi-select-values">{options.filter(option => value.includes(option.optionId)).map(option =>
        <span key={option.optionId} className="multi-select-option" data-color={option.color}>{option.name}</span>)}</span>}
    </button>
    {draft !== null && <div ref={editor} className="text-value-editor" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); cancel(); }
      else if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT" && !event.nativeEvent.isComposing) { event.preventDefault(); void save(draft); }
    }}>
      <fieldset className="multi-select-editor" disabled={disabled || pending} aria-describedby={`${id}-hint`}>
        <legend className="text-value-label">{label}</legend>
        {options.filter(option => !option.hidden || originalSelection.current.includes(option.optionId) || draft.includes(option.optionId)).map(option =>
          <label key={option.optionId} className="multi-select-choice" data-color={option.color}>
            <input type="checkbox" checked={draft.includes(option.optionId)} onChange={event => setDraft(event.currentTarget.checked ? [...draft, option.optionId] : draft.filter(id => id !== option.optionId))} />
            <span>{option.name}{option.hidden ? ` (${t("selectHidden")})` : ""}</span>
          </label>)}
        {options.every(option => option.hidden && !originalSelection.current.includes(option.optionId) && !draft.includes(option.optionId)) && <p>{t(options.length === 0 ? "selectOptionsEmpty" : "multiSelectNoVisibleOptions")}</p>}
      </fieldset>
      <p id={`${id}-hint`} className="text-value-hint">{t("multiSelectValueHint")}</p>
      <div className="workspace-form-actions">
        <button type="button" className="workspace-button" disabled={disabled || pending} onClick={() => void save(draft)}>{t(pending ? "textValueSaving" : "saveTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} onClick={() => void save([])}>{t("clearTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelTextValue")}</button>
      </div>
    </div>}
    {editing && !pending && signature(value) !== original.current && <StatusMessage kind="info" title={t("textValueExternalChange")} />}
    {message && <StatusMessage kind={message === "textValueSaved" || message === "textValueNewerChange" ? "info" : "error"} title={t(message)} />}
  </div>;
}
