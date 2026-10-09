import { useEffect, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../../contracts/desktop-api.js";
import type { ActiveWorkspace, DiscoveryPreview, WorkspaceChangeEvent, WorkspaceLoad } from "../../contracts/workspaces.js";
import { App } from "../App.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import type { TextPropertySnapshot } from "../../contracts/text-properties.js";
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
      if (input.type === "workspace.listTextProperties") return { ok: true, value: { workspaceId: input.workspaceId, sourceId: records[0].sourceId, revision: 0, definitions: [], values: [] } };
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

// Text fixtures use the production Table/client and deterministic typed responses.
// Pending requests intentionally remain unresolved; no filesystem is accessed.
type TextStoryState = "no-definitions" | "no-projects" | "loading" | "editing" | "saving" | "validation" | "failure" | "sibling" | "saved";
const textStoryIds = {
  workspaceId: "00000000-0000-4000-8000-000000000001", sourceId: "00000000-0000-4000-8000-000000000010",
  propertyId: "00000000-0000-4000-8000-000000000030", projectId: "00000000-0000-4000-8000-000000000040",
};
const longPropertyName = "  Authored-свойство-" + "long-name-".repeat(18) + "  ";
const longTextValue = "  日本語 📝 Authored-value-" + "unbroken-text-".repeat(20) + "\nВторая строка  ";
function TextPreview({ language, state }: { language: Language; state: TextStoryState }) {
  const [client, setClient] = useState<WorkspaceServiceClient | null>(null);
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    let snapshot: TextPropertySnapshot = {
      workspaceId: textStoryIds.workspaceId, sourceId: textStoryIds.sourceId, revision: 1,
      definitions: state === "no-definitions" ? [] : [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: longPropertyName, propertyType: "text" }],
      values: state === "no-definitions" ? [] : [{ projectId: textStoryIds.projectId, propertyId: textStoryIds.propertyId, value: longTextValue }],
    };
    const listeners = new Set<(event: WorkspaceChangeEvent) => void>();
    const emit = () => listeners.forEach((listener) => listener({ type: "workspace.propertiesChanged", sourceId: snapshot.sourceId, workspaceIds: [snapshot.workspaceId], revision: snapshot.revision }));
    let saves = 0;
    const workspace = async (input: WorkspaceRequest): Promise<ServiceResult<WorkspaceResponse>> => {
      if (input.type === "workspace.listTextProperties") return state === "loading" ? new Promise(() => {}) : { ok: true, value: snapshot };
      if (input.type === "workspace.setTextValue") {
        saves++;
        if (state === "saving") return new Promise(() => {});
        if (saves === 1 && (state === "validation" || state === "failure")) return { ok: false, error: { code: state === "validation" ? "invalid_input" : "storage", message: "Disposable fixture failure" } };
        snapshot = { ...snapshot, revision: snapshot.revision + 1, values: input.value === null ? [] : [{ projectId: input.projectId, propertyId: input.propertyId, value: input.value }] };
        emit();
        return { ok: true, value: { snapshot, propertyId: input.propertyId, projectId: input.projectId } };
      }
      return { ok: false, error: { code: "invalid_input", message: "Unsupported fixture command" } };
    };
    const api: WorkspaceDesktopApi = {
      workspace: workspace as WorkspaceDesktopApi["workspace"],
      getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {},
      settings: async () => ({ ok: true, value: { language } }), pickRoot: async () => ({ outcome: "cancelled" }),
      onWorkspaceChange: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    };
    setClient(new WorkspaceServiceClient(api));
    let opened = false;
    const observer = new MutationObserver(() => {
      const root = document.querySelector("[data-text-fixture]");
      if (!root) return;
      if (["loading", "no-definitions", "no-projects", "saved"].includes(state)) {
        if (state === "loading" || root.querySelector(".text-properties")?.getAttribute("aria-busy") === "false") { observer.disconnect(); setPrepared(true); }
        return;
      }
      const button = root.querySelector<HTMLButtonElement>(".text-value-button");
      if (!opened && button) { opened = true; button.click(); return; }
      if (!root.querySelector("textarea")) return;
      observer.disconnect();
      if (state === "sibling") { snapshot = { ...snapshot, revision: 2, values: [{ ...snapshot.values[0], value: "Sibling committed change" }] }; emit(); }
      else if (state !== "editing") root.querySelector<HTMLButtonElement>(".text-value-editor .workspace-button")?.click();
      setPrepared(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => { observer.disconnect(); listeners.clear(); };
  }, [language, state]);
  return <main className="app-shell" lang={language} data-text-fixture={state} data-fixture-ready={prepared}>
    {client && <TextPropertiesTable client={client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language} disabled={false}
      projects={state === "no-projects" ? [] : [{ projectId: textStoryIds.projectId, name: "Authored-проект-" + "long-name-".repeat(18), relativePath: "Project" }]} />}
  </main>;
}
export const TextNoDefinitionsEnglish: Story = () => <TextPreview language="en" state="no-definitions" />;
export const TextNoDefinitionsRussian: Story = () => <TextPreview language="ru" state="no-definitions" />;
export const TextNoProjectsEnglish: Story = () => <TextPreview language="en" state="no-projects" />;
export const TextNoProjectsRussian: Story = () => <TextPreview language="ru" state="no-projects" />;
export const TextLoadingEnglish: Story = () => <TextPreview language="en" state="loading" />;
export const TextLoadingRussian: Story = () => <TextPreview language="ru" state="loading" />;
export const TextEditingEnglish: Story = () => <TextPreview language="en" state="editing" />;
export const TextEditingRussian: Story = () => <TextPreview language="ru" state="editing" />;
export const TextSavingEnglish: Story = () => <TextPreview language="en" state="saving" />;
export const TextSavingRussian: Story = () => <TextPreview language="ru" state="saving" />;
export const TextValidationEnglish: Story = () => <TextPreview language="en" state="validation" />;
export const TextValidationRussian: Story = () => <TextPreview language="ru" state="validation" />;
export const TextFailureEnglish: Story = () => <TextPreview language="en" state="failure" />;
export const TextFailureRussian: Story = () => <TextPreview language="ru" state="failure" />;
export const TextSiblingEnglish: Story = () => <TextPreview language="en" state="sibling" />;
export const TextSiblingRussian: Story = () => <TextPreview language="ru" state="sibling" />;
export const TextSavedEnglish: Story = () => <TextPreview language="en" state="saved" />;
export const TextSavedRussian: Story = () => <TextPreview language="ru" state="saved" />;
