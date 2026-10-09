import { useEffect, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../../contracts/desktop-api.js";
import type { ActiveWorkspace, DiscoveryPreview, WorkspaceChangeEvent, WorkspaceLoad } from "../../contracts/workspaces.js";
import { App } from "../App.js";
import { DiscoveryPanel } from "./DiscoveryPanel.js";
import "../app.css";
import type { Story } from "@ladle/react";
import "./bb-foundation.css";
import {
  EmptyStatePanel,
  LanguageSelect,
  StatusMessage,
} from "./bb-foundation";

export const English: Story = () => (
  <div className="bb-foundation-preview" lang="en">
    <LanguageSelect id="language-en" label="Interface language" value="en" onChange={() => {}} />
    <StatusMessage kind="info" title="Starting local service">
      Workspace is getting ready.
    </StatusMessage>
    <StatusMessage kind="error" title="Could not save language">
      Your saved preference has not changed.
    </StatusMessage>
    <EmptyStatePanel>No projects yet.</EmptyStatePanel>
  </div>
);

export const Russian: Story = () => (
  <div className="bb-foundation-preview" lang="ru">
    <LanguageSelect id="language-ru" label="Язык интерфейса" value="ru" onChange={() => {}} />
    <StatusMessage kind="info" title="Запуск локальной службы">
      Workspace готовит приложение к работе.
    </StatusMessage>
    <StatusMessage kind="error" title="Не удалось сохранить язык">
      Сохранённая настройка не изменилась.
    </StatusMessage>
    <EmptyStatePanel>Проектов пока нет.</EmptyStatePanel>
  </div>
);

// Preview the production screen through its typed boundary. These disposable
// in-memory fixtures never access the desktop service or a user's folders.
function WorkspacePreview({ language, state = "management" }: {
  language: Language;
  state?: "management" | "confirmation" | "loading" | "error" | "empty" | "unavailable" | "applied" | "applied-empty";
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const previous = window.workspace;
    let savedLanguage = language;
    let records: ActiveWorkspace[] = [
      {
        workspaceId: "00000000-0000-4000-8000-000000000001", sourceId: "00000000-0000-4000-8000-000000000010",
        viewId: "00000000-0000-4000-8000-000000000020", name: "  Authored-workspace-" + "long-name-".repeat(8) + "  ",
        canonicalRoot: "/Projects/" + "long-authored-folder-path-".repeat(8), sourceAvailable: state !== "unavailable",
      },
      {
        workspaceId: "00000000-0000-4000-8000-000000000002", sourceId: "00000000-0000-4000-8000-000000000010",
        viewId: "00000000-0000-4000-8000-000000000021", name: "Sibling configuration / Свой вид",
        canonicalRoot: "/Projects/" + "long-authored-folder-path-".repeat(8), sourceAvailable: state !== "unavailable",
      },
    ];
    if (state === "empty") records = [];
    let selected = records[0]?.workspaceId;
    const listeners = new Set<(event: WorkspaceChangeEvent) => void>();
    const snapshot = (): WorkspaceLoad => ({
      workspaces: records.map(({ workspaceId, name }) => ({ workspaceId, name })),
      activeWorkspace: records.find((record) => record.workspaceId === selected) ?? null,
    });
    const failure: ServiceResult<never> = { ok: false, error: { code: "storage", message: "Preview storage failure" } };
    const workspace = async (input: WorkspaceRequest): Promise<ServiceResult<WorkspaceResponse>> => {
      if (input.type === "workspace.load") return { ok: true, value: snapshot() };
      if (input.type === "workspace.listProjects") return { ok: true, value: {
        workspaceId: input.workspaceId, sourceId: records[0].sourceId, revision: state.startsWith("applied") ? 1 : 0,
        configured: state.startsWith("applied"), state: state === "unavailable" ? "unavailable" : state === "applied" ? "ready" : "empty",
        projects: state === "applied" ? [{ projectId: "project-preview", name: "  Authored-проект-" + "long-name-".repeat(18) + "  ",
          relativePath: "  Authored-проект-" + "long-name-".repeat(18) + "  " }] : [], retainedCount: state.startsWith("applied") ? 2 : 0,
      } };
      if (state === "error") return failure;
      if (input.type === "workspace.reorder") records = input.workspaceIds.map((id) => records.find((record) => record.workspaceId === id)!);
      else if (input.type === "workspace.rename") records = records.map((record) => record.workspaceId === input.workspaceId ? { ...record, name: input.name } : record);
      else if (input.type === "workspace.remove") {
        records = records.filter((record) => record.workspaceId !== input.workspaceId);
        if (selected === input.workspaceId) selected = records[0]?.workspaceId;
      } else if (input.type === "workspace.activate") {
        selected = input.workspaceId;
        return { ok: true, value: snapshot().activeWorkspace! };
      } else if (input.type === "workspace.refreshSource") return failure;
      else return { ok: false, error: { code: "invalid_input", message: "Preview does not create folders" } };
      const value = snapshot();
      listeners.forEach((listener) => listener({ type: "workspace.listChanged", snapshot: value }));
      return { ok: true, value };
    };
    window.workspace = {
      getBackendStatus: async () => ({ state: state === "loading" ? "starting" : "ready" }),
      onBackendStatus: () => () => {},
      settings: async (input) => {
        if (input.type === "settings.setLanguage") savedLanguage = input.language;
        return { ok: true, value: { language: savedLanguage } };
      },
      workspace: workspace as WorkspaceDesktopApi["workspace"],
      onWorkspaceChange: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      pickRoot: async () => ({ outcome: "cancelled" }),
    };
    const observer = new MutationObserver(() => {
      const selector = state === "confirmation" ? "button[data-action='remove']" : "button[data-direction='down']:not(:disabled)";
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (button) { observer.disconnect(); button.click(); }
    });
    if (state === "confirmation" || state === "error") observer.observe(document.body, { childList: true, subtree: true });
    setReady(true);
    return () => { observer.disconnect(); window.workspace = previous; };
  }, [language, state]);
  return ready ? <App /> : null;
}

