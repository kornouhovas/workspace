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
      override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
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
    name: "Mode-retained 日本語", relativePath: `${path}/Historical project`, associationState: "active", resolution: "active", retentionReason: "mode_change" };
  const [client] = useState(() => new class extends WorkspaceServiceClient {
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
