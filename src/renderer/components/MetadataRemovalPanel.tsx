import { useEffect, useId, useRef, useState } from "react";
import type { MetadataRemovalPreview } from "../../contracts/metadata-removal.js";
import type { PropertyDefinition, SelectOption } from "../../contracts/text-properties.js";
import type { Language } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; property: PropertyDefinition;
  optionId: string | null; options: SelectOption[]; language: Language; disabled: boolean;
  onCancel(): void; onCommitted(): void; onObserved?(): Promise<void>;
}
export function MetadataRemovalPanel({ client, workspaceId, sourceId, property, optionId, options, language, disabled, onCancel, onCommitted, onObserved }: Props) {
  const t = (key: TranslationKey) => translate(language, key), id = useId();
  const [replacement, setReplacement] = useState<string | null>(null);
  const [preview, setPreview] = useState<MetadataRemovalPreview | null>(null);
  const [pending, setPending] = useState<"load" | "save" | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const sequence = useRef(0), busy = useRef(false), heading = useRef<HTMLHeadingElement>(null), reviewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (error && pending === null) reviewButton.current?.focus(); }, [error, pending]);
  const review = async () => {
    if (busy.current || disabled) return;
    const request = ++sequence.current;
    busy.current = true; setPending("load"); setPreview(null); setError(null);
    try {
      const result = await client.previewMetadataRemoval({ workspaceId, propertyId: property.propertyId, optionId, replacementOptionId: replacement });
      if (request !== sequence.current) return;
      if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.propertyId === property.propertyId && result.value.optionId === optionId && result.value.replacementOptionId === replacement) setPreview(result.value);
      else setError("metadataPreviewError");
    } catch { if (request === sequence.current) setError("metadataPreviewError"); }
    finally { if (request === sequence.current) { busy.current = false; setPending(null); } }
  };
  useEffect(() => {
    heading.current?.focus(); void review();
    return () => { sequence.current++; busy.current = false; };
  }, [client, workspaceId, sourceId, property.propertyId, optionId]);
  const apply = async () => {
    if (!preview || busy.current || disabled) return;
    const request = ++sequence.current;
    busy.current = true; setPending("save"); setError(null);
    let committed = false, failure: TranslationKey = "metadataError";
    try {
      const result = await client.applyMetadataRemoval(workspaceId, preview.previewToken);
      committed = result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId;
      if (!result.ok && result.error.code === "stale_preview") failure = "metadataStale";
    } catch { /* A lost response is observed below; mutations are never replayed. */ }
    try { await onObserved?.(); } catch { /* The parent presents its independent read error. */ }
    if (request !== sequence.current) return;
    busy.current = false; setPending(null); setPreview(null);
    if (committed) onCommitted();
    else setError(failure);
  };
  return <section className="metadata-removal" aria-labelledby={`${id}-title`} aria-busy={pending !== null}
    onKeyDown={event => { if (event.key === "Escape" && !busy.current) { event.preventDefault(); onCancel(); } }}>
    <h3 id={`${id}-title`} tabIndex={-1} ref={heading}>{t("metadataTitle")}: {property.name}{optionId && ` / ${options.find(o => o.optionId === optionId)?.name ?? preview?.optionName ?? ""}`}</h3>
    <p>{t("metadataScope")}</p><p>{t(optionId ? "metadataOptionPolicy" : "metadataPropertyPolicy")}</p>
    {optionId && <><label htmlFor={`${id}-action`}>{t("metadataAction")}</label>
      <select id={`${id}-action`} className="workspace-input" value={replacement ?? ""} disabled={disabled || pending !== null}
        onChange={event => { setReplacement(event.currentTarget.value || null); setPreview(null); setError(null); }}>
        <option value="">{t("metadataClear")}</option>
        {options.filter(o => o.optionId !== optionId && o.propertyId === property.propertyId).map(o => <option key={o.optionId} value={o.optionId}>{o.name}</option>)}
      </select></>}
    {pending && <p role="status">{t(pending === "load" ? "metadataLoading" : "metadataSaving")}</p>}
    {error && <StatusMessage kind="error" title={t(error)} />}
    {preview && <>
      <h4>{t("metadataProjects")} ({preview.projects.length})</h4>
      {!preview.projects.length && <p>{t("metadataNoProjects")}</p>}
      <ul>{preview.projects.map(p => <li key={p.projectId}><div className="property-authored">{p.relativePath}</div><ul>{p.values.map((value, index) => <li key={index} className="property-authored">{value}</li>)}</ul></li>)}</ul>
      <h4>{t("metadataViews")} ({preview.views.length})</h4>
      {!preview.views.length && <p>{t("metadataNoViews")}</p>}
      <ul>{preview.views.map(v => <li key={v.viewId}><div className="property-authored">{v.workspaceName} / {v.viewName}</div>{[
        v.filters ? `${t("metadataFilters")}: ${v.filters}` : null, v.grouping ? t("metadataGrouping") : null, v.table ? t("metadataTable") : null, v.board ? t("metadataBoard") : null,
      ].filter(Boolean).join(", ")}</li>)}</ul>
    </>}
    <div className="workspace-form-actions">
      <button type="button" className="workspace-button workspace-button--secondary" ref={reviewButton} disabled={disabled || pending !== null} onClick={() => void review()}>{t("metadataReview")}</button>
      <button type="button" className="workspace-button" disabled={disabled || pending !== null || !preview} onClick={() => void apply()}>{t("metadataConfirm")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending !== null} onClick={onCancel}>{t("metadataCancel")}</button>
    </div>
  </section>;
}
