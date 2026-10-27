import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { ProjectRecoveryPanel } from "../src/renderer/components/ProjectRecoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectAssociationSummary, ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
import type { ProjectRecoveryPreview } from "../src/contracts/project-recovery.js";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement,
  Node: browser.Node, Element: browser.Element, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser), NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement,
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser), MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, waitFor, act, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(() => cleanup());
const retained: ProjectAssociationSummary = { projectId: "project", name: "Original authored name", relativePath: "Original authored name", categoryId: null, categoryName: null,
  associationState: "active", resolution: "missing" };
const preview: ProjectRecoveryPreview = { workspaceId: "workspace", sourceId: "source", projectId: retained.projectId, revision: 1, mode: "direct", state: "ready",
  previewToken: "review", entries: [{ relativePath: "Target authored name", name: "Target authored name", categoryPath: null, status: "selectable" },
    { relativePath: "Occupied", name: "Occupied", categoryPath: null, status: "reserved_path" }] };
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "ready",
  projects: [], retainedProjects: [retained, { ...retained, projectId: "excluded", name: "Excluded", relativePath: "Excluded", associationState: "excluded", resolution: "excluded" }], retainedCount: 2,
  categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
const committed: ProjectList = { ...initial, revision: 2, projects: [{ ...retained, relativePath: preview.entries[0].relativePath, name: preview.entries[0].name, associationState: "active", resolution: "active" }],
  retainedProjects: [initial.retainedProjects[1]], retainedCount: 1 };
class RecoveryClient extends WorkspaceServiceClient {
  override async getTableLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { columns: [], rowOrder: [] } } }; }
  override async getBoardLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { widths: [], properties: [], wrap: true } } }; }
  // Non-filter workflow fixtures expose the new empty-filter projection without
  // calling listProjects again (some tests intentionally control that read).
  override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
  override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...this.projects.projects, ...this.projects.retainedProjects].map(p => p.projectId) } }; }
  override async listViews(workspaceId: string) { return { ok: true as const, value: { workspaceId, activeViewId: "view", views: [{ viewId: "view", name: "Table", kind: "table" as const }] } }; }
  override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  override onBackendStatus() { return () => {}; }
  override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  projects = initial;
  recoveryPreview = preview;
  previews = 0;
  saves = 0;
  handler: () => Promise<ServiceResult<ProjectList>> = async () => { this.projects = committed; return { ok: true, value: committed }; };
  listeners = new Set<(event: WorkspaceChangeEvent) => void>();
  emit(event: WorkspaceChangeEvent) { for (const listener of this.listeners) listener(event); }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }
  listHandler: (() => Promise<ServiceResult<ProjectList>>) | null = null;
  override async listProjects() { return this.listHandler ? this.listHandler() : { ok: true as const, value: this.projects }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1,
    definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }],
    values: [{ projectId: "project", propertyId: "notes", value: "Exact authored Text" }] } }; }
  previewHandler: (() => Promise<ServiceResult<ProjectRecoveryPreview>>) | null = null;
  override async previewProjectRecovery(workspaceId: string, projectId: string) {
    assert.equal(workspaceId, "workspace"); assert.equal(projectId, "project"); this.previews++;
    return this.previewHandler ? this.previewHandler() : { ok: true as const, value: this.recoveryPreview };
  }
  override async reassociateProject(workspaceId: string, projectId: string, token: string, path: string) {
    assert.deepEqual([workspaceId, projectId, token, path], ["workspace", "project", this.recoveryPreview.previewToken, this.recoveryPreview.entries[0].relativePath]);
    this.saves++; return this.handler();
  }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

