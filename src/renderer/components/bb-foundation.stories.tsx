import { ProjectCreationPanel } from "./ProjectCreationPanel.js";
import { createInitialCategoryMoveReviewRefresh } from "./category-move-story-preparation.js";
import { ProjectRevealButton } from "./ProjectRevealButton.js";
import type { ProjectCreationOperation, ProjectCreationResult } from "../../contracts/project-creation.js";
import type { ProjectRenameOperation, ProjectRenameResult, ProjectRenameRecoveryPreview } from "../../contracts/project-rename.js";
import type { ProjectCategoryMoveOperation, ProjectCategoryMoveResult, ProjectCategoryMoveRecoveryPreview } from "../../contracts/project-category-move.js";
import type { ProjectRevealResult } from "../../contracts/project-reveal.js";
import { useEffect, useRef, useState } from "react";
import type { Language, ServiceResult } from "../../contracts/settings.js";
import type { WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../../contracts/desktop-api.js";
import type { ActiveWorkspace, CategoryPropertySnapshot, DiscoveryPreview, ProjectList, DiscoveryMode, WorkspaceChangeEvent, WorkspaceLoad } from "../../contracts/workspaces.js";
import { App } from "../App.js";
import { TextPropertiesTable } from "./TextPropertiesTable.js";
import { WorkspaceServiceClient } from "../workspace-service-client.js";
import type { TextPropertySnapshot } from "../../contracts/text-properties.js";
import { ProjectRecoveryPanel } from "./ProjectRecoveryPanel.js";
import type { ProjectRecoveryPreview } from "../../contracts/project-recovery.js";
import type { ProjectAssociationSummary } from "../../contracts/workspaces.js";
import { translate } from "../localization.js";
import { SourceRefresh } from "./SourceRefresh.js";
import { DiscoveryWorkspace, DiscoveryPanel } from "./DiscoveryPanel.js";
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
      if (input.type === "workspace.getTableLayout" || input.type === "workspace.setTableLayout") return { ok: true, value: { workspaceId: input.workspaceId, viewId: input.viewId, config: input.type === "workspace.setTableLayout" ? input.config : { columns: [], rowOrder: [] } } };
      if (input.type === "workspace.getViewGrouping" || input.type === "workspace.setViewGrouping") return { ok: true, value: { workspaceId: input.workspaceId, viewId: input.viewId, config: input.type === "workspace.setViewGrouping" ? input.config : { propertyId: null, settings: [] } } };
      if (input.type === "workspace.getViewFilter" || input.type === "workspace.setViewFilter") return { ok: true, value: { workspaceId: input.workspaceId, viewId: input.viewId, config: input.type === "workspace.setViewFilter" ? input.config : { search: "", rules: [] } } };
      if (input.type === "workspace.queryView") return { ok: true, value: { workspaceId: input.workspaceId, viewId: input.viewId, archived: input.archived, projectIds: state.startsWith("applied") ? ["project-preview", "retained-missing", "retained-excluded"] : [] } };
      if (input.type === "workspace.listViews") return storyViews(input.workspaceId, records.find(record => record.workspaceId === input.workspaceId)!.viewId);
      if (input.type === "workspace.listProjectCategoryMoves") return { ok: true, value: { workspaceId: input.workspaceId, sourceId: records[0].sourceId, operations: [] } };
      if (input.type === "workspace.listProjectRenames") return { ok: true, value: { workspaceId: input.workspaceId, sourceId: records[0].sourceId, operations: [] } };
      if (input.type === "workspace.listProjectCreations") return { ok: true, value: { workspaceId: input.workspaceId, sourceId: records[0].sourceId, operations: [] } };
      if (input.type === "workspace.listProjects") return { ok: true, value: {
        workspaceId: input.workspaceId, sourceId: records[0].sourceId, revision: state.startsWith("applied") ? 1 : 0,
        mode: state.startsWith("applied") ? "direct" : null, categories: [], categoryProperty: null, categoryPropertyRevision: 0,
        configured: state.startsWith("applied"), state: state === "unavailable" ? "unavailable" : state === "applied" ? "ready" : "empty",
        projects: state === "applied" ? [{ associationState: "active", resolution: "active", categoryName: null, projectId: "project-preview", categoryId: null, name: "  Authored-проект-" + "long-name-".repeat(18) + "  ",
          relativePath: "  Authored-проект-" + "long-name-".repeat(18) + "  " }] : [],
        retainedProjects: state.startsWith("applied") ? ["missing", "excluded"].map((associationState) => ({
          projectId: `retained-${associationState}`, categoryId: null, categoryName: null,
          name: `Retained ${associationState}`, relativePath: `Retained ${associationState}`,
          associationState: associationState as "missing" | "excluded", resolution: associationState as "missing" | "excluded",
        })) : [], retainedCount: state.startsWith("applied") ? 2 : 0,
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
function DiscoveryState({ language, state, grouped = false }: { language: Language; state: DiscoveryStoryState; grouped?: boolean }) {
  const preview: DiscoveryPreview = {
    currentMode: null, projectEffects: { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] },
    categoryAvailability: { current: false, target: grouped, propertyId: null, name: null },
    effectiveExcludedRelativePaths: ["Excluded"], inactiveExcludedRelativePaths: [],
    mode: "direct", configured: false,
    workspaceId: "00000000-0000-4000-8000-000000000001", sourceId: "00000000-0000-4000-8000-000000000010",
    revision: 1, canonicalRoot: "/Projects/" + "long-authored-folder-path-".repeat(8), excludedRelativePaths: ["Excluded"],
    state: state === "empty" ? "empty" : "ready", previewToken: state === "pending" || state === "applying" ? null : "preview-fixture",
    entries: state === "empty" ? [] : [
      { kind: "project", categoryPath: null, name: "  Authored-проект-" + "long-name-".repeat(18) + "  ", relativePath: "Project", reason: null },
      { kind: "project", categoryPath: null, name: "Excluded", relativePath: "Excluded", reason: "manual" },
      { kind: "project", categoryPath: null, name: ".hidden", relativePath: ".hidden", reason: "hidden" },
      { kind: "project", categoryPath: null, name: "External link", relativePath: "External link", reason: "link" },
      { kind: "project", categoryPath: null, name: "$RECYCLE.BIN", relativePath: "$RECYCLE.BIN", reason: "service" },
      { kind: "project", categoryPath: null, name: "Designated archive", relativePath: "Designated archive", reason: "archive" },
      { kind: "project", categoryPath: null, name: "Uncertain folder", relativePath: "Uncertain folder", reason: "unresolved" },
    ],
  };
  if (grouped) {
    preview.mode = "grouped";
    preview.entries = state === "empty" ? [] : [
      { kind: "category", name: "Категория-" + "long-category-".repeat(16), relativePath: "Category", reason: null, empty: false },
      { kind: "project", categoryPath: "Category", name: "日本語-проект-" + "long-project-".repeat(16), relativePath: "Category/Project", reason: null },
      { kind: "project", categoryPath: "Category", name: "Excluded child", relativePath: "Category/Excluded child", reason: "manual" },
      { kind: "category", name: "Empty category", relativePath: "Empty category", reason: null, empty: true },
      { kind: "category", name: "Direct-looking project", relativePath: "Direct-looking project", reason: null, empty: false },
      { kind: "project", categoryPath: "Direct-looking project", name: "Immediate child only", relativePath: "Direct-looking project/Immediate child only", reason: null },
      { kind: "category", name: "Excluded category", relativePath: "Excluded category", reason: "manual", empty: false },
      { kind: "category", name: "External link", relativePath: "External link", reason: "link", empty: false },
    ];
    preview.excludedRelativePaths = ["Category/Excluded child", "Excluded category"];
  }
  return <main className="app-shell" lang={language}><DiscoveryPanel language={language}
    preview={state === "error" || state === "stale" ? null : preview}
    pending={state === "pending" || state === "applying"} applying={state === "applying"}
    error={state === "error"} stale={state === "stale"}
    onMode={() => {}} onApply={() => {}} onExclude={() => {}} onRetry={() => {}} onCancel={() => {}} /></main>;
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
function storyViews(workspaceId: string, viewId = "00000000-0000-4000-8000-000000000020") {
  return { ok: true as const, value: { workspaceId, activeViewId: viewId,
    views: [{ viewId, name: "Table", kind: "table" as const }] } };
}
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
      projects={state === "no-projects" ? [] : [{ projectId: textStoryIds.projectId, categoryId: null, name: "Authored-проект-" + "long-name-".repeat(18), relativePath: "Project" }]} />}
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

export const GroupedPreviewEnglish: Story = () => <DiscoveryState language="en" state="preview" grouped />;
export const GroupedPreviewRussian: Story = () => <DiscoveryState language="ru" state="preview" grouped />;
export const GroupedEmptyEnglish: Story = () => <DiscoveryState language="en" state="empty" grouped />;
export const GroupedEmptyRussian: Story = () => <DiscoveryState language="ru" state="empty" grouped />;
export const GroupedPendingEnglish: Story = () => <DiscoveryState language="en" state="pending" grouped />;
export const GroupedPendingRussian: Story = () => <DiscoveryState language="ru" state="pending" grouped />;
export const GroupedApplyingEnglish: Story = () => <DiscoveryState language="en" state="applying" grouped />;
export const GroupedApplyingRussian: Story = () => <DiscoveryState language="ru" state="applying" grouped />;
export const GroupedErrorEnglish: Story = () => <DiscoveryState language="en" state="error" grouped />;
export const GroupedErrorRussian: Story = () => <DiscoveryState language="ru" state="error" grouped />;
export const GroupedStaleEnglish: Story = () => <DiscoveryState language="en" state="stale" grouped />;
export const GroupedStaleRussian: Story = () => <DiscoveryState language="ru" state="stale" grouped />;

// Folder-backed Table and label editor states use the production client/header.
type CategoryStoryState = "default" | "authored" | "no-projects" | "loading" | "editing" | "saving" | "validation" | "failure" | "sibling" | "saved" | "newer";
const longCategory = "Категория-日本語-" + "long-category-".repeat(16);
const longCategoryLabel = "  Authored-категория-" + "long-label-".repeat(18) + "  ";
function CategoryPreview({ language, state }: { language: Language; state: CategoryStoryState }) {
  const [client, setClient] = useState<WorkspaceServiceClient | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [label, setLabel] = useState<{ name: string | null; revision: number }>({ name: state === "default" ? null : state === "validation" ? "   " : longCategoryLabel, revision: 1 });
  const minimum = useRef(1);
  useEffect(() => {
    let saves = 0;
    const workspace = async (input: WorkspaceRequest): Promise<ServiceResult<WorkspaceResponse>> => {
      if (input.type === "workspace.listTextProperties") return state === "loading" ? new Promise(() => {}) : { ok: true, value: { ...textStoryIds, revision: 0, definitions: [], values: [] } };
      if (input.type === "workspace.renameCategoryProperty") {
        saves++;
        if (state === "saving") return new Promise(() => {});
        if (state === "failure" && saves === 1) return { ok: false, error: { code: "storage", message: "Disposable label failure" } };
        return { ok: true, value: { workspaceId: input.workspaceId, sourceId: textStoryIds.sourceId, propertyId: input.propertyId, name: input.name, revision: 2 } };
      }
      return { ok: false, error: { code: "invalid_input", message: "Unsupported fixture command" } };
    };
    const api: WorkspaceDesktopApi = {
      workspace: workspace as WorkspaceDesktopApi["workspace"],
      getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {},
      settings: async () => ({ ok: true, value: { language } }), pickRoot: async () => ({ outcome: "cancelled" }), onWorkspaceChange: () => () => {},
    };
    setClient(new WorkspaceServiceClient(api));
    let opened = false;
    const observer = new MutationObserver(() => {
      const root = document.querySelector("[data-category-fixture]");
      if (!root) return;
      if (["default", "authored", "no-projects", "loading"].includes(state)) {
        if (state === "loading" || root.querySelector(".text-properties")?.getAttribute("aria-busy") === "false") { observer.disconnect(); setPrepared(true); }
        return;
      }
      const button = root.querySelector<HTMLButtonElement>(".category-property-header > button");
      if (!opened && button) { opened = true; button.click(); return; }
      const input = root.querySelector<HTMLInputElement>(".category-property-header input");
      if (!input) return;
      observer.disconnect();
      if (state === "sibling") { minimum.current = 2; setLabel({ name: "Sibling category label", revision: 2 }); }
      if (!["editing", "sibling"].includes(state)) root.querySelector<HTMLFormElement>(".category-property-header form")?.requestSubmit();
      setPrepared(true);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => observer.disconnect();
  }, [language, state]);
  const commit = (snapshot: CategoryPropertySnapshot) => {
    minimum.current = state === "newer" ? snapshot.revision + 1 : snapshot.revision;
    setLabel({ name: state === "newer" ? "Newer sibling label" : snapshot.name, revision: minimum.current });
  };
  return <main className="app-shell" lang={language} data-category-fixture={state} data-fixture-ready={prepared}>
    <p>{language === "en" ? "Grouped: Root / Category / Project" : "Сгруппированная: Источник / Категория / Проект"}</p>
    <ul className="saved-categories"><li>{longCategory}</li><li>Empty category</li></ul>
    {client && <TextPropertiesTable client={client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language} disabled={false}
      categoryProperty={{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: label.name }} categoryPropertyRevision={label.revision}
      minimumCategoryPropertyRevision={minimum} onCategoryPropertyCommitted={commit}
      categories={[{ categoryId: "category-fixture", name: longCategory, relativePath: "Category" }]}
      projects={state === "no-projects" ? [] : [{ projectId: textStoryIds.projectId, categoryId: "category-fixture", name: "日本語-проект-" + "long-project-".repeat(16), relativePath: "Category/Project" }]} />}
  </main>;
}
export const CategoryDefaultEnglish: Story = () => <CategoryPreview language="en" state="default" />;
export const CategoryDefaultRussian: Story = () => <CategoryPreview language="ru" state="default" />;
export const CategoryAuthoredEnglish: Story = () => <CategoryPreview language="en" state="authored" />;
export const CategoryAuthoredRussian: Story = () => <CategoryPreview language="ru" state="authored" />;
export const CategoryNoProjectsEnglish: Story = () => <CategoryPreview language="en" state="no-projects" />;
export const CategoryNoProjectsRussian: Story = () => <CategoryPreview language="ru" state="no-projects" />;
export const CategoryLoadingEnglish: Story = () => <CategoryPreview language="en" state="loading" />;
export const CategoryLoadingRussian: Story = () => <CategoryPreview language="ru" state="loading" />;
export const CategoryEditingEnglish: Story = () => <CategoryPreview language="en" state="editing" />;
export const CategoryEditingRussian: Story = () => <CategoryPreview language="ru" state="editing" />;
export const CategorySavingEnglish: Story = () => <CategoryPreview language="en" state="saving" />;
export const CategorySavingRussian: Story = () => <CategoryPreview language="ru" state="saving" />;
export const CategoryValidationEnglish: Story = () => <CategoryPreview language="en" state="validation" />;
export const CategoryValidationRussian: Story = () => <CategoryPreview language="ru" state="validation" />;
export const CategoryFailureEnglish: Story = () => <CategoryPreview language="en" state="failure" />;
export const CategoryFailureRussian: Story = () => <CategoryPreview language="ru" state="failure" />;
export const CategorySiblingEnglish: Story = () => <CategoryPreview language="en" state="sibling" />;
export const CategorySiblingRussian: Story = () => <CategoryPreview language="ru" state="sibling" />;
export const CategorySavedEnglish: Story = () => <CategoryPreview language="en" state="saved" />;
export const CategorySavedRussian: Story = () => <CategoryPreview language="ru" state="saved" />;
export const CategoryNewerEnglish: Story = () => <CategoryPreview language="en" state="newer" />;
export const CategoryNewerRussian: Story = () => <CategoryPreview language="ru" state="newer" />;

// Presentation states exercise production recovery and retained Text components.
// Selection, cancellation and saving are explicit fixture actions, never timers.
type RecoveryStoryState = "retained" | "loading" | "empty" | "selection" | "grouped" | "conflict" | "stale" | "failure" | "pending" | "saved";
const recoveryName = "  Authored-日本語-проект-" + "long-name-".repeat(18) + "  ";
const recoveryTarget = "Target-日本語-" + "long-target-".repeat(18);
function RecoveryPreview({ language, state }: { language: Language; state: RecoveryStoryState }) {
  const grouped = state === "grouped" || state === "conflict";
  const path = grouped ? `${longCategory}/${recoveryTarget}` : recoveryTarget;
  const project: ProjectAssociationSummary = { projectId: textStoryIds.projectId, name: recoveryName, relativePath: recoveryName,
    categoryId: null, categoryName: null, associationState: "active", resolution: "missing" };
  const [closed, setClosed] = useState(state === "retained" || state === "saved");
  const [saved, setSaved] = useState(state === "saved");
  const [selected, setSelected] = useState<string | null>(["selection", "grouped", "failure", "pending"].includes(state) ? path : null);
  const [refreshed, setRefreshed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => { if (closed && returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; } }, [closed]);
  const [client] = useState(() => new class extends WorkspaceServiceClient {
    override onBackendStatus() { return () => {}; }
    override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectRenames(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override onWorkspaceChange() { return () => {}; }
    override async listTextProperties() { return { ok: true as const, value: { ...textStoryIds, revision: 7,
      definitions: [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: longCategoryLabel, propertyType: "text" as const }],
      values: [project.projectId, "retained-unresolved", "retained-replaced", "retained-excluded"].map((projectId) => ({ projectId,
        propertyId: textStoryIds.propertyId, value: "  Exact authored 日本語\n" + "long-text-".repeat(24) + "  " })) } }; }
  }());
  const preview: ProjectRecoveryPreview = { ...textStoryIds, revision: 3, mode: grouped ? "grouped" : "direct", state: state === "empty" ? "empty" : "ready",
    previewToken: "disposable-review", entries: state === "empty" ? [] : [
      ...(state === "conflict" ? [] : [{ relativePath: path, name: recoveryTarget, categoryPath: grouped ? longCategory : null, status: "selectable" as const }]),
      ...(["reserved_path", "native_conflict", "category_unavailable", "excluded", "unresolved"] as const).filter((status) => grouped || status !== "category_unavailable").map((status) => ({
        relativePath: (grouped ? `${longCategory}/` : "") + status + "long-conflicting-path-".repeat(12), name: status, categoryPath: grouped ? longCategory : null, status,
      })),
    ] };
  const close = () => { returnFocus.current = true; setClosed(true); };
  const retained = (["missing", "unresolved", "replaced", "excluded"] as const).map((resolution, index) => ({ ...project,
    projectId: index === 0 ? project.projectId : `retained-${resolution}`, name: `${resolution} ${recoveryName}`,
    associationState: resolution, resolution, categoryName: longCategory }));
  return <main className="app-shell" lang={language} data-recovery-fixture={state}>
    <button className="workspace-button" ref={trigger} onClick={() => { setSelected(null); setClosed(false); }}>{translate(language, "recoveryLocate")}</button>
    {closed ? <>
      {saved && <StatusMessage kind="info" title={translate(language, "recoverySaved")} />}
      <TextPropertiesTable client={client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language} disabled={false}
        projects={saved ? [{ ...project, name: recoveryTarget, relativePath: path }] : []}
        retainedProjects={saved ? [] : retained} />
    </> : <ProjectRecoveryPanel language={language} project={project} preview={state === "loading" || state === "stale" && !refreshed ? null : preview}
      selectedPath={selected} loading={state === "loading"} pending={state === "pending"} error={state === "failure" && !refreshed}
      stale={state === "stale" && !refreshed} uncertain={false} onSelect={setSelected} onCancel={close}
      onRefresh={() => { setRefreshed(true); setSelected(null); }} onConfirm={() => { setSaved(true); close(); }} />}
  </main>;
}
export const RecoveryRetainedEnglish: Story = () => <RecoveryPreview language="en" state="retained" />;
export const RecoveryRetainedRussian: Story = () => <RecoveryPreview language="ru" state="retained" />;
export const RecoveryLoadingEnglish: Story = () => <RecoveryPreview language="en" state="loading" />;
export const RecoveryLoadingRussian: Story = () => <RecoveryPreview language="ru" state="loading" />;
export const RecoveryEmptyEnglish: Story = () => <RecoveryPreview language="en" state="empty" />;
export const RecoveryEmptyRussian: Story = () => <RecoveryPreview language="ru" state="empty" />;
export const RecoverySelectionEnglish: Story = () => <RecoveryPreview language="en" state="selection" />;
export const RecoverySelectionRussian: Story = () => <RecoveryPreview language="ru" state="selection" />;
export const RecoveryGroupedEnglish: Story = () => <RecoveryPreview language="en" state="grouped" />;
export const RecoveryGroupedRussian: Story = () => <RecoveryPreview language="ru" state="grouped" />;
export const RecoveryConflictEnglish: Story = () => <RecoveryPreview language="en" state="conflict" />;
export const RecoveryConflictRussian: Story = () => <RecoveryPreview language="ru" state="conflict" />;
export const RecoveryStaleEnglish: Story = () => <RecoveryPreview language="en" state="stale" />;
export const RecoveryStaleRussian: Story = () => <RecoveryPreview language="ru" state="stale" />;
export const RecoveryFailureEnglish: Story = () => <RecoveryPreview language="en" state="failure" />;
export const RecoveryFailureRussian: Story = () => <RecoveryPreview language="ru" state="failure" />;
export const RecoveryPendingEnglish: Story = () => <RecoveryPreview language="en" state="pending" />;
export const RecoveryPendingRussian: Story = () => <RecoveryPreview language="ru" state="pending" />;
export const RecoverySavedEnglish: Story = () => <RecoveryPreview language="en" state="saved" />;
export const RecoverySavedRussian: Story = () => <RecoveryPreview language="ru" state="saved" />;

type SourceStoryState = "available" | "empty" | "pending" | "error" | "degraded" | "new-category" | "recovery";
function SourceObservationPreview({ language, state }: { language: Language; state: SourceStoryState }) {
  const [pending, setPending] = useState(state === "pending");
  const [error, setError] = useState(state === "error");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [fixture] = useState(() => {
    const listeners = new Set<(event: WorkspaceChangeEvent) => void>();
    const grouped = state === "new-category" || state === "recovery";
    const project: ProjectAssociationSummary = { projectId: textStoryIds.projectId, name: recoveryName, relativePath: grouped ? `Needed/${recoveryName}` : recoveryName,
      categoryId: grouped ? "needed-category" : null, categoryName: grouped ? longCategory : null, associationState: "active", resolution: state === "recovery" ? "unresolved" : "active" };
    let list: ProjectList = { workspaceId: textStoryIds.workspaceId, sourceId: textStoryIds.sourceId, revision: 3,
      configured: true, mode: grouped ? "grouped" : "direct", state: state === "empty" ? "empty" : "ready",
      projects: ["empty", "recovery"].includes(state) ? [] : [project], retainedProjects: state === "recovery" ? [project] : [], retainedCount: state === "recovery" ? 1 : 0,
      categories: grouped ? [{ categoryId: "needed-category", name: longCategory, relativePath: "Needed" }, { categoryId: "old-category", name: "Old empty category", relativePath: "Old" }] : [],
      categoryProperty: grouped ? { propertyId: "category-label", sourceId: textStoryIds.sourceId, name: longCategoryLabel } : null, categoryPropertyRevision: grouped ? 7 : 0 };
    const client = new class extends WorkspaceServiceClient {
    override onBackendStatus() { return () => {}; }
    override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectRenames(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
      override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
      override async listViews(workspaceId: string) { return storyViews(workspaceId); }
      override async getTableLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { columns: [], rowOrder: [] } } }; }
      override async getViewGrouping(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { propertyId: null, settings: [] } } }; }
      override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
      override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...list.projects, ...list.retainedProjects].map(p => p.projectId) } }; }
      override async listProjects() { return { ok: true as const, value: list }; }
      override async listTextProperties() { return { ok: true as const, value: { workspaceId: textStoryIds.workspaceId, sourceId: textStoryIds.sourceId, revision: 7,
        definitions: [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, propertyType: "text" as const, name: "Notes" }],
        values: [{ projectId: project.projectId, propertyId: textStoryIds.propertyId, value: "  Exact authored 日本語\n" + "long-text-".repeat(24) + "  " }] } }; }
      override async previewProjectRecovery() { return { ok: true as const, value: { workspaceId: textStoryIds.workspaceId, sourceId: textStoryIds.sourceId, projectId: project.projectId,
        mode: "grouped" as const, revision: list.revision, state: "ready" as const, previewToken: "disposable-review",
        entries: [{ name: recoveryTarget, relativePath: `Needed/${recoveryTarget}`, categoryPath: "Needed", status: "category_unavailable" as const }] } }; }
    }();
    return { client, refresh() {
      // A verified source commit updates locators and publishes before the response.
      // The same UUIDs keep the Text editor mounted, including in a new category.
      if (state !== "recovery" && state !== "empty") list = { ...list, revision: list.revision + 1,
        projects: list.projects.map((row) => ({ ...row, name: `Renamed ${recoveryName}`, relativePath: `Needed/Renamed ${recoveryName}` })) };
      for (const listener of listeners) listener({ type: "workspace.projectsChanged", sourceId: list.sourceId, workspaceIds: [list.workspaceId], revision: list.revision });
    } };
  });
  const refresh = () => { setError(false); fixture.refresh(); setRefreshVersion((value) => value + 1); };
  return <main className="workspace-screen" lang={language} data-source-fixture={state}>
    <h2>{translate(language, "workspaceSelectLabel")}</h2>
    <p className="workspace-root">{"/Projects/" + "long-authored-folder-path-".repeat(18)}</p>
    <SourceRefresh language={language} pending={pending} error={error} degraded={state === "degraded"} unavailable={false} disabled={false} onRefresh={refresh} />
    {state === "pending" && <button type="button" className="workspace-button" data-complete-refresh onClick={() => { setPending(false); refresh(); }}>
      {translate(language, "cancelRenameWorkspace")}
    </button>}
    <DiscoveryWorkspace client={fixture.client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} refreshVersion={refreshVersion} language={language} disabled={false} />
  </main>;
}
export const SourceAvailableEnglish: Story = () => <SourceObservationPreview language="en" state="available" />;
export const SourceAvailableRussian: Story = () => <SourceObservationPreview language="ru" state="available" />;
export const SourceEmptyEnglish: Story = () => <SourceObservationPreview language="en" state="empty" />;
export const SourceEmptyRussian: Story = () => <SourceObservationPreview language="ru" state="empty" />;
export const SourcePendingEnglish: Story = () => <SourceObservationPreview language="en" state="pending" />;
export const SourcePendingRussian: Story = () => <SourceObservationPreview language="ru" state="pending" />;
export const SourceErrorEnglish: Story = () => <SourceObservationPreview language="en" state="error" />;
export const SourceErrorRussian: Story = () => <SourceObservationPreview language="ru" state="error" />;
export const SourceDegradedEnglish: Story = () => <SourceObservationPreview language="en" state="degraded" />;
export const SourceDegradedRussian: Story = () => <SourceObservationPreview language="ru" state="degraded" />;
export const SourceNewCategoryEnglish: Story = () => <SourceObservationPreview language="en" state="new-category" />;
export const SourceNewCategoryRussian: Story = () => <SourceObservationPreview language="ru" state="new-category" />;
export const SourceRecoveryEnglish: Story = () => <SourceObservationPreview language="en" state="recovery" />;
export const SourceRecoveryRussian: Story = () => <SourceObservationPreview language="ru" state="recovery" />;

