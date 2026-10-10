import { useEffect, useRef, useState } from "react";
import type { Language } from "../../contracts/settings.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";

export function ProjectRevealButton({ client, workspaceId, projectId, name, language, disabled, minimumRevision, observationVersion }: {
  client: WorkspaceServiceClient; workspaceId: string; projectId: string; name: string; language: Language; disabled: boolean; minimumRevision?: { current: number }; observationVersion?: { current: number };
}) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState<TranslationKey | null>(null);
  const lifetime = useRef(0), busy = useRef(false), ready = useRef(true);
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
    const current = lifetime.current, revision = minimumRevision?.current, observed = observationVersion?.current;
    try {
      const result = await client.revealProject(workspaceId, projectId);
      if (current !== lifetime.current) return;
      if (revision !== minimumRevision?.current || observed !== observationVersion?.current) { setMessage("revealUncertain"); return; }
      if (!result.ok || result.value.workspaceId !== workspaceId || result.value.projectId !== projectId) setMessage("revealUncertain");
      else if (result.value.outcome === "dispatched") setMessage("revealDispatched");
      else setMessage(result.value.problem === "mode_retained" ? "revealRetained" :
        ["missing", "replaced", "unresolved", "excluded"].includes(result.value.problem) ? "revealMissing" : "revealError");
    } catch { if (current === lifetime.current) setMessage("revealUncertain"); }
    finally { if (current === lifetime.current) { busy.current = false; setPending(false); } }
  };
  return <div className="project-reveal">
    <button type="button" className="workspace-button workspace-button--secondary" aria-label={`${t("revealProject")}: ${name}`} disabled={disabled || pending}
      onClick={() => void reveal()}>{t(pending ? "revealPending" : "revealProject")}</button>
    {message && <StatusMessage kind={message === "revealDispatched" ? "info" : "error"} title={t(message)} />}
  </div>;
}