for (const language of ["en", "ru"] as const) {
  test(`${language}: removed exclusions expose mode-retained recovery while current exclusions still block it`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    for (const excluded of [true, false]) {
      const client = new RecoveryClient();
      client.projects = { ...initial, retainedProjects: [{ ...retained, retentionReason: "mode_change", associationState: "excluded", resolution: excluded ? "excluded" : "unresolved" }], retainedCount: 1 };
      render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
      const edit = await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` });
      assert.ok(edit.textContent?.includes("Exact authored Text"));
      assert.ok(screen.getByText(t("projectModeRetained")));
      const locate = screen.queryByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` });
      assert.equal(Boolean(locate), !excluded);
      assert.equal(Boolean(screen.queryByText(t("projectExcluded"))), excluded);
      assert.equal(client.saves, 0);
      if (locate) {
        locate.focus(); await userEvent.keyboard("{Enter}");
        const target = await screen.findByRole("radio", { name: "Target authored name" });
        target.focus(); await userEvent.keyboard(" ");
        screen.getByRole("button", { name: t("recoveryConfirm") }).focus(); await userEvent.keyboard("{Enter}");
        await screen.findByText(t("recoverySaved"));
        assert.equal(client.saves, 1);
      }
      cleanup(); assert.equal(client.listeners.size, 0);
    }
  });
  for (const delivery of ["batched", "separate"] as const) test(`${language}: a recovery response with a newer observation preserves the missing-folder projection (${delivery})`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient(), response = deferred<ServiceResult<ProjectList>>();
    client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    client.projects = { ...committed, state: "empty", projects: [], retainedProjects: [
      ...committed.projects.map((row) => ({ ...row, resolution: "missing" as const })), ...committed.retainedProjects,
    ], retainedCount: 2 };
    await act(async () => {
      client.emit({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"],
        observationRevision: 2, state: "empty", automaticUpdates: "active" });
      client.emit({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"],
        observationRevision: 1, state: "unavailable", automaticUpdates: "degraded" });
      if (delivery === "batched") response.resolve({ ok: true, value: committed });
    });
    if (delivery === "separate") {
      assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
      assert.equal(client.saves, 1);
      await act(async () => { response.resolve({ ok: true, value: committed }); });
    }
    assert.ok(await screen.findByRole("button", { name: `${t("recoveryLocate")}: Target authored name` }));
    assert.ok(screen.getByText(t("recoverySaved")));
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }));
    assert.equal(screen.queryByRole("heading", { name: t("recoveryTitle") }), null);
    assert.equal(client.saves, 1, "a confirmed recovery must not be replayed");
    cleanup(); assert.equal(client.listeners.size, 0);
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language}: manually excluded projects keep reinclusion guidance and editable Text when folder observations change`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    for (const resolution of ["missing", "unresolved", "replaced", null] as const) {
      const client = new RecoveryClient();
      client.projects = { ...initial, retainedProjects: [{ ...retained, associationState: "excluded", resolution }], retainedCount: 1 };
      render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
      const edit = await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` });
      assert.equal(Boolean(screen.queryByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` })), false, String(resolution));
      assert.ok(screen.getByText(t("projectExcluded")), String(resolution));
      edit.focus(); await userEvent.keyboard("{Enter}");
      const input = await screen.findByRole("textbox", { name: `${t("editTextValue")}: ${retained.name} / Notes` });
      assert.equal((input as HTMLTextAreaElement).value, "Exact authored Text");
      await userEvent.keyboard("{Escape}");
      assert.equal(document.activeElement === edit, true);
      assert.equal(client.previews, 0);
      cleanup();
    }
  });
  test(`${language}: production workspace supports keyboard selection/review, read-only cancellation and explicit recovery`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const locate = await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` });
    assert.equal(screen.queryByRole("button", { name: `${t("recoveryLocate")}: Excluded` }), null);
    locate.focus(); await userEvent.keyboard("{Enter}");
    const title = await screen.findByRole("heading", { name: t("recoveryTitle") });
    assert.equal(document.activeElement === title, true);
    await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal(client.saves, 0);
    await userEvent.keyboard("{Escape}");
    assert.equal(client.saves, 0); assert.equal(document.activeElement === locate, true);
    await userEvent.keyboard("{Enter}");
    const target = await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal((screen.getByRole("radio", { name: new RegExp("Occupied") }) as HTMLInputElement).disabled, true);
    const confirm = screen.getByRole("button", { name: t("recoveryConfirm") });
    assert.equal((confirm as HTMLButtonElement).disabled, true);
    target.focus(); await userEvent.keyboard(" ");
    assert.ok(screen.getByText(t("recoveryTargetPath"))); assert.ok(screen.getByText(t("recoveryNoCategory")));
    assert.equal(client.saves, 0);
    confirm.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(t("recoverySaved"));
    assert.equal(client.saves, 1);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }).textContent?.includes("Exact authored Text"));
    assert.equal(document.activeElement === screen.getByRole("heading", { name: "Table" }), true);
    cleanup();
  });
  test(`${language}: pending prevents duplicate submission/cancel; stale requires refresh and explicit reselection`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    const confirm = screen.getByRole("button", { name: t("recoveryConfirm") });
    await userEvent.click(confirm); await userEvent.click(confirm);
    assert.equal(client.saves, 1);
    assert.equal((screen.getByRole("button", { name: t("cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: t("discoveryRefresh") }) as HTMLButtonElement).disabled, true);
    await userEvent.keyboard("{Escape}");
    assert.ok(screen.getByRole("heading", { name: t("recoveryTitle") }));
    await act(async () => response.resolve({ ok: false, error: { code: "stale_preview", message: "changed" } }));
    await screen.findByText(t("recoveryStale"));
    assert.equal(screen.queryByRole("radio"), null);
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    const target = await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal((target as HTMLInputElement).checked, false);
    assert.equal((confirm as HTMLButtonElement).disabled, true);
    assert.equal(client.saves, 1); assert.equal(client.previews, 2);
    cleanup();
  });
  test(`${language}: recovery handles empty, loading, source conflict, failure and uncertain states`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const props = { language, project: retained, preview: null, selectedPath: null, loading: false, pending: false, error: false, stale: false, uncertain: false,
      onSelect() {}, onConfirm() {}, onRefresh() {}, onCancel() {} };
    const view = render(<ProjectRecoveryPanel {...props} loading />);
    assert.ok(screen.getByText(t("recoveryLoading")));
    view.rerender(<ProjectRecoveryPanel {...props} preview={{ ...preview, state: "empty", entries: [] }} />);
    assert.ok(screen.getByText(t("recoveryEmpty")));
    view.rerender(<ProjectRecoveryPanel {...props} preview={{ ...preview, state: "root_identity_conflict", entries: [], previewToken: null }} />);
    assert.ok(screen.getByText(t("discoveryRootConflict")));
    view.rerender(<ProjectRecoveryPanel {...props} error uncertain />);
    assert.ok(screen.getByText(t("recoveryError"))); assert.ok(screen.getByText(t("recoveryUncertain")));
    cleanup();
    const client = new RecoveryClient(); client.handler = async () => ({ ok: false, error: { code: "storage", message: "failed" } });
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await screen.findByText(t("recoveryError"));
    assert.equal(screen.queryByText(t("recoverySaved")), null);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }).textContent?.includes("Exact authored Text"));
    client.handler = async () => { throw new Error("lost response"); };
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await screen.findByText(t("recoveryUncertain"));
    await waitFor(() => assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true));
    assert.equal(client.saves, 2); cleanup();
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language}: grouped recovery reviews full path/category, blocks category conflicts and requires fresh keyboard selection`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    const groupedProject = { ...retained, relativePath: "Old category/Original authored name", categoryId: "old-category", categoryName: "Old category" };
    client.projects = { ...initial, mode: "grouped", retainedProjects: [groupedProject], retainedCount: 1,
      categoryProperty: { propertyId: "category-property", sourceId: "source", name: "Authored category label" } };
    client.recoveryPreview = { ...preview, mode: "grouped", entries: [
      { relativePath: "New authored category/Target authored name", name: "Target authored name", categoryPath: "New authored category", status: "selectable" },
      { relativePath: "Conflicting category/Blocked", name: "Blocked", categoryPath: "Conflicting category", status: "category_unavailable" },
    ] };
    client.handler = async () => ({ ok: false, error: { code: "stale_preview", message: "category changed" } });
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const locate = await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` });
    locate.focus(); await userEvent.keyboard("{Enter}");
    const target = await screen.findByRole("radio", { name: /New authored category\/Target authored name/ });
    assert.equal((screen.getByRole("radio", { name: /Conflicting category\/Blocked/ }) as HTMLInputElement).disabled, true);
    assert.ok(screen.getByText(t("recoveryCategoryUnavailable")));
    target.focus(); await userEvent.keyboard(" ");
    const review = document.querySelector(".recovery-review")!;
    assert.ok(review.textContent?.includes(groupedProject.relativePath));
    assert.ok(review.textContent?.includes("New authored category/Target authored name"));
    assert.ok(review.textContent?.includes("New authored category"));
    assert.equal(client.saves, 0);
    const confirm = screen.getByRole("button", { name: t("recoveryConfirm") });
    confirm.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(t("recoveryStale"));
    assert.equal(client.saves, 1); assert.equal(screen.queryByRole("radio"), null);
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    const fresh = await screen.findByRole("radio", { name: /New authored category\/Target authored name/ });
    assert.equal((fresh as HTMLInputElement).checked, false);
    assert.equal((confirm as HTMLButtonElement).disabled, true);
    fresh.focus(); await userEvent.keyboard(" ");
    client.handler = async () => {
      const saved: ProjectList = { ...client.projects, revision: 2, retainedProjects: [], retainedCount: 0,
        categories: [{ categoryId: "new-category", name: "New authored category", relativePath: "New authored category" }],
        projects: [{ ...groupedProject, relativePath: client.recoveryPreview.entries[0].relativePath, name: "Target authored name",
          categoryId: "new-category", categoryName: "New authored category", resolution: "active" }] };
      client.projects = saved; return { ok: true, value: saved };
    };
    confirm.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(t("recoverySaved"));
    assert.equal(client.saves, 2); assert.equal(client.previews, 2);
    assert.equal(document.activeElement === screen.getByRole("heading", { name: "Table" }), true);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }).textContent?.includes("Exact authored Text"));
    cleanup();
  });
  test(`${language}: grouped empty target set and category-only conflicts remain cancellable`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const props = { language, project: retained, selectedPath: null, loading: false, pending: false, error: false, stale: false, uncertain: false,
      onSelect() {}, onConfirm() {}, onRefresh() {}, onCancel() {} };
    const view = render(<ProjectRecoveryPanel {...props} preview={{ ...preview, mode: "grouped", entries: [] }} />);
    assert.ok(screen.getByText(t("recoveryEmpty")));
    view.rerender(<ProjectRecoveryPanel {...props} preview={{ ...preview, mode: "grouped", entries: [
      { relativePath: "Unavailable/Project", name: "Project", categoryPath: "Unavailable", status: "category_unavailable" },
    ] }} />);
    assert.equal((screen.getByRole("radio") as HTMLInputElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: t("cancelRenameWorkspace") }) as HTMLButtonElement).disabled, false);
    cleanup();
  });
}