// Configured-source reviews expose role effects and dormant authored exclusions.
type ModeStoryState = "review" | "return" | "empty" | "loading" | "stale" | "failure" | "unavailable" | "retained" | "category";
function ModeChangePreview({ language, state }: { language: Language; state: ModeStoryState }) {
  const [target, setTarget] = useState<DiscoveryMode>((state === "return" || state === "category") ? "grouped" : "direct");
  const [open, setOpen] = useState(true);
  const [retried, setRetried] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const categoryRevision = useRef(0);
  const path = "Category-日本語-" + "long-path-".repeat(18);
  const retained: ProjectAssociationSummary = { projectId: textStoryIds.projectId, categoryId: "historic-category", categoryName: path,
    name: "Mode-retained 日本語", relativePath: `${path}/Historical project`, associationState: state === "retained" ? "excluded" : "active",
    resolution: state === "retained" ? "unresolved" : "active", retentionReason: "mode_change" };
  const [client] = useState(() => new class extends WorkspaceServiceClient {
    override onBackendStatus() { return () => {}; }
    override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    override async listProjectRenames(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: textStoryIds.sourceId, operations: [] } }; }
    private value: string | null = longTextValue;
    private revision = 1;
    override onWorkspaceChange() { return () => {}; }
    override async listTextProperties() { return { ok: true as const, value: { ...textStoryIds, revision: this.revision,
      definitions: [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: longPropertyName, propertyType: "text" as const }],
      values: this.value === null ? [] : [{ projectId: textStoryIds.projectId, propertyId: textStoryIds.propertyId, value: this.value }] } }; }
    override async setTextValue(_workspace: string, projectId: string, propertyId: string, value: string | null) {
      this.value = value; this.revision++;
      return { ok: true as const, value: { projectId, propertyId, snapshot: (await this.listTextProperties()).value } };
    }
  }());
  const preview: DiscoveryPreview = { ...textStoryIds, canonicalRoot: `/Projects/${path}`, configured: true, revision: 4,
    mode: target, currentMode: state === "return" ? "direct" : "grouped", state: state === "unavailable" ? "unavailable" : state === "empty" ? "empty" : "ready",
    previewToken: ["loading", "unavailable"].includes(state) || state === "stale" && !retried ? null : "disposable-mode-review",
    excludedRelativePaths: ["Excluded category", `${path}/Excluded child`], effectiveExcludedRelativePaths: target === "grouped" ? ["Excluded category", `${path}/Excluded child`] : ["Excluded category"],
    inactiveExcludedRelativePaths: target === "direct" ? [`${path}/Excluded child`] : [],
    categoryAvailability: { current: state !== "return", target: target === "grouped", propertyId: "historic-label", name: longCategoryLabel },
    projectEffects: state === "empty" || state === "unavailable" ? { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] } : {
      added: [{ categoryPath: target === "direct" ? null : path, name: target === "direct" ? path : "New child", relativePath: target === "direct" ? path : `${path}/New child` }], retained: [],
      noLongerRecognized: [{ projectId: "previous-role", categoryId: target === "direct" ? "historic-category" : null, name: "Previous role", relativePath: target === "direct" ? `${path}/Previous child` : path }],
      alreadyRetained: [{ projectId: retained.projectId, categoryId: retained.categoryId, name: retained.name, relativePath: retained.relativePath }] }, entries: state === "empty" || state === "unavailable" ? [] : target === "direct" ? [
      { kind: "project", categoryPath: null, name: path, relativePath: path, reason: null },
      { kind: "project", categoryPath: null, name: "Excluded category", relativePath: "Excluded category", reason: "manual" },
    ] : [
      { kind: "category", name: path, relativePath: path, reason: null, empty: false },
      { kind: "project", categoryPath: path, name: "New child", relativePath: `${path}/New child`, reason: null },
      { kind: "project", categoryPath: path, name: "Excluded child", relativePath: `${path}/Excluded child`, reason: "manual" },
      { kind: "category", name: "Excluded category", relativePath: "Excluded category", reason: "manual", empty: false },
    ] };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <main className="app-shell" lang={language} data-mode-fixture={state}>
    <button ref={trigger} className="workspace-button" onClick={() => setOpen(true)}>{translate(language, "discoveryAction")}</button>
    {state === "category" && <button data-toggle-mode className="workspace-button" onClick={() => setTarget(target === "direct" ? "grouped" : "direct")}>
      {translate(language, target === "direct" ? "discoveryGroupedMode" : "discoveryDirectMode")}</button>}
    {state === "retained" || state === "category" ? <TextPropertiesTable client={client} {...textStoryIds} language={language} disabled={false} projects={[]}
      retainedProjects={[retained]} onLocate={() => {}}
      categoryProperty={state === "category" && target === "grouped" ? { propertyId: "historic-label", sourceId: textStoryIds.sourceId, name: longCategoryLabel } : null}
      categories={[{ categoryId: "historic-category", name: path, relativePath: path }]}
      minimumCategoryPropertyRevision={categoryRevision} onCategoryPropertyCommitted={() => {}} /> : open && <DiscoveryPanel language={language} preview={preview}
      pending={state === "loading"} stale={state === "stale" && !retried} error={false} applyError={state === "failure" && !retried}
      onMode={setTarget} onExclude={() => {}} onApply={close} onRetry={() => setRetried(true)} onCancel={close} />}
  </main>;
}
export const ModeReviewEnglish: Story = () => <ModeChangePreview language="en" state="review" />;
export const ModeReviewRussian: Story = () => <ModeChangePreview language="ru" state="review" />;
export const ModeReturnEnglish: Story = () => <ModeChangePreview language="en" state="return" />;
export const ModeReturnRussian: Story = () => <ModeChangePreview language="ru" state="return" />;
export const ModeEmptyEnglish: Story = () => <ModeChangePreview language="en" state="empty" />;
export const ModeEmptyRussian: Story = () => <ModeChangePreview language="ru" state="empty" />;
export const ModeLoadingEnglish: Story = () => <ModeChangePreview language="en" state="loading" />;
export const ModeLoadingRussian: Story = () => <ModeChangePreview language="ru" state="loading" />;
export const ModeStaleEnglish: Story = () => <ModeChangePreview language="en" state="stale" />;
export const ModeStaleRussian: Story = () => <ModeChangePreview language="ru" state="stale" />;
export const ModeFailureEnglish: Story = () => <ModeChangePreview language="en" state="failure" />;
export const ModeFailureRussian: Story = () => <ModeChangePreview language="ru" state="failure" />;
export const ModeUnavailableEnglish: Story = () => <ModeChangePreview language="en" state="unavailable" />;
export const ModeUnavailableRussian: Story = () => <ModeChangePreview language="ru" state="unavailable" />;
export const ModeRetainedEnglish: Story = () => <ModeChangePreview language="en" state="retained" />;
export const ModeRetainedRussian: Story = () => <ModeChangePreview language="ru" state="retained" />;

