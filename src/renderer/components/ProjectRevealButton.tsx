import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

export function ProjectRevealButton({ client, workspaceId, projectId, name, language, disabled, minimumRevision, sourceLifetime, targetKey = name, locatorKey = targetKey }: {
  client: WorkspaceServiceClient; workspaceId: string; projectId: string; name: string; language: Language; disabled: boolean; minimumRevision?: { current: number }; sourceLifetime?: { current: number }; targetKey?: string; locatorKey?: string;
}) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState<TranslationKey | null>(null);
  const lifetime = useRef(0), busy = useRef(false), ready = useRef(true);
  const target = useRef({ key: targetKey, version: 0 });
  if (target.current.key !== targetKey) target.current = { key: targetKey, version: target.current.version + 1 };
  const locator = useRef({ key: locatorKey, version: 0 });
  if (locator.current.key !== locatorKey) locator.current = { key: locatorKey, version: locator.current.version + 1 };
  const feedbackContext = useRef({ locatorKey, revision: minimumRevision?.current, source: sourceLifetime?.current });
  useEffect(() => {
    const previous = feedbackContext.current;
    const next = { locatorKey, revision: minimumRevision?.current, source: sourceLifetime?.current };
    feedbackContext.current = next;
    // A status-only projection can arrive on either side of the typed missing
    // reply. Preserve that rejection only for the same locator/source context.
    const same = previous.locatorKey === next.locatorKey && previous.revision === next.revision && previous.source === next.source;
    setMessage(current => current === "revealMissing" && same ? current : null);
  }, [targetKey, locatorKey]);
  useEffect(() => {
    const unsubscribe = client.onBackendStatus((status) => {
      lifetime.current++; busy.current = false; ready.current = status.state === "ready"; setPending(false); setMessage(null);
    });
    return () => { lifetime.current++; unsubscribe(); };
  }, [client, workspaceId, projectId]);
  const t = (key: TranslationKey) => translate(language, key);
  const reveal = async () => {
    if (busy.current || disabled || !ready.current) return;
    busy.current = true; setPending(true); setMessage(null);
    const current = lifetime.current, revision = minimumRevision?.current, source = sourceLifetime?.current, requestedTarget = target.current.version, requestedLocator = locator.current.version;
    feedbackContext.current = { locatorKey, revision, source };
    try {
      const result = await client.revealProject(workspaceId, projectId);
      if (current !== lifetime.current) return;
      // Active observations can follow creation without changing the authorized
      // target. The service revalidates it after native completion; keep that
      // acknowledgment while still rejecting invalidated source/target lifetimes.
      if (revision !== minimumRevision?.current || source !== sourceLifetime?.current) { setMessage("revealUncertain"); return; }
      if (!result.ok || result.value.workspaceId !== workspaceId || result.value.projectId !== projectId) setMessage("revealUncertain");
      else if (requestedTarget !== target.current.version && (requestedLocator !== locator.current.version || result.value.outcome !== "rejected")) setMessage("revealUncertain");
      else if (result.value.outcome === "dispatched") setMessage("revealDispatched");
      else setMessage(result.value.problem === "mode_retained" ? "revealRetained" :
        ["missing", "replaced", "unresolved", "excluded"].includes(result.value.problem) ? "revealMissing" : "revealError");
    } catch { if (current === lifetime.current) setMessage("revealUncertain"); }
    finally { if (current === lifetime.current) { busy.current = false; setPending(false); } }
  };
  return <div className="project-reveal" aria-busy={pending}>
    <button type="button" className="workspace-button workspace-button--secondary" aria-label={`${t("revealProject")}: ${name}`} disabled={disabled || pending}
      onClick={() => void reveal()}>{t(pending ? "revealPending" : "revealProject")}</button>
    {message && <StatusMessage kind={message === "revealDispatched" ? "info" : "error"} title={t(message)} />}
  </div>;
}