const projectEvent = (revision: number): Extract<WorkspaceChangeEvent, { type: "workspace.projectsChanged" }> => ({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace", "sibling"], revision });
const sourceEvent = (sourceAvailable: boolean): WorkspaceChangeEvent => ({ type: "workspace.sourceChanged", source: {
  sourceId: "source", canonicalRoot: "/fixture", sourceAvailable, workspaceIds: ["workspace", "sibling"],
} });
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const openTarget = async () => {
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
  };
  test(`${language}: event before recovery response preserves drafts and newer independent category labels`, async () => {
    const client = new RecoveryClient();
    const category = { propertyId: "category", sourceId: "source", name: "Initial category label" };
    client.projects = { ...initial, mode: "grouped", categoryProperty: category, categoryPropertyRevision: 1 };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }));
    const editor = screen.getByRole("textbox", { name: `${t("editTextValue")}: ${retained.name} / Notes` });
    await userEvent.clear(editor); await userEvent.type(editor, "Unsaved independent Text");
    await userEvent.click(screen.getByRole("button", { name: `${t("renameCategoryProperty")}: Initial category label` }));
    const labelEditor = screen.getByRole("textbox", { name: t("categoryPropertyName") });
    await userEvent.clear(labelEditor); await userEvent.type(labelEditor, "Unsaved category label");
    const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    await openTarget(); await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    const own = { ...committed, mode: "grouped" as const, categoryProperty: category, categoryPropertyRevision: 1 };
    client.projects = { ...own, categoryProperty: { ...category, name: "Newer committed label" }, categoryPropertyRevision: 2 };
    await act(async () => {
      client.emit(projectEvent(2));
      client.emit({ type: "workspace.categoryPropertyChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 });
    });
    await act(async () => response.resolve({ ok: true, value: own }));
    await screen.findByText(t("recoverySaved"));
    assert.equal(document.querySelector("textarea"), editor);
    assert.equal((editor as HTMLTextAreaElement).value, "Unsaved independent Text");
    assert.equal((labelEditor as HTMLInputElement).value, "Unsaved category label");
    assert.ok(screen.getByRole("columnheader", { name: "Newer committed label" }));
    cleanup(); assert.equal(client.listeners.size, 0);
  });
  test(`${language}: newer sibling snapshot wins over a delayed successful recovery and older list`, async () => {
    const client = new RecoveryClient();
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    await openTarget(); await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    const oldList = deferred<ServiceResult<ProjectList>>(); client.listHandler = () => oldList.promise;
    await act(async () => client.emit(projectEvent(2)));
    client.listHandler = null;
    const newer = { ...committed, revision: 3, projects: [{ ...committed.projects[0], name: "Newest sibling project", relativePath: "Newest sibling project" }] };
    client.projects = newer;
    await act(async () => client.emit(projectEvent(3)));
    await screen.findByRole("button", { name: `${t("editTextValue")}: Newest sibling project / Notes` });
    await act(async () => { response.resolve({ ok: true, value: committed }); oldList.resolve({ ok: true, value: committed }); });
    await screen.findByText(t("recoverySaved"));
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Newest sibling project / Notes` }));
    assert.equal(screen.queryByText(t("recoveryUncertain")), null);
    cleanup(); assert.equal(client.listeners.size, 0);
  });
  test(`${language}: cancellation rejects delayed preview and unrelated events preserve target selection`, async () => {
    const client = new RecoveryClient(); const delayed = deferred<ServiceResult<ProjectRecoveryPreview>>();
    client.previewHandler = () => delayed.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.keyboard("{Escape}");
    await act(async () => delayed.resolve({ ok: true, value: preview }));
    assert.equal(screen.queryByRole("radio"), null);
    client.previewHandler = null; await openTarget();
    await act(async () => {
      client.emit({ ...projectEvent(9), sourceId: "unrelated" });
      client.emit({ ...projectEvent(9), workspaceIds: ["foreign"] });
    });
    assert.equal((screen.getByRole("radio", { name: "Target authored name" }) as HTMLInputElement).checked, true);
    await act(async () => client.emit(sourceEvent(false)));
    await screen.findByText(t("recoveryStale"));
    assert.equal(screen.queryByRole("radio"), null);
    assert.equal(client.saves, 0); cleanup(); assert.equal(client.listeners.size, 0);
  });
  test(`${language}: lost committed response reloads actual state without replay or fabricated success`, async () => {
    const client = new RecoveryClient();
    client.handler = async () => { client.projects = committed; client.emit(projectEvent(2)); return { ok: false, error: { code: "service_unavailable", message: "lost" } }; };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await openTarget(); await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await screen.findByText(t("recoveryUncertain"));
    assert.ok(await screen.findByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }));
    assert.equal(screen.queryByText(t("recoverySaved")), null); assert.equal(client.saves, 1);
    assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
    cleanup(); assert.equal(client.listeners.size, 0);
  });
  for (const delivery of ["batched", "separate"] as const) for (const notification of ["availability", "observation"] as const)
  test(`${language}: source disconnect during an accepted mutation discards its delayed response (${delivery}, ${notification})`, async () => {
    const client = new RecoveryClient(); const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await openTarget(); await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await act(async () => {
      client.emit(notification === "availability" ? sourceEvent(false) : { type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"],
        observationRevision: 1, state: "unavailable", automaticUpdates: "degraded" });
      if (delivery === "batched") response.resolve({ ok: true, value: committed });
    });
    await screen.findByText(t("recoveryUncertain"));
    if (delivery === "separate") await act(async () => response.resolve({ ok: true, value: committed }));
    assert.equal(screen.queryByText(t("recoverySaved")), null);
    assert.equal(client.saves, 1);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }));
    cleanup(); assert.equal(client.listeners.size, 0);
  });
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  test(`${language}: recovery cannot cancel a delayed newer category-label reload`, async () => {
    const client = new RecoveryClient(), category = { propertyId: "category", sourceId: "source", name: "Initial label" };
    client.projects = { ...initial, mode: "grouped", categoryProperty: category, categoryPropertyRevision: 1 };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    const own = { ...committed, mode: "grouped" as const, categoryProperty: category, categoryPropertyRevision: 1 };
    const labelLoad = deferred<ServiceResult<ProjectList>>(); client.listHandler = () => labelLoad.promise;
    await act(async () => client.emit({ type: "workspace.categoryPropertyChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 }));
    await act(async () => response.resolve({ ok: true, value: own }));
    await screen.findByText(t("recoverySaved"));
    await act(async () => labelLoad.resolve({ ok: true, value: { ...own, categoryProperty: { ...category, name: "Newest label" }, categoryPropertyRevision: 2 } }));
    await screen.findByRole("columnheader", { name: "Newest label" });
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }));
    cleanup();
  });
  test(`${language}: retry and failed/incomplete observations preserve editors but revoke target selection`, async () => {
    const client = new RecoveryClient();
    const view = render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" refreshVersion={0} language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }));
    const editor = screen.getByRole("textbox", { name: `${t("editTextValue")}: ${retained.name} / Notes` });
    await userEvent.clear(editor); await userEvent.type(editor, "Unsaved across failure and retry");
    await userEvent.click(screen.getByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    client.listHandler = async () => ({ ok: false, error: { code: "storage", message: "failed" } });
    view.rerender(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" refreshVersion={1} language={language} disabled={false} />);
    await screen.findByText(t("projectsError")); await screen.findByText(t("recoveryStale"));
    assert.equal(screen.queryByRole("radio"), null); assert.equal(document.querySelector("textarea"), editor);
    assert.equal((editor as HTMLTextAreaElement).value, "Unsaved across failure and retry");
    client.listHandler = null;
    await userEvent.click(screen.getByRole("button", { name: t("projectsRetry") }));
    await waitFor(() => assert.equal(screen.queryByText(t("projectsError")) === null, true));
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    client.projects = { ...initial, state: "unreadable" };
    view.rerender(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" refreshVersion={2} language={language} disabled={false} />);
    await screen.findByText(t("discoveryUnreadable"));
    assert.equal(screen.queryByRole("radio"), null); assert.equal(document.querySelector("textarea"), editor);
    assert.equal(client.saves, 0); cleanup();
  });
  test(`${language}: invalidated in-flight previews cannot restore targets or submit a stale selection`, async () => {
    const client = new RecoveryClient(), delayed = deferred<ServiceResult<ProjectRecoveryPreview>>(); client.previewHandler = () => delayed.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    client.projects = { ...initial, revision: 2 };
    await act(async () => client.emit(projectEvent(2)));
    await screen.findByText(t("recoveryStale"));
    await act(async () => delayed.resolve({ ok: true, value: preview }));
    assert.equal(screen.queryByRole("radio"), null);
    assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
    client.previewHandler = null; client.recoveryPreview = { ...preview, revision: 2 };
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    assert.equal((await screen.findByRole("radio", { name: "Target authored name" }) as HTMLInputElement).checked, false);
    assert.equal(client.saves, 0); cleanup();
  });
}


for (const language of ["en", "ru"] as const) {
  test(`${language}: long authored grouped recovery paths remain exact and every conflict is explained without selectable controls`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const category = "  Категория-日本語-" + "long-category-".repeat(18) + "  ";
    const name = "  Authored-project-" + "long-name-".repeat(18) + "  ";
    const path = `${category}/${name}`;
    const statuses = ["reserved_path", "native_conflict", "category_unavailable", "excluded", "unresolved"] as const;
    const reasons = ["recoveryReserved", "recoveryNativeConflict", "recoveryCategoryUnavailable", "recoveryExcluded", "recoveryUnresolved"] as const;
    const longPreview: ProjectRecoveryPreview = { ...preview, mode: "grouped", entries: [
      { name, relativePath: path, categoryPath: category, status: "selectable" },
      ...statuses.map((status) => ({ name: status, relativePath: `${category}/${status}`, categoryPath: category, status })),
    ] };
    let selected: string | null = null, confirms = 0, cancels = 0;
    const props = { language, project: { ...retained, name, relativePath: path }, preview: longPreview,
      selectedPath: null as string | null, loading: false, pending: false, error: false, stale: false, uncertain: false,
      onSelect: (value: string) => { selected = value; }, onConfirm: () => { confirms++; }, onCancel: () => { cancels++; }, onRefresh: () => {} };
    const view = render(<ProjectRecoveryPanel {...props} />);
    assert.equal(document.activeElement === screen.getByRole("heading", { name: t("recoveryTitle") }), true);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    assert.equal(radios[0].value, path);
    for (let index = 0; index < statuses.length; index++) {
      assert.equal(radios[index + 1].disabled, true);
      assert.ok(screen.getByText(t(reasons[index])));
    }
    radios[0].focus(); await userEvent.keyboard(" ");
    assert.equal(selected, path); assert.equal(confirms, 0);
    view.rerender(<ProjectRecoveryPanel {...props} selectedPath={selected} />);
    const values = Array.from(view.container.querySelectorAll(".recovery-review dd"), (node) => node.textContent);
    assert.deepEqual(values, [name, path, path, category]);
    view.rerender(<ProjectRecoveryPanel {...props} selectedPath={selected} pending />);
    assert.ok(screen.getByText(t("recoverySaving")));
    assert.equal(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled), true);
    await userEvent.keyboard("{Escape}"); assert.equal(cancels, 0);
    view.rerender(<ProjectRecoveryPanel {...props} selectedPath={selected} />);
    await userEvent.keyboard("{Escape}"); assert.equal(cancels, 1); assert.equal(confirms, 0);
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language}: observer-only invalidation retains Text, restores the review keyboard route and requires reselection`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key), client = new RecoveryClient();
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }));
    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.clear(editor); await userEvent.type(editor, "Unsaved observation draft");
    await userEvent.click(screen.getByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    const target = await screen.findByRole("radio", { name: "Target authored name" }); target.focus(); await userEvent.keyboard(" ");
    await act(async () => client.emit({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 2, state: "ready", automaticUpdates: "degraded" }));
    await screen.findByText(t("recoveryStale"));
    assert.equal(screen.queryByRole("radio") === null, true);
    assert.equal(document.activeElement === screen.getByRole("button", { name: t("discoveryRefresh") }), true);
    assert.equal(document.querySelector("textarea"), editor); assert.equal(editor.value, "Unsaved observation draft");
    await userEvent.keyboard("{Enter}");
    const refreshed = await screen.findByRole("radio", { name: "Target authored name" }) as HTMLInputElement;
    assert.equal(refreshed.checked, false); assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
    await act(async () => client.emit({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: "unavailable", automaticUpdates: "degraded" }));
    assert.equal(screen.getByRole("radio", { name: "Target authored name" }), refreshed);
    assert.equal(client.saves, 0); cleanup();
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language}: mode-retained projects remain editable and a sibling mode change invalidates recovery before target-depth rereview`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    client.projects = { ...initial, retainedProjects: [{ ...retained, retentionReason: "mode_change", resolution: "active" }], retainedCount: 1 };
    const delayed = deferred<ServiceResult<ProjectRecoveryPreview>>(); client.previewHandler = () => delayed.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }));
    const editor = screen.getByRole("textbox", { name: `${t("editTextValue")}: ${retained.name} / Notes` }) as HTMLTextAreaElement;
    await userEvent.clear(editor); await userEvent.type(editor, "  Retained draft  ");
    await userEvent.click(screen.getByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    client.projects = { ...client.projects, mode: "grouped", revision: 2, categoryProperty: { propertyId: "category", sourceId: "source", name: "Category label" } };
    await act(async () => client.emit(projectEvent(2)));
    await screen.findByText(t("recoveryStale"));
    await act(async () => delayed.resolve({ ok: true, value: preview }));
    assert.equal(screen.queryByRole("radio"), null); assert.equal(client.saves, 0);
    assert.equal(editor.value, "  Retained draft  "); assert.ok(screen.getByText(t("projectModeRetained")));
    client.previewHandler = null;
    client.recoveryPreview = { ...preview, revision: 2, mode: "grouped", entries: [
      { relativePath: "Category/Target", name: "Target", categoryPath: "Category", status: "selectable" },
    ] };
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    const target = await screen.findByRole("radio", { name: /Category\/Target/ });
    assert.equal((target as HTMLInputElement).checked, false);
    assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true);
    target.focus(); await userEvent.keyboard(" ");
    client.handler = async () => {
      const value: ProjectList = { ...client.projects, revision: 3, projects: [{ ...retained, retentionReason: null, resolution: "active", name: "Target", relativePath: "Category/Target", categoryId: "category" }], retainedProjects: [], retainedCount: 0 };
      client.projects = value; client.emit(projectEvent(3)); return { ok: true, value };
    };
    screen.getByRole("button", { name: t("recoveryConfirm") }).focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(t("recoverySaved"));
    assert.equal(document.querySelector("textarea"), editor); assert.equal(editor.value, "  Retained draft  ");
    assert.equal(client.saves, 1); assert.equal(client.previews, 2); assert.equal(screen.queryByText(t("projectModeRetained")), null);
    cleanup(); assert.equal(client.listeners.size, 0);
  });
}

for (const language of ["en", "ru"] as const) test(`${language}: expanded retained project opens recovery and Cancel returns to its visible origin`, async () => {
  const client = new RecoveryClient();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const user = userEvent.setup({ document });
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await user.click(await screen.findByRole("button", { name: `${language === "en" ? "Preview project" : "Открыть предпросмотр проекта"}: ${retained.name}` }));
  await user.click(screen.getByRole("button", { name: language === "en" ? "Expand project" : "Развернуть проект" }));
  const area = screen.getByRole("region", { name: `${language === "en" ? "Project" : "Проект"}: ${retained.name}` });
  const locate = await within(area).findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` });
  await user.click(locate);
  const dialog = await screen.findByRole("dialog", { name: t("recoveryTitle") });
  await within(dialog).findByRole("radio", { name: "Target authored name" });
  await user.click(within(dialog).getByRole("button", { name: t("cancelRenameWorkspace") }));
  await waitFor(() => assert.equal(screen.queryByRole("dialog", { name: t("recoveryTitle") }), null));
  await waitFor(() => assert.equal(document.activeElement === locate, true));
  assert.ok(screen.getByRole("tab", { name: retained.name, selected: true }));
  assert.equal(client.saves, 0);
});

