import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { PropertyMutation, SelectOption } from "../../contracts/text-properties.js";
import { translate } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
import type { OptionsEditorState } from "./SelectOptionsEditor.js";
import { useDraftGuard } from "./ScalarDrafts.js";

export type SelectionOptionsEditor = (onStateChange: (state: OptionsEditorState) => void, valuePending: boolean) => ReactNode;
export interface SelectionProps {
  workspaceId: string; sourceId: string; projectId: string; propertyId: string;
  projectName: string; propertyName: string; value: string[]; options: SelectOption[];
  revision: number; minimumRevision: { current: number }; language: Language; disabled: boolean;
  onSave(optionIds: string[]): Promise<ServiceResult<PropertyMutation>>;
  optionsEditor?: SelectionOptionsEditor;
}
export function SelectionPropertyCell(props: SelectionProps & { multiple?: boolean }) {
  const guard = useDraftGuard();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const canClose = useRef(() => true);
  const t = (key: Parameters<typeof translate>[1]) => translate(props.language, key);
  const label = `${t(props.multiple ? "editMultiSelectValue" : "editSelectValue")}: ${props.projectName} / ${props.propertyName}`;
  return <Popover.Root open={open} onOpenChange={next => { if (next) setOpen(true); else if (canClose.current()) { if (guard) guard.run(() => setOpen(false)); else setOpen(false); } }}>
    <div className="text-property-cell" aria-busy={pending}>
      <Popover.Trigger asChild><button ref={trigger} type="button" className="text-value-button" aria-label={label} disabled={props.disabled}>
        {props.value.length ? <span className="multi-select-values">{props.options.filter(option => props.value.includes(option.optionId)).map(option => <span key={option.optionId} className="multi-select-option" data-color={option.color}>{option.name}</span>)}</span> : t("textValueAbsent")}
      </button></Popover.Trigger>
      {open && <SelectionMenu key={`${props.workspaceId}:${props.sourceId}:${props.projectId}:${props.propertyId}`} {...props} label={label} canClose={canClose} setPending={setPending} close={() => setOpen(false)} />}
    </div>
  </Popover.Root>;
}
function SelectionMenu({ multiple = false, label, close, canClose, setPending, ...props }: SelectionProps & { multiple?: boolean; label: string; close(): void; canClose: { current: () => boolean }; setPending(value: boolean): void }) {
  const guard = useDraftGuard();
  const t = (key: Parameters<typeof translate>[1]) => translate(props.language, key);
  const [selection, setSelection] = useState(props.value);
  const [pending, pendingState] = useState(false);
  const [error, setError] = useState(false);
  const [validation, setValidation] = useState(false);
  const [newer, setNewer] = useState(false);
  const [optionState, setOptionState] = useState<OptionsEditorState>({busy: false, failed: false});
  const appliedRevision = useRef(props.revision);
  const desired = useRef(props.value);
  const committed = useRef(props.value);
  const queue = useRef<string[][]>([]);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const failed = useRef(false);
  const content = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const latest = useRef(props); latest.current = props;
  canClose.current = () => !inFlight.current && !failed.current && !optionState.busy && !optionState.failed && !content.current?.querySelector("form");
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; setPending(false); }; }, []);
  const focus = () => content.current?.querySelector<HTMLElement>('select, input, button')?.focus();
  // A new source snapshot owns an idle menu; it cannot replace queued or failed
  // intent. The parent's revision gate separately rejects obsolete snapshots.
  useLayoutEffect(() => {
    if (!inFlight.current && !failed.current && props.revision >= appliedRevision.current) { desired.current = props.value; committed.current = props.value; setSelection(props.value); }
  }, [props.value, props.revision, pending]);
  const send = (next: string[]) => {
    desired.current = next; setSelection(next); setError(false); setValidation(false);
    failed.current = false; queue.current.push(next);
    if (inFlight.current) return;
    pendingState(true); setPending(true);
    const request = Promise.resolve().then(async () => {
      while (queue.current.length && alive.current) {
        const ids = queue.current.shift()!;
        try {
          const current = latest.current;
          const result = await current.onSave(ids);
          if (!alive.current) return false;
          if (!result.ok || result.value.projectId !== current.projectId || result.value.propertyId !== current.propertyId || result.value.snapshot.workspaceId !== current.workspaceId || result.value.snapshot.sourceId !== current.sourceId) {
            setValidation(!result.ok && result.error.code === "invalid_input");
            failed.current = true;
          } else {
            committed.current = ids;
            appliedRevision.current = result.value.snapshot.revision;
            setNewer(result.value.snapshot.revision < current.minimumRevision.current);
          }
        } catch { if (!alive.current) return false; failed.current = true; }
        if (failed.current) { queue.current = []; setError(true); return false; }
      }
      if (!multiple && alive.current) close();
      return true;
    }).finally(() => {
      if (alive.current) { inFlight.current = null; pendingState(false); setPending(false); }
    });
    inFlight.current = request;
  };
  const latestClose = useRef(close); latestClose.current = close;
  useLayoutEffect(() => {
    return guard?.register({ commit: () => inFlight.current ?? Promise.resolve(!failed.current), focus });
  }, [guard]);
  const dismiss = () => {
    if (inFlight.current || optionState.busy || content.current?.querySelector("form")) return;
    // Dismissal drops only failed, uncommitted intent, never committed values.
    latestClose.current();
  };
  return <Popover.Content ref={content} className="context-popover selection-popover text-value-editor" align="start" sideOffset={4} aria-label={label}
    onOpenAutoFocus={event => { event.preventDefault(); focus(); }}
    onEscapeKeyDown={event => { event.preventDefault(); if ((event.target as HTMLElement).closest("form")) return; event.stopPropagation(); dismiss(); }}
    onInteractOutside={event => { if (inFlight.current || optionState.busy || optionState.failed || failed.current || content.current?.querySelector("form")) event.preventDefault(); }}>
    {multiple ? <fieldset className="multi-select-editor" disabled={props.disabled || optionState.busy || optionState.failed} aria-busy={pending}>
      <legend className="text-value-label">{label}</legend>
      {props.options.filter(option => !option.hidden || committed.current.includes(option.optionId) || selection.includes(option.optionId)).map(option => <label key={option.optionId} className="multi-select-choice" data-color={option.color}>
        <input type="checkbox" checked={selection.includes(option.optionId)} onChange={event => send(event.currentTarget.checked ? [...desired.current, option.optionId] : desired.current.filter(id => id !== option.optionId))} />
        <span>{option.name}{option.hidden ? ` (${t("selectHidden")})` : ""}</span>
      </label>)}
      {!props.options.some(option => !option.hidden || selection.includes(option.optionId)) && <p>{t(props.options.length ? "multiSelectNoVisibleOptions" : "selectOptionsEmpty")}</p>}
    </fieldset> : <label className="text-value-label">{label}<select className="workspace-input" value={selection[0] ?? ""} disabled={props.disabled || pending || optionState.busy || optionState.failed} onChange={event => send(event.currentTarget.value ? [event.currentTarget.value] : [])}>
      <option value="">{t("textValueAbsent")}</option>
      {props.options.filter(option => !option.hidden || selection.includes(option.optionId)).map(option => <option key={option.optionId} value={option.optionId}>{option.name}{option.hidden ? ` (${t("selectHidden")})` : ""}</option>)}
    </select></label>}
    <p className="text-value-hint">{t(multiple ? "multiSelectValueHint" : "selectValueHint")}</p>
    {pending && <p role="status">{t("textValueSaving")}</p>}
    {error && <><StatusMessage kind="error" title={t(validation ? "selectValueValidation" : "textValueSaveError")} /><button type="button" className="workspace-button" disabled={pending || props.disabled || optionState.busy || optionState.failed} onClick={() => send(desired.current)}>{t("saveTextValue")}</button></>}
    {newer && <StatusMessage kind="info" title={t("textValueNewerChange")} />}
    <div className="workspace-form-actions">
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || props.disabled || optionState.busy || optionState.failed} onClick={() => send([])}>{t("clearTextValue")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || optionState.busy} onClick={dismiss}>{t(error || optionState.failed ? "cancelTextValue" : "closeSelection")}</button>
    </div>
    {props.optionsEditor?.(setOptionState, pending)}
  </Popover.Content>;
}
