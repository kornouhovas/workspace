import { DesktopShell, AppearanceControl, shellLabels } from "./components/DesktopShell.js";
import { DataRecoveryPanel } from "./components/DataRecoveryPanel.js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BackendStatus } from "../contracts/desktop-api.js";
import type { ServiceErrorCode } from "../contracts/settings.js";
import type { ActiveWorkspace, WorkspaceLoad, WorkspaceSourceState, WorkspaceChangeEvent, ProjectList } from "../contracts/workspaces.js";
import type { Appearance, Language } from "../contracts/settings.js";
import { LanguageSelect, StatusMessage } from "./components/bb-foundation.js";
import { translate, type TranslationKey } from "./localization.js";
import { SourceRefresh } from "./components/SourceRefresh.js";
import { DiscoveryWorkspace } from "./components/DiscoveryPanel.js";
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
  const [dataLocked, setDataLocked] = useState(false);
  const [client] = useState(() => new WorkspaceServiceClient());
  const [backend, setBackend] = useState<BackendStatus>({ state: "starting" });
  const backendState = useRef<BackendStatus["state"]>("starting");
  const [backendGeneration, setBackendGeneration] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [language, setLanguage] = useState<Language>("en");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceError, setAppearanceError] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceLoad | null>(null);
  const selectedWorkspace = useRef<ActiveWorkspace | null>(null);
  selectedWorkspace.current = workspaceData?.activeWorkspace ?? null;
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [formMessage, setFormMessage] = useState<FormMessage>(null);
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [busy, setBusy] = useState<"picker" | "create" | "activate" | "rename" | "reorder" | "remove" | "refresh" | null>(null);
  const [sourceFeedback, setSourceFeedback] = useState<{ workspaceId: string; state: ProjectList["state"] } | null>(null);
  const [sourceRefreshVersion, setSourceRefreshVersion] = useState(0);
  const recoveryPending = useRef<string | null>(null);
  const [uncertainRecovery, setUncertainRecovery] = useState<string | null>(null);
  const observeSourceScan = useCallback((workspaceId: string, state: ProjectList["state"]) => {
    setSourceFeedback((current) => current?.workspaceId === workspaceId && current.state === state ? current : { workspaceId, state });
  }, []);
  const [renameDraft, setRenameDraft] = useState<{ workspaceId: string; name: string } | null>(null);
  const [renameError, setRenameError] = useState<"blank" | "stale" | "save" | null>(null);
  const [reorderError, setReorderError] = useState<"stale" | "save" | null>(null);
  const [removalTarget, setRemovalTarget] = useState<{ workspaceId: string; name: string } | null>(null);
  const [removalError, setRemovalError] = useState<"stale" | "save" | null>(null);
  const [refreshError, setRefreshError] = useState(false);
  const refreshPending = useRef<object | null>(null);
  const [sourceObservations, setSourceObservations] = useState(new Map<string, Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }>>());
  const observationVersions = useRef(new Map<string, number>());
  const backendLifetime = useRef(0);
  const dataVersion = useRef(0);
  const sourceVersion = useRef(new Map<string, number>());
  const sourceStates = useRef(new Map<string, WorkspaceSourceState>());
  const applyObservedSource = useCallback((active: ActiveWorkspace): ActiveWorkspace => {
    const source = sourceStates.current.get(active.sourceId);
    return source && source.workspaceIds.includes(active.workspaceId)
      ? { ...active, canonicalRoot: source.canonicalRoot, sourceAvailable: source.sourceAvailable }
      : active;
  }, []);
  const applyWorkspaceData = useCallback((data: WorkspaceLoad) => {
    setWorkspaceData({ ...data, activeWorkspace: data.activeWorkspace ? applyObservedSource(data.activeWorkspace) : null });
  }, [applyObservedSource]);
  const acceptSourceObservation = useCallback((event: Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }>) => {
    const selected = selectedWorkspace.current;
    if (selected?.sourceId === event.sourceId && !event.workspaceIds.includes(selected.workspaceId)) return;
    if (!event.workspaceIds.length || event.observationRevision <= (observationVersions.current.get(event.sourceId) ?? 0)) return;
    observationVersions.current.set(event.sourceId, event.observationRevision);
    sourceVersion.current.set(event.sourceId, (sourceVersion.current.get(event.sourceId) ?? 0) + 1);
    setSourceObservations((current) => new Map(current).set(event.sourceId, event));
  }, []);
  useEffect(() => {
    let active = true;
    const unsubscribe = client.onWorkspaceChange((event) => {
      if (!active) return;
      if (event.type === "workspace.listChanged") {
        dataVersion.current++;
        // This snapshot was observed after the cached source state.
        if (event.snapshot.activeWorkspace) sourceStates.current.delete(event.snapshot.activeWorkspace.sourceId);
        selectedWorkspace.current = event.snapshot.activeWorkspace;
        setWorkspaceData(event.snapshot);
        setRenameDraft((draft) => draft && !event.snapshot.workspaces.some((workspace) => workspace.workspaceId === draft.workspaceId) ? null : draft);
        setRemovalTarget((target) => target && !event.snapshot.workspaces.some((workspace) => workspace.workspaceId === target.workspaceId) ? null : target);
        setRefreshError(false);
      } else if (event.type === "workspace.sourceObserved") {
        acceptSourceObservation(event);
      } else if (event.type === "workspace.sourceChanged") {
        sourceVersion.current.set(event.source.sourceId, (sourceVersion.current.get(event.source.sourceId) ?? 0) + 1);
        sourceStates.current.set(event.source.sourceId, event.source);
        setWorkspaceData((current) => {
          const workspace = current?.activeWorkspace;
          if (!workspace || workspace.sourceId !== event.source.sourceId ||
            !event.source.workspaceIds.includes(workspace.workspaceId)) return current;
          return { ...current, activeWorkspace: {
            ...workspace, canonicalRoot: event.source.canonicalRoot, sourceAvailable: event.source.sourceAvailable,
          } };
        });
      }
    });
    return () => { active = false; dataVersion.current++; unsubscribe(); };
  }, [client, acceptSourceObservation]);
  const removalFocus = useRef<string | null>(null);
  const createNameInput = useRef<HTMLInputElement>(null);
  const managementList = useRef<HTMLOListElement>(null);
  const reorderFocus = useRef<{ workspaceId: string; direction: "up" | "down" } | null>(null);

  useEffect(() => {
    if (busy || removalTarget || !removalFocus.current) return;
    const buttons = Array.from(managementList.current?.querySelectorAll<HTMLButtonElement>("button[data-action='remove']") ?? []);
    const target = buttons.find((button) => button.dataset.workspaceId === removalFocus.current) ?? buttons[0];
    (target ?? createNameInput.current)?.focus();
    removalFocus.current = null;
  }, [busy, removalTarget, workspaceData]);

  useEffect(() => {
    if (busy || !reorderFocus.current) return;
    const { workspaceId, direction } = reorderFocus.current;
    const buttons = Array.from(managementList.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])
      .filter((button) => button.dataset.workspaceId === workspaceId && !button.disabled);
    (buttons.find((button) => button.dataset.direction === direction) ?? buttons[0])?.focus();
    reorderFocus.current = null;
  }, [busy, workspaceData]);

  const renameButton = useRef<HTMLButtonElement>(null);
  const returnRenameFocus = useRef(false);

  useEffect(() => {
    if (!renameDraft && returnRenameFocus.current) {
      renameButton.current?.focus();
      returnRenameFocus.current = false;
    }
  }, [renameDraft]);

  const loadInitialData = useCallback(async (isCurrent: () => boolean) => {
    const version = dataVersion.current;
    try {
      const [settings, workspaces] = await Promise.all([client.loadSettings(), client.loadWorkspaces()]);
      if (!isCurrent()) return;
      if (!settings.ok || (!workspaces.ok && version === dataVersion.current)) {
        setViewState("load-error");
        return;
      }
      setLanguage(settings.value.language);
      setAppearance(settings.value.appearance ?? "system");
      if (workspaces.ok && version === dataVersion.current) applyWorkspaceData(workspaces.value);
      setViewState("ready");
    } catch {
      if (isCurrent()) setViewState("load-error");
    }
  }, [client, applyWorkspaceData]);

  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const observe = (status: BackendStatus) => {
      if (!active) return;
      if (status.state !== backendState.current) {
        if (recoveryPending.current) {
          setUncertainRecovery(recoveryPending.current);
          recoveryPending.current = null;
        }
        backendState.current = status.state;
        backendLifetime.current++;
        dataVersion.current++;
        // Source observations belong to the backend that produced them.
        // Events received after this transition can still override a delayed load.
        sourceStates.current.clear();
        sourceVersion.current.clear();
        observationVersions.current.clear();
        setSourceObservations(new Map());
        setRefreshError(false);
        if (refreshPending.current) { refreshPending.current = null; setBusy(null); }
        // React may batch unavailable/ready notifications into one render.
        // Still discard children and responses belonging to the prior backend.
        setBackendGeneration((generation) => generation + 1);
      }
      setBackend(status);
    };
    const unsubscribe = client.onBackendStatus((status) => {
      receivedEvent = true;
      observe(status);
    });
    void client.getBackendStatus().then((status) => {
      if (active && !receivedEvent) observe(status);
    }).catch(() => {
      if (active && !receivedEvent) observe({ state: "unavailable" });
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
  }, [backend.state, backendGeneration, loadInitialData]);

  useEffect(() => {
    let current = true;
    const selected = workspaceData?.activeWorkspace;
    const lifetime = backendLifetime.current;
    if (backend.state === "ready" && selected) {
      // Startup events can precede renderer subscription. Read current status
      // after selection/readiness; newer live revisions still win over this read.
      void client.getSourceObservation(selected.workspaceId).then((result) => {
        if (!current || lifetime !== backendLifetime.current || !result.ok || !result.value.observation || backendState.current !== "ready" ||
          selectedWorkspace.current?.workspaceId !== selected.workspaceId) return;
        const observation = result.value.observation;
        if (observation.sourceId === selected.sourceId) acceptSourceObservation(observation);
      }).catch(() => { /* Ordinary refresh/events remain available after a failed status read. */ });
    }
    return () => { current = false; };
  }, [client, backend.state, backendGeneration, workspaceData?.activeWorkspace?.workspaceId, acceptSourceObservation]);

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

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = appearance === "dark" || appearance === "system" && media.matches;
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance]);

  const changeAppearance = async (next: Appearance) => {
    if (savingAppearance || next === appearance) return;
    setSavingAppearance(true); setAppearanceError(false);
    try {
      const result = await client.setAppearance(next);
      if (result.ok) setAppearance(result.value.appearance);
      else setAppearanceError(true);
    } catch { setAppearanceError(true); }
    finally { setSavingAppearance(false); }
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
    const version = ++dataVersion.current;
    setBusy("create");
    try {
      const result = await client.createWorkspace(name, rootPath);
      if (!result.ok) {
        setFormMessage(errorMessage(result.error.code));
        return;
      }
      const activeWorkspace = applyObservedSource({ ...result.value, sourceAvailable: true });
      if (version === dataVersion.current) setWorkspaceData((current) => ({
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
    const version = ++dataVersion.current;
    setBusy("activate");
    setFormMessage(null);
    try {
      const result = await client.activateWorkspace(workspaceId);
      if (result.ok) {
        if (version === dataVersion.current) setWorkspaceData((current) => current ? { ...current, activeWorkspace: applyObservedSource(result.value) } : current);
      } else {
        setFormMessage("activation");
      }
    } catch {
      setFormMessage("activation");
    } finally {
      setBusy(null);
    }
  };

  const cancelRename = () => {
    if (busy) return;
    setRenameDraft(null);
    setRenameError(null);
  };

  const renameWorkspace = async () => {
    if (busy || !renameDraft) return;
    if (!renameDraft.name.trim()) {
      setRenameError("blank");
      return;
    }
    const version = ++dataVersion.current;
    setBusy("rename");
    setRenameError(null);
    try {
      const result = await client.renameWorkspace(renameDraft.workspaceId, renameDraft.name);
      if (result.ok) {
        if (version === dataVersion.current) applyWorkspaceData(result.value);
        setRenameDraft(null);
      } else {
        setRenameError(result.error.code === "invalid_input" ? "stale" : "save");
      }
    } catch {
      setRenameError("save");
    } finally {
      setBusy(null);
    }
  };

  const moveWorkspace = async (workspaceId: string, direction: "up" | "down") => {
    if (busy || renameDraft || removalTarget || !workspaceData) return;
    const workspaceIds = workspaceData.workspaces.map((workspace) => workspace.workspaceId);
    const index = workspaceIds.indexOf(workspaceId);
    const target = index + (direction === "up" ? -1 : 1);
    if (index < 0 || target < 0 || target >= workspaceIds.length) return;
    [workspaceIds[index], workspaceIds[target]] = [workspaceIds[target], workspaceIds[index]];
    reorderFocus.current = { workspaceId, direction };
    const version = ++dataVersion.current;
    setBusy("reorder");
    setReorderError(null);
    try {
      const result = await client.reorderWorkspaces(workspaceIds);
      if (result.ok) {
        if (version === dataVersion.current) applyWorkspaceData(result.value);
      } else setReorderError(result.error.code === "invalid_input" ? "stale" : "save");
    } catch {
      setReorderError("save");
    } finally {
      setBusy(null);
    }
  };

  const cancelRemoval = () => {
    if (busy || !removalTarget) return;
    removalFocus.current = removalTarget.workspaceId;
    setRemovalTarget(null);
    setRemovalError(null);
  };

  const removeWorkspace = async () => {
    if (busy || !removalTarget) return;
    const version = ++dataVersion.current;
    setBusy("remove");
    setRemovalError(null);
    try {
      const result = await client.removeWorkspace(removalTarget.workspaceId);
      if (result.ok) {
        removalFocus.current = removalTarget.workspaceId;
        if (version === dataVersion.current) applyWorkspaceData(result.value);
        setRemovalTarget(null);
        setFormMessage(null);
        setReorderError(null);
      } else {
        setRemovalError(result.error.code === "invalid_input" ? "stale" : "save");
      }
    } catch {
      setRemovalError("save");
    } finally {
      setBusy(null);
    }
  };

  const refreshSource = async () => {
    const selected = workspaceData?.activeWorkspace;
    if (busy || refreshPending.current || !selected) return;
    const request = {};
    refreshPending.current = request;
    const { workspaceId, sourceId } = selected;
    const version = sourceVersion.current.get(sourceId);
    const selectionVersion = dataVersion.current;
    setBusy("refresh");
    setRefreshError(false);
    try {
      const result = await client.refreshSource(workspaceId);
      if (refreshPending.current !== request || selectionVersion !== dataVersion.current) return;
      if (!result.ok) { setRefreshError(true); return; }
      setSourceRefreshVersion((current) => current + 1);
      if (version !== sourceVersion.current.get(sourceId) || selectionVersion !== dataVersion.current) return;
      setWorkspaceData((current) => {
        const active = current?.activeWorkspace;
        if (!active || active.workspaceId !== workspaceId || active.sourceId !== result.value.sourceId) return current;
        return { ...current, activeWorkspace: {
          ...active, canonicalRoot: result.value.canonicalRoot, sourceAvailable: result.value.sourceAvailable,
        } };
      });
    } catch { if (refreshPending.current === request && selectionVersion === dataVersion.current) setRefreshError(true); }
    finally { if (refreshPending.current === request) { refreshPending.current = null; setBusy(null); } }
  };

  const t = (key: TranslationKey) => translate(language, key);
  const messageTitle: Record<NonNullable<FormMessage>, TranslationKey> = {
    cancelled: "pickerCancelledTitle",
    "picker-failed": "pickerFailedTitle",
    validation: "workspaceValidationTitle",
    permission: "workspacePermissionTitle",
    storage: "workspaceStorageTitle",
    activation: "workspaceActivationTitle",
  };
  const messageDescription: Record<NonNullable<FormMessage>, TranslationKey> = {
    cancelled: "pickerCancelledDescription",
    "picker-failed": "pickerFailedDescription",
    validation: "workspaceValidationDescription",
    permission: "workspacePermissionDescription",
    storage: "workspaceStorageDescription",
    activation: "workspaceActivationDescription",
  };
  const activeWorkspace = workspaceData?.activeWorkspace ?? null;

  const settingsAvailable = viewState === "ready";
  const unavailableSettings = <StatusMessage kind="info" title={shellLabels[language].unavailable} />;
  return (
    <DesktopShell language={language} data={workspaceData} busy={viewState !== "ready" || busy !== null || renameDraft !== null || removalTarget !== null} locked={dataLocked}
      onActivate={(id) => { setAddingWorkspace(false); void activateWorkspace(id); }}
      renderPanels={(back) => ({
        general: settingsAvailable ? <>          <section className="workspace-settings" aria-labelledby="settings-title">
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
</> : unavailableSettings,
        appearance: settingsAvailable ? <>
          <AppearanceControl language={language} value={appearance} disabled={savingAppearance} onChange={next => void changeAppearance(next)} />
          {appearanceError && <StatusMessage kind="error" title={t("saveErrorTitle")}>{t("saveErrorDescription")}</StatusMessage>}
        </> : unavailableSettings,
        workspaces: settingsAvailable ? <>{activeWorkspace ? <>
          <h2>{activeWorkspace.name}</h2>
          <label className="bb-field">{t("workspaceSelectLabel")}
            <select className="bb-select" value={activeWorkspace.workspaceId} disabled={busy !== null || renameDraft !== null || removalTarget !== null}
              onChange={event => void activateWorkspace(event.currentTarget.value)}>
              {workspaceData?.workspaces.map(workspace => <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.name}</option>)}
            </select>
          </label>
          <button type="button" className="workspace-button workspace-button--secondary" disabled={busy !== null || renameDraft !== null || removalTarget !== null}
            onClick={() => { setFormMessage(null); setAddingWorkspace(true); back(); }}>{t("addWorkspaceAction")}</button>              <section className="workspace-management" aria-labelledby="workspace-order-title" aria-busy={busy === "reorder"}>
                <h3 id="workspace-order-title">{t("workspaceOrderTitle")}</h3>
                <ol ref={managementList} className="workspace-management__list" aria-label={t("workspaceOrderTitle")}>
                  {workspaceData?.workspaces.map((workspace, index, all) => (
                    <li key={workspace.workspaceId} className="workspace-management__row">
                      <span className="workspace-management__name">{workspace.name}</span>
                      <div className="workspace-form-actions">
                        {(["up", "down"] as const).map((direction) => (
                          <button
                            key={direction}
                            type="button"
                            className="workspace-button workspace-button--secondary"
                            data-workspace-id={workspace.workspaceId}
                            data-direction={direction}
                            aria-label={`${t(direction === "up" ? "moveWorkspaceUp" : "moveWorkspaceDown")}: ${workspace.name}`}
                            disabled={busy !== null || renameDraft !== null || removalTarget !== null || (direction === "up" ? index === 0 : index === all.length - 1)}
                            onClick={() => void moveWorkspace(workspace.workspaceId, direction)}
                          >
                            {t(direction === "up" ? "moveWorkspaceUp" : "moveWorkspaceDown")}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="workspace-button workspace-button--secondary"
                          data-workspace-id={workspace.workspaceId}
                          data-action="remove"
                          aria-label={`${t("removeWorkspaceAction")}: ${workspace.name}`}
                          disabled={busy !== null || renameDraft !== null || removalTarget !== null}
                          onClick={() => { setRemovalTarget(workspace); setRemovalError(null); }}
                        >
                          {t("removeWorkspaceAction")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                {busy === "reorder" && <p role="status">{t("savingWorkspaceOrder")}</p>}
                {reorderError && (
                  <StatusMessage kind="error" title={t("reorderErrorTitle")}>
                    {t(reorderError === "stale" ? "reorderStaleDescription" : "reorderErrorDescription")}
                  </StatusMessage>
                )}
              </section>
              {removalTarget && (
                <form
                  className="workspace-removal"
                  aria-labelledby="remove-title"
                  aria-describedby="remove-description"
                  aria-busy={busy === "remove"}
                  onSubmit={(event) => { event.preventDefault(); void removeWorkspace(); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { event.preventDefault(); cancelRemoval(); }
                  }}
                >
                  <h3 id="remove-title">{t("removeWorkspaceTitle")}: <span>{removalTarget.name}</span></h3>
                  <p id="remove-description">{t("removeWorkspaceDescription")}</p>
                  <div className="workspace-form-actions">
                    <button type="button" autoFocus className="workspace-button workspace-button--secondary" disabled={busy !== null} onClick={cancelRemoval}>
                      {t("cancelRemoveWorkspace")}
                    </button>
                    <button type="submit" className="workspace-button" disabled={busy !== null}>
                      {busy === "remove" ? t("removingWorkspace") : t("confirmRemoveWorkspace")}
                    </button>
                  </div>
                  {removalError && (
                    <StatusMessage kind="error" title={t("removeErrorTitle")}>
                      {t(removalError === "stale" ? "removeStaleDescription" : "removeErrorDescription")}
                    </StatusMessage>
                  )}
                </form>
              )}
              <button
                ref={renameButton}
                type="button"
                className="workspace-button workspace-button--secondary"
                disabled={busy !== null || renameDraft !== null || removalTarget !== null}
                onClick={() => {
                  setRenameDraft({ workspaceId: activeWorkspace.workspaceId, name: activeWorkspace.name });
                  setRenameError(null);
                  returnRenameFocus.current = true;
                }}
              >
                {t("renameWorkspaceAction")}
              </button>
              {renameDraft && (
                <form
                  className="workspace-rename"
                  aria-label={t("renameWorkspaceAction")}
                  aria-busy={busy === "rename"}
                  onSubmit={(event) => { event.preventDefault(); void renameWorkspace(); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
                  }}
                >
                  <label className="bb-field">
                    <span className="bb-label">{t("workspaceNameLabel")}</span>
                    <input
                      className="bb-input"
                      autoFocus
                      autoComplete="off"
                      value={renameDraft.name}
                      disabled={busy !== null}
                      aria-invalid={renameError === "blank"}
                      aria-describedby={renameError ? "rename-error" : undefined}
                      onChange={(event) => setRenameDraft({ ...renameDraft, name: event.currentTarget.value })}
                    />
                  </label>
                  <div className="workspace-form-actions">
                    <button type="submit" className="workspace-button" disabled={busy !== null}>
                      {busy === "rename" ? t("savingWorkspaceName") : t("saveWorkspaceName")}
                    </button>
                    <button type="button" className="workspace-button workspace-button--secondary" disabled={busy !== null} onClick={cancelRename}>
                      {t("cancelRenameWorkspace")}
                    </button>
                  </div>
                  {renameError && (
                    <div id="rename-error">
                      <StatusMessage kind="error" title={t("renameErrorTitle")}>
                        {t(renameError === "blank" ? "renameValidation" : renameError === "stale" ? "renameStaleDescription" : "renameErrorDescription")}
                      </StatusMessage>
                    </div>
                  )}
                </form>
              )}
</> : <p>{t("createWorkspaceDescription")}</p>}</> : unavailableSettings,
        sources: settingsAvailable && activeWorkspace ? <><h2>{activeWorkspace.name}</h2><p className="workspace-root">{activeWorkspace.canonicalRoot}</p></> : settingsAvailable ? <p>{t("createWorkspaceDescription")}</p> : unavailableSettings,
        backup: settingsAvailable ? <DataRecoveryPanel key={backendGeneration} client={client} language={language} onRestored={() => window.location.reload()} onLock={setDataLocked} /> : unavailableSettings,
        about: <><h2>Workspace</h2><p>{shellLabels[language].aboutDescription}</p><p>bb · MIT · Copyright (c) 2026 Michael Yong</p></>,
      })}>
    <main data-ready={viewState === "ready"} className="workspace-screen" aria-label={t("appTitle")}>
      <header className="workspace-header"><h1>{t("appTitle")}</h1></header>
      {uncertainRecovery && (!activeWorkspace || activeWorkspace.workspaceId === uncertainRecovery) &&
        <StatusMessage kind="error" title={t("recoveryUncertain")} />}
      {viewState === "loading" && <StatusMessage kind="info" title={t("loading")} />}
      {viewState === "unavailable" && (
        <StatusMessage kind="error" title={t("unavailableTitle")}>
          {t(backend.diagnostic?.code === "BACKUP_FAILED" ? "backupStartupFailed" : backend.diagnostic?.code === "MIGRATION_FAILED" ? "backupMigrationFailed" : "unavailableDescription")}
        </StatusMessage>
      )}
      {viewState === "load-error" && (
        <StatusMessage kind="error" title={t("loadErrorTitle")}>
          {t("loadErrorDescription")}
          <button type="button" className="workspace-button workspace-button--secondary" onClick={() => { setViewState("loading"); void loadInitialData(() => backendState.current === "ready"); }}>{shellLabels[language].retry}</button>
        </StatusMessage>
      )}
      {viewState === "ready" && (
        <>
          <fieldset disabled={dataLocked} hidden={dataLocked} className="workspace-controls">
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
                    disabled={busy !== null || renameDraft !== null || removalTarget !== null}
                    onChange={(event) => void activateWorkspace(event.currentTarget.value)}
                  >
                    {workspaceData?.workspaces.map((workspace) => (
                      <option key={workspace.workspaceId} value={workspace.workspaceId}>{workspace.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {formMessage === "activation" && (
                <StatusMessage kind="error" title={t(messageTitle.activation)}>
                  {t(messageDescription.activation)}
                </StatusMessage>
              )}
              <SourceRefresh language={language} pending={busy === "refresh"} error={refreshError}
                degraded={sourceObservations.get(activeWorkspace.sourceId)?.automaticUpdates === "degraded"}
                unavailable={!activeWorkspace.sourceAvailable || sourceFeedback?.workspaceId === activeWorkspace.workspaceId &&
                  sourceFeedback.state !== "ready" && sourceFeedback.state !== "empty"}
                unavailableTitle={!activeWorkspace.sourceAvailable || sourceFeedback?.state === "unavailable" ? "sourceUnavailableTitle"
                  : sourceFeedback?.state === "root_identity_conflict" ? "discoveryRootConflict" : sourceFeedback?.state === "changed" ? "discoveryChanged" : "discoveryUnreadable"}
                disabled={busy !== null || renameDraft !== null || removalTarget !== null} onRefresh={() => void refreshSource()} />
              <DiscoveryWorkspace key={`${backendGeneration}:${activeWorkspace.workspaceId}:${activeWorkspace.sourceId}`}
                refreshVersion={sourceRefreshVersion} onSourceState={observeSourceScan}
                onRecoveryPending={(pending) => {
                  recoveryPending.current = pending ? activeWorkspace.workspaceId : null;
                  if (pending) setUncertainRecovery(null);
                }}
                client={client} workspaceId={activeWorkspace.workspaceId} sourceId={activeWorkspace.sourceId} language={language}
                disabled={busy !== null && busy !== "refresh" || renameDraft !== null || removalTarget !== null} />
              <button
                type="button"
                className="workspace-button workspace-button--secondary"
                disabled={busy !== null || renameDraft !== null || removalTarget !== null}
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
                  ref={createNameInput}
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
                <StatusMessage kind={formMessage === "cancelled" ? "info" : "error"} title={t(messageTitle[formMessage])}>
                  {t(messageDescription[formMessage])}
                </StatusMessage>
              )}
            </section>
          )}
          </fieldset>

        </>
      )}
    </main>
    </DesktopShell>
  );
}
