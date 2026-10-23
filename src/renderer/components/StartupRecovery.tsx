import type { Language } from "../../contracts/settings.js";
import type { StartupDiagnostic } from "../../contracts/startup-diagnostic.js";
import { translate } from "../localization.js";
import { shellLabels } from "./DesktopShell.js";
import { useSettingsNavigation } from "./SettingsNavigation.js";

export function RecoverySettingsEntry({ language }: { language: Language }) {
  const navigation = useSettingsNavigation();
  return <button type="button" className="workspace-button workspace-button--secondary" onClick={() => navigation?.open("backup")}>{shellLabels[language].backup}</button>;
}

export function StartupRecovery({ language, diagnostic }: { language: Language; diagnostic?: StartupDiagnostic }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <section className="data-recovery" aria-labelledby="startup-recovery-title">
    <h2 id="startup-recovery-title">{t("dataTitle")}</h2>
    <p>{t(diagnostic?.code === "BACKUP_FAILED" ? "backupStartupFailed" : diagnostic?.code === "MIGRATION_FAILED" ? "backupMigrationFailed" : "dataStartupRecovery")}</p>
    <p>{t("backupOlder")}</p>
    <p>{t("dataScope")}</p>
  </section>;
}