export const ModeCategoryEnglish: Story = () => <ModeChangePreview language="en" state="category" />;
export const ModeCategoryRussian: Story = () => <ModeChangePreview language="ru" state="category" />;

// Creation fixtures exercise production components through disposable typed clients.
type CreationStoryState = "direct" | "grouped" | "unconfigured" | "no-category" | "unavailable" | "pending" | "validation" | "collision" | "failure" | "success" | "success-list-error" | "success-list-recovered" | "uncertain" | "recovery" | "blocked" | "reveal-pending" | "reveal-error" | "reveal-retained";
function CreationPreview({ language, state }: { language: Language; state: CreationStoryState }) {
  const root = useRef<HTMLElement>(null);
  const [prepared, setPrepared] = useState(false);
  const [invalidation, setInvalidation] = useState(0);
  const [fixture] = useState(() => {
    const grouped = state === "grouped" || state === "no-category";
    const operation: ProjectCreationOperation = { operationId: "00000000-0000-4000-8000-000000000050", sourceId: textStoryIds.sourceId,
      initiatingWorkspaceId: textStoryIds.workspaceId, projectId: textStoryIds.projectId, name: recoveryName, relativePath: grouped ? `${longCategory}/${recoveryName}` : recoveryName,
      mode: grouped ? "grouped" : "direct", categoryId: grouped ? "existing-category" : null, expectedRevision: 1, stage: "uncertain", evidenceRecorded: false, problem: "ownership_uncertain", completedRevision: null };
    const projects: ProjectList = { ...textStoryIds, revision: 1, mode: state === "unconfigured" ? null : grouped ? "grouped" : "direct",
      configured: state !== "unconfigured", state: state === "unavailable" ? "unavailable" : "empty", projects: [], retainedProjects: [], retainedCount: 0,
      categories: grouped && state !== "no-category" ? [{ categoryId: "existing-category", name: longCategory, relativePath: longCategory }] : [], categoryProperty: null, categoryPropertyRevision: 0 };
    const result = (input: Parameters<WorkspaceServiceClient["createProject"]>[0]): ProjectCreationResult => {
      const op = { ...operation, ...input, categoryId: "categoryId" in input ? input.categoryId : null };
      return state.startsWith("success") ? { outcome: "completed", operation: { ...op, stage: "completed", completedRevision: 2 }, project: {
        operationId: op.operationId, sourceId: op.sourceId, projectId: op.projectId, name: op.name, relativePath: op.relativePath, categoryId: op.categoryId, revision: 2,
      } } : { outcome: "rejected", operation: null, problem: state === "validation" ? "invalid_name" : state === "collision" ? "occupied" : "filesystem_error" };
    };
    const client = new class extends WorkspaceServiceClient {
      completed = false;
      listReadsAfterCreation = 0;
      override onBackendStatus() { return () => {}; }
      override async listProjectCreations() {
        if (this.completed && state.startsWith("success-list") && ++this.listReadsAfterCreation === 1) {
          return { ok: false as const, error: { code: "service_unavailable" as const, message: "Disposable list failure" } };
        }
        return { ok: true as const, value: { ...textStoryIds, operations: ["recovery", "blocked"].includes(state) ? [operation] : [] } };
      }
      override async createProject(input: Parameters<WorkspaceServiceClient["createProject"]>[0]) {
        if (state === "pending") return new Promise<ServiceResult<ProjectCreationResult>>(() => {});
        if (state === "uncertain") throw new Error("Disposable lost-response fixture");
        this.completed = state.startsWith("success");
        return { ok: true as const, value: result(input) };
      }
      override async previewProjectCreationRecovery() { return { ok: true as const, value: { ...textStoryIds, operation, revision: 1,
        destinationState: state === "blocked" ? "replaced" as const : "unverified" as const, problem: "ownership_uncertain" as const,
        actions: state === "blocked" ? [] : ["associate_reviewed" as const], previewToken: state === "blocked" ? null : "disposable-reviewed-folder" } }; }
      override async revealProject(workspaceId: string, projectId: string): Promise<ServiceResult<ProjectRevealResult>> {
        if (state === "reveal-pending") return new Promise(() => {});
        return { ok: true, value: { workspaceId, projectId, outcome: "rejected", problem: state === "reveal-retained" ? "mode_retained" : "missing" } };
      }
    }();
    return { client, projects };
  });
  useEffect(() => {
    let opened = false, submitted = false, reloaded = false;
    let submitTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      const target = root.current; if (!target) return;
      if (["unconfigured", "no-category", "unavailable"].includes(state)) { setPrepared(true); observer.disconnect(); return; }
      if (state.startsWith("reveal-")) {
        if (!submitted) { submitted = true; target.querySelector<HTMLButtonElement>(".project-reveal button")?.click(); }
        if (target.querySelector(".project-reveal .bb-status") || target.querySelector<HTMLButtonElement>(".project-reveal button")?.disabled) { setPrepared(true); observer.disconnect(); }
        return;
      }
      if (["recovery", "blocked"].includes(state)) {
        if (!opened) { const button = [...target.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === translate(language, "creationReview")); if (button) { opened = true; button.click(); } }
        if (target.querySelector(".creation-review")) { setPrepared(true); observer.disconnect(); }
        return;
      }
      if (submitted && state.startsWith("success-list")) {
        const saved = [...target.querySelectorAll(".project-creation [role=status]")].some((element) => element.textContent === translate(language, "creationSaved"));
        const error = target.querySelector(".project-creation [role=alert]");
        if (!saved) return;
        if (state === "success-list-error" && error) { setPrepared(true); observer.disconnect(); }
        if (state === "success-list-recovered") {
          if (error && !reloaded) {
            reloaded = true;
            [...target.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === translate(language, "creationReload"))?.click();
          } else if (reloaded && !error) { setPrepared(true); observer.disconnect(); }
        }
        return;
      }
      if (!opened) { const button = target.querySelector<HTMLButtonElement>(".project-creation > button"); if (button && !button.disabled) { opened = true; button.click(); } return; }
      const input = target.querySelector<HTMLInputElement>("#project-creation-name"); if (!input) return;
      if (!submitted) {
        // Native setter plus input event goes through React's production onChange.
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, recoveryTarget);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (["direct", "grouped"].includes(state)) { setPrepared(true); observer.disconnect(); return; }
        submitted = true;
        submitTimer = setTimeout(() => { if (target.isConnected) input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }, 0);
      }
      if (!state.startsWith("success-list") && target.querySelector(".project-creation .bb-status")) { setPrepared(true); observer.disconnect(); }
    });
    observer.observe(root.current!, { childList: true, subtree: true, attributes: true });
    // Ensure the same preparation also runs if the first effect's list is already settled.
    root.current?.setAttribute("data-preparing", "true");
    return () => { observer.disconnect(); clearTimeout(submitTimer); };
  }, [language, state]);
  return <main ref={root} className="app-shell" lang={language} data-creation-fixture={state} data-fixture-ready={prepared}>
    <ProjectCreationPanel client={fixture.client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language}
      projects={fixture.projects} disabled={false} invalidation={invalidation} minimumRevision={{ current: 1 }} observationVersion={{ current: 0 }} onCompleted={() => { if (state.startsWith("success-list")) setInvalidation((value) => value + 1); }} />
    {state.startsWith("reveal-") && <ProjectRevealButton client={fixture.client} workspaceId={textStoryIds.workspaceId} projectId={textStoryIds.projectId} name={recoveryName} language={language} disabled={false} />}
  </main>;
}

