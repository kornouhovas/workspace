import { useCallback, useEffect, useState } from "react";
import type { BackendStatus } from "../contracts/desktop-api.js";
import type { ServiceErrorCode } from "../contracts/settings.js";
import type { ActiveWorkspace, WorkspaceLoad } from "../contracts/workspaces.js";
import type { Language } from "../contracts/settings.js";
import { EmptyStatePanel, LanguageSelect, StatusMessage } from "./components/bb-foundation.js";
import { translate, type TranslationKey } from "./localization.js";
import { WorkspaceServiceClient } from "./workspace-service-client.js";

type ViewState = "loading" | "ready" | "unavailable" | "load-error";
type FormMessage = "cancelled" | "picker-failed" | "validation" | "permission" | "storage" | "activation" | null;

function errorMessage(code: ServiceErrorCode): FormMessage {
  if (code === "invalid_input") return "validation";
  if (code === "filesystem") return "permission";
  if (code === "storage") return "storage";
  return "activation";
}

export function App() {
  const [client] = useState(() => new WorkspaceServiceClient());
  const [backend, setBackend] = useState<BackendStatus>({ state: "starting" });
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [language, setLanguage] = useState<Language>("en");
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceLoad | null>(null);
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [formMessage, setFormMessage] = useState<FormMessage>(null);
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [busy, setBusy] = useState<"picker" | "create" | "activate" | null>(null);

  const loadInitialData = useCallback(async (isCurrent: () => boolean) => {
    try {
      const [settings, workspaces] = await Promise.all([client.loadSettings(), client.loadWorkspaces()]);
      if (!isCurrent()) return;
      if (!settings.ok || !workspaces.ok) {
        setViewState("load-error");
        return;
      }
      setLanguage(settings.value.language);
      setWorkspaceData(workspaces.value);
      setViewState("ready");
    } catch {
      if (isCurrent()) setViewState("load-error");
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = client.onBackendStatus((status) => {
      receivedEvent = true;
      setBackend(status);
    });
    void client.getBackendStatus().then((status) => {
      if (active && !receivedEvent) setBackend(status);
    }).catch(() => {
      if (active && !receivedEvent) setBackend({ state: "unavailable" });
    });
    return () => { active = false; unsubscribe(); };
  }, [client]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    if (backend.state === "unavailable") {
      setViewState("unavailable");
    } else if (backend.state === "ready") {
      void loadInitialData(() => active);
    } else {
      setViewState("loading");
    }
    return () => { active = false; };
  }, [backend.state, loadInitialData]);

  const changeLanguage = async (nextLanguage: Language) => {
    if (savingLanguage || nextLanguage === language) return;
    setSavingLanguage(true);
    setSaveError(false);
    try {
      const result = await client.setLanguage(nextLanguage);
      if (result.ok) setLanguage(result.value.language);
      else setSaveError(true);
    } catch {
      setSaveError(true);
    } finally {
      setSavingLanguage(false);
    }
  };

  const pickRoot = async () => {
    if (busy) return;
    setBusy("picker");
    setFormMessage(null);
    try {
      const result = await client.pickRoot();
      if (result.outcome === "selected") setRootPath(result.path);
      else setFormMessage(result.outcome === "cancelled" ? "cancelled" : "picker-failed");
    } catch {
      setFormMessage("picker-failed");
    } finally {
      setBusy(null);
    }
  };

  const createWorkspace = async () => {
    if (busy) return;
    setFormMessage(null);
    if (!name.trim() || !rootPath) {
      setFormMessage("validation");
      return;
    }
    setBusy("create");
    try {
      const result = await client.createWorkspace(name, rootPath);
      if (!result.ok) {
        setFormMessage(errorMessage(result.error.code));
        return;
      }
      const activeWorkspace: ActiveWorkspace = { ...result.value, sourceAvailable: true };
      setWorkspaceData((current) => ({
        workspaces: [
          ...(current?.workspaces.filter((item) => item.workspaceId !== activeWorkspace.workspaceId) ?? []),
          { workspaceId: activeWorkspace.workspaceId, name: activeWorkspace.name },
        ],
        activeWorkspace,
      }));
      setFormMessage(null);
      setName("");
      setAddingWorkspace(false);
    } catch {
      setFormMessage("storage");
    } finally {
      setBusy(null);
    }
  };

  const activateWorkspace = async (workspaceId: string) => {
    if (busy || !workspaceId) return;
    setBusy("activate");
    setFormMessage(null);
    try {
      const result = await client.activateWorkspace(workspaceId);
      if (result.ok) {
        setWorkspaceData((current) => current ? { ...current, activeWorkspace: result.value } : current);
      } else {
        setFormMessage(errorMessage(result.error.code));
      }
    } catch {
      setFormMessage("activation");
    } finally {
      setBusy(null);
    }
  };

  const t = (key: TranslationKey) => translate(language, key);
  const messageTitle: Partial<Record<NonNullable<FormMessage>, TranslationKey>> = {
    cancelled: "pickerCancelledTitle",
    "picker-failed": "pickerFailedTitle",
    validation: "workspaceValidationTitle",
    permission: "workspacePermissionTitle",
    storage: "workspaceStorageTitle",
    activation: "workspaceActivationTitle",
  };
  const messageDescription: Partial<Record<NonNullable<FormMessage>, TranslationKey>> = {
    cancelled: "pickerCancelledDescription",
    "picker-failed": "pickerFailedDescription",
    validation: "workspaceValidationDescription",
    permission: "workspacePermissionDescription",
    storage: "workspaceStorageDescription",
    activation: "workspaceActivationDescription",
  };
  const activeWorkspace = workspaceData?.activeWorkspace ?? null;

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
              disabled={savingLanguage}
            />
            {saveError && (
              <StatusMessage kind="error" title={t("saveErrorTitle")}>
                {t("saveErrorDescription")}
              </StatusMessage>
            )}
          </section>
          {activeWorkspace && !addingWorkspace ? (
            <section className="workspace-content" aria-labelledby="workspace-title">
              <div className="workspace-toolbar">
                <div>
                  <h2 id="workspace-title">{activeWorkspace.name}</h2>
                  <p className="workspace-root">{activeWorkspace.canonicalRoot}</p>
                </div>
                <div className="bb-field workspace-switcher">
                  <label className="bb-label" htmlFor="workspace-switcher">{t("workspaceSelectLabel")}</label>
                  <select
                    className="bb-select"
                    id="workspace-switcher"
                    value={activeWorkspace.workspaceId}
                    disabled={busy === "activate"}
                    onChange={(event) => void activateWorkspace(event.currentTarget.value)}
                  >
                    {workspaceData?.workspaces.map((workspace) => (
                      <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!activeWorkspace.sourceAvailable && (
                <StatusMessage kind="error" title={t("sourceUnavailableTitle")}>
                  {t("sourceUnavailableDescription")}
                </StatusMessage>
              )}
              <section className="table-view" aria-labelledby="table-title">
                <div className="table-view__heading">
                  <div>
                    <h3 id="table-title">{t("tableViewTitle")}</h3>
                    <p>{t("emptyTableDescription")}</p>
                  </div>
                  <span className="view-badge">{t("tableViewLabel")}</span>
                </div>
                <EmptyStatePanel>{t("emptyTableGuidance")}</EmptyStatePanel>
              </section>
              <button
                type="button"
                className="workspace-button workspace-button--secondary"
                onClick={() => { setFormMessage(null); setAddingWorkspace(true); }}
              >
                {t("addWorkspaceAction")}
              </button>
            </section>
          ) : (
            <section className="workspace-create" aria-labelledby="create-title">
              <h2 id="create-title">{t("createWorkspaceTitle")}</h2>
              <p className="workspace-intro">{t("createWorkspaceDescription")}</p>
              <label className="bb-field">
                <span className="bb-label">{t("workspaceNameLabel")}</span>
                <input
                  className="bb-input"
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                  autoComplete="off"
                />
              </label>
              <div className="root-picker-row">
                <button type="button" className="workspace-button workspace-button--secondary" onClick={() => void pickRoot()} disabled={busy !== null}>
                  {busy === "picker" ? t("pickerLoading") : t("pickRootAction")}
                </button>
                <div className="selected-root" aria-live="polite">
                  <span className="bb-label">{t("selectedRootLabel")}</span>
                  <span className="selected-root__path">{rootPath || t("noRootSelected")}</span>
                </div>
              </div>
              <button type="button" className="workspace-button" onClick={() => void createWorkspace()} disabled={busy !== null}>
                {busy === "create" ? t("creatingWorkspace") : t("createWorkspaceAction")}
              </button>
              {activeWorkspace && (
                <button
                  type="button"
                  className="workspace-button workspace-button--secondary"
                  onClick={() => { setAddingWorkspace(false); setFormMessage(null); }}
                  disabled={busy !== null}
                >
                  {t("cancelAddWorkspace")}
                </button>
              )}
              {formMessage && (
                <StatusMessage kind={formMessage === "cancelled" ? "info" : "error"} title={t(messageTitle[formMessage] ?? "workspaceStorageTitle")}>
                  {t(messageDescription[formMessage] ?? "workspaceStorageDescription")}
                </StatusMessage>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
