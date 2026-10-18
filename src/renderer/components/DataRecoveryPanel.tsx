import { useEffect, useRef, useState } from "react";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import type { Language } from "../../contracts/settings.js";
import { maxExportBytes } from "../../contracts/data-recovery.js";
import { translate } from "../localization.js";

export function DataRecoveryPanel({ client, language, onRestored, onLock }: {
  client: WorkspaceServiceClient; language: Language; onRestored(): void; onLock(locked: boolean): void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [content, setContent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"dataError" | "dataExported" | "dataUnknown" | null>(null);
  const [unknown, setUnknown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const returnFocus = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (content !== null) confirm.current?.focus();
    else if (returnFocus.current) { returnFocus.current = false; input.current?.focus(); }
  }, [content]);
  function cancel() {
    if (busy) return;
    returnFocus.current = true; setContent(null); onLock(false);
    if (input.current) { input.current.value = ""; }
  }
  async function select(file: File | undefined) {
    if (!file) return;
    setMessage(null); setBusy(true); onLock(true);
    try {
      if (file.size > maxExportBytes) throw new Error("Too large");
      const text = await file.text();
      if (mounted.current) setContent(text);
    } catch { if (mounted.current) { setMessage("dataError"); onLock(false); } }
    finally { if (mounted.current) setBusy(false); }
  }
  async function download() {
    setMessage(null); setBusy(true);
    try {
      const result = await client.exportData();
      if (!mounted.current) return;
      if (!result.ok || !("content" in result.value)) throw new Error("Export failed");
      const url = URL.createObjectURL(new Blob([result.value.content], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = "workspace-application-data.json";
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("dataExported");
    } catch { if (mounted.current) setMessage("dataError"); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function restore() {
    if (content === null || busy || unknown) return;
    setBusy(true); setMessage(null);
    try {
      const result = await client.restoreData(content);
      if (!mounted.current) return;
      if (!result.ok) {
        // A transport failure may have occurred after commit. Never replay it.
        if (result.error.code === "service_unavailable") { setUnknown(true); setMessage("dataUnknown"); }
        else setMessage("dataError");
      } else if ("restored" in result.value) { onRestored(); }
      else { setUnknown(true); setMessage("dataUnknown"); }
    } catch { if (mounted.current) { setUnknown(true); setMessage("dataUnknown"); } }
    finally { if (mounted.current) setBusy(false); }
  }
  return <details className="data-recovery">
    <summary id="data-title">{t("dataTitle")}</summary>
    <div className="workspace-settings">
    <p>{t("dataScope")}</p>
    <button type="button" disabled={busy || content !== null} onClick={() => void download()}>{t("dataExport")}</button>
    <label className="bb-label" htmlFor="data-file">{t("dataFile")}</label>
    <input ref={input} id="data-file" type="file" accept=".json,application/json" disabled={busy || content !== null} onChange={event => void select(event.currentTarget.files?.[0])} />
    {content !== null && <div role="group" aria-label={t("dataConfirmTitle")} onKeyDown={event => { if (event.key === "Escape" && !unknown) { event.preventDefault(); cancel(); } }}>
      <p>{t("dataConfirmTitle")}</p><p>{t("dataReplace")}</p>
      <button ref={confirm} type="button" disabled={busy || unknown} onClick={() => void restore()}>{t("dataConfirm")}</button>
      <button type="button" disabled={busy || unknown} onClick={cancel}>{t("dataCancel")}</button>
      {unknown && <button type="button" onClick={onRestored}>{t("dataReload")}</button>}
    </div>}
    {busy && <p role="status">{t("dataBusy")}</p>}
    {message && <p role={message === "dataExported" ? "status" : "alert"}>{t(message)}</p>}
    </div>
  </details>;
}
