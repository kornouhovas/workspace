import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { CategorySummary } from "../../contracts/workspaces.js";
import type { CategoryFolderAction, CategoryFolderPreview, CategoryFolderOperation, CategoryFolderRecoveryPreview, CategoryFolderResult, CategoryPresentation } from "../../contracts/category-options.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; categories: CategorySummary[];
  language: Language; disabled: boolean; revision: number; invalidation: number;
  onCommitted(): void; onBlockedChange?(blocked: boolean): void;
}
const colors: Record<CategoryPresentation["color"], TranslationKey> = { default: "categoryDefault", gray: "categoryGray", red: "categoryRed", orange: "categoryOrange", yellow: "categoryYellow", green: "categoryGreen", blue: "categoryBlue", purple: "categoryPurple" };
export function CategoryOptionsPanel({ client, workspaceId, sourceId, categories, language, disabled, revision, invalidation, onCommitted, onBlockedChange }: Props) {
  const t = (key: TranslationKey) => translate(language, key);
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), nameInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [loading, setLoading] = useState(false);
  const [action, setAction] = useState<CategoryFolderAction>("create"), [name, setName] = useState(""), [categoryId, setCategoryId] = useState("");
  const [preview, setPreview] = useState<CategoryFolderPreview | null>(null);
  const [operations, setOperations] = useState<CategoryFolderOperation[]>([]), [options, setOptions] = useState<CategoryPresentation[]>([]);
  const [recovery, setRecovery] = useState<CategoryFolderRecoveryPreview | null>(null), [unknownOperation, setUnknownOperation] = useState<string | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const lifetime = useRef(0), busy = useRef(false), reads = useRef(0);
  useEffect(() => () => { lifetime.current++; reads.current++; }, [workspaceId, sourceId, client]);
  useEffect(() => { setPreview(null); setRecovery(null); reads.current++; setLoading(false); }, [revision, invalidation, disabled]);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  useEffect(() => { onBlockedChange?.(open || pending || unknownOperation !== null); }, [open, pending, unknownOperation, onBlockedChange]);
  useEffect(() => () => onBlockedChange?.(false), [onBlockedChange]);
  const load = async () => {
    const serial = ++reads.current, current = lifetime.current;
    setLoading(true); setMessage(null);
    try {
      const [presentation, saved] = await Promise.all([client.listCategoryPresentation({ workspaceId }), client.listCategoryFolderOperations({ workspaceId })]);
      if (current !== lifetime.current || serial !== reads.current) return;
      if (!presentation.ok || !saved.ok || presentation.value.workspaceId !== workspaceId || saved.value.workspaceId !== workspaceId || presentation.value.sourceId !== sourceId || saved.value.sourceId !== sourceId) { setMessage("categoryError"); return; }
      setOptions(presentation.value.options); setOperations(saved.value.operations);
    } catch { if (current === lifetime.current) setMessage("categoryError"); }
    finally { if (current === lifetime.current && serial === reads.current) setLoading(false); }
  };
  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage(null);
    try { await task(); } catch { setMessage("categoryError"); }
    finally { busy.current = false; setPending(false); }
  };
  const accept = async (value: CategoryFolderResult, expectedOperationId: string) => {
    if (value.operation.sourceId !== sourceId || value.operation.operationId !== expectedOperationId) { setMessage("categoryUnknown"); return; }
    setUnknownOperation(null); setRecovery(null);
    if (value.outcome === "completed" || value.outcome === "rejected") {
      setPreview(null); await load(); onCommitted(); setMessage(value.outcome === "completed" ? "categorySaved" : "categoryError");
    } else { await load(); setMessage("categoryInterrupted"); }
    heading.current?.focus();
  };
  const review = () => void run(async () => {
    const current = lifetime.current, serial = ++reads.current;
    setPreview(null); setRecovery(null);
    const result = await client.previewCategoryFolder({ workspaceId, action, name, categoryId: action === "rename" ? categoryId : null });
    if (current !== lifetime.current || serial !== reads.current) return;
    if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.action === action && result.value.requestedRelativePath === name && result.value.revision === revision) { setPreview(result.value); heading.current?.focus(); }
    else setMessage("categoryError");
  });
  const apply = () => {
    if (!preview || disabled || unknownOperation) return;
    const submitted = preview, operationId = crypto.randomUUID();
    setUnknownOperation(operationId); setPreview(null);
    void run(async () => {
      const current = lifetime.current;
      try {
        const result = await client.applyCategoryFolder({ workspaceId, operationId, previewToken: submitted.previewToken });
        if (current !== lifetime.current) return;
        if (result.ok) await accept(result.value, operationId);
        else { setUnknownOperation(null); setMessage("categoryError"); }
      } catch { if (current === lifetime.current) setMessage("categoryUnknown"); }
    });
  };
  const check = () => void run(async () => {
    if (!unknownOperation) return;
    const current = lifetime.current, operationId = unknownOperation;
    const result = await client.getCategoryFolderOperation({ workspaceId, operationId });
    if (current !== lifetime.current) return;
    if (result.ok) await accept(result.value, operationId); else setMessage("categoryUnknown");
  });
  const reviewRecovery = (operationId: string) => void run(async () => {
    const current = lifetime.current, serial = ++reads.current;
    setPreview(null); setRecovery(null);
    const result = await client.previewCategoryFolderRecovery({ workspaceId, operationId });
    if (current !== lifetime.current || serial !== reads.current) return;
    if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.operation.operationId === operationId) { setRecovery(result.value); heading.current?.focus(); }
    else setMessage("categoryError");
  });
  const recover = (action: "complete_destination" | "keep_original") => {
    if (!recovery?.previewToken || !recovery.actions.includes(action)) return;
    const submitted = recovery; setRecovery(null); setUnknownOperation(submitted.operation.operationId);
    void run(async () => {
      const current = lifetime.current;
      try {
        const result = await client.recoverCategoryFolder({ workspaceId, operationId: submitted.operation.operationId, previewToken: submitted.previewToken!, action });
        if (current !== lifetime.current) return;
        if (result.ok) await accept(result.value, submitted.operation.operationId); else { setUnknownOperation(null); setMessage("categoryError"); }
      } catch { if (current === lifetime.current) setMessage("categoryUnknown"); }
    });
  };
  const cancel = () => { if (!busy.current) { setPreview(null); setRecovery(null); setMessage(null); nameInput.current?.focus(); } };
  const update = (index: number, patch: Partial<CategoryPresentation>) => setOptions(current => current.map((o, i) => i === index ? { ...o, ...patch } : o));
  const move = (index: number, direction: number) => setOptions(current => {
    const next = [...current], other = index + direction;
    if (other < 0 || other >= next.length) return current;
    [next[index], next[other]] = [next[other], next[index]];
    return next.map((o, position) => ({ ...o, position }));
  });
  const savePresentation = () => void run(async () => {
    const current = lifetime.current;
    const result = await client.setCategoryPresentation({ workspaceId, options });
    if (current !== lifetime.current) return;
    if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId) { setOptions(result.value.options); onCommitted(); setMessage("categorySaved"); }
    else setMessage("categoryError");
  });
  const effectsDisabled = disabled || pending || loading || unknownOperation !== null || operations.length > 0;
  return <section className="category-options" aria-busy={pending || loading} onKeyDown={event => { if (event.key === "Escape" && !pending) { event.preventDefault(); cancel(); } }}>
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending} aria-expanded={open} onClick={() => { if (open) { setOpen(false); setPreview(null); setRecovery(null); } else { setOpen(true); void load(); } }}>{t("categoryOptions")}</button>
    {open && <div className="category-options__body">
      <h3 ref={heading} tabIndex={-1}>{t("categoryOptions")}</h3>
      <p>{t("categorySharedEffect")}</p>
      {loading && <StatusMessage kind="info" title={t("categoryLoading")} />}
      {pending && <StatusMessage kind="info" title={t("categoryPending")} />}
      {message && <StatusMessage kind={message === "categoryError" || message === "categoryUnknown" ? "error" : "info"} title={t(message)} />}
      {unknownOperation && <button type="button" className="workspace-button" disabled={pending} onClick={check}>{t("categoryCheck")}</button>}
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || loading} onClick={() => { setPreview(null); setRecovery(null); void load(); }}>{t("categoryRefresh")}</button>
      <form className="category-options__form" onSubmit={event => { event.preventDefault(); if (!effectsDisabled) review(); }}>
        <label htmlFor={`${id}-action`}>{t("categoryAction")}</label>
        <select id={`${id}-action`} disabled={effectsDisabled} value={action} onChange={e => { setAction(e.currentTarget.value as CategoryFolderAction); setPreview(null); }}>
          <option value="create">{t("categoryCreate")}</option><option value="associate">{t("categoryAssociate")}</option><option value="rename">{t("categoryRename")}</option>
        </select>
        {action === "rename" && <><label htmlFor={`${id}-category`}>{t("categoryChoose")}</label><select id={`${id}-category`} disabled={effectsDisabled} value={categoryId} onChange={e => { setCategoryId(e.currentTarget.value); setPreview(null); }}>
          <option value="">—</option>{categories.map(c => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}</select></>}
        <label htmlFor={`${id}-name`}>{t("categoryFolderName")}</label><input ref={nameInput} id={`${id}-name`} className="workspace-input" value={name} disabled={effectsDisabled} onChange={e => { setName(e.currentTarget.value); setPreview(null); }} />
        <button type="submit" className="workspace-button" disabled={effectsDisabled || !name.trim() || action === "rename" && !categoryId}>{t("categoryPreview")}</button>
      </form>
      {preview && <div className="category-options__review">
        <p>{t("categoryPhysicalEffect")}</p><p className="workspace-root">{preview.originalRelativePath ?? "∅"} → {preview.requestedRelativePath}</p>
        {preview.affectedProjects.length ? <ul>{preview.affectedProjects.map(p => <li key={p.originalRelativePath} className="workspace-root">{p.originalRelativePath} → {p.requestedRelativePath}</li>)}</ul> : <p>{t("categoryEmptyEffect")}</p>}
        <button type="button" className="workspace-button" disabled={effectsDisabled} onClick={apply}>{t("categoryApply")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("categoryCancel")}</button>
      </div>}
      {operations.length > 0 && <div><h4>{t("categoryInterrupted")}</h4><ul>{operations.map(o => <li key={o.operationId}>
        <span className="workspace-root">{o.originalRelativePath ?? "∅"} → {o.requestedRelativePath}</span>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={() => reviewRecovery(o.operationId)}>{t("categoryReviewRecovery")}</button>
      </li>)}</ul></div>}
      {recovery && <div className="category-options__review">
        <p className="workspace-root">{recovery.operation.originalRelativePath ?? "∅"} → {recovery.operation.requestedRelativePath}</p>
        <p>{t("categoryOriginal")}: {t(recovery.originalState === "matching" ? "categoryMatching" : recovery.originalState === "missing" ? "categoryMissing" : "categoryChanged")}</p>
        <p>{t("categoryDestination")}: {t(recovery.destinationState === "matching" ? "categoryMatching" : recovery.destinationState === "missing" ? "categoryMissing" : "categoryChanged")}</p>
        {recovery.actions.length ? recovery.actions.map(a => <button type="button" className="workspace-button" key={a} disabled={disabled || pending || !recovery.previewToken} onClick={() => recover(a)}>{t(a === "complete_destination" ? "categoryComplete" : "categoryKeep")}</button>) : <p>{t("categoryUnresolved")}</p>}
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("categoryCancel")}</button>
      </div>}
      <h4>{t("categoryPresentationScope")}</h4>
      {options.length === 0 && !loading && <p>{t("savedCategoriesEmpty")}</p>}
      <ol className="category-options__list">{options.map((o, i) => <li key={o.categoryId}>
        <span className="category-chip" data-color={o.color}>{categories.find(c => c.categoryId === o.categoryId)?.name ?? t("discoveryCategory")}</span>
        <label>{t("categoryColor")}<select aria-label={`${t("categoryColor")}: ${categories.find(c => c.categoryId === o.categoryId)?.name ?? i + 1}`} value={o.color} disabled={pending || loading || disabled} onChange={e => update(i, { color: e.currentTarget.value as CategoryPresentation["color"] })}>{Object.entries(colors).map(([color, label]) => <option key={color} value={color}>{t(label)}</option>)}</select></label>
        <label><input type="checkbox" checked={o.hidden} disabled={pending || loading || disabled} onChange={e => update(i, { hidden: e.currentTarget.checked })} />{t("categoryHidden")}</label>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || disabled || i === 0} onClick={() => move(i, -1)} aria-label={`${t("categoryUp")}: ${categories.find(c => c.categoryId === o.categoryId)?.name ?? i + 1}`}>{t("categoryUp")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || disabled || i === options.length - 1} onClick={() => move(i, 1)} aria-label={`${t("categoryDown")}: ${categories.find(c => c.categoryId === o.categoryId)?.name ?? i + 1}`}>{t("categoryDown")}</button>
      </li>)}</ol>
      <button type="button" className="workspace-button" disabled={disabled || pending || loading} onClick={savePresentation}>{t("categorySavePresentation")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={() => { setOpen(false); setPreview(null); setRecovery(null); trigger.current?.focus(); }}>{t("categoryClose")}</button>
    </div>}
  </section>;
}
