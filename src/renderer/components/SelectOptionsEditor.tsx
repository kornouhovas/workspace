import { useEffect, useId, useRef, useState } from "react";
import { selectColors, type PropertyDefinition, type PropertySnapshot, type SelectColor, type SelectCommand, type SelectOption } from "../../contracts/text-properties.js";
import type { Language } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

interface Props {
  onRemove?(optionId: string, trigger: HTMLButtonElement): void; removalOpen?: boolean;
  client: WorkspaceServiceClient; workspaceId: string; property: PropertyDefinition; snapshot: PropertySnapshot;
  language: Language; disabled: boolean; onCommitted(snapshot: PropertySnapshot): void;
}
export function SelectOptionsEditor({ onRemove, removalOpen, client, workspaceId, property, snapshot, language, disabled, onCommitted }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const id = useId();
  const options = snapshot.selectOptions?.filter(option => option.propertyId === property.propertyId) ?? [];
  const [draft, setDraft] = useState<{ optionId: string | null; name: string; color: SelectColor; originalName: string; originalColor: SelectColor } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const saving = useRef(false), lifetime = useRef(0);
  const input = useRef<HTMLInputElement>(null), add = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  useEffect(() => () => { lifetime.current++; }, []);
  useEffect(() => { if (draft) input.current?.focus(); else { returnFocus.current?.focus(); returnFocus.current = null; } }, [draft?.optionId, draft === null]);
  const cancel = () => { if (!saving.current) { setDraft(null); setError(false); } };
  const commit = async (command: SelectCommand, closeDraft = false) => {
    if (saving.current || disabled) return;
    const current = lifetime.current;
    saving.current = true; setPending(true); setError(false);
    try {
      const result = await client.selectCommand(command);
      if (current !== lifetime.current) return;
      if (result.ok && result.value.propertyId === property.propertyId && result.value.snapshot.sourceId === property.sourceId && result.value.snapshot.workspaceId === workspaceId) {
        onCommitted(result.value.snapshot);
        if (closeDraft) setDraft(null);
      } else setError(true);
    } catch { if (current === lifetime.current) setError(true); }
    finally { if (current === lifetime.current) { saving.current = false; setPending(false); } }
  };
  const edit = (option: SelectOption, trigger: HTMLButtonElement) => {
    returnFocus.current = trigger; setError(false); setDraft({ optionId: option.optionId, name: option.name, color: option.color, originalName: option.name, originalColor: option.color });
  };
  const move = (index: number, delta: number) => {
    const optionIds = options.map(option => option.optionId);
    [optionIds[index], optionIds[index + delta]] = [optionIds[index + delta], optionIds[index]];
    void commit({ type: "workspace.reorderSelectOptions", workspaceId, propertyId: property.propertyId, optionIds });
  };
  return <details className="select-options"><summary>{t("selectOptions")}: {property.name}</summary>
    <p>{t("selectPresentationScope")}</p>
    {!options.length && <p>{t("selectOptionsEmpty")}</p>}
    <ul>{options.map((option, index) => <li key={option.optionId} data-color={option.color}>
      <span className="property-authored">{option.name}</span>{option.hidden && <span> ({t("selectHidden")})</span>}
      <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || pending || draft !== null} aria-label={`${t("selectEditOption")}: ${option.name}`} onClick={event => edit(option, event.currentTarget)}>{t("selectEditOption")}</button>
      <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || pending || draft !== null || index === 0} aria-label={`${t("selectMoveUp")}: ${option.name}`} onClick={() => move(index, -1)}>{t("selectMoveUp")}</button>
      <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || pending || draft !== null || index === options.length - 1} aria-label={`${t("selectMoveDown")}: ${option.name}`} onClick={() => move(index, 1)}>{t("selectMoveDown")}</button>
      <button className="workspace-button workspace-button--secondary" type="button" disabled={disabled || pending || draft !== null} aria-label={`${t(option.hidden ? "selectShow" : "selectHide")}: ${option.name}`}
        onClick={() => void commit({ type: "workspace.setSelectOptionHidden", workspaceId, propertyId: property.propertyId, optionId: option.optionId, hidden: !option.hidden })}>{t(option.hidden ? "selectShow" : "selectHide")}</button>
      {onRemove && <button type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || draft !== null || removalOpen}
        aria-label={`${t("metadataDeleteOption")}: ${option.name}`} onClick={event => onRemove(option.optionId, event.currentTarget)}>{t("metadataDeleteOption")}</button>}
    </li>)}</ul>
    <button className="workspace-button workspace-button--secondary" ref={add} type="button" disabled={disabled || pending || draft !== null} onClick={() => { returnFocus.current = add.current; setError(false); setDraft({ optionId: null, name: "", color: "default", originalName: "", originalColor: "default" }); }}>{t("selectAddOption")}</button>
    {draft && <form aria-busy={pending} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }} onSubmit={event => {
      event.preventDefault();
      if (!draft.name.trim()) { setError(true); input.current?.focus(); return; }
      const base = { workspaceId, propertyId: property.propertyId, name: draft.name, color: draft.color };
      void commit(draft.optionId === null ? { type: "workspace.createSelectOption", ...base } : { type: "workspace.updateSelectOption", ...base, optionId: draft.optionId }, true);
    }}>
      <label htmlFor={`${id}-name`}>{t("selectOptionName")}</label>
      <input ref={input} id={`${id}-name`} className="workspace-input" value={draft.name} disabled={disabled || pending} aria-invalid={error} onChange={event => setDraft({ ...draft, name: event.currentTarget.value })} />
      <label htmlFor={`${id}-color`}>{t("categoryColor")}</label>
      <select id={`${id}-color`} className="workspace-input" value={draft.color} disabled={disabled || pending} onChange={event => setDraft({ ...draft, color: event.currentTarget.value as SelectColor })}>
        {selectColors.map(color => <option key={color} value={color}>{t(`selectColor_${color}`)}</option>)}
      </select>
      <div className="workspace-form-actions"><button className="workspace-button" type="submit" disabled={disabled || pending}>{t(pending ? "propertySaving" : "savePropertyName")}</button>
        <button className="workspace-button workspace-button--secondary" type="button" disabled={pending} onClick={cancel}>{t("cancelTextValue")}</button></div>
    </form>}
    {draft?.optionId && !pending && options.some(option => option.optionId === draft.optionId && (option.name !== draft.originalName || option.color !== draft.originalColor)) &&
      <StatusMessage kind="info" title={t("selectOptionExternalChange")} />}
    {error && <StatusMessage kind="error" title={t("selectOptionError")} />}
  </details>;
}
