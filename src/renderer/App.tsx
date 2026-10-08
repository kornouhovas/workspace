import { useCallback, useEffect, useState } from "react";
import type { BackendStatus } from "../contracts/desktop-api.js";
import type { Language } from "../contracts/settings.js";
import { EmptyStatePanel, LanguageSelect, StatusMessage } from "./components/bb-foundation.js";
import { translate, type TranslationKey } from "./localization.js";

type ViewState = "loading" | "ready" | "unavailable" | "load-error";

export function App() {
  const [backend, setBackend] = useState<BackendStatus>({ state: "starting" });
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [language, setLanguage] = useState<Language>("en");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const result = await window.workspace.settings({ type: "settings.load" });
      if (!result.ok) {
        setViewState("load-error");
        return;
      }
      setLanguage(result.value.language);
      setViewState("ready");
    } catch {
      setViewState("load-error");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = window.workspace.onBackendStatus(setBackend);
    void window.workspace.getBackendStatus().then(setBackend).catch(() => {
      setBackend({ state: "unavailable" });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (backend.state === "unavailable") {
      setViewState("unavailable");
    } else if (backend.state === "ready") {
      void loadSettings();
    } else {
      setViewState("loading");
    }
  }, [backend.state, loadSettings]);

  const changeLanguage = async (nextLanguage: Language) => {
    if (saving || nextLanguage === language) return;
    setSaving(true);
    setSaveError(false);
    try {
      const result = await window.workspace.settings({ type: "settings.setLanguage", language: nextLanguage });
      if (result.ok) {
        setLanguage(result.value.language);
      } else {
        setSaveError(true);
      }
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const t = (key: TranslationKey) => translate(language, key);

  return (
    <main className="workspace-screen" aria-label={t("appTitle")}>
      <header className="workspace-header"><h1>{t("appTitle")}</h1></header>
      {viewState === "loading" && <StatusMessage kind="info" title={t("loading")} />}
      {viewState === "unavailable" && (
        <StatusMessage kind="error" title={t("unavailableTitle")}>
          {t("unavailableDescription")}
        </StatusMessage>
      )}
      {viewState === "load-error" && (
        <StatusMessage kind="error" title={t("loadErrorTitle")}>
          {t("loadErrorDescription")}
        </StatusMessage>
      )}
      {viewState === "ready" && (
        <>
          <section className="workspace-settings" aria-labelledby="settings-title">
            <h2 id="settings-title">{t("settingsTitle")}</h2>
            <LanguageSelect
              id="interface-language"
              label={t("languageLabel")}
              value={language}
              onChange={(nextLanguage) => void changeLanguage(nextLanguage)}
              disabled={saving}
            />
            {saveError && (
              <StatusMessage kind="error" title={t("saveErrorTitle")}>
                {t("saveErrorDescription")}
              </StatusMessage>
            )}
          </section>
          <EmptyStatePanel>{t("emptyState")}</EmptyStatePanel>
        </>
      )}
    </main>
  );
}
