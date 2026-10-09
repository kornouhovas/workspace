import { useEffect, useRef, useState } from "react";
import type { DiscoveryPreview } from "../../contracts/workspaces.js";
import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { EmptyStatePanel, StatusMessage } from "./bb-foundation.js";

interface PanelProps {
  language: Language;
  preview: DiscoveryPreview | null;
  pending: boolean;
  error: boolean;
  onExclude(relativePath: string, excluded: boolean): void;
  onRetry(): void;
  onCancel(): void;
}
const stateLabels: Record<DiscoveryPreview["state"], TranslationKey> = {
  ready: "discoveryReady", empty: "discoveryEmpty", unavailable: "discoveryUnavailable",
  unreadable: "discoveryUnreadable", root_identity_conflict: "discoveryRootConflict", changed: "discoveryChanged",
};
const reasonLabels = {
  manual: "discoveryManual", link: "discoveryLink", hidden: "discoveryHidden",
  service: "discoveryService", archive: "discoveryArchive",
} as const;

export function DiscoveryPanel({ language, preview, pending, error, onExclude, onRetry, onCancel }: PanelProps) {
  const t = (key: TranslationKey) => translate(language, key);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestedFocus = useRef<string | null>(null);
  const controls = useRef(new Map<string, HTMLInputElement>());
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pending && requestedFocus.current) {
      (controls.current.get(requestedFocus.current) ?? retry.current)?.focus();
      requestedFocus.current = null;
    }
  }, [pending, preview]);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="discovery-panel" aria-labelledby="discovery-title" aria-busy={pending}>
    <h3 id="discovery-title" ref={heading} tabIndex={-1}>{t("discoveryTitle")}</h3>
    <p>{t("discoveryDescription")}</p>
    {pending && <StatusMessage kind="info" title={t("discoveryLoading")} />}
    {error && <StatusMessage kind="error" title={t("discoveryError")} />}
    {preview && <>
      <p className="workspace-root">{preview.canonicalRoot}</p>
      <StatusMessage kind={preview.previewToken ? "info" : "error"} title={t(stateLabels[preview.state])} />
      {preview.entries.length > 0 ? <ul className="discovery-entries">
        {preview.entries.map((entry) => {
          const automatic = entry.reason !== null && entry.reason !== "manual";
          return <li key={entry.relativePath}>
            <label>
              <input type="checkbox" ref={(element) => {
                if (element) controls.current.set(entry.relativePath, element); else controls.current.delete(entry.relativePath);
              }} checked={entry.reason !== null} disabled={pending || automatic}
                onChange={(event) => { requestedFocus.current = entry.relativePath; onExclude(entry.relativePath, event.currentTarget.checked); }} />
              <span>{t("discoveryExclude")}: <span className="discovery-name">{entry.name}</span></span>
            </label>
            {entry.reason && <span className="discovery-reason">{t(reasonLabels[entry.reason])}</span>}
          </li>;
        })}
      </ul> : preview.previewToken && <EmptyStatePanel>{t("discoveryEmptyDescription")}</EmptyStatePanel>}
    </>}
    <div className="workspace-form-actions">
      <button ref={retry} type="button" className="workspace-button workspace-button--secondary" disabled={pending} onClick={onRetry}>{t("discoveryRefresh")}</button>
      <button type="button" className="workspace-button workspace-button--secondary" onClick={onCancel}>{t("cancelRenameWorkspace")}</button>
    </div>
  </section>;
}

export function DiscoveryController({ client, workspaceId, language, disabled }: {
  client: WorkspaceServiceClient; workspaceId: string; language: Language; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DiscoveryPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const exclusions = useRef<string[] | undefined>(undefined);
  useEffect(() => () => { version.current++; }, []);
  useEffect(() => {
    if (!open && returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; }
  }, [open]);
  const request = async (draft?: string[]) => {
    const current = ++version.current;
    exclusions.current = draft;
    setPending(true);
    setError(false);
    setPreview(null);
    try {
      const result = await client.previewDiscovery(workspaceId, draft);
      if (current !== version.current) return;
      if (result.ok && result.value.workspaceId === workspaceId) {
        setPreview(result.value);
        exclusions.current = result.value.excludedRelativePaths;
      } else setError(true);
    } catch { if (current === version.current) setError(true); }
    finally { if (current === version.current) setPending(false); }
  };
  return <>
    <button ref={trigger} type="button" className="workspace-button workspace-button--secondary" disabled={disabled || open}
      onClick={() => { setOpen(true); void request(); }}>{translate(language, "discoveryAction")}</button>
    {open && <DiscoveryPanel language={language} preview={preview} pending={pending} error={error}
      onRetry={() => void request(exclusions.current)}
      onExclude={(name, excluded) => {
        const draft = new Set(exclusions.current ?? []);
        if (excluded) draft.add(name); else draft.delete(name);
        void request([...draft]);
      }}
      onCancel={() => { version.current++; returnFocus.current = true; setOpen(false); setPreview(null); setPending(false); }} />}
  </>;
}