export const CreationDirectEnglish: Story = () => <CreationPreview language="en" state="direct" />;
export const CreationDirectRussian: Story = () => <CreationPreview language="ru" state="direct" />;
export const CreationGroupedEnglish: Story = () => <CreationPreview language="en" state="grouped" />;
export const CreationGroupedRussian: Story = () => <CreationPreview language="ru" state="grouped" />;
export const CreationUnconfiguredEnglish: Story = () => <CreationPreview language="en" state="unconfigured" />;
export const CreationUnconfiguredRussian: Story = () => <CreationPreview language="ru" state="unconfigured" />;
export const CreationNoCategoryEnglish: Story = () => <CreationPreview language="en" state="no-category" />;
export const CreationNoCategoryRussian: Story = () => <CreationPreview language="ru" state="no-category" />;
export const CreationUnavailableEnglish: Story = () => <CreationPreview language="en" state="unavailable" />;
export const CreationUnavailableRussian: Story = () => <CreationPreview language="ru" state="unavailable" />;
export const CreationPendingEnglish: Story = () => <CreationPreview language="en" state="pending" />;
export const CreationPendingRussian: Story = () => <CreationPreview language="ru" state="pending" />;
export const CreationValidationEnglish: Story = () => <CreationPreview language="en" state="validation" />;
export const CreationValidationRussian: Story = () => <CreationPreview language="ru" state="validation" />;
export const CreationCollisionEnglish: Story = () => <CreationPreview language="en" state="collision" />;
export const CreationCollisionRussian: Story = () => <CreationPreview language="ru" state="collision" />;
export const CreationFailureEnglish: Story = () => <CreationPreview language="en" state="failure" />;
export const CreationFailureRussian: Story = () => <CreationPreview language="ru" state="failure" />;
export const CreationSuccessEnglish: Story = () => <CreationPreview language="en" state="success" />;
export const CreationSuccessRussian: Story = () => <CreationPreview language="ru" state="success" />;
export const CreationSuccessListErrorEnglish: Story = () => <CreationPreview language="en" state="success-list-error" />;
export const CreationSuccessListErrorRussian: Story = () => <CreationPreview language="ru" state="success-list-error" />;
export const CreationSuccessListRecoveredEnglish: Story = () => <CreationPreview language="en" state="success-list-recovered" />;
export const CreationSuccessListRecoveredRussian: Story = () => <CreationPreview language="ru" state="success-list-recovered" />;
export const CreationUncertainEnglish: Story = () => <CreationPreview language="en" state="uncertain" />;
export const CreationUncertainRussian: Story = () => <CreationPreview language="ru" state="uncertain" />;
export const CreationRecoveryEnglish: Story = () => <CreationPreview language="en" state="recovery" />;
export const CreationRecoveryRussian: Story = () => <CreationPreview language="ru" state="recovery" />;
export const CreationBlockedEnglish: Story = () => <CreationPreview language="en" state="blocked" />;
export const CreationBlockedRussian: Story = () => <CreationPreview language="ru" state="blocked" />;
export const CreationRevealPendingEnglish: Story = () => <CreationPreview language="en" state="reveal-pending" />;
export const CreationRevealPendingRussian: Story = () => <CreationPreview language="ru" state="reveal-pending" />;
export const CreationRevealErrorEnglish: Story = () => <CreationPreview language="en" state="reveal-error" />;
export const CreationRevealErrorRussian: Story = () => <CreationPreview language="ru" state="reveal-error" />;
export const CreationRevealRetainedEnglish: Story = () => <CreationPreview language="en" state="reveal-retained" />;
export const CreationRevealRetainedRussian: Story = () => <CreationPreview language="ru" state="reveal-retained" />;

