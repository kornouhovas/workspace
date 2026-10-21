import { contextReturnTarget } from "../src/renderer/components/ContextTools.js";
import { findAction } from "./context-tools-driver.js";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { BackendStatus } from "../src/contracts/desktop-api.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectRenameOperation, ProjectRenameResult, ProjectRenameList, ProjectRenameRecoveryPreview, ProjectRenameRecoveryAction } from "../src/contracts/project-rename.js";
import type { ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, act, fireEvent, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "ready", projects: [{ projectId: "project", name: "Original", relativePath: "Original", categoryId: null, associationState: "active", resolution: "active", categoryName: null }], retainedProjects: [], retainedCount: 0, categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
class Client extends WorkspaceServiceClient {
  // Non-filter workflow fixtures expose the new empty-filter projection without
  // calling listProjects again (some tests intentionally control that read).
  override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
  override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...this.list.projects, ...this.list.retainedProjects].map(p => p.projectId) } }; }
  override async listViews(workspaceId: string) { return { ok: true as const, value: { workspaceId, activeViewId: "view", views: [{ viewId: "view", name: "Table", kind: "table" as const }] } }; }
  statuses = new Set<(status: BackendStatus) => void>(); events = new Set<(event: WorkspaceChangeEvent) => void>();
  list = structuredClone(initial); renames: Parameters<WorkspaceServiceClient["renameProject"]>[0][] = []; statusCalls: string[][] = [];
  handler: () => Promise<ServiceResult<ProjectRenameResult>> = async () => {
    const result = this.completed();
    if (result.outcome === "completed") this.list = { ...this.list, revision: 2, projects: [{ projectId: "project", name: result.project.name, relativePath: result.project.relativePath, categoryId: result.project.categoryId, associationState: "active", resolution: "active", categoryName: null }] };
    return { ok: true, value: result };
  };
  statusHandler: () => Promise<ServiceResult<ProjectRenameResult>> = async () => ({ ok: true, value: this.completed() });
  operation(): ProjectRenameOperation {
    const input = this.renames.at(-1)!;
    return { ...input, sourceId: "source", initiatingWorkspaceId: "workspace", originalName: "Original", originalRelativePath: "Original", requestedRelativePath: input.name, mode: "direct", categoryId: null, stage: "completed", lastVerifiedPlacement: "destination", problem: null, resultKind: "completed", completedRevision: 2 };
  }
  completed(): ProjectRenameResult { const operation = this.operation(); return { outcome: "completed", operation, project: { operationId: operation.operationId, sourceId: "source", projectId: "project", name: operation.name, relativePath: operation.requestedRelativePath, categoryId: null, revision: 2 } }; }
  override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: this.list.sourceId, operations: [] } }; }
  override onBackendStatus(listener: (status: BackendStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects() { return { ok: true as const, value: this.list }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: this.list.workspaceId, sourceId: this.list.sourceId, revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "Exact text" }] } }; }
  override async listProjectCreations() { return { ok: true as const, value: { workspaceId: this.list.workspaceId, sourceId: this.list.sourceId, operations: [] } }; }
  unfinished: ProjectRenameOperation[] = [];
  renameLists: string[] = [];
  reviews: string[][] = [];
  recoveries: [string, string, string, ProjectRenameRecoveryAction][] = [];
  listRenameHandler: (() => Promise<ServiceResult<ProjectRenameList>>) | null = null;
  reviewHandler: (() => Promise<ServiceResult<ProjectRenameRecoveryPreview>>) | null = null;
  recoveryHandler: (() => Promise<ServiceResult<ProjectRenameResult>>) | null = null;
  override async listProjectRenames(workspaceId: string) {
    this.renameLists.push(workspaceId);
    return this.listRenameHandler ? this.listRenameHandler() : { ok: true as const, value: { workspaceId, sourceId: this.list.sourceId, operations: this.unfinished } };
  }
  override async previewProjectRenameRecovery(workspaceId: string, operationId: string) {
    this.reviews.push([workspaceId, operationId]);
    return this.reviewHandler ? this.reviewHandler() : { ok: true as const, value: recoveryPreview(this.unfinished[0], workspaceId) };
  }
  override async recoverProjectRename(workspaceId: string, operationId: string, token: string, action: ProjectRenameRecoveryAction) {
    this.recoveries.push([workspaceId, operationId, token, action]);
    return this.recoveryHandler ? this.recoveryHandler() : { ok: true as const, value: { outcome: "recoverable" as const, operation: this.unfinished[0] } };
  }
  override async renameProject(input: Parameters<WorkspaceServiceClient["renameProject"]>[0]) { this.renames.push(input); return this.handler(); }
  override async getProjectRename(workspace: string, operation: string) { this.statusCalls.push([workspace, operation]); return this.statusHandler(); }
}
for (const language of ["en", "ru"] as const) {
  test(`${language}: Table Name submits exact authored text and reloads committed Name`, async () => {
    const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const trigger = await findAction("button", { name: `${language === "en" ? "Rename project folder" : "Переименовать папку проекта"}: Original` });
    await userEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: t("projectName") });
    assert.equal(document.activeElement === input, true);
    await userEvent.clear(input); await userEvent.type(input, "  Текст 📝  {Enter}");
    await screen.findByText("  Текст 📝  ", { selector: "td .project-preview-trigger", normalizer: (text) => text });
    assert.equal(client.renames.length, 1);
    assert.equal(client.renames[0].name, "  Текст 📝  ");
    assert.equal(client.renames[0].workspaceId, "workspace"); assert.equal(client.renames[0].projectId, "project"); assert.equal(client.renames[0].expectedRevision, 1);
    assert.match(client.renames[0].operationId, /^[0-9a-f-]{36}$/);
    assert.ok(screen.getByText("Exact text"));
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const mount = (client: Client) => render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  const edit = async () => { const trigger = await findAction("button", { name: `${t("renameProject")}: Original` }); const returning=contextReturnTarget(trigger as HTMLButtonElement); await userEvent.click(trigger); return returning; };
  test(`${language}: Escape restores initiating focus without submitting`, async () => {
    const client = new Client(); mount(client); const trigger = await edit();
    await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Escape}");
    assert.equal(screen.queryByRole("textbox", { name: t("projectName") }), null);
    assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); assert.equal(client.renames.length, 0);
  });
  test(`${language}: pending dismissal retains operation and prevents double/replacement submission`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
    mount(client); await edit(); const input = screen.getByRole("textbox", { name: t("projectName") });
    await userEvent.clear(input); await userEvent.type(input, "Draft");
    const submit = screen.getByRole("button", { name: t("renameSubmit") });
    fireEvent.click(submit); fireEvent.click(submit); assert.equal(client.renames.length, 1);
    assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" })); assert.equal(document.activeElement, screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    assert.equal((document.activeElement as HTMLElement)?.getAttribute("aria-label"), `${t("projectActions")}: Original`);
    const trigger = await findAction("button", { name: `${t("renameProject")}: Original` }); assert.equal((trigger as HTMLButtonElement).disabled, true);
    await act(async () => response.resolve({ ok: false, error: { code: "service_unavailable", message: "Lost response" } }));
    await userEvent.click(screen.getByRole("button", { name: t("renameStatus") }));
    assert.deepEqual(client.statusCalls, [["workspace", client.renames[0].operationId]]);
    assert.equal(client.renames.length, 1); await screen.findByText(t("renameSaved"));
  });
  test(`${language}: exact current name receives unchanged result and restores focus`, async () => {
    const client = new Client(); client.handler = async () => {
      const receipt = client.completed(); if (receipt.outcome !== "completed") throw new Error();
      return { ok: true, value: { ...receipt, outcome: "unchanged", operation: { ...receipt.operation, resultKind: "unchanged", completedRevision: 1 }, project: { ...receipt.project, revision: 1 } } };
    };
    mount(client); const trigger = await edit(); await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    await screen.findByText(t("renameUnchanged")); assert.equal(client.renames[0].name, "Original");
    assert.ok([trigger, screen.getByRole("heading", { name: "Table" })].includes(document.activeElement as HTMLElement));
    assert.equal(client.list.revision, 1);
  });
  for (const [problem, key] of [["invalid_name", "renameInvalid"], ["occupied", "renameCollision"], ["stale_configuration", "renameStale"], ["source_unavailable", "renameUnavailable"], ["storage_error", "renameFailed"]] as const) {
    test(`${language}: ${problem} retains authored draft and committed Name`, async () => {
      const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "rejected", operation: null, problem } });
      mount(client); await edit(); const input = screen.getByRole("textbox", { name: t("projectName") });
      await userEvent.clear(input); await userEvent.type(input, "  Draft  {Enter}");
      await screen.findByText(t(key)); assert.equal((input as HTMLInputElement).value, "  Draft  "); assert.equal((input as HTMLInputElement).disabled, false);
      assert.equal(document.activeElement === input, true); assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" }));
      assert.equal(screen.queryByRole("button", { name: t("renameStatus") }), null); assert.equal(client.renames.length, 1);
    });
  }
  test(`${language}: uncertain transport and status errors never replay mutations`, async () => {
    const client = new Client(); client.handler = async () => { throw new Error("transport"); };
    client.statusHandler = async () => ({ ok: false, error: { code: "invalid_input", message: "Unknown operation" } });
    mount(client); await edit(); await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    await screen.findByText(t("renameUncertain"));
    await userEvent.click(screen.getByRole("button", { name: t("renameStatus") }));
    assert.equal((screen.getByRole("textbox", { name: t("projectName") }) as HTMLInputElement).disabled, true);
    assert.equal(client.renames.length, 1); assert.equal(client.statusCalls.length, 1);
    await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
    assert.equal(client.renames.length, 1); assert.equal(client.statusCalls.length, 1);
    await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
  });
  test(`${language}: recoverable receipt locks replacement mutation and keeps explicit status`, async () => {
    const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "recoverable", operation: { ...client.operation(), stage: "uncertain", resultKind: null, completedRevision: null, problem: "ownership_uncertain" } } });
    mount(client); await edit(); await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    await screen.findByText(t("renameRecoverable")); assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
    assert.equal((screen.getByRole("button", { name: t("renameSubmit") }) as HTMLButtonElement).disabled, true);
    assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" })); assert.equal(client.renames.length, 1);
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  test(`${language}: backend-generation remount preserves unknown identity for explicit status`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
    const props = { client, workspaceId: "workspace", sourceId: "source", language, disabled: false };
    const view = render(<DiscoveryWorkspace key="backend-0" {...props} />);
    await userEvent.click(await findAction("button", { name: `${t("renameProject")}: Original` }));
    await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    view.rerender(<DiscoveryWorkspace key="backend-1" {...props} />);
    await act(async () => response.resolve({ ok: true, value: client.completed() }));
    assert.equal(screen.queryByText(t("renameSaved")), null);
    await userEvent.click(await findAction("button", { name: t("renameStatus") }));
    await screen.findByText(t("renameSaved")); assert.deepEqual(client.statusCalls, [["workspace", client.renames[0].operationId]]); assert.equal(client.renames.length, 1);
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const open = async () => userEvent.click(await findAction("button", { name: `${t("renameProject")}: Original` }));
  test(`${language}: source observation invalidates an open draft until explicit reopening`, async () => {
    const client = new Client(); render(<DiscoveryWorkspace {...props(client)} />); await open();
    await act(async () => client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 3, state: "ready", automaticUpdates: "active" })));
    const submit = screen.getByRole("button", { name: t("renameSubmit") });
    assert.equal((submit as HTMLButtonElement).disabled, true); fireEvent.click(submit); assert.equal(client.renames.length, 0);
    await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") })); await open();
    assert.equal((screen.getByRole("button", { name: t("renameSubmit") }) as HTMLButtonElement).disabled, false);
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const open = async () => userEvent.click(await findAction("button", { name: `${t("renameProject")}: Original` }));
  for (const binding of ["operation", "project", "source", "workspace", "name", "revision", "original", "category", "receipt"] as const) {
    test(`${language}: mismatched ${binding} response cannot resolve the submitted operation`, async () => {
      const client = new Client(); client.handler = async () => {
        const receipt = client.completed(); if (receipt.outcome !== "completed") throw new Error();
        if (binding === "operation") receipt.operation.operationId = "other";
        if (binding === "project") receipt.operation.projectId = "other";
        if (binding === "source") receipt.operation.sourceId = "other";
        if (binding === "workspace") receipt.operation.initiatingWorkspaceId = "other";
        if (binding === "name") receipt.operation.name = "other";
        if (binding === "revision") receipt.operation.expectedRevision = 100;
        if (binding === "original") receipt.operation.originalRelativePath = "Other";
        if (binding === "category") receipt.operation.categoryId = "other";
        if (binding === "receipt") receipt.project.operationId = "other";
        return { ok: true, value: receipt };
      };
      render(<DiscoveryWorkspace {...props(client)} />); await open();
      await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
      await screen.findByText(t("renameUncertain")); assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
      assert.equal(screen.queryByText(t("renameSaved")), null); assert.equal(client.renames.length, 1);
    });
  }
  for (const change of ["own-event", "newer-sibling", "observation", "unavailable", "refresh", "unrelated"] as const) {
    test(`${language}: delayed result after ${change} reloads current placement without repainting it`, async () => {
      const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
      const view = render(<DiscoveryWorkspace {...props(client)} refreshVersion={0} />); await open();
      const input = screen.getByRole("textbox", { name: t("projectName") }); await userEvent.clear(input); await userEvent.type(input, "Requested{Enter}");
      const receipt = client.completed();
      client.list = { ...client.list, revision: change === "newer-sibling" ? 3 : 2,
        projects: [{ ...initial.projects[0], name: change === "newer-sibling" ? "Newer external" : "Requested", relativePath: change === "newer-sibling" ? "Newer external" : "Requested" }] };
      await act(async () => {
        if (change === "refresh") view.rerender(<DiscoveryWorkspace {...props(client)} refreshVersion={1} />);
        else client.events.forEach((listener) => listener(change === "observation" || change === "unavailable"
          ? { type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace", "sibling"], observationRevision: 10, state: change === "unavailable" ? "unavailable" : "ready", automaticUpdates: "active" }
          : { type: "workspace.projectsChanged", sourceId: change === "unrelated" ? "another-source" : "source", workspaceIds: ["workspace", "sibling"], revision: client.list.revision }));
      });
      if (change === "unrelated") assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" }));
      await act(async () => response.resolve({ ok: true, value: receipt }));
      const newer = ["newer-sibling", "observation", "unavailable", "refresh"].includes(change);
      await screen.findByText(t(newer ? "renameNewer" : "renameSaved"));
      assert.ok(screen.getByText(change === "newer-sibling" ? "Newer external" : "Requested", { selector: "td .project-preview-trigger" }));
      if (change === "newer-sibling") assert.equal(screen.queryByText("Requested", { selector: "td .project-preview-trigger" }), null);
      assert.equal(client.renames.length, 1);
    });
  }
  for (const change of ["backend", "selection", "unmount"] as const) {
    test(`${language}: ${change} discards delayed responses and never replays rename`, async () => {
      const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
      const view = render(<DiscoveryWorkspace key="selected" {...props(client)} />); await open();
      await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
      if (change === "backend") await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
      if (change === "selection") { client.list = { ...initial, workspaceId: "other", sourceId: "other-source", projects: [] }; view.rerender(<DiscoveryWorkspace key="other" {...props(client)} workspaceId="other" sourceId="other-source" />); }
      if (change === "unmount") view.unmount();
      await act(async () => response.resolve({ ok: true, value: client.completed() }));
      assert.equal(screen.queryByText(t("renameSaved")), null); assert.equal(client.renames.length, 1); assert.equal(client.statusCalls.length, 0);
      if (change === "backend") assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
      if (change === "unmount") { assert.equal(client.statuses.size, 0); assert.equal(client.events.size, 0); }
    });
  }
  test(`${language}: status remains accessible through a selected source sibling`, async () => {
    const client = new Client(); client.handler = async () => ({ ok: false, error: { code: "service_unavailable", message: "lost" } });
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} />); await open(); await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    await screen.findByText(t("renameUncertain"));
    client.list = { ...client.list, workspaceId: "sibling" };
    view.rerender(<DiscoveryWorkspace key="sibling" {...props(client)} workspaceId="sibling" />);
    await userEvent.click(await findAction("button", { name: t("renameStatus") }));
    await screen.findByText(t("renameSaved")); assert.deepEqual(client.statusCalls, [["sibling", client.renames[0].operationId]]); assert.equal(client.renames.length, 1);
  });
  test(`${language}: retained rows keep Text editing while Name mutation is unavailable`, async () => {
    const client = new Client(); client.list = { ...client.list, state: "unavailable", projects: [], retainedProjects: [{ ...initial.projects[0], associationState: "unresolved", resolution: "unresolved" }], retainedCount: 1 };
    render(<DiscoveryWorkspace {...props(client)} />);
    const text = await findAction("button", { name: `${t("editTextValue")}: Original / Notes` });
    assert.equal(screen.queryByRole("button", { name: `${t("renameProject")}: Original` }), null);
    assert.equal((text as HTMLButtonElement).disabled, false); await userEvent.click(text);
    assert.equal((screen.getByRole("textbox", { name: `${t("editTextValue")}: Original / Notes` }) as HTMLTextAreaElement).disabled, false);
    assert.equal(client.renames.length, 0);
  });
}
for (const language of ["en", "ru"] as const) test(`${language}: delayed success preserves focus moved into Text editing`, async () => {
  const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  client.handler = () => response.promise;
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await findAction("button", { name: `${t("renameProject")}: Original` }));
  await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
  await userEvent.click(screen.getByRole("button", { name: `${t("editTextValue")}: Original / Notes` }));
  const editor = screen.getByRole("textbox", { name: `${t("editTextValue")}: Original / Notes` });
  assert.equal(document.activeElement === editor, true);
  await act(async () => response.resolve({ ok: true, value: client.completed() }));
  await screen.findByText(t("renameSaved")); assert.equal(document.activeElement === editor, true);
});
for (const language of ["en", "ru"] as const) test(`${language}: status must bind an operation before it unlocks replacement renames`, async () => {
  const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  client.handler = async () => ({ ok: false, error: { code: "service_unavailable", message: "lost" } });
  client.statusHandler = async () => ({ ok: true, value: { outcome: "rejected", problem: "invalid_name", operation: null } });
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await findAction("button", { name: `${t("renameProject")}: Original` }));
  await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
  await userEvent.click(await findAction("button", { name: t("renameStatus") }));
  assert.equal((screen.getByRole("button", { name: t("renameSubmit") }) as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
  client.statusHandler = async () => ({ ok: true, value: client.completed() });
  await userEvent.click(screen.getByRole("button", { name: t("renameStatus") }));
  await screen.findByText(t("renameSaved")); assert.equal(client.renames.length, 1);
});

const interrupted: ProjectRenameOperation = { operationId: "interrupted", sourceId: "source", initiatingWorkspaceId: "removed-workspace", projectId: "project", originalName: "Original", name: "Requested", originalRelativePath: "Original", requestedRelativePath: "Requested", mode: "direct", categoryId: null, expectedRevision: 1, stage: "intent", lastVerifiedPlacement: "original", problem: null, resultKind: null, completedRevision: null };
function recoveryPreview(operation = interrupted, workspaceId = "workspace"): ProjectRenameRecoveryPreview {
  return { workspaceId, sourceId: "source", operation, revision: 1, originalState: "matching", stagedState: null, destinationState: "missing", problem: null, actions: ["retry_original", "keep_original"], previewToken: "fresh-token" };
}
test("unfinished rename loads source-scoped names without implicit review or mutation", async () => {
  const client = new Client(); client.unfinished = [interrupted];
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false} />);
  const review = await findAction("button", { name: "Review interrupted rename: Original → Requested" });
  assert.ok(review); assert.ok(client.renameLists.length > 0); assert.ok(client.renameLists.every((id) => id === "workspace"));
  assert.equal(client.reviews.length, 0); assert.equal(client.recoveries.length, 0); assert.equal(client.renames.length, 0);
});

