import { useEffect, useLayoutEffect, useId, useMemo, useRef, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { SelectOption, TextPropertyMutation } from "../../contracts/text-properties.js";
import { useDraftGuard } from "./ScalarDrafts.js";
import { formatCalendarDate } from "../date-display.js";
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
  propertyType?: "text" | "number" | "date" | "single_select";
  options?: SelectOption[];
  revision: number;
  minimumRevision: { current: number };
  language: Language;
  disabled: boolean;
  onSave(value: string | null): Promise<ServiceResult<TextPropertyMutation>>;
}

// Idle cells need a button, not a mounted editor with draft/revision/focus
// effects. Once opened, retain the editor instance through snapshot refreshes.
export function TextPropertyCell(props: Props) {
  const [state, setState] = useState({ opened: false, editing: false, pending: false, openToken: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const { propertyType = "text", options = [], value, language, disabled } = props;
  const { label, displayValue } = presentation(props);
  useLayoutEffect(() => { if (state.opened && !state.editing && restoreFocus.current) button.current?.focus(); }, [state.editing]);
  // Snapshot revisions and unrelated pending controls do not change an idle
  // value button. Editors below still receive every current prop and callback.
  const valueButton = useMemo(() => <button ref={button} type="button" className="text-value-button" aria-label={label} disabled={disabled} hidden={state.editing}
      onClick={() => setState(current => ({ ...current, opened: true, editing: true, openToken: current.openToken + 1 }))}>
      {value === null ? translate(language, "textValueAbsent") : value === "" ? translate(language, "textValueEmpty") : displayValue}
    </button>, [label, disabled, state.editing, value, displayValue, language]);
  return <div className="text-property-cell" data-color={propertyType === "single_select" ? options.find(option => option.optionId === value)?.color : undefined} aria-busy={state.pending}>
    {valueButton}
    {state.opened && <EditingTextPropertyCell key={`${props.workspaceId}:${props.sourceId}:${props.projectId}:${props.propertyId}`} {...props} restoreFocus={restoreFocus} openToken={state.openToken} onState={setState} />}
  </div>;
}
function presentation({ propertyType = "text", options = [], projectName, propertyName, value, language }: Props) {
  const select = propertyType === "single_select", numeric = propertyType === "number", date = propertyType === "date";
  const label = `${translate(language, select ? "editSelectValue" : date ? "editDateValue" : numeric ? "editNumberValue" : "editTextValue")}: ${projectName} / ${propertyName}`;
  const displayValue = select ? options.find(option => option.optionId === value)?.name ?? value : date && value !== null ? formatCalendarDate(value, language) : numeric && language === "ru" && value !== null ? value.replace(".", ",") : value;
  return { label, displayValue };
}
type EditorState = { opened: boolean; editing: boolean; pending: boolean; openToken: number };
function EditingTextPropertyCell(props: Props & { restoreFocus: {current:boolean}; openToken: number; onState: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const guard = useDraftGuard();
  const { restoreFocus, workspaceId, sourceId, projectId, propertyId, value, revision, minimumRevision, language, disabled, propertyType = "text", options = [], onSave, openToken, onState } = props;
  const select = propertyType === "single_select";
  const numeric = propertyType === "number";
  const date = propertyType === "date";
  const t = (key: TranslationKey) => translate(language, key);
  const { label, displayValue } = presentation(props);
  const id = useId();
  const [draft, setDraft] = useState<string | null>((date || select ? value : displayValue) ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<"textValueValidation" | "textValueSaveError" | "textValueSaved" | "textValueNewerChange" | null>(null);
  const originalValue = useRef(value);
  const savedRevision = useRef(0);
  const editor = useRef<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const closed = useRef(false);
  const failed = useRef(false);
  const currentDraft = useRef(draft); currentDraft.current = draft;
  const [calendar, setCalendar] = useState(false);
  const lifetime = useRef(0);
  const editing = draft !== null;
  useLayoutEffect(() => { onState(current => ({ ...current, editing, pending })); }, [editing, pending, onState]);
  useEffect(() => { closed.current = false; failed.current = false; restoreFocus.current = true; originalValue.current = value; setDraft((date || select ? value : displayValue) ?? ""); setMessage(null); }, [openToken]);
  useEffect(() => {
    if (revision > savedRevision.current) {
      setMessage((current) => current === "textValueSaved" ? "textValueNewerChange" : current);
    }
  }, [revision]);
  useEffect(() => {
    if (editing && !pending && restoreFocus.current) editor.current?.focus();
  }, [editing, pending]);
  useEffect(() => () => { lifetime.current++; }, []);
  const cancel = () => {
    if (inFlight.current) return;
    closed.current = true; restoreFocus.current = true;
    setDraft(null); setCalendar(false); setMessage(null);
  };
  const change = (next: string) => { failed.current = false; currentDraft.current = next; setDraft(next); setMessage(null); };
  const save = (next: string | null, automatic = false): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    if (closed.current) return Promise.resolve(true);
    if (!editing || disabled || automatic && failed.current) return Promise.resolve(false);
    const current = lifetime.current;
    restoreFocus.current = !automatic;
    setPending(true); setMessage(null);
    const request = Promise.resolve().then(async () => {
      try {
        const result = await onSave(next);
        if (current !== lifetime.current) return false;
        if (result.ok && result.value.projectId === projectId && result.value.propertyId === propertyId &&
          result.value.snapshot.workspaceId === workspaceId && result.value.snapshot.sourceId === sourceId) {
          closed.current = true;
          savedRevision.current = result.value.snapshot.revision;
          setDraft(null); setCalendar(false);
          setMessage(result.value.snapshot.revision < minimumRevision.current ? "textValueNewerChange" : "textValueSaved");
          return true;
        }
        setMessage(!result.ok && result.error.code === "invalid_input" ? "textValueValidation" : "textValueSaveError");
      } catch { if (current === lifetime.current) setMessage("textValueSaveError"); }
      finally { if (current === lifetime.current) { inFlight.current = null; setPending(false); } }
      failed.current = true;
      if (!automatic) editor.current?.focus();
      return false;
    });
    inFlight.current = request;
    return request;
  };
  const commit = () => save(select && currentDraft.current === "" ? null : currentDraft.current, true);
  const latestCommit = useRef(commit); latestCommit.current = commit;
  useLayoutEffect(() => {
    if (!editing || select) return;
    return guard?.register({ commit: () => latestCommit.current(), focus: () => { restoreFocus.current = true; editor.current?.focus(); } });
  }, [guard, editing, select]);
  return <>
    {editing && <div className="text-value-editor" onBlur={event => {
      if (!select && !event.currentTarget.contains(event.relatedTarget as Node | null)) void commit();
    }} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (calendar) setCalendar(false); else cancel(); }
      else if (event.key === "Enter" && (date || numeric || select || event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); void save(select && draft === "" ? null : draft); }
    }}>
      <label className="text-value-label" htmlFor={id} onPointerDown={event => { event.preventDefault(); editor.current?.focus(); }}>{label}</label>
      {select ? <select ref={(element) => { editor.current = element; }} id={id} className="workspace-input" value={draft} disabled={disabled || pending}
        aria-invalid={message === "textValueValidation"} aria-describedby={`${id}-hint`} onChange={event => change(event.currentTarget.value)}>
        <option value="">{t("textValueAbsent")}</option>
        {options.filter(option => !option.hidden || option.optionId === draft).map(option => <option key={option.optionId} value={option.optionId}>{option.name}{option.hidden ? ` (${t("selectHidden")})` : ""}</option>)}
      </select> : date || numeric ? <input ref={(element) => { editor.current = element; }} id={id} className="bb-input" type="text" maxLength={numeric ? 512 : undefined} placeholder={date ? "YYYY-MM-DD" : undefined} value={draft} disabled={disabled || pending}
        aria-invalid={message === "textValueValidation"} aria-describedby={`${id}-hint`} onChange={(event) => change(event.currentTarget.value)} />
        : <textarea ref={(element) => { editor.current = element; }} id={id} className="workspace-input" rows={3} value={draft} disabled={disabled || pending}
          aria-invalid={message === "textValueValidation"} aria-describedby={`${id}-hint`} onChange={(event) => change(event.currentTarget.value)} />}
      {date && <>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} aria-expanded={calendar} aria-controls={`${id}-calendar`} onClick={() => setCalendar(!calendar)}>{t("chooseCalendarDate")}</button>
        {calendar && <label>{t("chooseCalendarDate")}<input id={`${id}-calendar`} className="bb-input" type="date" aria-label={t("chooseCalendarDate")} min="0001-01-01" max="9999-12-31" disabled={disabled || pending} value={/^\d{4}-\d{2}-\d{2}$/.test(draft) ? draft : ""} onChange={event => { const next = event.currentTarget.value; if (next) { change(next); void save(next); } }}/></label>}
      </>}
      <p id={`${id}-hint`} className="text-value-hint">{t(select ? "selectValueHint" : date ? "dateValueHint" : numeric ? "numberValueHint" : "textValueKeyboardHint")}</p>
      <div className="workspace-form-actions">
        <button type="button" className="workspace-button" disabled={disabled || pending} onClick={() => void save(select && draft === "" ? null : draft)}>{t(pending ? "textValueSaving" : "saveTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} onClick={() => void save(null)}>{t("clearTextValue")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("cancelTextValue")}</button>
      </div>
    </div>}
    {editing && !pending && value !== originalValue.current && <StatusMessage kind="info" title={t("textValueExternalChange")} />}
    {message && <StatusMessage kind={message === "textValueSaved" || message === "textValueNewerChange" ? "info" : "error"} title={t(message === "textValueValidation" ? (select ? "selectValueValidation" : date ? "dateValueValidation" : numeric ? "numberValueValidation" : message) : message)} />}
  </>;
}