// Rename stories drive the production workspace/Table through a disposable typed
// client. Preparation uses real controls; no private component state is injected.
type RenameStoryState = "editing" | "pending" | "saved" | "unchanged" | "invalid" | "collision" | "stale" | "unavailable" | "unknown" | "list-loading" | "list-empty" | "list-error" | "interrupted" | "uncertain" | "recovery-original" | "recovery-staged" | "recovery-destination" | "recovery-blocked" | "review-stale" | "review-loading" | "review-error" | "recovery-pending" | "recovery-unknown" | "kept-original";
const renameOriginal = "  Original-日本語-" + "long-authored-name-".repeat(10) + "  ";
const renameRequested = "  Requested-новое-" + "unbroken-name-".repeat(14) + "  ";
function RenamePreview({ language, mode, state }: { language: Language; mode: DiscoveryMode; state: RenameStoryState }) {
  const root = useRef<HTMLElement>(null);
  const [prepared, setPrepared] = useState(false);
  const [calls, setCalls] = useState({ rename: 0, recovery: 0, status: 0, review: 0 });
  const [fixture] = useState(() => {
    const reviewState = state.startsWith("recovery-") || state.startsWith("review-") || state === "kept-original";
    const retained = reviewState || ["interrupted", "uncertain"].includes(state);
    const categoryId = mode === "grouped" ? "rename-category" : null;
    const path = (name: string) => mode === "grouped" ? `${longCategory}/${name}` : name;
    const row = { projectId: textStoryIds.projectId, name: renameOriginal, relativePath: path(renameOriginal), categoryId,
      categoryName: categoryId ? longCategory : null, associationState: retained ? "unresolved" as const : "active" as const,
      resolution: retained ? "unresolved" as const : "active" as const };
    let projects: ProjectList = { ...textStoryIds, revision: 1, configured: true, mode, state: "ready",
      projects: retained ? [] : [row], retainedProjects: retained ? [row] : [], retainedCount: retained ? 1 : 0,
      categories: categoryId ? [{ categoryId, name: longCategory, relativePath: longCategory }] : [],
      categoryProperty: categoryId ? { propertyId: "category-property", sourceId: textStoryIds.sourceId, name: longPropertyName } : null, categoryPropertyRevision: 0 };
    let operation: ProjectRenameOperation = { operationId: "00000000-0000-4000-8000-000000000060", sourceId: textStoryIds.sourceId,
      initiatingWorkspaceId: textStoryIds.workspaceId, projectId: row.projectId, originalName: row.name, name: renameRequested,
      originalRelativePath: row.relativePath, requestedRelativePath: path(renameRequested), mode, categoryId, expectedRevision: 1,
      stage: state === "interrupted" ? "intent" : "uncertain", lastVerifiedPlacement: state === "recovery-staged" ? "staged" : state === "recovery-destination" ? "destination" : "original",
      problem: state === "interrupted" ? null : "ownership_uncertain", resultKind: null, completedRevision: null };
    let operations = retained ? [operation] : [];
    const events = new Set<(event: WorkspaceChangeEvent) => void>();
    const count = (key: keyof typeof calls) => setCalls((value) => ({ ...value, [key]: value[key] + 1 }));
    const finish = (unchanged = false): ProjectRenameResult => {
      operation = { ...operation, stage: "completed", resultKind: unchanged ? "unchanged" : "completed", problem: null,
        lastVerifiedPlacement: unchanged ? "original" : "destination", completedRevision: unchanged ? 1 : 2 };
      operations = [];
      projects = { ...projects, revision: operation.completedRevision!, projects: [{ ...row, name: operation.name,
        relativePath: operation.requestedRelativePath, associationState: "active", resolution: "active" }], retainedProjects: [], retainedCount: 0 };
      return { outcome: unchanged ? "unchanged" : "completed", operation, project: { operationId: operation.operationId,
        sourceId: operation.sourceId, projectId: operation.projectId, name: operation.name, relativePath: operation.requestedRelativePath,
        categoryId, revision: projects.revision } };
    };
    const client = new class extends WorkspaceServiceClient {
      override onBackendStatus() { return () => {}; }
      override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { events.add(listener); return () => { events.delete(listener); }; }
      override async listViews(workspaceId: string) { return storyViews(workspaceId); }
      override async getTableLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { columns: [], rowOrder: [] } } }; }
      override async getViewGrouping(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { propertyId: null, settings: [] } } }; }
      override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
      override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...projects.projects, ...projects.retainedProjects].map(p => p.projectId) } }; }
      override async listProjects() { return { ok: true as const, value: projects }; }
      override async listProjectCreations() { return { ok: true as const, value: { ...textStoryIds, operations: [] } }; }
      override async listTextProperties() { return { ok: true as const, value: { ...textStoryIds, revision: 1,
        definitions: [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: longPropertyName, propertyType: "text" as const }],
        values: [{ projectId: row.projectId, propertyId: textStoryIds.propertyId, value: longTextValue }] } }; }
      override async listProjectRenames() {
        if (state === "list-loading") return new Promise<Awaited<ReturnType<WorkspaceServiceClient["listProjectRenames"]>>>(() => {});
        if (state === "list-error") return { ok: false as const, error: { code: "service_unavailable" as const, message: "Disposable list error" } };
        return { ok: true as const, value: { ...textStoryIds, operations } };
      }
      override async renameProject(input: Parameters<WorkspaceServiceClient["renameProject"]>[0]) {
        count("rename"); operation = { ...operation, ...input, initiatingWorkspaceId: input.workspaceId, requestedRelativePath: path(input.name) };
        if (state === "pending") return new Promise<ServiceResult<ProjectRenameResult>>(() => {});
        if (state === "unknown") throw new Error("Disposable lost response");
        if (["saved", "unchanged"].includes(state)) return { ok: true as const, value: finish(state === "unchanged") };
        return { ok: true as const, value: { outcome: "rejected" as const, operation: null,
          problem: state === "invalid" ? "invalid_name" as const : state === "collision" ? "occupied" as const : state === "stale" ? "stale_configuration" as const : "source_unavailable" as const } };
      }
      override async getProjectRename() { count("status"); return { ok: true as const, value: finish() }; }
      override async previewProjectRenameRecovery() {
        count("review");
        if (state === "review-loading") return new Promise<ServiceResult<ProjectRenameRecoveryPreview>>(() => {});
        if (state === "review-error") return { ok: false as const, error: { code: "service_unavailable" as const, message: "Disposable review error" } };
        const blocked = state === "recovery-blocked", staged = state === "recovery-staged", destination = state === "recovery-destination";
        const preview: ProjectRenameRecoveryPreview = { ...textStoryIds, operation, revision: projects.revision,
          originalState: blocked ? "conflicting" : staged || destination ? "missing" : "matching",
          stagedState: staged ? "matching" : null, destinationState: blocked ? "replaced" : destination ? "matching" : "missing",
          problem: blocked ? "ownership_uncertain" : null, previewToken: blocked ? null : "disposable-fresh-token",
          actions: blocked ? [] : staged ? ["finish_staged"] : destination ? ["complete_destination"] : ["retry_original", "keep_original"] };
        return { ok: true as const, value: preview };
      }
      override async recoverProjectRename(_workspaceId: string, _operationId: string, _token: string, action: Parameters<WorkspaceServiceClient["recoverProjectRename"]>[3]) {
        count("recovery");
        if (state === "recovery-pending") return new Promise<ServiceResult<ProjectRenameResult>>(() => {});
        if (state === "recovery-unknown") throw new Error("Disposable lost recovery response");
        if (action === "keep_original") {
          operation = { ...operation, stage: "failed", problem: "kept_original", resultKind: "rejected", lastVerifiedPlacement: "original" };
          operations = []; projects = { ...projects, projects: [{ ...row, associationState: "active", resolution: "active" }], retainedProjects: [], retainedCount: 0 };
          return { ok: true as const, value: { outcome: "rejected" as const, operation, problem: "kept_original" as const } };
        }
        return { ok: true as const, value: finish() };
      }
    }();
    return { client, reviewState, observe: () => events.forEach((listener) => listener({ type: "workspace.sourceObserved",
      sourceId: textStoryIds.sourceId, workspaceIds: [textStoryIds.workspaceId], observationRevision: 2, state: "ready", automaticUpdates: "active" })) };
  });
  useEffect(() => {
    let opened = false, authored = false, submitted = false, observed = false;
    let submitTimer: ReturnType<typeof setTimeout> | undefined;
    const prepare = () => {
      const target = root.current; if (!target || target.querySelector(".text-properties")?.getAttribute("aria-busy") !== "false") return;
      const done = () => { setPrepared(true); observer.disconnect(); };
      if (state.startsWith("list-") || ["interrupted", "uncertain"].includes(state)) {
        const list = target.querySelector(".rename-operations");
        if (list && (state === "list-loading" || list.getAttribute("aria-busy") === "false")) done();
        return;
      }
      if (fixture.reviewState) {
        if (!opened) {
          const button = target.querySelector<HTMLButtonElement>(".rename-operations div > button");
          if (button && !button.disabled) { opened = true; button.click(); } return;
        }
        if (state === "kept-original" && submitted && [...target.querySelectorAll(".project-rename .bb-status")].some((node) => node.textContent === translate(language, "renameKeptOriginal"))) { done(); return; }
        const review = target.querySelector(".rename-review"); if (!review) return;
        if (state === "review-loading" && review.getAttribute("aria-busy") === "true" || state === "review-error" && review.querySelector("[role=alert]")) { done(); return; }
        if (state === "review-stale") {
          if (!observed && review.querySelector(".rename-placements")) { observed = true; fixture.observe(); }
          if (observed && !review.querySelector(".rename-placements") && review.querySelector("[role=alert]")) done();
          return;
        }
        if (["recovery-pending", "recovery-unknown", "kept-original"].includes(state)) {
          if (!submitted && review.querySelector(".rename-placements")) {
            submitted = true;
            const action = state === "kept-original" ? "renameKeepOriginal" : "renameRetryOriginal";
            [...review.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === translate(language, action))?.click();
          }
          const key = state === "kept-original" ? "renameKeptOriginal" : state === "recovery-pending" ? "renamePending" : "renameUncertain";
          if ([...target.querySelectorAll(".project-rename .bb-status")].some((node) => node.textContent === translate(language, key))) done();
          return;
        }
        if (review.querySelector(".rename-placements")) done(); return;
      }
      if (!opened) { const button = target.querySelector<HTMLButtonElement>("td:first-child .property-rename"); if (button && !button.disabled) { opened = true; button.click(); } return; }
      const input = target.querySelector<HTMLInputElement>("#project-rename-name");
      if (input && !authored) {
        authored = true;
        if (state !== "unchanged") {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, renameRequested);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (state === "editing") { done(); return; }
        submitted = true;
        submitTimer = setTimeout(() => { if (target.isConnected) input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }, 0);
      }
      const keys = { pending: "renamePending", saved: "renameSaved", unchanged: "renameUnchanged", invalid: "renameInvalid", collision: "renameCollision", stale: "renameStale", unavailable: "renameUnavailable", unknown: "renameUncertain" } as const;
      const key = keys[state as keyof typeof keys];
      if (submitted && key && [...target.querySelectorAll(".project-rename .bb-status")].some((node) => node.textContent === translate(language, key))) done();
    };
    // Wait for committed renders and their passive effects before interacting.
    // Initial discovery/list invalidation must settle before a recovery review.
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { frame = null; prepare(); }); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root.current!, { childList: true, subtree: true, attributes: true }); schedule();
    return () => { observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame); clearTimeout(submitTimer); };
  }, [fixture, language, state]);
  return <main ref={root} className="app-shell" lang={language} data-rename-fixture={state} data-rename-mode={mode} data-fixture-ready={prepared}
    data-rename-calls={calls.rename} data-recovery-calls={calls.recovery} data-status-calls={calls.status} data-review-calls={calls.review}>
    <DiscoveryWorkspace client={fixture.client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language} disabled={false} />
  </main>;
}
export const RenameEditingDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="editing" />;
export const RenameEditingDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="editing" />;
export const RenameEditingGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="editing" />;
export const RenameEditingGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="editing" />;
export const RenamePendingDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="pending" />;
export const RenamePendingDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="pending" />;
export const RenamePendingGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="pending" />;
export const RenamePendingGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="pending" />;
export const RenameSavedDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="saved" />;
export const RenameSavedDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="saved" />;
export const RenameSavedGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="saved" />;
export const RenameSavedGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="saved" />;
export const RenameUnchangedDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="unchanged" />;
export const RenameUnchangedDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="unchanged" />;
export const RenameUnchangedGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="unchanged" />;
export const RenameUnchangedGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="unchanged" />;
export const RenameInvalidDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="invalid" />;
export const RenameInvalidDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="invalid" />;
export const RenameInvalidGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="invalid" />;
export const RenameInvalidGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="invalid" />;
export const RenameCollisionDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="collision" />;
export const RenameCollisionDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="collision" />;
export const RenameCollisionGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="collision" />;
export const RenameCollisionGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="collision" />;
export const RenameStaleDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="stale" />;
export const RenameStaleDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="stale" />;
export const RenameStaleGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="stale" />;
export const RenameStaleGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="stale" />;
export const RenameUnavailableDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="unavailable" />;
export const RenameUnavailableDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="unavailable" />;
export const RenameUnavailableGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="unavailable" />;
export const RenameUnavailableGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="unavailable" />;
export const RenameUnknownDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="unknown" />;
export const RenameUnknownDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="unknown" />;
export const RenameUnknownGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="unknown" />;
export const RenameUnknownGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="unknown" />;
export const RenameListLoadingDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="list-loading" />;
export const RenameListLoadingDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="list-loading" />;
export const RenameListLoadingGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="list-loading" />;
export const RenameListLoadingGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="list-loading" />;
export const RenameListEmptyDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="list-empty" />;
export const RenameListEmptyDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="list-empty" />;
export const RenameListEmptyGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="list-empty" />;
export const RenameListEmptyGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="list-empty" />;
export const RenameListErrorDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="list-error" />;
export const RenameListErrorDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="list-error" />;
export const RenameListErrorGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="list-error" />;
export const RenameListErrorGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="list-error" />;
export const RenameInterruptedDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="interrupted" />;
export const RenameInterruptedDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="interrupted" />;
export const RenameInterruptedGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="interrupted" />;
export const RenameInterruptedGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="interrupted" />;
export const RenameUncertainDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="uncertain" />;
export const RenameUncertainDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="uncertain" />;
export const RenameUncertainGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="uncertain" />;
export const RenameUncertainGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="uncertain" />;
export const RenameRecoveryOriginalDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-original" />;
export const RenameRecoveryOriginalDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-original" />;
export const RenameRecoveryOriginalGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-original" />;
export const RenameRecoveryOriginalGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-original" />;
export const RenameRecoveryStagedDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-staged" />;
export const RenameRecoveryStagedDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-staged" />;
export const RenameRecoveryStagedGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-staged" />;
export const RenameRecoveryStagedGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-staged" />;
export const RenameRecoveryDestinationDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-destination" />;
export const RenameRecoveryDestinationDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-destination" />;
export const RenameRecoveryDestinationGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-destination" />;
export const RenameRecoveryDestinationGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-destination" />;
export const RenameRecoveryBlockedDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-blocked" />;
export const RenameRecoveryBlockedDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-blocked" />;
export const RenameRecoveryBlockedGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-blocked" />;
export const RenameRecoveryBlockedGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-blocked" />;
export const RenameReviewStaleDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="review-stale" />;
export const RenameReviewStaleDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="review-stale" />;
export const RenameReviewStaleGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="review-stale" />;
export const RenameReviewStaleGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="review-stale" />;
export const RenameReviewLoadingDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="review-loading" />;
export const RenameReviewLoadingDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="review-loading" />;
export const RenameReviewLoadingGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="review-loading" />;
export const RenameReviewLoadingGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="review-loading" />;
export const RenameReviewErrorDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="review-error" />;
export const RenameReviewErrorDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="review-error" />;
export const RenameReviewErrorGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="review-error" />;
export const RenameReviewErrorGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="review-error" />;
export const RenameRecoveryPendingDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-pending" />;
export const RenameRecoveryPendingDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-pending" />;
export const RenameRecoveryPendingGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-pending" />;
export const RenameRecoveryPendingGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-pending" />;
export const RenameRecoveryUnknownDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="recovery-unknown" />;
export const RenameRecoveryUnknownDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="recovery-unknown" />;
export const RenameRecoveryUnknownGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="recovery-unknown" />;
export const RenameRecoveryUnknownGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="recovery-unknown" />;
export const RenameKeptOriginalDirectEnglish: Story = () => <RenamePreview language="en" mode="direct" state="kept-original" />;
export const RenameKeptOriginalDirectRussian: Story = () => <RenamePreview language="ru" mode="direct" state="kept-original" />;
export const RenameKeptOriginalGroupedEnglish: Story = () => <RenamePreview language="en" mode="grouped" state="kept-original" />;
export const RenameKeptOriginalGroupedRussian: Story = () => <RenamePreview language="ru" mode="grouped" state="kept-original" />;

