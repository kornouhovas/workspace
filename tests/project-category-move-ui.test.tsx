import { contextReturnTarget } from "../src/renderer/components/ContextTools.js";
import { findAction } from "./context-tools-driver.js";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { createInitialCategoryMoveReviewRefresh, openCategoryMoveStoryAction, showCategoryMoveStoryHistory } from "../src/renderer/components/category-move-story-preparation.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectCategoryMoveOperation, ProjectCategoryMoveResult, ProjectCategoryMoveList, ProjectCategoryMoveRecoveryPreview, ProjectCategoryMoveRecoveryAction } from "../src/contracts/project-category-move.js";
import type { BackendStatus } from "../src/contracts/desktop-api.js";
import type { ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
import type { ProjectCreationList, ProjectCreationOperation, ProjectCreationResult } from "../src/contracts/project-creation.js";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, act, fireEvent, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const initial: ProjectList = {
  workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "grouped", state: "ready",
  projects: [{ projectId: "project", name: "  Exact 📝  ", relativePath: "Current/  Exact 📝  ", categoryId: "current", associationState: "active", resolution: "active", categoryName: "Current" }],
  retainedProjects: [], retainedCount: 0,
  categories: [{ categoryId: "current", name: "Current", relativePath: "Current" }, { categoryId: "empty", name: "Empty", relativePath: "Empty" }],
  categoryProperty: { propertyId: "category-label", sourceId: "source", name: "Client" }, categoryPropertyRevision: 0,
};
class Client extends WorkspaceServiceClient {
  // Non-filter workflow fixtures expose the new empty-filter projection without
  // calling listProjects again (some tests intentionally control that read).
  override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
  override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...this.list.projects, ...this.list.retainedProjects].map(p => p.projectId) } }; }
  override async listViews(workspaceId: string) { return { ok: true as const, value: { workspaceId, activeViewId: "view", views: [{ viewId: "view", name: "Table", kind: "table" as const }] } }; }
  list = structuredClone(initial);
  lists = 0;
  events = new Set<(event: WorkspaceChangeEvent) => void>();
  moves: Parameters<WorkspaceServiceClient["moveProjectCategory"]>[0][] = [];
  handler: () => Promise<ServiceResult<ProjectCategoryMoveResult>> = async () => {
    const receipt = this.completed();
    if (receipt.outcome === "completed") this.list = { ...this.list, revision: 2, projects: [{ ...this.list.projects[0], categoryId: "empty", categoryName: "Empty", relativePath: receipt.project.relativePath }] };
    return { ok: true, value: receipt };
  };
  operation(): ProjectCategoryMoveOperation {
    const input = this.moves.at(-1)!;
    return { operationId: input.operationId, sourceId: "source", initiatingWorkspaceId: input.workspaceId, projectId: input.projectId,
      name: "  Exact 📝  ", originalCategoryId: "current", destinationCategoryId: input.destinationCategoryId,
      originalRelativePath: "Current/  Exact 📝  ", requestedRelativePath: input.destinationCategoryId === "current" ? "Current/  Exact 📝  " : "Empty/  Exact 📝  ",
      expectedRevision: input.expectedRevision, stage: "completed", lastVerifiedPlacement: "destination", problem: null, resultKind: "completed", completedRevision: 2 };
  }
  completed(): ProjectCategoryMoveResult {
    const operation = this.operation();
    return { outcome: "completed", operation, project: { operationId: operation.operationId, sourceId: "source", projectId: "project", name: operation.name, relativePath: operation.requestedRelativePath, categoryId: operation.destinationCategoryId, revision: 2 } };
  }
  unfinished: ProjectCategoryMoveOperation[] = [];
  moveLists: string[] = [];
  statuses = new Set<(status: BackendStatus) => void>();
  statusCalls: string[][] = [];
  reviews: string[][] = [];
  recoveries: [string, string, string, ProjectCategoryMoveRecoveryAction][] = [];
  listHandler: (() => Promise<ServiceResult<ProjectCategoryMoveList>>) | null = null;
  statusHandler: (() => Promise<ServiceResult<ProjectCategoryMoveResult>>) | null = null;
  reviewHandler: (() => Promise<ServiceResult<ProjectCategoryMoveRecoveryPreview>>) | null = null;
  recoveryHandler: (() => Promise<ServiceResult<ProjectCategoryMoveResult>>) | null = null;
  override async listProjectCategoryMoves(workspaceId: string) { this.moveLists.push(workspaceId); return this.listHandler ? this.listHandler() : { ok: true as const, value: { workspaceId, sourceId: this.list.sourceId, operations: this.unfinished } }; }
  override async getProjectCategoryMove(workspaceId: string, operationId: string) { this.statusCalls.push([workspaceId, operationId]); return this.statusHandler ? this.statusHandler() : { ok: true as const, value: this.completed() }; }
  override async previewProjectCategoryMoveRecovery(workspaceId: string, operationId: string) { this.reviews.push([workspaceId, operationId]); return this.reviewHandler ? this.reviewHandler() : { ok: true as const, value: recoveryPreview(this.unfinished[0], workspaceId) }; }
  override async recoverProjectCategoryMove(workspaceId: string, operationId: string, token: string, action: ProjectCategoryMoveRecoveryAction) { this.recoveries.push([workspaceId, operationId, token, action]); return this.recoveryHandler ? this.recoveryHandler() : { ok: true as const, value: recoveryCompleted(this.unfinished[0]) }; }
  override onBackendStatus(listener: (status: BackendStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects() { this.lists++; return { ok: true as const, value: this.list }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "  Exact Text\nТекст  " }] } }; }
  override async listProjectCreations(workspaceId: string): Promise<ServiceResult<ProjectCreationList>> { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  override async listProjectRenames(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  override async moveProjectCategory(input: Parameters<WorkspaceServiceClient["moveProjectCategory"]>[0]) { this.moves.push(input); return this.handler(); }
}
for (const language of ["en", "ru"] as const) {
const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
for (const observation of [false, true]) test(`${language}: current-category completion ${observation ? "with in-flight sourceObserved guard" : "without observation"} retains one submission and exact project/Text`, async () => {
  const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>();
  client.handler = () => response.promise;
  const before = structuredClone(client.list);
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
  const select = screen.getByRole("combobox", { name: t("moveCategoryDestination") }) as HTMLSelectElement;
  assert.equal(select.value, "current"); await userEvent.keyboard("{Enter}");
  assert.equal(client.moves.length, 1);
  const operation: ProjectCategoryMoveOperation = { ...client.operation(), resultKind: "unchanged", completedRevision: 1, lastVerifiedPlacement: "original" };
  const receipt: ProjectCategoryMoveResult = { outcome: "unchanged", operation, project: {
    operationId: operation.operationId, sourceId: "source", projectId: "project", name: operation.name,
    relativePath: operation.requestedRelativePath, categoryId: "current", revision: 1,
  } };
  if (observation) await act(async () => client.events.forEach(listener => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: "ready", automaticUpdates: "active" })));
  await act(async () => response.resolve({ ok: true, value: receipt }));
  await screen.findByText(t(observation ? "moveCategoryNewer" : "moveCategoryUnchanged"));
  await waitFor(() => assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null));
  assert.deepEqual(client.list, before);
  assert.deepEqual(client.moves, [{ workspaceId: "workspace", projectId: "project", operationId: operation.operationId, destinationCategoryId: "current", expectedRevision: 1 }]);
  assert.deepEqual(client.recoveries, []); assert.deepEqual(client.statusCalls, []);
  assert.ok(screen.getByText("  Exact 📝  ", { selector: "td .project-preview-trigger", normalizer: value => value }));
  assert.ok(screen.getByText("  Exact Text\nТекст  ", { normalizer: value => value }));
});
test(`${language}: delayed creation list keeps read-only status usable with an unsubmitted category editor open`, async () => {
  const list = deferred<ServiceResult<ProjectCreationList>>(), status = deferred<ServiceResult<ProjectCreationResult>>();
  const operation: ProjectCreationOperation = {
    operationId: "creation", sourceId: "source", initiatingWorkspaceId: "workspace", projectId: "new-project",
    name: "New", relativePath: "Empty/New", mode: "grouped", categoryId: "empty", expectedRevision: 1,
    stage: "intent", evidenceRecorded: false, problem: null, completedRevision: null,
  };
  const client = new class extends Client {
    creationStatuses: string[][] = [];
    creationMutations: string[] = [];
    creationLists = 0;
    override async listProjectCreations() { this.creationLists++; return list.promise; }
    override async getProjectCreation(workspaceId: string, operationId: string) {
      this.creationStatuses.push([workspaceId, operationId]); return status.promise;
    }
    override async createProject(): Promise<never> { this.creationMutations.push("create"); throw new Error("Unexpected creation"); }
    override async recoverProjectCreation(): Promise<never> { this.creationMutations.push("recover"); throw new Error("Unexpected recovery"); }
  }();
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
  const destination = screen.getByRole("combobox", { name: t("moveCategoryDestination") });
  await userEvent.selectOptions(destination, "empty");
  await act(async () => list.resolve({ ok: true, value: { workspaceId: "workspace", sourceId: "source", operations: [operation] } }));
  const statusButton = await findAction("button", { name: t("creationStatus") }) as HTMLButtonElement;
  assert.equal(statusButton.disabled, false);
  for (const key of ["moveCategorySubmit", "createProject", "creationReview"] as const) {
    const button = screen.getByRole("button", { name: t(key) }) as HTMLButtonElement;
    assert.equal(button.disabled, true); fireEvent.click(button);
  }
  const reload = await findAction("button", { name: t("creationReload") }) as HTMLButtonElement;
  const listsBeforeReload = client.creationLists;
  assert.equal(reload.disabled, false); await userEvent.click(reload);
  assert.equal(client.creationLists, listsBeforeReload + 1);
  await userEvent.click(statusButton);
  assert.deepEqual(client.creationStatuses, [["workspace", "creation"]]);
  assert.equal(statusButton.disabled, true);
  assert.equal(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), destination);
  await act(async () => status.resolve({ ok: true, value: { outcome: "recoverable", operation } }));
  await waitFor(() => assert.equal(statusButton.disabled, false));
  assert.equal((destination as HTMLSelectElement).value, "empty");
  assert.deepEqual(client.moves, []); assert.deepEqual(client.recoveries, []); assert.deepEqual(client.creationMutations, []);
});
test(`${language}: explicit grouped category selection moves the folder without changing Name or Text`, async () => {
  const client = new Client();
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
  const select = screen.getByRole("combobox", { name: t("moveCategoryDestination") });
  assert.equal(document.activeElement?.tagName, "SELECT");
  assert.equal((select as HTMLSelectElement).disabled, false);
  assert.deepEqual(within(select).getAllByRole("option").map((option) => (option as HTMLOptionElement).value), ["current", "empty"]);
  await userEvent.selectOptions(select, "empty");
  assert.equal(client.moves.length, 0);
  await userEvent.keyboard("{Enter}");
  await screen.findByText(t("moveCategorySaved"));
  assert.equal(client.moves.length, 1);
  assert.deepEqual({ ...client.moves[0], operationId: "fresh" }, { workspaceId: "workspace", projectId: "project", destinationCategoryId: "empty", expectedRevision: 1, operationId: "fresh" });
  assert.match(client.moves[0].operationId, /^[0-9a-f-]{36}$/);
  await waitFor(() => assert.equal(client.list.projects[0].categoryId, "empty"));
  assert.ok(screen.getByText("  Exact 📝  ", { selector: "td .project-preview-trigger", normalizer: (value) => value }));
  assert.ok(screen.getByText("  Exact Text\nТекст  ", { normalizer: (value) => value }));
});

}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const mount = (client: Client) => render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  const open = async () => {
    const trigger = await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) });
    const returning=contextReturnTarget(trigger as HTMLButtonElement); await userEvent.click(trigger); return returning;
  };
  const destination = () => screen.getByRole("combobox", { name: t("moveCategoryDestination") }) as HTMLSelectElement;
  const submit = () => screen.getByRole("button", { name: t("moveCategorySubmit") }) as HTMLButtonElement;
  test(`${language}: current category submits a service-validated no-op and restores focus`, async () => {
    const client = new Client(); client.handler = async () => {
      const operation = { ...client.operation(), resultKind: "unchanged" as const, completedRevision: 1, lastVerifiedPlacement: "original" as const };
      return { ok: true, value: { outcome: "unchanged", operation, project: { operationId: operation.operationId, sourceId: "source", projectId: "project", name: operation.name, relativePath: operation.requestedRelativePath, categoryId: "current", revision: 1 } } };
    };
    mount(client); const trigger = await open();
    assert.equal(destination().value, "current");
    await userEvent.keyboard("{Enter}");
    await screen.findByText(t("moveCategoryUnchanged"));
    assert.equal(client.moves.length, 1); assert.equal(client.moves[0].destinationCategoryId, "current");
    assert.equal(client.list.revision, 1); assert.equal(client.list.projects[0].relativePath, "Current/  Exact 📝  ");
    assert.ok(document.activeElement === trigger || document.activeElement === screen.getByRole("heading", { name: "Table" }));
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
  });
  test(`${language}: Escape dismisses an unsubmitted editor and restores the category trigger`, async () => {
    const client = new Client(); mount(client); const trigger = await open();
    await userEvent.selectOptions(destination(), "empty");
    await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
    assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); assert.equal(client.moves.length, 0);
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)}));
    await waitFor(() => {
      assert.equal(destination().value, "current");
      assert.equal(document.activeElement, destination());
      assert.equal(destination().disabled, false);
    });
    assert.equal(client.moves.length, 0);
    await userEvent.selectOptions(destination(), "empty");
    assert.equal(client.moves.length, 0);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => assert.equal(client.moves.length, 1));
    assert.equal(client.moves[0].destinationCategoryId, "empty");
  });
  test(`${language}: category cannot be cleared or implicitly submitted by selecting`, async () => {
    const client = new Client(); mount(client); await open();
    assert.ok(within(destination()).getAllByRole("option").every((option) => (option as HTMLOptionElement).value !== ""));
    await userEvent.selectOptions(destination(), "empty");
    assert.equal(client.moves.length, 0);
    assert.equal(screen.getByText("Current/  Exact 📝  ", { selector: "dd", normalizer: (value) => value }).textContent, "Current/  Exact 📝  ");
    assert.ok(screen.getByText("Empty/  Exact 📝  ", { selector: "dd", normalizer: (value) => value }));
    assert.ok(screen.getByText(t("moveCategoryHint")));
    fireEvent.change(destination(), { target: { value: "" } });
    assert.equal(submit().disabled, true); fireEvent.click(submit()); assert.equal(client.moves.length, 0);
  });
  test(`${language}: duplicate submission and dismissal never cancel or replace pending work`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.handler = () => response.promise;
    mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
    fireEvent.click(submit()); fireEvent.click(submit());
    assert.equal(client.moves.length, 1); assert.equal(destination().disabled, true);
    assert.equal(document.activeElement, screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    assert.ok(await findAction("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
    await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement).disabled, true);
    const receipt = client.completed();
    if (receipt.outcome === "completed") client.list = { ...client.list, revision: 2, projects: [{ ...client.list.projects[0], categoryId: "empty", relativePath: receipt.project.relativePath }] };
    await act(async () => response.resolve({ ok: true, value: receipt }));
    await screen.findByText(t("moveCategorySaved")); assert.equal(client.moves.length, 1);
  });
  for (const [problem, key] of [["occupied", "moveCategoryCollision"], ["reserved_destination", "moveCategoryCollision"], ["stale_configuration", "moveCategoryStale"], ["source_unavailable", "moveCategoryUnavailable"], ["category_unavailable", "moveCategoryUnavailable"], ["storage_error", "moveCategoryFailed"]] as const) {
    test(`${language}: ${problem} preserves destination draft and actual committed category`, async () => {
      const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "rejected", problem, operation: null } });
      mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
      await userEvent.click(submit()); await screen.findByText(t(key));
      await waitFor(() => assert.equal(destination().disabled, false));
      assert.equal(destination().value, "empty"); assert.equal(document.activeElement, destination());
      assert.equal(client.list.projects[0].categoryId, "current"); assert.equal(client.moves.length, 1); assert.ok(client.lists >= 2);
      await userEvent.click(submit()); await waitFor(() => assert.equal(client.moves.length, 2));
      assert.notEqual(client.moves[0].operationId, client.moves[1].operationId);
    });
  }
  for (const kind of ["recoverable", "transport-error", "transport-throw"] as const) {
    test(`${language}: ${kind} blocks a replacement move and reloads actual state`, async () => {
      const client = new Client(); client.handler = async () => {
        if (kind === "transport-throw") throw new Error("lost transport");
        if (kind === "transport-error") return { ok: false, error: { code: "service_unavailable", message: "Lost response" } };
        return { ok: true, value: { outcome: "recoverable", operation: { ...client.operation(), stage: "uncertain", resultKind: null, completedRevision: null, problem: "ownership_uncertain", lastVerifiedPlacement: "original" } } };
      };
      mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
      await userEvent.click(submit()); await screen.findByText(t(kind === "recoverable" ? "moveCategoryRecoverable" : "moveCategoryUncertain"));
      assert.equal(submit().disabled, true); fireEvent.click(submit()); assert.equal(client.moves.length, 1); assert.ok(client.lists >= 2);
      await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
      assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement).disabled, true);
    });
  }
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const mount = (client: Client) => render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  const open = async () => userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
  const destination = () => screen.getByRole("combobox", { name: t("moveCategoryDestination") }) as HTMLSelectElement;
  const submit = () => screen.getByRole("button", { name: t("moveCategorySubmit") }) as HTMLButtonElement;
  for (const restriction of ["direct", "retained", "unresolved", "unavailable"] as const) {
    test(`${language}: ${restriction} projects have no category edit control`, async () => {
      const client = new Client();
      if (restriction === "direct") client.list = { ...client.list, mode: "direct", categoryProperty: null, projects: [{ ...client.list.projects[0], categoryId: null, relativePath: "  Exact 📝  " }] };
      if (restriction === "retained") client.list = { ...client.list, retainedCount: 1, retainedProjects: [{ ...client.list.projects[0], associationState: "missing", resolution: "missing" }], projects: [] };
      if (restriction === "unresolved") client.list = { ...client.list, projects: [{ ...client.list.projects[0], resolution: "unresolved" }] };
      if (restriction === "unavailable") client.list = { ...client.list, state: "unavailable", projects: [{ ...client.list.projects[0], resolution: null }] };
      mount(client); await screen.findByText("  Exact 📝  ", { selector: "td .project-preview-trigger", normalizer: (value) => value });
      assert.equal(screen.queryByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }), null);
      assert.ok(await findAction("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
      assert.equal(client.moves.length, 0);
    });
  }
  for (const timing of ["own-event", "newer-project", "observation"] as const) {
    test(`${language}: confirmed completion survives ${timing} before response and reloads actual placement`, async () => {
      const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.handler = () => response.promise;
      mount(client); await open(); await userEvent.selectOptions(destination(), "empty"); await userEvent.click(submit());
      const receipt = client.completed();
      client.list = { ...client.list, revision: timing === "newer-project" ? 3 : 2,
        projects: [{ ...client.list.projects[0], categoryId: timing === "newer-project" ? "current" : "empty", categoryName: timing === "newer-project" ? "Current" : "Empty", relativePath: timing === "newer-project" ? "Current/  Exact 📝  " : "Empty/  Exact 📝  " }] };
      await act(async () => client.events.forEach((listener) => listener(timing === "observation"
        ? { type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: "ready", automaticUpdates: "active" }
        : { type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: client.list.revision })));
      await act(async () => response.resolve({ ok: true, value: receipt }));
      await screen.findByText(t(timing === "own-event" ? "moveCategorySaved" : "moveCategoryNewer"));
      const table = screen.getByRole("table");
      await waitFor(() => assert.ok(within(table).getByRole("cell", { name: new RegExp(timing === "newer-project" ? "^Current" : "^Empty") })));
      assert.equal(client.moves.length, 1); assert.ok(client.lists >= 3);
    });
  }
  for (const change of ["observation", "revision", "unavailable"] as const) test(`${language}: same-turn ${change} invalidates authoring before React rerenders`, async () => {
    const client = new Client(); mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
    const input = destination(), original = globalThis.crypto.randomUUID;
    let authored = 0;
    globalThis.crypto.randomUUID = () => { authored++; return original.call(globalThis.crypto); };
    try {
      await act(async () => {
        if (change === "revision") client.list = { ...client.list, revision: 2 };
        client.events.forEach(listener => listener(change === "revision"
          ? { type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 }
          : { type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: change === "unavailable" ? "unavailable" : "ready", automaticUpdates: "active" }));
        fireEvent.keyDown(input, { key: "Enter" });
      });
      assert.equal(authored, 0, "Invalidation before Enter must not author an ID");
      assert.equal(client.moves.length, 0, "Invalidation before Enter must not author a command");
      assert.equal(submit().disabled, true);
    } finally { globalThis.crypto.randomUUID = original; }
  });
  test(`${language}: observation after authoring preserves a single rejected command and displays stale`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>();
    client.handler = () => response.promise;
    const before = structuredClone(client.list);
    mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
    await userEvent.keyboard("{Enter}"); assert.equal(client.moves.length, 1);
    await act(async () => client.events.forEach(listener => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: "ready", automaticUpdates: "active" })));
    await act(async () => response.resolve({ ok: true, value: { outcome: "rejected", operation: null, problem: "category_unavailable" } }));
    await screen.findByText(t("moveCategoryStale"));
    assert.equal(destination().disabled, true); assert.equal(submit().disabled, true);
    fireEvent.click(submit()); fireEvent.keyDown(destination(), { key: "Enter" });
    assert.equal(client.moves.length, 1); assert.deepEqual(client.list, before);
    assert.deepEqual(client.recoveries, []); assert.deepEqual(client.statusCalls, []);
  });
  test(`${language}: an observed source change makes an unsubmitted editor stale`, async () => {
    const client = new Client(); mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
    await act(async () => client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, state: "ready", automaticUpdates: "active" })));
    assert.equal(submit().disabled, true); fireEvent.click(submit()); assert.equal(client.moves.length, 0);
    await userEvent.keyboard("{Escape}");
    // The disabled native select cannot receive keyboard events; dismiss explicitly.
    if (screen.queryByRole("combobox", { name: t("moveCategoryDestination") })) await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    await open(); assert.equal(submit().disabled, false);
  });
  test(`${language}: independent category label and Text saves do not invalidate category selection`, async () => {
    const client = new class extends Client {
      text = "  Exact Text\nТекст  ";
      textSaves: [string, string, string, string | null][] = [];
      labels: [string, string, string][] = [];
      override async listTextProperties() {
        const result = await super.listTextProperties();
        return { ...result, value: { ...result.value, revision: this.textSaves.length + 1, values: [{ projectId: "project", propertyId: "notes", value: this.text }] } };
      }
      override async setTextValue(workspaceId: string, projectId: string, propertyId: string, value: string | null) {
        this.textSaves.push([workspaceId, projectId, propertyId, value]); this.text = value!;
        return { ok: true as const, value: { projectId, propertyId, snapshot: (await this.listTextProperties()).value } };
      }
      override async renameCategoryProperty(workspaceId: string, propertyId: string, name: string) {
        this.labels.push([workspaceId, propertyId, name]);
        this.list = { ...this.list, categoryPropertyRevision: 1, categoryProperty: { propertyId, sourceId: "source", name } };
        return { ok: true as const, value: { workspaceId, sourceId: "source", propertyId, name, revision: 1 } };
      }
    }();
    mount(client); await open(); await userEvent.selectOptions(destination(), "empty");
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("renameCategoryProperty")}:`) }));
    const label = screen.getByRole("textbox", { name: t("categoryPropertyName") });
    await userEvent.clear(label); await userEvent.type(label, "Portfolio");
    await userEvent.click(screen.getByRole("button", { name: t("saveCategoryPropertyName") }));
    await screen.findByText(t("categoryPropertySaved"));
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
    const text = screen.getByRole("textbox", { name: new RegExp(`^${t("editTextValue")}:`) });
    await userEvent.clear(text); await userEvent.type(text, "  Independent\nТекст  ");
    await userEvent.click(screen.getByRole("button", { name: t("saveTextValue") })); await screen.findByText(t("textValueSaved"));
    assert.equal(submit().disabled, false); assert.equal(destination().value, "empty");
    assert.equal(client.moves.length, 0); assert.equal(client.labels.length, 1);
    assert.deepEqual(client.textSaves, [["workspace", "project", "notes", "  Independent\nТекст  "]]);
    await userEvent.click(submit()); await screen.findByText(t("moveCategorySaved"));
    assert.equal(client.moves[0].expectedRevision, 1);
    assert.ok(screen.getByRole("columnheader", { name: "Portfolio" })); assert.equal(client.text, "  Independent\nТекст  ");
  });
}


test("unknown category move survives backend remount and resolves only through explicit status", async () => {
  const client = new class extends Client {
    statusCalls: string[][] = [];
    override async getProjectCategoryMove(workspaceId: string, operationId: string) {
      this.statusCalls.push([workspaceId, operationId]); return { ok: true as const, value: this.completed() };
    }
  }();
  client.handler = async () => { throw new Error("lost response"); };
  const props = { client, workspaceId: "workspace", sourceId: "source", language: "en" as const, disabled: false };
  const view = render(<DiscoveryWorkspace key="first" {...props} />);
  await userEvent.click(await findAction("button", { name: /^Move project category:/ }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Destination category" }), "empty");
  await userEvent.click(screen.getByRole("button", { name: "Move project folder" }));
  await screen.findByText(translate("en", "moveCategoryUncertain"));
  view.rerender(<DiscoveryWorkspace key="restarted" {...props} />);
  await userEvent.click(await findAction("button", { name: "Check category move status" }));
  await screen.findByText(translate("en", "moveCategorySaved"));
  assert.deepEqual(client.statusCalls, [["workspace", client.moves[0].operationId]]);
  assert.equal(client.moves.length, 1);
});

const interrupted: ProjectCategoryMoveOperation = {
  operationId: "interrupted", sourceId: "source", initiatingWorkspaceId: "removed-workspace", projectId: "project",
  name: "  Exact 📝  ", originalCategoryId: "current", destinationCategoryId: "empty",
  originalRelativePath: "Current/  Exact 📝  ", requestedRelativePath: "Empty/  Exact 📝  ", expectedRevision: 1,
  stage: "intent", lastVerifiedPlacement: "original", problem: null, resultKind: null, completedRevision: null,
};
function recoveryPreview(operation = interrupted, workspaceId = "workspace"): ProjectCategoryMoveRecoveryPreview {
  return { workspaceId, sourceId: "source", operation, revision: 1, originalState: "matching", destinationState: "missing", problem: null,
    actions: ["retry_original", "keep_original"], previewToken: "fresh-token" };
}
function recoveryCompleted(operation = interrupted): ProjectCategoryMoveResult {
  return { outcome: "completed", operation: { ...operation, stage: "completed", lastVerifiedPlacement: "destination", resultKind: "completed", completedRevision: 2 },
    project: { operationId: operation.operationId, sourceId: operation.sourceId, projectId: operation.projectId, name: operation.name,
      relativePath: operation.requestedRelativePath, categoryId: operation.destinationCategoryId, revision: 2 } };
}
const recoveryActions = { retry_original: "moveCategoryRetryOriginal", complete_destination: "moveCategoryCompleteDestination", keep_original: "moveCategoryKeepOriginal" } as const;
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const openReview = async (operation = interrupted) => {
    const trigger = await findAction("button", { name: `${t("moveCategoryReview")}: ${operation.originalRelativePath} → ${operation.requestedRelativePath}`.replace(/\s+/g, " ").trim() });
    const returning=contextReturnTarget(trigger as HTMLButtonElement); await userEvent.click(trigger); return returning;
  };
  test(`${language}: interrupted category move exposes durable stage and placement without automatic effects`, async () => {
    const client = new Client(); client.unfinished = [{ ...interrupted, stage: "destination_recorded", lastVerifiedPlacement: "destination", problem: "storage_error" }];
    render(<DiscoveryWorkspace {...props(client)} />);
    await screen.findByText(t("moveCategoryStageDestination"));
    assert.ok(screen.getByText(t("moveCategoryVerifiedDestination")));
    assert.ok(screen.getByText(t("moveCategoryStorageError")));
    assert.equal(client.reviews.length, 0); assert.equal(client.recoveries.length, 0); assert.equal(client.moves.length, 0);
  });
  for (const action of Object.keys(recoveryActions) as ProjectCategoryMoveRecoveryAction[]) test(`${language}: explicit ${action} uses fresh token and current workspace while retaining initiating workspace`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.unfinished = [interrupted];
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(), actions: [action], originalState: action === "complete_destination" ? "missing" : "matching", destinationState: action === "complete_destination" ? "matching" : "missing" } });
    client.recoveryHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); await openReview();
    const button = await findAction("button", { name: t(recoveryActions[action]) });
    for (const other of Object.keys(recoveryActions) as ProjectCategoryMoveRecoveryAction[]) if (other !== action) assert.equal(screen.queryByRole("button", { name: t(recoveryActions[other]) }), null);
    await userEvent.click(button); fireEvent.click(button);
    assert.equal(client.recoveries.length, 1);
    assert.equal(document.activeElement, screen.getByRole("button", { name: t("moveCategoryReviewClose") }));
    client.unfinished = [];
    const result: ProjectCategoryMoveResult = action === "keep_original"
      ? { outcome: "rejected", problem: "kept_original", operation: { ...interrupted, stage: "failed", resultKind: "rejected", problem: "kept_original" } }
      : recoveryCompleted();
    if (action !== "keep_original") client.list = { ...client.list, revision: 2, projects: [{ ...client.list.projects[0], categoryId: "empty", categoryName: "Empty", relativePath: interrupted.requestedRelativePath }] };
    await act(async () => response.resolve({ ok: true, value: result }));
    await screen.findByText(t(action === "keep_original" ? "moveCategoryKeptOriginal" : "moveCategorySaved"));
    assert.deepEqual(client.recoveries, [["workspace", "interrupted", "fresh-token", action]]);
    assert.deepEqual(client.reviews, [["workspace", "interrupted"]]); assert.equal(client.moves.length, 0);
    assert.ok(screen.getByText("  Exact 📝  ", { selector: "td .project-preview-trigger", normalizer: (value) => value }));
    assert.ok(screen.getByText("  Exact Text\nТекст  ", { normalizer: (value) => value }));
  });
  for (const state of ["missing", "replaced", "link", "unavailable", "conflicting"] as const) test(`${language}: ${state} recovery evidence offers no action`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(), originalState: state, destinationState: state, actions: [], previewToken: null, problem: "ownership_uncertain" } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await screen.findByText(t("moveCategoryRecoveryBlocked"));
    for (const label of Object.values(recoveryActions)) assert.equal(screen.queryByRole("button", { name: t(label) }), null);
    assert.equal(client.recoveries.length, 0); assert.equal(client.moves.length, 0);
  });
  test(`${language}: failed operation-list refresh retains source conflicts and ordinary Text access`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    render(<DiscoveryWorkspace {...props(client)} />); await findAction("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) });
    client.listHandler = async () => ({ ok: false, error: { code: "storage", message: "cannot read" } });
    await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") })); await screen.findByText(t("moveCategoryListError"));
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("renameProject")}:`) }) as HTMLButtonElement).disabled, true);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
    assert.ok(screen.getByRole("textbox", { name: new RegExp(`^${t("editTextValue")}:`) }));
    assert.equal(client.moves.length, 0); assert.equal(client.reviews.length, 0);
  });
  for (const field of ["sourceId", "operationId", "projectId", "initiatingWorkspaceId", "name", "originalRelativePath", "requestedRelativePath", "originalCategoryId", "destinationCategoryId", "expectedRevision"] as const) test(`${language}: changed ${field} receipt cannot resolve immutable submission`, async () => {
    const client = new Client(); client.handler = async () => {
      const value = client.completed(); Object.assign(value.operation!, { [field]: field === "expectedRevision" ? 99 : "foreign" }); return { ok: true, value };
    };
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("moveCategorySubmit") })); await screen.findByText(t("moveCategoryUncertain"));
    assert.ok(screen.getByRole("button", { name: t("moveCategoryStatus") })); assert.equal(client.moves.length, 1);
    assert.equal((screen.getByRole("button", { name: t("moveCategorySubmit") }) as HTMLButtonElement).disabled, true);
  });
  test(`${language}: dismissal and sibling remount preserve pending operation and use current workspace for status`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.handler = () => response.promise;
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} />);
    await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("moveCategorySubmit") }));
    await userEvent.keyboard("{Escape}");
    client.list = { ...client.list, workspaceId: "sibling" };
    view.rerender(<DiscoveryWorkspace key="sibling" {...props(client)} workspaceId="sibling" />);
    await act(async () => response.resolve({ ok: true, value: client.completed() }));
    await screen.findByText(t("moveCategoryUncertain"));
    client.listHandler = async () => ({ ok: false, error: { code: "storage", message: "list failed" } });
    await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") })); await screen.findByText(t("moveCategoryListError"));
    client.statusHandler = async () => ({ ok: false, error: { code: "service_unavailable", message: "unknown" } });
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategoryUncertain"));
    assert.equal(client.moves.length, 1);
    client.statusHandler = async () => ({ ok: true, value: client.completed() });
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategorySaved"));
    assert.deepEqual(client.statusCalls, [["sibling", client.moves[0].operationId], ["sibling", client.moves[0].operationId]]);
    assert.equal(client.moves[0].workspaceId, "workspace");
    await waitFor(() => assert.equal(document.activeElement === screen.getByRole("heading", { name: "Table" }), true));
  });
  test(`${language}: switching away preserves unknown source operation and leaves an unrelated source usable`, async () => {
    const client = new Client(); client.handler = async () => { throw new Error("lost"); };
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} />);
    await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("moveCategorySubmit") })); await screen.findByText(t("moveCategoryUncertain"));
    client.list = { ...initial, workspaceId: "other", sourceId: "other-source" };
    view.rerender(<DiscoveryWorkspace key="other" {...props(client)} workspaceId="other" sourceId="other-source" />);
    const other = await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) });
    assert.equal((other as HTMLButtonElement).disabled, false); assert.equal(screen.queryByRole("button", { name: t("moveCategoryStatus") }), null);
    client.list = structuredClone(initial); view.rerender(<DiscoveryWorkspace key="returned" {...props(client)} />);
    await findAction("button", { name: t("moveCategoryStatus") }); assert.equal(client.moves.length, 1); assert.equal(client.statusCalls.length, 0);
  });
  test(`${language}: backend generation discards old command response and reconnect never replays`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("moveCategorySubmit") }));
    await act(async () => { client.statuses.forEach((fn) => fn({ state: "unavailable" })); client.statuses.forEach((fn) => fn({ state: "ready" })); response.resolve({ ok: true, value: client.completed() }); });
    await screen.findByText(t("moveCategoryUncertain")); assert.equal(screen.queryByText(t("moveCategorySaved")), null);
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategorySaved"));
    assert.equal(client.moves.length, 1); assert.equal(client.statusCalls.length, 1);
  });
  test(`${language}: status without durable operation cannot unlock replacement moves`, async () => {
    const client = new Client(); client.handler = async () => { throw new Error("lost"); };
    client.statusHandler = async () => ({ ok: true, value: { outcome: "rejected", operation: null, problem: "project_unavailable" } });
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("moveCategoryDestination") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("moveCategorySubmit") })); await screen.findByText(t("moveCategoryUncertain"));
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategoryUncertain"));
    assert.equal((screen.getByRole("button", { name: t("moveCategorySubmit") }) as HTMLButtonElement).disabled, true); assert.equal(client.moves.length, 1);
  });
  for (const field of ["workspaceId", "sourceId", "operationId", "projectId", "initiatingWorkspaceId", "name", "originalRelativePath", "requestedRelativePath", "originalCategoryId", "destinationCategoryId", "expectedRevision", "stage", "lastVerifiedPlacement", "problem", "revision"] as const) test(`${language}: recovery preview rejects changed ${field} binding`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.reviewHandler = async () => {
      const value = structuredClone(recoveryPreview());
      if (field === "workspaceId" || field === "sourceId") value[field] = "foreign";
      else if (field === "revision") value.revision = 0;
      else Object.assign(value.operation, { [field]: field === "expectedRevision" ? 99 : field === "stage" ? "uncertain" : field === "lastVerifiedPlacement" ? "destination" : field === "problem" ? "storage_error" : "foreign" });
      return { ok: true, value };
    };
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await screen.findByText(t("moveCategoryReviewError"));
    assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null); assert.equal(client.recoveries.length, 0);
  });
  for (const change of ["revision", "observation", "unavailable", "refresh", "backend", "reload", "selection"] as const) test(`${language}: ${change} invalidates category recovery preview without replay`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} refreshVersion={0} />); await openReview();
    const action = await findAction("button", { name: t("moveCategoryRetryOriginal") }); action.focus();
    await act(async () => {
      if (change === "revision") client.events.forEach((fn) => fn({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 }));
      if (change === "observation" || change === "unavailable") client.events.forEach((fn) => fn({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, automaticUpdates: "active", state: change === "unavailable" ? "unavailable" : "ready" }));
      if (change === "refresh") view.rerender(<DiscoveryWorkspace key="first" {...props(client)} refreshVersion={1} />);
      if (change === "backend") { client.statuses.forEach((fn) => fn({ state: "unavailable" })); client.statuses.forEach((fn) => fn({ state: "ready" })); }
      if (change === "selection") { client.list = { ...initial, workspaceId: "other", sourceId: "other-source" }; client.unfinished = []; view.rerender(<DiscoveryWorkspace key="other" {...props(client)} workspaceId="other" sourceId="other-source" />); }
    });
    if (change === "reload") await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") }));
    assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null); fireEvent.click(action);
    assert.equal(client.recoveries.length, 0); assert.equal(client.reviews.length, 1);
    if (change !== "selection") await screen.findByText(t("moveCategoryReviewStale"));
    if (["observation", "refresh", "backend"].includes(change)) await waitFor(() => assert.equal(document.activeElement, screen.getByRole("button", { name: t("moveCategoryReviewAgain") })));
  });
  test(`${language}: story preparation enters the current row action before opening category editing`, async () => {
    const client = new Client();
    render(<DiscoveryWorkspace {...props(client)} />);
    await screen.findByText("Current");
    await waitFor(() => assert.equal(document.querySelector(".text-properties")?.getAttribute("aria-busy"), "false"));
    await act(async () => { openCategoryMoveStoryAction(document.body, language); });
    await act(async () => { assert.equal(openCategoryMoveStoryAction(document.body, language), true); });
    await screen.findByLabelText(t("moveCategoryDestination"));
    assert.equal(client.moves.length, 0, "Opening preparation cannot submit a filesystem command");
  });
  test(`${language}: story preparation reveals operation history without a recovery or move`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    render(<DiscoveryWorkspace {...props(client)} />);
    await waitFor(() => assert.equal(document.querySelector(".category-move-operations")?.getAttribute("aria-busy"), "false"));
    await act(async () => { showCategoryMoveStoryHistory(document.body); });
    await act(async () => { showCategoryMoveStoryHistory(document.body); });
    assert.equal(showCategoryMoveStoryHistory(document.body), true);
    await screen.findByRole("button", { name: new RegExp(t("moveCategoryReview")) });
    assert.equal(client.reviews.length, 0); assert.equal(client.recoveries.length, 0); assert.equal(client.moves.length, 0);
  });
  test(`${language}: story preparation refreshes one stale initial review without retrying mutations`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    render(<DiscoveryWorkspace {...props(client)} />); await openReview();
    await findAction("button", { name: t("moveCategoryRetryOriginal") });
    const refresh = createInitialCategoryMoveReviewRefresh(language);
    assert.equal(refresh(document.body), false);
    for (const revision of [1, 2]) {
      await act(async () => client.events.forEach((fn) => fn({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: revision, automaticUpdates: "active", state: "ready" })));
      await screen.findByText(t("moveCategoryReviewStale"));
      await waitFor(() => assert.equal(document.querySelector(".category-move-operations")?.getAttribute("aria-busy"), "false"));
      await act(async () => assert.equal(refresh(document.body), revision === 1));
      if (revision === 1) {
        assert.equal(document.querySelector(".category-move-review"), null);
        // Reopening follows the current Source tools entry before the review.
        for (let step = 0; step < 3 && !document.querySelector(".category-move-review"); step++) {
          await act(async () => assert.equal(refresh(document.body), true));
        }
        await findAction("button", { name: t("moveCategoryRetryOriginal") });
        assert.equal(document.activeElement === document.getElementById("category-move-review-title"), true, "Prepared initial review restores heading focus");
      }
      else assert.ok(screen.getByText(t("moveCategoryReviewStale")), "Repeated instability must remain a fixture failure");
    }
    assert.equal(client.reviews.length, 2);
    assert.equal(client.recoveries.length, 0); assert.equal(client.moves.length, 0);
  });
  for (const change of ["observation", "refresh", "backend", "unmount", "dismissal"] as const) test(`${language}: ${change} discards delayed category recovery preview`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveRecoveryPreview>>(); client.unfinished = [interrupted]; client.reviewHandler = () => response.promise;
    const view = render(<DiscoveryWorkspace {...props(client)} refreshVersion={0} />); const trigger = await openReview(); await screen.findByText(t("moveCategoryReviewLoading"));
    await act(async () => {
      if (change === "observation") client.events.forEach((fn) => fn({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, automaticUpdates: "active", state: "ready" }));
      if (change === "refresh") view.rerender(<DiscoveryWorkspace {...props(client)} refreshVersion={1} />);
      if (change === "backend") { client.statuses.forEach((fn) => fn({ state: "unavailable" })); client.statuses.forEach((fn) => fn({ state: "ready" })); }
      if (change === "unmount") view.unmount();
    });
    if (change === "dismissal") { await userEvent.keyboard("{Escape}"); assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); }
    await act(async () => response.resolve({ ok: true, value: recoveryPreview() }));
    assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null); assert.equal(client.recoveries.length, 0);
    if (change === "unmount") { assert.equal(client.statuses.size, 0); assert.equal(client.events.size, 0); }
  });
  test(`${language}: recovery pending dismissal and failed list retain same-operation status across remount`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.unfinished = [interrupted]; client.recoveryHandler = () => response.promise;
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} />); await openReview();
    await userEvent.click(await findAction("button", { name: t("moveCategoryRetryOriginal") }));
    await userEvent.keyboard("{Escape}");
    await act(async () => response.resolve({ ok: false, error: { code: "service_unavailable", message: "lost recovery response" } }));
    client.listHandler = async () => ({ ok: false, error: { code: "storage", message: "list failed" } });
    view.rerender(<DiscoveryWorkspace key="restarted" {...props(client)} />); await screen.findByText(t("moveCategoryListError"));
    client.statusHandler = async () => { client.unfinished = []; return { ok: true, value: { outcome: "rejected", problem: "kept_original", operation: { ...interrupted, stage: "failed", resultKind: "rejected", problem: "kept_original" } } }; };
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategoryKeptOriginal"));
    assert.deepEqual(client.statusCalls, [["workspace", "interrupted"]]); assert.equal(client.recoveries.length, 1); assert.equal(client.moves.length, 0);
  });
  test(`${language}: stale recovery token requires fresh explicit review with no automatic retry`, async () => {
    const client = new Client(); client.unfinished = [interrupted]; client.recoveryHandler = async () => ({ ok: false, error: { code: "stale_preview", message: "stale" } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("moveCategoryRetryOriginal") }));
    await screen.findByText(t("moveCategoryReviewStale")); assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null);
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(), previewToken: "new-token" } });
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryReviewAgain") })); await findAction("button", { name: t("moveCategoryRetryOriginal") });
    assert.equal(client.reviews.length, 2); assert.equal(client.recoveries.length, 1);
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryRetryOriginal") })); assert.deepEqual(client.recoveries[1], ["workspace", "interrupted", "new-token", "retry_original"]);
  });
  test(`${language}: category recovery confirmed after a newer event keeps actual placement and Text focus`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveResult>>(); client.unfinished = [interrupted]; client.recoveryHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("moveCategoryRetryOriginal") }));
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
    const text = screen.getByRole("textbox", { name: new RegExp(`^${t("editTextValue")}:`) });
    client.unfinished = []; client.list = { ...client.list, revision: 3 };
    await act(async () => client.events.forEach((fn) => fn({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 3 })));
    await act(async () => response.resolve({ ok: true, value: recoveryCompleted() })); await screen.findByText(t("moveCategoryNewer"));
    assert.equal(document.activeElement === text, true); assert.equal(client.moves.length, 0); assert.equal(client.recoveries.length, 1);
    assert.equal(client.list.projects[0].categoryId, "current");
  });
  test(`${language}: loading empty failed and retried lists never replay effects`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveList>>(); client.listHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); await screen.findByText(t("moveCategoryListLoading"));
    await act(async () => response.resolve({ ok: false, error: { code: "storage", message: "failed list" } })); await screen.findByText(t("moveCategoryListError"));
    client.listHandler = null; await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") })); await screen.findByText(t("moveCategoryListEmpty"));
    assert.equal(client.moves.length, 0); assert.equal(client.recoveries.length, 0); assert.equal(client.reviews.length, 0);
  });
  for (const field of ["workspace", "source", "operation-source", "duplicate", "terminal"] as const) test(`${language}: wrong ${field} operation list exposes no review`, async () => {
    const client = new Client(); client.listHandler = async () => ({ ok: true, value: { workspaceId: field === "workspace" ? "foreign" : "workspace", sourceId: field === "source" ? "foreign" : "source",
      operations: field === "duplicate" ? [interrupted, interrupted] : [{ ...interrupted, sourceId: field === "operation-source" ? "foreign" : "source", stage: field === "terminal" ? "completed" : "intent" }] } });
    render(<DiscoveryWorkspace {...props(client)} />); await screen.findByText(t("moveCategoryListError"));
    assert.equal(screen.queryByRole("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) }), null); assert.equal(client.reviews.length, 0);
  });
  test(`${language}: later operation list cannot change project binding`, async () => {
    const client = new Client(); client.unfinished = [interrupted]; render(<DiscoveryWorkspace {...props(client)} />);
    await findAction("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) });
    client.unfinished = [{ ...interrupted, projectId: "foreign" }];
    await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") })); await screen.findByText(t("moveCategoryListError"));
    const button = screen.getByRole("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) }); assert.equal((button as HTMLButtonElement).disabled, true);
    assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: a listed operation has explicit status access independent from recovery and list errors`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.statusHandler = async () => ({ ok: false, error: { code: "service_unavailable", message: "lost status" } });
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: `${t("moveCategoryStatus")}: ${interrupted.originalRelativePath}`.replace(/\s+/g, " ").trim() }));
    await screen.findByText(t("moveCategoryUncertain"));
    client.listHandler = async () => ({ ok: false, error: { code: "storage", message: "failed list" } });
    await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") })); await screen.findByText(t("moveCategoryListError"));
    client.statusHandler = async () => { client.unfinished = []; return { ok: true, value: recoveryCompleted() }; };
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategorySaved"));
    assert.deepEqual(client.statusCalls, [["workspace", "interrupted"], ["workspace", "interrupted"]]);
    assert.equal(screen.queryByRole("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) }), null);
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    await waitFor(() => assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement).disabled, false));
    assert.equal(client.reviews.length, 0); assert.equal(client.moves.length, 0); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: older list cannot revive operation resolved through status`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveList>>(); client.unfinished = [interrupted];
    client.recoveryHandler = async () => ({ ok: false, error: { code: "service_unavailable", message: "lost" } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("moveCategoryRetryOriginal") })); await screen.findByText(t("moveCategoryUncertain"));
    client.listHandler = () => response.promise; await userEvent.click(await findAction("button", { name: t("moveCategoryListReload") }));
    client.statusHandler = async () => { client.unfinished = []; client.listHandler = null; return { ok: true, value: recoveryCompleted() }; };
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryStatus") })); await screen.findByText(t("moveCategorySaved"));
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", sourceId: "source", operations: [interrupted] } }));
    assert.equal(screen.queryByRole("button", { name: new RegExp(`^${t("moveCategoryReview")}:`) }), null); assert.equal(client.recoveries.length, 1);
  });
  test(`${language}: changing operation discards delayed review and reconnect requires new explicit review`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCategoryMoveRecoveryPreview>>();
    const other = { ...interrupted, operationId: "other-operation", projectId: "other-project", name: "Other", originalRelativePath: "Current/Other", requestedRelativePath: "Empty/Other" };
    client.unfinished = [interrupted, other]; client.reviewHandler = () => client.reviews.length === 1 ? response.promise : Promise.resolve({ ok: true, value: recoveryPreview(other) });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await openReview(other); await findAction("button", { name: t("moveCategoryRetryOriginal") });
    await act(async () => response.resolve({ ok: true, value: { ...recoveryPreview(), actions: ["complete_destination"] } }));
    assert.equal(screen.queryByRole("button", { name: t("moveCategoryCompleteDestination") }), null);
    client.unfinished = [{ ...other, stage: "destination_recorded", lastVerifiedPlacement: "destination" }];
    await act(async () => { client.statuses.forEach((fn) => fn({ state: "unavailable" })); client.statuses.forEach((fn) => fn({ state: "ready" })); });
    await screen.findByText(t("moveCategoryReviewStale")); assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null);
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(client.unfinished[0]), actions: ["complete_destination"], originalState: "missing", destinationState: "matching" } });
    await userEvent.click(screen.getByRole("button", { name: t("moveCategoryReviewAgain") })); await findAction("button", { name: t("moveCategoryCompleteDestination") });
    assert.equal(client.reviews.length, 3); assert.equal(client.recoveries.length, 0); assert.equal(client.moves.length, 0);
  });
  for (const fault of ["throw", "service-error", "null-operation", "foreign-project"] as const) test(`${language}: ${fault} recovery result retains explicit status`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.recoveryHandler = async () => {
      if (fault === "throw") throw new Error("lost");
      if (fault === "service-error") return { ok: false, error: { code: "service_unavailable", message: "lost" } };
      if (fault === "null-operation") return { ok: true, value: { outcome: "rejected", operation: null, problem: "project_unavailable" } };
      const value = recoveryCompleted(); if (value.outcome === "completed") value.project.projectId = "foreign"; return { ok: true, value };
    };
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("moveCategoryRetryOriginal") })); await screen.findByText(t("moveCategoryUncertain"));
    assert.ok(screen.getByRole("button", { name: t("moveCategoryStatus") })); assert.equal(client.recoveries.length, 1);
    assert.equal(screen.queryByRole("button", { name: t("moveCategoryRetryOriginal") }), null);
  });
  test(`${language}: pending and unknown creation block category moves while creation status and Text stay usable`, async () => {
    const response = deferred<Awaited<ReturnType<WorkspaceServiceClient["createProject"]>>>();
    const client = new class extends Client { override async createProject() { return response.promise; } }();
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: t("createProject") }));
    await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "New project");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: t("creationCategory") }), "empty");
    await userEvent.click(screen.getByRole("button", { name: t("creationSubmit") }));
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    const move = screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement;
    assert.equal(move.disabled, true); fireEvent.click(move); assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
    await act(async () => response.resolve({ ok: false, error: { code: "service_unavailable", message: "unknown" } }));
    await screen.findAllByText(t("creationUncertain")); assert.equal(move.disabled, true);
    assert.equal((screen.getByRole("button", { name: t("creationStatus") }) as HTMLButtonElement).disabled, false);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) })); assert.ok(screen.getByRole("textbox", { name: new RegExp(`^${t("editTextValue")}:`) }));
    assert.equal(client.moves.length, 0);
  });
  test(`${language}: discovery Apply and category move prevent competing source effects in both directions`, async () => {
    const response = deferred<Awaited<ReturnType<WorkspaceServiceClient["applyDiscovery"]>>>();
    const client = new class extends Client {
      applies = 0;
      override async previewDiscovery() { return { ok: true as const, value: { mode: "grouped" as const, currentMode: "grouped" as const, projectEffects: { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] }, categoryAvailability: { current: true, target: true, propertyId: "category-label", name: "Client" }, configured: true, workspaceId: "workspace", sourceId: "source", revision: 1, canonicalRoot: "/fixture", excludedRelativePaths: [], effectiveExcludedRelativePaths: [], inactiveExcludedRelativePaths: [], entries: [], state: "empty" as const, previewToken: "preview" } }; }
      override async applyDiscovery() { this.applies++; return response.promise; }
    }();
    render(<DiscoveryWorkspace {...props(client)} />);
    await userEvent.click(await findAction("button", { name: t("discoveryAction") }));
    const apply = await findAction("button", { name: t("discoveryApply") }) as HTMLButtonElement;
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
    assert.equal(apply.disabled, true); fireEvent.click(apply); assert.equal(client.applies, 0);
    await userEvent.keyboard("{Escape}"); await waitFor(() => assert.equal(apply.disabled, false)); await userEvent.click(apply);
    await findAction("button", {name:new RegExp(`^${t("moveCategory")}:`)});
    const move = screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement;
    assert.equal(move.disabled, true); fireEvent.click(move); assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
    await act(async () => response.resolve({ ok: false, error: { code: "storage", message: "failed apply" } }));
    assert.equal(client.moves.length, 0); assert.equal(client.applies, 1);
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language}: long category labels review physical relative paths and retain the rejected selection`, async () => {
    const client = new Client();
    const name = "  日本語-проект-" + "exact-name-".repeat(24) + "  ";
    const currentLabel = "Authored category label / Категория / " + "long-label-".repeat(20);
    const destinationLabel = "Empty destination / Назначение / " + "long-label-".repeat(20);
    const originalPath = "Original-physical-" + "long-folder-".repeat(20);
    const destinationPath = "Destination-physical-" + "long-folder-".repeat(20);
    client.list = { ...client.list,
      projects: [{ ...client.list.projects[0], name, categoryName: currentLabel, relativePath: `${originalPath}/${name}` }],
      categories: [{ categoryId: "current", name: currentLabel, relativePath: originalPath }, { categoryId: "empty", name: destinationLabel, relativePath: destinationPath }],
    };
    client.handler = async () => ({ ok: true, value: { outcome: "rejected", operation: null, problem: "occupied" } });
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const trigger = await findAction("button", { name: new RegExp(`^${t("moveCategory")}:`) });
    await userEvent.click(trigger);
    const select = screen.getByRole("combobox", { name: t("moveCategoryDestination") }) as HTMLSelectElement;
    assert.equal(select.labels?.[0]?.textContent, t("moveCategoryDestination"));
    assert.deepEqual(within(select).getAllByRole("option").map((option) => option.textContent), [currentLabel, destinationLabel]);
    await userEvent.selectOptions(select, "empty");
    assert.equal(client.moves.length, 0);
    const review = within(document.querySelector(".project-category-move form") as HTMLElement);
    assert.equal(review.getByText(`${originalPath}/${name}`, { selector: "dd", normalizer: (text) => text }).textContent, `${originalPath}/${name}`);
    assert.equal(review.getByText(`${destinationPath}/${name}`, { selector: "dd", normalizer: (text) => text }).textContent, `${destinationPath}/${name}`);
    await userEvent.keyboard("{Enter}");
    await screen.findByText(t("moveCategoryCollision"));
    assert.equal(client.moves.length, 1);
    assert.equal(client.moves[0].destinationCategoryId, "empty");
    assert.equal(select.value, "empty"); assert.equal(document.activeElement === select, true);
    assert.equal(client.list.projects[0].name, name);
    assert.equal(client.list.projects[0].relativePath, `${originalPath}/${name}`);
    assert.ok(screen.getByText("  Exact Text\nТекст  ", { normalizer: (text) => text }));
    await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); assert.equal(client.moves.length, 1);
  });
}