test("explicit recovery review advertises fresh placements and submits only the chosen token-bound action", async () => {
  const client = new Client(); client.unfinished = [interrupted];
  client.recoveryHandler = async () => { client.unfinished = []; return { ok: true, value: { outcome: "rejected", problem: "kept_original", operation: { ...interrupted, stage: "failed", resultKind: "rejected", problem: "kept_original" } } }; };
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false} />);
  await userEvent.click(await findAction("button", { name: "Review interrupted rename: Original → Requested" }));
  await screen.findByText("Original folder"); await screen.findByText("Verified project folder");
  assert.equal(client.recoveries.length, 0); assert.equal(client.reviews.length, 1);
  assert.equal(screen.queryByRole("button", { name: "Finish staged rename" }), null);
  assert.equal(screen.queryByRole("button", { name: "Complete destination rename" }), null);
  await userEvent.click(screen.getByRole("button", { name: "Keep original folder" }));
  await screen.findByText("Original folder retained. Rename resolved.");
  assert.deepEqual(client.recoveries, [["workspace", "interrupted", "fresh-token", "keep_original"]]);
  assert.equal(client.renames.length, 0); assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" }));
});

const recoveryActions = { retry_original: "renameRetryOriginal", finish_staged: "renameFinishStaged", complete_destination: "renameCompleteDestination", keep_original: "renameKeepOriginal" } as const;
function recoveryCompleted(operation = interrupted): ProjectRenameResult {
  return { outcome: "completed", operation: { ...operation, stage: "completed", lastVerifiedPlacement: "destination", resultKind: "completed", completedRevision: 2 }, project: { operationId: operation.operationId, projectId: operation.projectId, sourceId: operation.sourceId, name: operation.name, relativePath: operation.requestedRelativePath, categoryId: operation.categoryId, revision: 2 } };
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const openReview = async () => {
    const trigger = await findAction("button", { name: `${t("renameReview")}: Original → Requested` });
    const returning=contextReturnTarget(trigger as HTMLButtonElement); await userEvent.click(trigger); return returning;
  };
  for (const mode of ["direct", "grouped"] as const) for (const action of Object.keys(recoveryActions) as ProjectRenameRecoveryAction[]) {
    test(`${language}/${mode}: explicit ${action} preserves bindings, category and Text; receipts reload committed Name`, async () => {
      const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>();
      const operation = { ...interrupted, mode, categoryId: mode === "grouped" ? "category" : null, originalRelativePath: mode === "grouped" ? "Category/Original" : "Original", requestedRelativePath: mode === "grouped" ? "Category/Requested" : "Requested", stage: action === "finish_staged" ? "staged" as const : "intent" as const };
      client.unfinished = [operation]; client.list = { ...client.list, mode, projects: [{ ...client.list.projects[0], relativePath: operation.originalRelativePath, categoryId: operation.categoryId }] };
      client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(operation), originalState: action === "finish_staged" || action === "complete_destination" ? "missing" : "matching", stagedState: action === "finish_staged" ? "matching" : null, destinationState: action === "complete_destination" ? "matching" : "missing", actions: [action] } });
      client.recoveryHandler = () => response.promise;
      render(<DiscoveryWorkspace {...props(client)} />); await openReview();
      const submit = await findAction("button", { name: t(recoveryActions[action]) });
      assert.equal(client.recoveries.length, 0); assert.equal(client.renames.length, 0);
      assert.ok(document.activeElement === screen.getByRole("heading", { name: t("renameReviewTitle") }));
      submit.focus(); fireEvent.click(submit); fireEvent.click(submit);
      assert.deepEqual(client.recoveries, [["workspace", "interrupted", "fresh-token", action]]);
      assert.ok(screen.getByText("Original", { selector: "td .project-preview-trigger" })); assert.ok(screen.getByText("Exact text"));
      assert.ok(document.activeElement === screen.getByRole("button", { name: t("renameReviewClose") }));
      const retained = action === "keep_original";
      client.unfinished = []; client.list = { ...client.list, revision: retained ? 1 : 2, projects: [{ ...client.list.projects[0], name: retained ? "Original" : "Requested", relativePath: retained ? operation.originalRelativePath : operation.requestedRelativePath }] };
      await act(async () => response.resolve({ ok: true, value: retained ? { outcome: "rejected", problem: "kept_original", operation: { ...operation, stage: "failed", resultKind: "rejected", problem: "kept_original", lastVerifiedPlacement: "original" } } : recoveryCompleted(operation) }));
      await screen.findByText(t(retained ? "renameKeptOriginal" : "renameSaved"));
      await screen.findByText(retained ? "Original" : "Requested", { selector: "td .project-preview-trigger" });
      assert.ok(screen.getByText("Exact text")); assert.equal(client.statusCalls.length, 0); assert.equal(client.reviews.length, 1); assert.equal(client.renames.length, 0);
      assert.equal(screen.queryByRole("heading", { name: t("renameReviewTitle") }), null);
      assert.ok(document.activeElement === screen.getByRole("button", { name: t("sourceTools") }));
    });
  }
  for (const state of ["missing", "replaced", "link", "unavailable", "conflicting"] as const) test(`${language}: ${state} evidence advertises no action and cannot adopt a folder`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(), originalState: state, stagedState: state, destinationState: state, actions: [], previewToken: null, problem: "ownership_uncertain" } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await screen.findByText(t("renameRecoveryBlocked"));
    for (const key of Object.values(recoveryActions)) assert.equal(screen.queryByRole("button", { name: t(key) }), null);
    assert.equal(screen.queryByRole("radio"), null); assert.equal(screen.queryByRole("textbox"), null);
    assert.equal(client.recoveries.length, 0); assert.equal(client.renames.length, 0);
  });
  test(`${language}: Escape cancels delayed review and restores initiating focus`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameRecoveryPreview>>(); client.unfinished = [interrupted]; client.reviewHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); const trigger = await openReview(); await screen.findByText(t("renameReviewLoading"));
    await userEvent.keyboard("{Escape}"); assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true);
    await act(async () => response.resolve({ ok: true, value: recoveryPreview() }));
    assert.equal(screen.queryByRole("heading", { name: t("renameReviewTitle") }), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: recovery transport uncertainty and pending dismissal use the same status after list failure and remount`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.unfinished = [interrupted]; client.recoveryHandler = () => response.promise;
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") }));
    await userEvent.click(screen.getByRole("button", { name: t("renameReviewClose") }));
    await act(async () => response.resolve({ ok: false, error: { code: "service_unavailable", message: "lost" } }));
    client.listRenameHandler = async () => ({ ok: false, error: { code: "storage", message: "list failed" } });
    view.rerender(<DiscoveryWorkspace key="restarted" {...props(client)} />);
    await screen.findByText(t("renameListError"));
    client.statusHandler = async () => { client.unfinished = []; return { ok: true, value: { outcome: "rejected", problem: "kept_original", operation: { ...interrupted, stage: "failed", resultKind: "rejected", problem: "kept_original" } } }; };
    await userEvent.click(screen.getByRole("button", { name: t("renameStatus") })); await screen.findByText(t("renameKeptOriginal"));
    assert.deepEqual(client.statusCalls, [["workspace", "interrupted"]]); assert.equal(client.recoveries.length, 1); assert.equal(client.renames.length, 0);
    await waitFor(() => assert.ok(document.activeElement === screen.getByRole("heading", { name: "Table" }), "Status resolution restores Table focus"));
  });
  test(`${language}: a stale recovery token requires explicit status and fresh review; no mutation retry`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.recoveryHandler = async () => ({ ok: false, error: { code: "stale_preview", message: "stale" } });
    client.statusHandler = async () => ({ ok: true, value: { outcome: "recoverable", operation: interrupted } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") }));
    await screen.findByText(t("renameUncertain")); assert.equal(screen.queryByRole("button", { name: t("renameRetryOriginal") }), null);
    await userEvent.click(screen.getByRole("button", { name: t("renameStatus") })); await screen.findByText(t("renameRecoverable"));
    assert.equal(client.recoveries.length, 1); assert.equal(client.reviews.length, 1);
    await userEvent.click(screen.getByRole("button", { name: t("renameReviewAgain") })); await findAction("button", { name: t("renameRetryOriginal") });
    assert.equal(client.reviews.length, 2); assert.equal(client.recoveries.length, 1);
  });
  for (const change of ["revision", "observation", "unavailable", "refresh", "backend", "reload", "selection"] as const) test(`${language}: ${change} invalidates review without implicit replay`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    const view = render(<DiscoveryWorkspace key="first" {...props(client)} refreshVersion={0} />); await openReview(); await findAction("button", { name: t("renameRetryOriginal") });
    await act(async () => {
      if (change === "revision") client.events.forEach((listener) => listener({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace", "sibling"], revision: 2 }));
      if (change === "observation" || change === "unavailable") client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, automaticUpdates: "active", state: change === "unavailable" ? "unavailable" : "ready" }));
      if (change === "refresh") view.rerender(<DiscoveryWorkspace key="first" {...props(client)} refreshVersion={1} />);
      if (change === "backend") { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); }
      if (change === "selection") { client.list = { ...initial, workspaceId: "other", sourceId: "other-source", projects: [] }; client.unfinished = []; view.rerender(<DiscoveryWorkspace key="other" {...props(client)} workspaceId="other" sourceId="other-source" />); }
    });
    if (change === "reload") await userEvent.click(await findAction("button", { name: t("renameListReload") }));
    assert.equal(screen.queryByRole("button", { name: t("renameRetryOriginal") }), null); assert.equal(client.recoveries.length, 0); assert.equal(client.reviews.length, 1); assert.equal(client.renames.length, 0);
    if (change !== "selection") await screen.findByText(t("renameReviewStale"));
  });
  for (const field of ["workspaceId", "sourceId", "operationId", "projectId", "initiatingWorkspaceId", "name", "originalName", "originalRelativePath", "requestedRelativePath", "expectedRevision", "categoryId", "mode", "stage", "lastVerifiedPlacement", "problem", "revision"] as const) test(`${language}: recovery preview rejects wrong ${field} binding`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.reviewHandler = async () => {
      const value = structuredClone(recoveryPreview());
      if (field === "workspaceId" || field === "sourceId") value[field] = "foreign";
      else if (field === "revision") value.revision = 0;
      else Object.assign(value.operation, { [field]: field === "expectedRevision" ? 0 : field === "categoryId" ? "foreign" : field === "mode" ? "grouped" : field === "stage" ? "staged" : field === "lastVerifiedPlacement" ? "destination" : field === "problem" ? "storage_error" : "foreign" });
      return { ok: true, value };
    };
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await screen.findByText(t("renameReviewError"));
    assert.equal(screen.queryByRole("button", { name: t("renameRetryOriginal") }), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: older unfinished list cannot revive an operation resolved through explicit status`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameList>>(); client.unfinished = [interrupted];
    client.recoveryHandler = async () => ({ ok: false, error: { code: "service_unavailable", message: "lost" } });
    client.statusHandler = async () => { client.unfinished = []; client.listRenameHandler = null; return { ok: true, value: recoveryCompleted() }; };
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") })); await screen.findByText(t("renameUncertain"));
    client.listRenameHandler = () => response.promise; await userEvent.click(await findAction("button", { name: t("renameListReload") }));
    await userEvent.click(screen.getByRole("button", { name: t("renameStatus") })); await screen.findByText(t("renameSaved"));
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", sourceId: "source", operations: [interrupted] } }));
    assert.equal(screen.queryByRole("button", { name: `${t("renameReview")}: Original → Requested` }), null); assert.equal(client.recoveries.length, 1); assert.equal(client.renames.length, 0);
  });
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const openReview = async (original = "Original", requested = "Requested") => { const trigger = await findAction("button", { name: `${t("renameReview")}: ${original} → ${requested}` }); const returning=contextReturnTarget(trigger as HTMLButtonElement); await userEvent.click(trigger); return returning; };
  test(`${language}: loading, empty, list errors and retry never trigger review or mutation`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameList>>(); client.listRenameHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); await screen.findByText(t("renameListLoading"));
    await act(async () => response.resolve({ ok: false, error: { code: "storage", message: "Private DB/path error" } }));
    await screen.findByText(t("renameListError")); assert.equal(screen.queryByText("Private DB/path error"), null); assert.equal(screen.queryByText(t("renameListEmpty")), null);
    client.listRenameHandler = null;
    await userEvent.click(await findAction("button", { name: t("renameListReload") })); await screen.findByText(t("renameListEmpty"));
    assert.equal(client.reviews.length, 0); assert.equal(client.recoveries.length, 0);
  });
  for (const field of ["workspace", "source", "operation-source", "duplicate", "terminal"] as const) test(`${language}: rejects ${field} unfinished list bindings`, async () => {
    const client = new Client(); client.listRenameHandler = async () => ({ ok: true, value: { workspaceId: field === "workspace" ? "foreign" : "workspace", sourceId: field === "source" ? "foreign" : "source", operations: field === "duplicate" ? [interrupted, interrupted] : [{ ...interrupted, sourceId: field === "operation-source" ? "foreign" : "source", stage: field === "terminal" ? "completed" : "intent" }] } });
    render(<DiscoveryWorkspace {...props(client)} />); await screen.findByText(t("renameListError"));
    assert.equal(screen.queryByRole("button", { name: `${t("renameReview")}: Original → Requested` }), null); assert.equal(client.reviews.length, 0);
  });
  test(`${language}: recovery rejects mismatched terminal project and keeps same-operation status access`, async () => {
    const client = new Client(); client.unfinished = [interrupted];
    client.recoveryHandler = async () => ({ ok: true, value: recoveryCompleted({ ...interrupted, projectId: "foreign" }) });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") })); await screen.findByText(t("renameUncertain"));
    assert.ok(screen.getByRole("button", { name: t("renameStatus") })); assert.equal(screen.queryByText(t("renameSaved")), null); assert.equal(client.recoveries.length, 1);
  });
  test(`${language}: pending review cannot accept null-operation recovery rejection as resolution`, async () => {
    const client = new Client(); client.unfinished = [interrupted]; client.recoveryHandler = async () => ({ ok: true, value: { outcome: "rejected", operation: null, problem: "storage_error" } });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") })); await screen.findByText(t("renameUncertain"));
    assert.ok(screen.getByRole("button", { name: t("renameStatus") })); assert.equal(client.recoveries.length, 1);
  });
  test(`${language}: same operation cannot switch project identity in a later list`, async () => {
    const client = new Client(); client.unfinished = [interrupted]; render(<DiscoveryWorkspace {...props(client)} />); await openReview();
    await findAction("button", { name: t("renameRetryOriginal") });
    client.unfinished = [{ ...interrupted, projectId: "foreign" }];
    await userEvent.click(await findAction("button", { name: t("renameListReload") })); await screen.findByText(t("renameListError"));
    assert.equal(screen.queryByRole("button", { name: t("renameRetryOriginal") }), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: changing selected operation discards an older delayed review`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameRecoveryPreview>>();
    const other = { ...interrupted, operationId: "other-operation", projectId: "other-project", originalName: "Other", name: "Other requested", originalRelativePath: "Other", requestedRelativePath: "Other requested" };
    client.unfinished = [interrupted, other]; client.reviewHandler = () => client.reviews.length === 1 ? response.promise : Promise.resolve({ ok: true, value: recoveryPreview(other) });
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await openReview("Other", "Other requested"); await findAction("button", { name: t("renameRetryOriginal") });
    await act(async () => response.resolve({ ok: true, value: { ...recoveryPreview(), actions: ["complete_destination"] } }));
    const panel = screen.getByRole("heading", { name: t("renameReviewTitle") }).parentElement!;
    assert.equal(within(panel).queryByText("Original"), null); assert.ok(within(panel).getByText("Other"));
    assert.equal(screen.queryByRole("button", { name: t("renameCompleteDestination") }), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: reconnect reloads a changed operation without preview replay`, async () => {
    const client = new Client(); client.unfinished = [interrupted]; render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await findAction("button", { name: t("renameRetryOriginal") });
    const lists = client.renameLists.length; client.unfinished = [{ ...interrupted, stage: "staged", lastVerifiedPlacement: "staged" }];
    await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
    await waitFor(() => assert.ok(client.renameLists.length > lists)); assert.equal(client.reviews.length, 1); assert.equal(client.recoveries.length, 0);
    client.reviewHandler = async () => ({ ok: true, value: { ...recoveryPreview(client.unfinished[0]), originalState: "missing", stagedState: "matching", actions: ["finish_staged"] } });
    await userEvent.click(screen.getByRole("button", { name: t("renameReviewAgain") })); await findAction("button", { name: t("renameFinishStaged") }); assert.equal(client.reviews.length, 2);
  });
  test(`${language}: source sibling authorizes explicit recovery even when initiating workspace is gone`, async () => {
    const client = new Client(); client.list = { ...client.list, workspaceId: "sibling" }; client.unfinished = [interrupted];
    client.reviewHandler = async () => ({ ok: true, value: recoveryPreview(interrupted, "sibling") });
    client.recoveryHandler = async () => { client.unfinished = []; return { ok: true, value: recoveryCompleted() }; };
    render(<DiscoveryWorkspace {...props(client)} workspaceId="sibling" />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") })); await screen.findByText(t("renameSaved"));
    assert.deepEqual(client.recoveries, [["sibling", "interrupted", "fresh-token", "retry_original"]]); assert.equal(client.renames.length, 0);
  });
  test(`${language}: delayed recovery success preserves external Text focus and reloads newer sibling placement`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.unfinished = [interrupted]; client.recoveryHandler = () => response.promise;
    render(<DiscoveryWorkspace {...props(client)} />); await openReview(); await userEvent.click(await findAction("button", { name: t("renameRetryOriginal") }));
    await userEvent.click(screen.getByRole("button", { name: `${t("editTextValue")}: Original / Notes` })); const text = screen.getByRole("textbox", { name: `${t("editTextValue")}: Original / Notes` });
    client.unfinished = []; client.list = { ...client.list, revision: 3, projects: [{ ...initial.projects[0], name: "Newer external", relativePath: "Newer external" }] };
    await act(async () => client.events.forEach((listener) => listener({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace", "sibling"], revision: 3 })));
    await act(async () => response.resolve({ ok: true, value: recoveryCompleted() })); await screen.findByText(t("renameNewer"));
    await screen.findByText("Newer external", { selector: "td .project-preview-trigger" }); assert.ok(document.activeElement === text); assert.equal(client.recoveries.length, 1); assert.equal(client.reviews.length, 1);
  });
  for (const change of ["observation", "refresh", "backend", "unmount"] as const) test(`${language}: ${change} rejects delayed preview without recovery`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameRecoveryPreview>>(); client.unfinished = [interrupted]; client.reviewHandler = () => response.promise;
    const view = render(<DiscoveryWorkspace {...props(client)} refreshVersion={0} />); await openReview();
    await act(async () => {
      if (change === "observation") client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1, automaticUpdates: "active", state: "ready" }));
      if (change === "refresh") view.rerender(<DiscoveryWorkspace {...props(client)} refreshVersion={1} />);
      if (change === "backend") { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); }
      if (change === "unmount") view.unmount();
    });
    await act(async () => response.resolve({ ok: true, value: recoveryPreview() })); assert.equal(screen.queryByRole("button", { name: t("renameRetryOriginal") }), null); assert.equal(client.recoveries.length, 0); assert.equal(client.reviews.length, 1);
    if (change === "unmount") { assert.equal(client.events.size, 0); assert.equal(client.statuses.size, 0); }
  });
}

