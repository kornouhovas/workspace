import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
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
export function MultiSelectPropertyCell(props: Props) {
  const [state, setState] = useState({ opened: false, editing: false, pending: false, openToken: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const { value, options, language, disabled, projectName, propertyName } = props;
  const label = `${translate(language, "editMultiSelectValue")}: ${projectName} / ${propertyName}`;
  useLayoutEffect(() => { if (state.opened && !state.editing) button.current?.focus(); }, [state.editing]);
  return <div className="text-property-cell" aria-busy={state.pending}>
    <button ref={button} type="button" className="text-value-button" aria-label={label} disabled={disabled} hidden={state.editing}
      onClick={() => setState(current => ({ ...current, opened: true, editing: true, openToken: current.openToken + 1 }))}>
      <SelectionValue value={value} options={options} language={language} />
    </button>
    {state.opened && <EditingMultiSelectPropertyCell {...props} openToken={state.openToken} onState={setState} />}
  </div>;
}
function SelectionValue({ value, options, language }: Pick<Props, "value" | "options" | "language">) {
  return value.length === 0 ? translate(language, "textValueAbsent") : <span className="multi-select-values">{options.filter(option => value.includes(option.optionId)).map(option =>
    <span key={option.optionId} className="multi-select-option" data-color={option.color}>{option.name}</span>)}</span>;
}
type EditorState = { opened: boolean; editing: boolean; pending: boolean; openToken: number };
function EditingMultiSelectPropertyCell({ workspaceId, sourceId, projectId, propertyId, projectName, propertyName, value, options, revision, minimumRevision, language, disabled, onSave, openToken, onState }: Props & { openToken: number; onState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const t = (key: TranslationKey) => translate(language, key);
  const label = `${t("editMultiSelectValue")}: ${projectName} / ${propertyName}`;
  const id = useId();
  const [draft, setDraft] = useState<string[] | null>([...value]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"selectValueValidation" | "textValueSaveError" | "textValueSaved" | "textValueNewerChange" | null>(null);
  const original = useRef(signature(value));
  const originalSelection = useRef<string[]>([...value]);
  const savedRevision = useRef(0), lifetime = useRef(0), saving = useRef(false);
  const editor = useRef<HTMLDivElement>(null);
  const editing = draft !== null;
  useLayoutEffect(() => { onState(current => ({ ...current, editing, pending })); }, [editing, pending, onState]);
  useEffect(() => { original.current = signature(value); originalSelection.current = [...value]; setDraft([...value]); setMessage(null); }, [openToken]);
  useEffect(() => () => { lifetime.current++; }, []);
  useEffect(() => {
    if (revision > savedRevision.current) setMessage(current => current === "textValueSaved" ? "textValueNewerChange" : current);
  }, [revision]);
  useEffect(() => {
    if (editing && !pending) editor.current?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus();
  }, [editing, pending]);
  const cancel = () => { if (!saving.current) { setDraft(null); setMessage(null); } };
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
        setDraft(null);
        setMessage(result.value.snapshot.revision < minimumRevision.current ? "textValueNewerChange" : "textValueSaved");
      } else setMessage(!result.ok && result.error.code === "invalid_input" ? "selectValueValidation" : "textValueSaveError");
    } catch { if (current === lifetime.current) setMessage("textValueSaveError"); }
    finally { if (current === lifetime.current) { saving.current = false; setPending(false); } }
  };
  return <>
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
  </>;
}