for (const language of ["en", "ru"] as const) test(`${language}: source outage takes precedence over persisted missing state in a retained tab`, async () => {
  const client = new RecoveryClient();
  client.projects = { ...initial, state: "unavailable", retainedProjects: [{ ...retained, associationState: "missing", resolution: null }], retainedCount: 1 };
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const user = userEvent.setup({ document });
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await user.click(await screen.findByRole("button", { name: `${language === "en" ? "Preview project" : "Открыть предпросмотр проекта"}: ${retained.name}` }));
  await user.click(screen.getByRole("button", { name: language === "en" ? "Expand project" : "Развернуть проект" }));
  const area = screen.getByRole("region", { name: `${language === "en" ? "Project" : "Проект"}: ${retained.name}` });
  assert.ok(within(area).getByText(t("discoveryUnavailable")));
  assert.equal(within(area).queryByText(t("projectMissing")), null);
  assert.equal(within(area).queryByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }), null);
  assert.equal((within(area).getByRole("button", { name: language === "en" ? "Refresh files" : "Обновить файлы" }) as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByRole("tab", { name: retained.name, selected: true }));
  assert.equal(client.saves, 0);
});

for (const language of ["en", "ru"] as const) test(`${language}: retained project reaches workspace settings and returns without losing its tab`, async () => {
  const { DesktopShell, shellLabels } = await import("../src/renderer/components/DesktopShell.js");
  const client = new RecoveryClient();
  const user = userEvent.setup({ document });
  const data = { workspaces: [{ workspaceId: "workspace", name: "One" }], activeWorkspace: { workspaceId: "workspace", sourceId: "source", viewId: "view", name: "One", canonicalRoot: "/fixture", sourceAvailable: false } };
  render(<DesktopShell language={language} data={data} busy={false} locked={false} onActivate={() => {}} renderPanels={() => ({ general: null, appearance: null, workspaces: <p>Current source settings</p>, sources: null, backup: <p>Application data recovery</p>, about: null })}>
    <DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />
  </DesktopShell>);
  await user.click(await screen.findByRole("button", { name: `${language === "en" ? "Preview project" : "Открыть предпросмотр проекта"}: ${retained.name}` }));
  await user.click(screen.getByRole("button", { name: language === "en" ? "Expand project" : "Развернуть проект" }));
  const area = screen.getByRole("region", { name: `${language === "en" ? "Project" : "Проект"}: ${retained.name}` });
  const settings = within(area).getByRole("button", { name: language === "en" ? "Source settings" : "Настройки источника" });
  await user.click(settings);
  assert.ok(await screen.findByText("Current source settings"));
  assert.ok(screen.getByRole("tab", { name: shellLabels[language].workspaces, selected: true }));
  await user.click(screen.getByRole("button", { name: shellLabels[language].back }));
  await waitFor(() => assert.equal(document.activeElement === settings, true));
  assert.ok(screen.getByRole("tab", { name: retained.name, selected: true }));
  assert.equal(client.saves, 0);
});