export const ManagementEnglish: Story = () => <WorkspacePreview language="en" />;
export const ManagementRussian: Story = () => <WorkspacePreview language="ru" />;
export const ConfirmationEnglish: Story = () => <WorkspacePreview language="en" state="confirmation" />;
export const ConfirmationRussian: Story = () => <WorkspacePreview language="ru" state="confirmation" />;
export const ManagementError: Story = () => <WorkspacePreview language="en" state="error" />;
export const EmptyWorkspace: Story = () => <WorkspacePreview language="ru" state="empty" />;
export const LoadingWorkspace: Story = () => <WorkspacePreview language="en" state="loading" />;
export const UnavailableSource: Story = () => <WorkspacePreview language="ru" state="unavailable" />;

// Present production panel states directly; no fake filesystem interpretation or timers.
type DiscoveryStoryState = "preview" | "empty" | "pending" | "applying" | "error" | "stale";
function DiscoveryState({ language, state }: { language: Language; state: DiscoveryStoryState }) {
  const preview: DiscoveryPreview = {
    workspaceId: "00000000-0000-4000-8000-000000000001", sourceId: "00000000-0000-4000-8000-000000000010",
    revision: 1, canonicalRoot: "/Projects/" + "long-authored-folder-path-".repeat(8), excludedRelativePaths: ["Excluded"],
    state: state === "empty" ? "empty" : "ready", previewToken: state === "pending" || state === "applying" ? null : "preview-fixture",
    entries: state === "empty" ? [] : [
      { name: "  Authored-проект-" + "long-name-".repeat(18) + "  ", relativePath: "Project", reason: null },
      { name: "Excluded", relativePath: "Excluded", reason: "manual" },
      { name: ".hidden", relativePath: ".hidden", reason: "hidden" },
      { name: "External link", relativePath: "External link", reason: "link" },
      { name: "$RECYCLE.BIN", relativePath: "$RECYCLE.BIN", reason: "service" },
      { name: "Designated archive", relativePath: "Designated archive", reason: "archive" },
      { name: "Uncertain folder", relativePath: "Uncertain folder", reason: "unresolved" },
    ],
  };
  return <main className="app-shell" lang={language}><DiscoveryPanel language={language}
    preview={state === "error" || state === "stale" ? null : preview}
    pending={state === "pending" || state === "applying"} applying={state === "applying"}
    error={state === "error"} stale={state === "stale"}
    onApply={() => {}} onExclude={() => {}} onRetry={() => {}} onCancel={() => {}} /></main>;
}
export const DiscoveryPreviewEnglish: Story = () => <DiscoveryState language="en" state="preview" />;
export const DiscoveryPreviewRussian: Story = () => <DiscoveryState language="ru" state="preview" />;
export const DiscoveryEmptyEnglish: Story = () => <DiscoveryState language="en" state="empty" />;
export const DiscoveryEmptyRussian: Story = () => <DiscoveryState language="ru" state="empty" />;
export const DiscoveryPendingEnglish: Story = () => <DiscoveryState language="en" state="pending" />;
export const DiscoveryPendingRussian: Story = () => <DiscoveryState language="ru" state="pending" />;
export const DiscoveryApplyingEnglish: Story = () => <DiscoveryState language="en" state="applying" />;
export const DiscoveryApplyingRussian: Story = () => <DiscoveryState language="ru" state="applying" />;
export const DiscoveryErrorEnglish: Story = () => <DiscoveryState language="en" state="error" />;
export const DiscoveryErrorRussian: Story = () => <DiscoveryState language="ru" state="error" />;
export const DiscoveryStaleEnglish: Story = () => <DiscoveryState language="en" state="stale" />;
export const DiscoveryStaleRussian: Story = () => <DiscoveryState language="ru" state="stale" />;
export const AppliedTableEnglish: Story = () => <WorkspacePreview language="en" state="applied" />;
export const AppliedTableRussian: Story = () => <WorkspacePreview language="ru" state="applied" />;
export const AppliedEmptyEnglish: Story = () => <WorkspacePreview language="en" state="applied-empty" />;
export const AppliedEmptyRussian: Story = () => <WorkspacePreview language="ru" state="applied-empty" />;
