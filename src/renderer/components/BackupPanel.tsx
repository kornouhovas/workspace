import { useEffect, useRef, useState } from "react";
import type { BackupStatus } from "../../contracts/data-recovery.js";
import type { Language } from "../../contracts/settings.js";
import type { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate } from "../localization.js";

export function BackupPanel({ client, language, disabled, onSelect }: {
  client: WorkspaceServiceClient; language: Language; disabled: boolean; onSelect(content: string): void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    mounted.current = true;
    let active = true;
    async function refresh() {
      const version = generation.current;
      try {
        const result = await client.backups();
        if (active && version === generation.current) {
          if (!result.ok || !("backups" in result.value)) setError(true);
          else { setStatus(result.value.backups); setError(false); }
        }
      } catch { if (active && version === generation.current) setError(true); }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => { active = false; mounted.current = false; clearInterval(timer); };
  }, [client]);
  async function create() {
    generation.current++; setBusy(true); setError(false);
    try {
      const result = await client.backupNow();
      if (!mounted.current) return;
      if (!result.ok || !("backups" in result.value)) setError(true);
      else setStatus(result.value.backups);
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function choose() {
    if (!selected) return;
    generation.current++; setBusy(true); setError(false);
    try {
      const result = await client.exportBackup(selected);
      if (!mounted.current) return;
      if (!result.ok || !("content" in result.value)) setError(true);
      else onSelect(result.value.content);
    } catch { if (mounted.current) setError(true); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section aria-label={t("backupTitle")}>
    <h3>{t("backupTitle")}</h3>
    <p>{t("backupPolicy")}</p>
    {status && <p className="backup-destination">{t("backupDestination")}: {status.destination}</p>}
    {(error || status?.state === "failed") && <p role="alert">{t("backupFailed")}</p>}
    {!status && !error && <p role="status">{t("backupLoading")}</p>}
    {status && <p role="status">{status.snapshots.length ? `${t("backupLatest")}: ${new Date(status.snapshots[0].createdAt).toLocaleString(language)}` : t("backupEmpty")}</p>}
    <button type="button" disabled={disabled || busy} onClick={() => void create()}>{t("backupNow")}</button>
    <label className="bb-label" htmlFor="backup-selection">{t("backupSelect")}</label>
    <select id="backup-selection" disabled={disabled || busy || !status?.snapshots.length} value={selected} onChange={event => setSelected(event.currentTarget.value)}>
      <option value="">{t("backupSelect")}</option>
      {status?.snapshots.map(item => <option key={item.id} value={item.id}>
        {new Date(item.createdAt).toLocaleString(language)} — {t(item.kind === "automatic" ? "backupAutomatic" : "backupMigration")}
      </option>)}
    </select>
    <p>{t("backupOlder")}</p>
    <button type="button" disabled={disabled || busy || !selected || !status?.snapshots.some(item => item.id === selected)} onClick={() => void choose()}>{t("backupReview")}</button>
    {busy && <p role="status">{t("dataBusy")}</p>}
  </section>;
}