test("uncertain journal entries identify interrupted work without claiming a current placement", async () => {
  const client = new Client(); client.unfinished = [{ ...interrupted, stage: "uncertain", problem: "ownership_uncertain", lastVerifiedPlacement: "staged" }];
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false} />);
  await screen.findByText("Folder placement is uncertain. Explicit recovery review is required.");
  assert.equal(screen.queryByText("Verified project folder"), null); assert.equal(client.reviews.length, 0); assert.equal(client.recoveries.length, 0);
});

for (const language of ["en", "ru"] as const) test(`${language}: stale recovery actions restore keyboard focus after project reload`, async () => {
  const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  client.unfinished = [interrupted];
  const view = render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} refreshVersion={0} />);
  await userEvent.click(await findAction("button", { name: `${t("renameReview")}: Original → Requested` }));
  const action = await findAction("button", { name: t("renameRetryOriginal") }); action.focus();
  view.rerender(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} refreshVersion={1} />);
  await screen.findByText(t("renameReviewStale"));
  const again = screen.getByRole("button", { name: t("renameReviewAgain") }); await waitFor(() => assert.equal((again as HTMLButtonElement).disabled, false));
  assert.ok(document.activeElement === again); assert.equal(client.reviews.length, 1); assert.equal(client.recoveries.length, 0);
});

