import type { Language } from "../../contracts/settings.js";
import { translate, type TranslationKey } from "../localization.js";
import { StatusMessage } from "./bb-foundation.js";
import { Hint } from "./Hint.js";
import { Icon } from "./Icons.js";

export function SourceRefresh({ language, pending, error, degraded, unavailable, unavailableTitle = "sourceUnavailableTitle", disabled, onRefresh }: {
  language: Language; pending: boolean; error: boolean; degraded: boolean; unavailable: boolean;
  unavailableTitle?: TranslationKey; disabled: boolean; onRefresh(): void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <div className={`source-refresh${!unavailable && !pending && !degraded && !error ? " source-refresh--quiet" : ""}${unavailable ? " bb-status bb-status--error" : ""}`} aria-busy={pending}
    role={unavailable ? "alert" : undefined}>
    {unavailable && <div>
      <h2 className="bb-status__title">{t(unavailableTitle)}</h2>
      <p className="bb-status__description">{t("sourceUnavailableDescription")}</p>
    </div>}
    <Hint label={t(pending ? "refreshingSource" : unavailable ? "retrySourceAction" : "refreshSourceAction")}><button key="refresh" type="button" className="workspace-button workspace-button--secondary workspace-source-retry"
      aria-label={t(pending ? "refreshingSource" : unavailable ? "retrySourceAction" : "refreshSourceAction")}
      disabled={disabled || pending} onClick={onRefresh}>
      <Icon name="refresh"/><span className={!unavailable && !pending && !degraded && !error ? "sr-only" : undefined}>{t(pending ? "refreshingSource" : unavailable ? "retrySourceAction" : "refreshSourceAction")}</span>
    </button></Hint>
    {pending && <StatusMessage kind="info" title={t("refreshingSource")} />}
    {degraded && <StatusMessage kind="info" title={t("automaticUpdatesDegraded")}>
      {t("automaticUpdatesDegradedDescription")}
    </StatusMessage>}
    {error && (unavailable ? <div>
      <h2 className="bb-status__title">{t("refreshSourceErrorTitle")}</h2>
      <p className="bb-status__description">{t("refreshSourceErrorDescription")}</p>
    </div> : <StatusMessage kind="error" title={t("refreshSourceErrorTitle")}>
      {t("refreshSourceErrorDescription")}
    </StatusMessage>)}
  </div>;
}