// Category move stories use the production Table/status/recovery controls and typed disposable data.
type CategoryMoveStoryState = "editing" | "pending" | "saved" | "unchanged" | "rejected" | "collision" | "stale" | "unavailable" | "unknown" | "list-loading" | "list-empty" | "list-error" | "interrupted" | "uncertain" | "recovery-original" | "recovery-destination" | "recovery-blocked" | "review-stale" | "review-loading" | "review-error" | "recovery-pending" | "recovery-unknown" | "kept-original" | "retained" | "direct";
const categoryMoveName = "  Original-日本語-" + "long-authored-name-".repeat(10) + "  ";
const categoryMoveDestination = "Destination-日本語-" + "unbroken-category-".repeat(14);
function CategoryMovePreview({ language, state }: { language: Language; state: CategoryMoveStoryState }) {
  const mode: DiscoveryMode = state === "direct" ? "direct" : "grouped";
  const root = useRef<HTMLElement>(null);
  const [prepared, setPrepared] = useState(false);
  const [calls, setCalls] = useState({ move: 0, recovery: 0, status: 0, review: 0 });
  const [fixture] = useState(() => {
    const reviewState = state.startsWith("recovery-") || state.startsWith("review-") || state === "kept-original";
    const retained = reviewState || ["interrupted", "uncertain", "retained"].includes(state);
    const categoryId = mode === "grouped" ? "move-original-category" : null;
    const path = (name: string) => mode === "grouped" ? `${longCategory}/${name}` : name;
    const row = { projectId: textStoryIds.projectId, name: categoryMoveName, relativePath: path(categoryMoveName), categoryId,
      categoryName: categoryId ? longCategory : null, associationState: retained ? "unresolved" as const : "active" as const,
      resolution: retained ? "unresolved" as const : "active" as const };
    let projects: ProjectList = { ...textStoryIds, revision: 1, configured: true, mode, state: "ready",
      projects: retained ? [] : [row], retainedProjects: retained ? [row] : [], retainedCount: retained ? 1 : 0,
      categories: categoryId ? [{ categoryId, name: longCategory, relativePath: longCategory }, { categoryId: "move-destination-category", name: categoryMoveDestination, relativePath: categoryMoveDestination }] : [],
      categoryProperty: categoryId ? { propertyId: "category-property", sourceId: textStoryIds.sourceId, name: longPropertyName } : null, categoryPropertyRevision: 0 };
    let operation: ProjectCategoryMoveOperation = { operationId: "00000000-0000-4000-8000-000000000060", sourceId: textStoryIds.sourceId,
      initiatingWorkspaceId: textStoryIds.workspaceId, projectId: row.projectId, name: row.name, originalCategoryId: "move-original-category", destinationCategoryId: "move-destination-category",
      originalRelativePath: row.relativePath, requestedRelativePath: `${categoryMoveDestination}/${row.name}`, expectedRevision: 1,
      stage: state === "interrupted" ? "intent" : "uncertain", lastVerifiedPlacement: state === "recovery-destination" ? "destination" : "original",
      problem: state === "interrupted" ? null : "ownership_uncertain", resultKind: null, completedRevision: null };
    let operations = retained && state !== "retained" ? [operation] : [];
    const events = new Set<(event: WorkspaceChangeEvent) => void>();
    const count = (key: keyof typeof calls) => setCalls((value) => ({ ...value, [key]: value[key] + 1 }));
    const finish = (unchanged = false): ProjectCategoryMoveResult => {
      operation = { ...operation, stage: "completed", resultKind: unchanged ? "unchanged" : "completed", problem: null,
        lastVerifiedPlacement: unchanged ? "original" : "destination", completedRevision: unchanged ? 1 : 2 };
      operations = [];
      projects = { ...projects, revision: operation.completedRevision!, projects: [{ ...row, categoryId: operation.destinationCategoryId, categoryName: operation.destinationCategoryId === "move-original-category" ? longCategory : categoryMoveDestination,
        relativePath: operation.requestedRelativePath, associationState: "active", resolution: "active" }], retainedProjects: [], retainedCount: 0 };
      return { outcome: unchanged ? "unchanged" : "completed", operation, project: { operationId: operation.operationId,
        sourceId: operation.sourceId, projectId: operation.projectId, name: operation.name, relativePath: operation.requestedRelativePath,
        categoryId: operation.destinationCategoryId, revision: projects.revision } };
    };
    const client = new class extends WorkspaceServiceClient {
      override onBackendStatus() { return () => {}; }
      override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { events.add(listener); return () => { events.delete(listener); }; }
      override async listViews(workspaceId: string) { return storyViews(workspaceId); }
      override async getTableLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { columns: [], rowOrder: [] } } }; }
      override async getViewGrouping(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { propertyId: null, settings: [] } } }; }
      override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
      override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...projects.projects, ...projects.retainedProjects].map(p => p.projectId) } }; }
      override async listProjects() { return { ok: true as const, value: projects }; }
      override async listProjectCreations() { return { ok: true as const, value: { ...textStoryIds, operations: [] } }; }
      override async listTextProperties() { return { ok: true as const, value: { ...textStoryIds, revision: 1,
        definitions: [{ propertyId: textStoryIds.propertyId, sourceId: textStoryIds.sourceId, name: longPropertyName, propertyType: "text" as const }],
        values: [{ projectId: row.projectId, propertyId: textStoryIds.propertyId, value: longTextValue }] } }; }
      override async listProjectRenames() { return { ok: true as const, value: { ...textStoryIds, operations: [] } }; }
      override async listProjectCategoryMoves() {
        if (state === "list-loading") return new Promise<Awaited<ReturnType<WorkspaceServiceClient["listProjectCategoryMoves"]>>>(() => {});
        if (state === "list-error") return { ok: false as const, error: { code: "service_unavailable" as const, message: "Disposable list error" } };
        return { ok: true as const, value: { ...textStoryIds, operations } };
      }
      override async moveProjectCategory(input: Parameters<WorkspaceServiceClient["moveProjectCategory"]>[0]) {
        count("move"); operation = { ...operation, operationId: input.operationId, destinationCategoryId: input.destinationCategoryId, initiatingWorkspaceId: input.workspaceId, requestedRelativePath: `${input.destinationCategoryId === "move-original-category" ? longCategory : categoryMoveDestination}/${row.name}` };
        if (state === "pending") return new Promise<ServiceResult<ProjectCategoryMoveResult>>(() => {});
        if (state === "unknown") throw new Error("Disposable lost response");
        if (["editing", "saved", "unchanged"].includes(state)) return { ok: true as const, value: finish(state === "unchanged") };
        return { ok: true as const, value: { outcome: "rejected" as const, operation: null,
          problem: state === "rejected" ? "storage_error" as const : state === "collision" ? "occupied" as const : state === "stale" ? "stale_configuration" as const : "source_unavailable" as const } };
      }
      override async getProjectCategoryMove() { count("status"); return { ok: true as const, value: finish() }; }
      override async previewProjectCategoryMoveRecovery() {
        count("review");
        if (state === "review-loading") return new Promise<ServiceResult<ProjectCategoryMoveRecoveryPreview>>(() => {});
        if (state === "review-error") return { ok: false as const, error: { code: "service_unavailable" as const, message: "Disposable review error" } };
        const blocked = state === "recovery-blocked", destination = state === "recovery-destination";
        const preview: ProjectCategoryMoveRecoveryPreview = { ...textStoryIds, operation, revision: projects.revision,
          originalState: blocked ? "conflicting" : destination ? "missing" : "matching",
          destinationState: blocked ? "replaced" : destination ? "matching" : "missing",
          problem: blocked ? "ownership_uncertain" : null, previewToken: blocked ? null : "disposable-fresh-token",
          actions: blocked ? [] : destination ? ["complete_destination"] : ["retry_original", "keep_original"] };
        return { ok: true as const, value: preview };
      }
      override async recoverProjectCategoryMove(_workspaceId: string, _operationId: string, _token: string, action: Parameters<WorkspaceServiceClient["recoverProjectCategoryMove"]>[3]) {
        count("recovery");
        if (state === "recovery-pending") return new Promise<ServiceResult<ProjectCategoryMoveResult>>(() => {});
        if (state === "recovery-unknown") throw new Error("Disposable lost recovery response");
        if (action === "keep_original") {
          operation = { ...operation, stage: "failed", problem: "kept_original", resultKind: "rejected", lastVerifiedPlacement: "original" };
          operations = []; projects = { ...projects, projects: [{ ...row, associationState: "active", resolution: "active" }], retainedProjects: [], retainedCount: 0 };
          return { ok: true as const, value: { outcome: "rejected" as const, operation, problem: "kept_original" as const } };
        }
        return { ok: true as const, value: finish() };
      }
    }();
    return { client, reviewState, observe: () => events.forEach((listener) => listener({ type: "workspace.sourceObserved",
      sourceId: textStoryIds.sourceId, workspaceIds: [textStoryIds.workspaceId], observationRevision: 2, state: "ready", automaticUpdates: "active" })) };
  });
  useEffect(() => {
    let opened = false, authored = false, submitted = false, observed = false;
    const refreshInitialReview = createInitialCategoryMoveReviewRefresh(language);
    let submitTimer: ReturnType<typeof setTimeout> | undefined;
    const prepare = () => {
      const target = root.current; if (!target || target.querySelector(".text-properties")?.getAttribute("aria-busy") !== "false") return;
      const done = () => { setPrepared(true); observer.disconnect(); };
      if (state.startsWith("list-") || ["interrupted", "uncertain", "retained", "direct"].includes(state)) {
        const list = target.querySelector(".category-move-operations");
        if (list && (state === "list-loading" || list.getAttribute("aria-busy") === "false")) done();
        return;
      }
      if (fixture.reviewState) {
        if (!opened) {
          const button = target.querySelector<HTMLButtonElement>(".category-move-operations > div > button:last-of-type");
          if (button && !button.disabled) { opened = true; button.click(); } return;
        }
        if (state === "kept-original" && submitted && [...target.querySelectorAll(".project-category-move .bb-status")].some((node) => node.textContent === translate(language, "moveCategoryKeptOriginal"))) { done(); return; }
        if (state !== "review-stale" && !submitted && refreshInitialReview(target)) return;
        const review = target.querySelector(".category-move-review"); if (!review) return;
        if (state === "review-loading" && review.getAttribute("aria-busy") === "true" || state === "review-error" && review.querySelector("[role=alert]")) { done(); return; }
        if (state === "review-stale") {
          if (!observed && review.querySelector(".category-move-placements")) { observed = true; fixture.observe(); }
          if (observed && !review.querySelector(".category-move-placements") && review.querySelector("[role=alert]")) done();
          return;
        }
        if (["recovery-pending", "recovery-unknown", "kept-original"].includes(state)) {
          if (!submitted && review.querySelector(".category-move-placements")) {
            submitted = true;
            const action = state === "kept-original" ? "moveCategoryKeepOriginal" : "moveCategoryRetryOriginal";
            [...review.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === translate(language, action))?.click();
          }
          const key = state === "kept-original" ? "moveCategoryKeptOriginal" : state === "recovery-pending" ? "moveCategoryPending" : "moveCategoryUncertain";
          if ([...target.querySelectorAll(".project-category-move .bb-status")].some((node) => node.textContent === translate(language, key))) done();
          return;
        }
        if (review.querySelector(".category-move-placements")) done(); return;
      }
      if (!opened) { const button = target.querySelector<HTMLButtonElement>("td:nth-child(2) .property-rename"); if (button && !button.disabled) { opened = true; button.click(); } return; }
      const input = target.querySelector<HTMLSelectElement>("#project-category-move-destination");
      if (input && !authored) {
        authored = true;
        if (state !== "unchanged") {
          input.value = "move-destination-category";
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (state === "editing") { done(); return; }
        submitted = true;
        submitTimer = setTimeout(() => { if (target.isConnected) input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }, 0);
      }
      const keys = { pending: "moveCategoryPending", saved: "moveCategorySaved", unchanged: "moveCategoryUnchanged", rejected: "moveCategoryFailed", collision: "moveCategoryCollision", stale: "moveCategoryStale", unavailable: "moveCategoryUnavailable", unknown: "moveCategoryUncertain" } as const;
      const key = keys[state as keyof typeof keys];
      if (submitted && key && [...target.querySelectorAll(".project-category-move .bb-status")].some((node) => node.textContent === translate(language, key))) done();
    };
    // Wait for committed renders and their passive effects before interacting.
    // Initial discovery/list invalidation must settle before a recovery review.
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { frame = null; prepare(); }); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(root.current!, { childList: true, subtree: true, attributes: true }); schedule();
    return () => { observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame); clearTimeout(submitTimer); };
  }, [fixture, language, state]);
  return <main ref={root} className="app-shell" lang={language} data-category-move-fixture={state} data-fixture-ready={prepared}
    data-move-calls={calls.move} data-recovery-calls={calls.recovery} data-status-calls={calls.status} data-review-calls={calls.review}>
    <DiscoveryWorkspace client={fixture.client} workspaceId={textStoryIds.workspaceId} sourceId={textStoryIds.sourceId} language={language} disabled={false} />
  </main>;
}