test("rename recovery review blocks competing folder reassociation while retaining Text editing", async () => {
  const client = new Client(); client.unfinished = [interrupted];
  client.list = { ...client.list, projects: [], retainedProjects: [{ ...initial.projects[0], associationState: "unresolved", resolution: "unresolved" }], retainedCount: 1 };
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language="en" disabled={false} />);
  const locate = await findAction("button", { name: `${translate("en", "recoveryLocate")}: Original` });
  assert.equal((locate as HTMLButtonElement).disabled, false);
  await userEvent.click(await findAction("button", { name: "Review interrupted rename: Original → Requested" })); await findAction("button", { name: "Keep original folder" });
  assert.equal((locate as HTMLButtonElement).disabled, true);
  const text = screen.getByRole("button", { name: `${translate("en", "editTextValue")}: Original / Notes` }); assert.equal((text as HTMLButtonElement).disabled, false);
  await userEvent.click(screen.getByRole("button", { name: "Close recovery review" })); assert.equal((locate as HTMLButtonElement).disabled, false);
});

for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) {
  test(`${language}/${mode}: long authored Table Name supports Space, Tab and keyboard cancellation with real focus restoration`, async () => {
    const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const original = "  Original-日本語-" + "long-name-".repeat(20) + "  ";
    client.list = { ...client.list, mode, projects: [{ ...initial.projects[0], name: original,
      relativePath: mode === "grouped" ? `Category/${original}` : original, categoryId: mode === "grouped" ? "category" : null, categoryName: mode === "grouped" ? "Category" : null }],
      categories: mode === "grouped" ? [{ categoryId: "category", name: "Category", relativePath: "Category" }] : [],
      categoryProperty: mode === "grouped" ? { propertyId: "category-property", sourceId: "source", name: "Category" } : null };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const trigger = await findAction("button", { name: new RegExp(`^${t("renameProject")}:`) });
    assert.equal(trigger.getAttribute("aria-label"), `${t("renameProject")}: ${original}`);
    trigger.focus(); await userEvent.keyboard(" ");
    const input = screen.getByRole("textbox", { name: t("projectName") });
    assert.equal(document.activeElement === input, true); assert.equal((input as HTMLInputElement).labels?.length, 1);
    assert.equal((input as HTMLInputElement).value, original);
    fireEvent.change(input, { target: { value: "  Requested-новое-" + "unbroken-name-".repeat(20) + "  " } });
    await userEvent.tab(); assert.equal(document.activeElement, screen.getByRole("button", { name: t("renameSubmit") }));
    await userEvent.tab(); assert.equal(document.activeElement, screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    await userEvent.keyboard("{Enter}");
    assert.equal(screen.queryByRole("textbox", { name: t("projectName") }), null);
    assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); assert.equal(client.renames.length, 0);
    assert.equal(screen.getByText(original, { selector: "td .project-preview-trigger", normalizer: (text) => text }).textContent, original);
    assert.ok(screen.getByText("Exact text"));
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await findAction("button", {name:new RegExp(`^${t("renameProject")}:`)}));
    assert.equal((screen.getByRole("textbox", { name: t("projectName") }) as HTMLInputElement).value, original);
    await userEvent.keyboard("{Escape}"); assert.equal(document.activeElement === contextReturnTarget(trigger as HTMLButtonElement), true); assert.equal(client.renames.length, 0);
  });
}
