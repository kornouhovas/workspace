import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import type { CategorySummary } from "../../contracts/workspaces.js";
import type { CategoryRemovalPreview, CategoryRemovalOperation, CategoryRemovalRecoveryPreview } from "../../contracts/category-removal.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
interface Props {
  client: WorkspaceServiceClient; workspaceId: string; sourceId: string; categories: CategorySummary[];
  language: Language; disabled: boolean; revision: number; invalidation: number;
  onCommitted(): void; onOpenChange?(open: boolean): void;
}
function problemLabel(problem: string): TranslationKey {
  if (["occupied", "reserved_destination", "native_conflict"].includes(problem)) return "removalCollision";
  if (problem === "unexpected_entry") return "removalUnexpected";
  if (problem === "permission_denied") return "removalPermission";
  if (["project_unavailable", "category_unavailable", "source_unavailable", "filesystem_changed", "ownership_uncertain", "destination_replaced", "destination_missing", "destination_link"].includes(problem)) return "removalUnavailable";
  return "removalError";
}
const outcomeLabels = { pending: "removalPending", completed: "removalMoved", rejected: "removalRejected", recoverable: "removalRecoverable" } satisfies Record<string, TranslationKey>;
export function CategoryRemovalPanel({ client, workspaceId, sourceId, categories, language, disabled, revision, invalidation, onCommitted, onOpenChange }: Props) {
  const t = (key: TranslationKey) => translate(language, key), id = useId();
  const trigger = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null), categoryInput = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [categoryId, setCategoryId] = useState(""), [destinationCategoryId, setDestinationCategoryId] = useState("");
  const [preview, setPreview] = useState<CategoryRemovalPreview | null>(null), [recovery, setRecovery] = useState<CategoryRemovalRecoveryPreview | null>(null);
  const [operations, setOperations] = useState<CategoryRemovalOperation[]>([]), [lastResult, setLastResult] = useState<CategoryRemovalOperation | null>(null);
  const [unknown, setUnknown] = useState<{ operationId: string; categoryId: string; destinationCategoryId: string | null } | null>(null);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const restoreForm = useRef(false);
  useEffect(() => { if (restoreForm.current && !preview && !recovery) { categoryInput.current?.focus(); restoreForm.current = false; } }, [preview, recovery]);
  const lifetime = useRef(0), reads = useRef(0), busy = useRef(false);
  useEffect(() => () => { lifetime.current++; reads.current++; }, [client, workspaceId, sourceId]);
  useEffect(() => { setPreview(null); setRecovery(null); reads.current++; setLoading(false); }, [revision, invalidation, disabled]);
  useEffect(() => { onOpenChange?.(open || pending || unknown !== null); }, [open, pending, unknown, onOpenChange]);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  const load = async () => {
    const current = lifetime.current, serial = ++reads.current; setLoading(true); setLoaded(false);
    try {
      const result = await client.listCategoryRemovals({ workspaceId });
      if (current !== lifetime.current || serial !== reads.current) return;
      if (!result.ok || result.value.workspaceId !== workspaceId || result.value.sourceId !== sourceId) { setMessage("removalError"); return; }
      setOperations(result.value.operations); setLoaded(true);
    } catch { if (current === lifetime.current) setMessage("removalError"); }
    finally { if (current === lifetime.current && serial === reads.current) setLoading(false); }
  };
  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    const current = lifetime.current; busy.current = true; setPending(true); setMessage(null);
    try { await task(); } catch { if (current === lifetime.current) setMessage("removalError"); }
    finally { busy.current = false; if (current === lifetime.current) setPending(false); }
  };
  const accept = async (operation: CategoryRemovalOperation, expected: NonNullable<typeof unknown>) => {
    if (operation.operationId !== expected.operationId || operation.sourceId !== sourceId || operation.categoryId !== expected.categoryId || operation.destinationCategoryId !== expected.destinationCategoryId) { setMessage("removalUnknown"); return; }
    setUnknown(null); setLastResult(operation); setRecovery(null); setPreview(null);
    await load(); onCommitted();
    setMessage(operation.stage === "completed" ? "removalCompleted" : operation.stage === "abandoned" ? "removalAbandoned" : "removalPartial");
    heading.current?.focus();
  };
  const review = () => void run(async () => {
    const current = lifetime.current, serial = ++reads.current; setPreview(null); setRecovery(null); setLastResult(null);
    const result = await client.previewCategoryRemoval({ workspaceId, categoryId, destinationCategoryId: destinationCategoryId || null });
    if (current !== lifetime.current || serial !== reads.current) return;
    if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.categoryId === categoryId && result.value.destinationCategoryId === (destinationCategoryId || null) && result.value.revision === revision) { setPreview(result.value); heading.current?.focus(); }
    else setMessage("removalError");
  });
  const submit = (expected: NonNullable<typeof unknown>, request: () => ReturnType<WorkspaceServiceClient["applyCategoryRemoval"]>) => {
    setUnknown(expected);
    void run(async () => {
      const current = lifetime.current;
      try {
        const result = await request();
        if (current !== lifetime.current) return;
        if (result.ok) await accept(result.value.operation, expected);
        else if (result.error.code === "invalid_input" || result.error.code === "stale_preview") { setUnknown(null); setMessage("removalError"); }
        else setMessage("removalUnknown");
      } catch { if (current === lifetime.current) setMessage("removalUnknown"); }
    });
  };
  const apply = () => {
    if (busy.current || !preview || preview.blockers.length || unknown || disabled) return;
    const submitted = preview, expected = { operationId: crypto.randomUUID(), categoryId: preview.categoryId, destinationCategoryId: preview.destinationCategoryId };
    setPreview(null);
    submit(expected, () => client.applyCategoryRemoval({ workspaceId, operationId: expected.operationId, previewToken: submitted.previewToken }));
  };
  const check = () => void run(async () => {
    if (!unknown) return;
    const current = lifetime.current, expected = unknown;
    const result = await client.getCategoryRemoval({ workspaceId, operationId: expected.operationId });
    if (current !== lifetime.current) return;
    if (!result.ok || result.value.workspaceId !== workspaceId || result.value.sourceId !== sourceId) { setMessage("removalUnknown"); return; }
    if (result.value.operation) await accept(result.value.operation, expected);
    else { setUnknown(null); setMessage("removalNotAccepted"); await load(); }
  });
  const reviewRecovery = (operationId: string) => void run(async () => {
    const current = lifetime.current, serial = ++reads.current; setPreview(null); setRecovery(null);
    const result = await client.previewCategoryRemovalRecovery({ workspaceId, operationId });
    if (current !== lifetime.current || serial !== reads.current) return;
    if (result.ok && result.value.workspaceId === workspaceId && result.value.sourceId === sourceId && result.value.operation.operationId === operationId) { setRecovery(result.value); setLastResult(null); heading.current?.focus(); }
    else setMessage("removalError");
  });
  const recover = (action: "retry_remaining" | "abandon") => {
    if (busy.current || !recovery?.previewToken || !recovery.actions.includes(action) || unknown || disabled) return;
    const submitted = recovery, expected = { operationId: recovery.operation.operationId, categoryId: recovery.operation.categoryId, destinationCategoryId: recovery.operation.destinationCategoryId };
    setRecovery(null);
    submit(expected, () => client.recoverCategoryRemoval({ workspaceId, operationId: expected.operationId, previewToken: submitted.previewToken!, action }));
  };
  const cancel = () => { if (!busy.current) { restoreForm.current = true; setPreview(null); setRecovery(null); categoryInput.current?.focus(); } };
  const showOperation = (operation: CategoryRemovalOperation) => <div className="category-options__review">
    <p className="workspace-root">{operation.originalRelativePath} → {operation.destinationRelativePath ?? "∅"}</p>
    {operation.problem && operation.problem !== "abandoned" && <p>{t(problemLabel(operation.problem))}</p>}
    <ul>{operation.projects.map(p => <li key={p.projectId}><span className="workspace-root">{p.originalRelativePath} → {p.requestedRelativePath}</span>: {t(outcomeLabels[p.outcome])}{p.problem && <> — {t(problemLabel(p.problem))}</>}</li>)}</ul>
  </div>;
  const effectsDisabled = !loaded || disabled || pending || loading || unknown !== null || operations.length > 0;
  return <section className="category-removal" aria-busy={pending || loading} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); if (!pending) { event.preventDefault(); cancel(); } } }}>
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || pending || unknown !== null} aria-expanded={open} onClick={() => { setOpen(!open); setPreview(null); setRecovery(null); if (!open) void load(); }}>{t("removalTitle")}</button>
    {open && <div className="category-options__body">
      <h4 className="sr-only" ref={heading} tabIndex={-1}>{t("removalTitle")}</h4><p>{t("removalPolicy")}</p>
      {(pending || loading) && <StatusMessage kind="info" title={t(pending ? "categoryPending" : "categoryLoading")} />}
      {message && <StatusMessage kind={message === "removalError" || message === "removalUnknown" ? "error" : "info"} title={t(message)} />}
      {unknown && <button type="button" className="workspace-button" disabled={pending || disabled} onClick={check}>{t("removalCheck")}</button>}
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || loading} onClick={() => { cancel(); void load(); }}>{t("removalRefresh")}</button>
      <form style={{display: preview || recovery ? "none" : undefined}} className="category-options__form" onSubmit={event => { event.preventDefault(); if (!effectsDisabled && categoryId) review(); }}>
        <label htmlFor={`${id}-category`}>{t("removalCategory")}</label>
        <select ref={categoryInput} id={`${id}-category`} disabled={effectsDisabled} value={categoryId} onChange={e => { setCategoryId(e.currentTarget.value); setPreview(null); }}><option value="">—</option>{categories.map(c => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}</select>
        <label htmlFor={`${id}-destination`}>{t("removalDestination")}</label>
        <select id={`${id}-destination`} disabled={effectsDisabled} value={destinationCategoryId} onChange={e => { setDestinationCategoryId(e.currentTarget.value); setPreview(null); }}><option value="">{t("removalEmptyDestination")}</option>{categories.filter(c => c.categoryId !== categoryId).map(c => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}</select>
        <button type="submit" className="workspace-button" disabled={effectsDisabled || !categoryId}>{t("removalPreview")}</button>
      </form>
      {preview && <div className="category-options__review"><p>{t("removalEffect")}</p><p className="workspace-root">{preview.originalRelativePath} → {preview.destinationRelativePath ?? "∅"}</p>
        {preview.projects.length ? <ul>{preview.projects.map(p => <li key={p.projectId} className="workspace-root">{p.originalRelativePath} → {p.requestedRelativePath}</li>)}</ul> : <p>{t("removalEmpty")}</p>}
        {preview.blockers.length > 0 && <><p>{t("removalBlocked")}</p><ul>{preview.blockers.map((b, i) => <li key={i}><span className="workspace-root">{b.relativePath}</span>: {t(problemLabel(b.problem))}</li>)}</ul></>}
        <button type="button" className="workspace-button" disabled={effectsDisabled || preview.blockers.length > 0} onClick={apply}>{t("removalApply")}</button>
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("categoryCancel")}</button>
      </div>}
      {lastResult && showOperation(lastResult)}
      {operations.length === 0 && loaded && !loading && <p>{t("removalNoOperations")}</p>}
      {operations.map(o => <div key={o.operationId}>{showOperation(o)}<button type="button" className="workspace-button" disabled={pending || unknown !== null} onClick={() => reviewRecovery(o.operationId)}>{t("categoryReviewRecovery")}</button></div>)}
      {recovery && <div>{showOperation(recovery.operation)}<p>{t("removalPolicy")}</p>
        {recovery.actions.length ? recovery.actions.map(a => <button key={a} type="button" className="workspace-button" disabled={pending || disabled || !recovery.previewToken} onClick={() => recover(a)}>{t(a === "retry_remaining" ? "removalRetry" : "removalAbandon")}</button>) : <p>{t("removalBlocked")}</p>}
        <button type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={cancel}>{t("categoryCancel")}</button>
      </div>}
      <button type="button" className="workspace-button workspace-button--secondary" disabled={pending || unknown !== null} onClick={() => { setOpen(false); cancel(); trigger.current?.focus(); }}>{t("removalClose")}</button>
    </div>}
  </section>;
}