export const CategoryMoveEditingEnglish: Story = () => <CategoryMovePreview language="en" state="editing" />;
export const CategoryMoveEditingRussian: Story = () => <CategoryMovePreview language="ru" state="editing" />;
export const CategoryMovePendingEnglish: Story = () => <CategoryMovePreview language="en" state="pending" />;
export const CategoryMovePendingRussian: Story = () => <CategoryMovePreview language="ru" state="pending" />;
export const CategoryMoveSavedEnglish: Story = () => <CategoryMovePreview language="en" state="saved" />;
export const CategoryMoveSavedRussian: Story = () => <CategoryMovePreview language="ru" state="saved" />;
export const CategoryMoveUnchangedEnglish: Story = () => <CategoryMovePreview language="en" state="unchanged" />;
export const CategoryMoveUnchangedRussian: Story = () => <CategoryMovePreview language="ru" state="unchanged" />;
export const CategoryMoveCollisionEnglish: Story = () => <CategoryMovePreview language="en" state="collision" />;
export const CategoryMoveCollisionRussian: Story = () => <CategoryMovePreview language="ru" state="collision" />;
export const CategoryMoveStaleEnglish: Story = () => <CategoryMovePreview language="en" state="stale" />;
export const CategoryMoveStaleRussian: Story = () => <CategoryMovePreview language="ru" state="stale" />;
export const CategoryMoveUnavailableEnglish: Story = () => <CategoryMovePreview language="en" state="unavailable" />;
export const CategoryMoveUnavailableRussian: Story = () => <CategoryMovePreview language="ru" state="unavailable" />;
export const CategoryMoveRejectedEnglish: Story = () => <CategoryMovePreview language="en" state="rejected" />;
export const CategoryMoveRejectedRussian: Story = () => <CategoryMovePreview language="ru" state="rejected" />;
export const CategoryMoveUnknownEnglish: Story = () => <CategoryMovePreview language="en" state="unknown" />;
export const CategoryMoveUnknownRussian: Story = () => <CategoryMovePreview language="ru" state="unknown" />;
export const CategoryMoveListLoadingEnglish: Story = () => <CategoryMovePreview language="en" state="list-loading" />;
export const CategoryMoveListLoadingRussian: Story = () => <CategoryMovePreview language="ru" state="list-loading" />;
export const CategoryMoveListEmptyEnglish: Story = () => <CategoryMovePreview language="en" state="list-empty" />;
export const CategoryMoveListEmptyRussian: Story = () => <CategoryMovePreview language="ru" state="list-empty" />;
export const CategoryMoveListErrorEnglish: Story = () => <CategoryMovePreview language="en" state="list-error" />;
export const CategoryMoveListErrorRussian: Story = () => <CategoryMovePreview language="ru" state="list-error" />;
export const CategoryMoveInterruptedEnglish: Story = () => <CategoryMovePreview language="en" state="interrupted" />;
export const CategoryMoveInterruptedRussian: Story = () => <CategoryMovePreview language="ru" state="interrupted" />;
export const CategoryMoveUncertainEnglish: Story = () => <CategoryMovePreview language="en" state="uncertain" />;
export const CategoryMoveUncertainRussian: Story = () => <CategoryMovePreview language="ru" state="uncertain" />;
export const CategoryMoveRecoveryOriginalEnglish: Story = () => <CategoryMovePreview language="en" state="recovery-original" />;
export const CategoryMoveRecoveryOriginalRussian: Story = () => <CategoryMovePreview language="ru" state="recovery-original" />;
export const CategoryMoveRecoveryDestinationEnglish: Story = () => <CategoryMovePreview language="en" state="recovery-destination" />;
export const CategoryMoveRecoveryDestinationRussian: Story = () => <CategoryMovePreview language="ru" state="recovery-destination" />;
export const CategoryMoveRecoveryBlockedEnglish: Story = () => <CategoryMovePreview language="en" state="recovery-blocked" />;
export const CategoryMoveRecoveryBlockedRussian: Story = () => <CategoryMovePreview language="ru" state="recovery-blocked" />;
export const CategoryMoveReviewStaleEnglish: Story = () => <CategoryMovePreview language="en" state="review-stale" />;
export const CategoryMoveReviewStaleRussian: Story = () => <CategoryMovePreview language="ru" state="review-stale" />;
export const CategoryMoveReviewLoadingEnglish: Story = () => <CategoryMovePreview language="en" state="review-loading" />;
export const CategoryMoveReviewLoadingRussian: Story = () => <CategoryMovePreview language="ru" state="review-loading" />;
export const CategoryMoveReviewErrorEnglish: Story = () => <CategoryMovePreview language="en" state="review-error" />;
export const CategoryMoveReviewErrorRussian: Story = () => <CategoryMovePreview language="ru" state="review-error" />;
export const CategoryMoveRecoveryPendingEnglish: Story = () => <CategoryMovePreview language="en" state="recovery-pending" />;
export const CategoryMoveRecoveryPendingRussian: Story = () => <CategoryMovePreview language="ru" state="recovery-pending" />;
export const CategoryMoveRecoveryUnknownEnglish: Story = () => <CategoryMovePreview language="en" state="recovery-unknown" />;
export const CategoryMoveRecoveryUnknownRussian: Story = () => <CategoryMovePreview language="ru" state="recovery-unknown" />;
export const CategoryMoveKeptOriginalEnglish: Story = () => <CategoryMovePreview language="en" state="kept-original" />;
export const CategoryMoveKeptOriginalRussian: Story = () => <CategoryMovePreview language="ru" state="kept-original" />;
export const CategoryMoveRetainedEnglish: Story = () => <CategoryMovePreview language="en" state="retained" />;
export const CategoryMoveRetainedRussian: Story = () => <CategoryMovePreview language="ru" state="retained" />;
export const CategoryMoveDirectEnglish: Story = () => <CategoryMovePreview language="en" state="direct" />;
export const CategoryMoveDirectRussian: Story = () => <CategoryMovePreview language="ru" state="direct" />;