for (const pending of [false, true]) test(`switching a retained project dismisses its delayed ${pending ? "command" : "preview"} without reactivating old content`, async () => {
  const client = new RecoveryClient();
  const read = deferred<ServiceResult<ProjectRecoveryPreview>>();
  const response = deferred<ServiceResult<ProjectList>>();
  if (pending) client.handler = () => response.promise;
  else client.previewHandler = () => read.promise;
  const user = userEvent.setup({ document });
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false} />);
  await user.click(await screen.findByRole("button", { name: "Preview project: Excluded" }));
  await user.click(screen.getByRole("button", { name: "Expand project" }));
  await user.click(screen.getByRole("tab", { name: "Table" }));
  await user.click(screen.getByRole("button", { name: `Preview project: ${retained.name}` }));
  await user.click(screen.getByRole("button", { name: "Expand project" }));
  await user.click(within(screen.getByRole("region", { name: `Project: ${retained.name}` })).getByRole("button", { name: `${translate("en", "recoveryLocate")}: ${retained.name}` }));
  await screen.findByRole("dialog", { name: translate("en", "recoveryTitle") });
  if (pending) {
    await user.click(await screen.findByRole("radio", { name: "Target authored name" }));
    await user.click(screen.getByRole("button", { name: translate("en", "recoveryConfirm") }));
    await user.keyboard("{Escape}");
    assert.ok(screen.getByRole("dialog", { name: translate("en", "recoveryTitle") }));
  }
  await user.click(screen.getByRole("tab", { name: "Excluded" }));
  await waitFor(() => assert.equal(Boolean(screen.queryByRole("dialog", { name: translate("en", "recoveryTitle") })), false));
  await act(async () => { if (pending) response.resolve({ ok: true, value: committed }); else read.resolve({ ok: true, value: preview }); });
  assert.ok(screen.getByRole("tab", { name: "Excluded", selected: true }));
  assert.equal(screen.queryByRole("radio", { name: "Target authored name" }), null);
  if (pending) assert.ok(screen.getByText(translate("en", "recoveryUncertain")));
  assert.equal(client.saves, pending ? 1 : 0);
});

test("opening application settings dismisses a delayed project review and keeps backup recovery reachable", async () => {
  const { DesktopShell } = await import("../src/renderer/components/DesktopShell.js");
  const client = new RecoveryClient(), read = deferred<ServiceResult<ProjectRecoveryPreview>>();
  client.previewHandler = () => read.promise;
  const user = userEvent.setup({ document });
  render(<DesktopShell language="en" data={{workspaces:[{workspaceId:"workspace",name:"One"}],activeWorkspace:{workspaceId:"workspace",sourceId:"source",viewId:"view",name:"One",canonicalRoot:"/fixture",sourceAvailable:false}}} busy={false} locked={false} onActivate={() => {}} renderPanels={() => ({general:null,appearance:null,workspaces:null,sources:null,backup:<p>Application data recovery</p>,about:null})}>
    <DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false}/>
  </DesktopShell>);
  await user.click(await screen.findByRole("button", {name:`Preview project: ${retained.name}`}));
  await user.click(screen.getByRole("button", {name:"Expand project"}));
  await user.click(within(screen.getByRole("region",{name:`Project: ${retained.name}`})).getByRole("button",{name:`${translate("en","recoveryLocate")}: ${retained.name}`}));
  await screen.findByRole("dialog", {name:translate("en","recoveryTitle")});
  await user.click(screen.getByRole("button",{name:"Settings"}));
  await waitFor(() => assert.equal(Boolean(screen.queryByRole("dialog",{name:translate("en","recoveryTitle")})),false));
  await act(async () => read.resolve({ok:true,value:preview}));
  await user.click(screen.getByRole("tab",{name:"Backup and recovery"}));
  assert.ok(screen.getByText("Application data recovery"));
  await user.click(screen.getByRole("button",{name:"Back to workspace"}));
  assert.ok(screen.getByRole("tab",{name:retained.name,selected:true}));
  assert.equal(client.saves,0);
});

test("expanded project reports a failed availability read and retries without closing its tab", async () => {
  const client = new RecoveryClient(), user = userEvent.setup({document});
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false}/>);
  await user.click(await screen.findByRole("button",{name:`Preview project: ${retained.name}`}));
  await user.click(screen.getByRole("button",{name:"Expand project"}));
  const area=screen.getByRole("region",{name:`Project: ${retained.name}`});
  const response=deferred<ServiceResult<ProjectList>>();client.listHandler=()=>response.promise;
  await user.click(within(area).getByRole("button",{name:translate("en","refreshSourceAction")}));
  assert.ok(within(area).getByText(translate("en","projectsLoading")));
  await act(async()=>response.resolve({ok:false,error:{code:"service_unavailable",message:"delayed read failed"}}));
  assert.ok(await within(area).findByText(translate("en","projectsError")));
  client.listHandler=null;
  await user.click(within(area).getByRole("button",{name:translate("en","refreshSourceAction")}));
  await waitFor(()=>assert.equal(Boolean(within(area).queryByText(translate("en","projectsError"))),false));
  assert.ok(screen.getByRole("tab",{name:retained.name,selected:true}));
  assert.equal(client.saves,0);
});
