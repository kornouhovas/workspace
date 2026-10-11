import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { BackendStatus } from "../src/contracts/desktop-api.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectRenameOperation, ProjectRenameResult } from "../src/contracts/project-rename.js";
import type { ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, act, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "ready", projects: [{ projectId: "project", name: "Original", relativePath: "Original", categoryId: null, associationState: "active", resolution: "active", categoryName: null }], retainedProjects: [], retainedCount: 0, categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
class Client extends WorkspaceServiceClient {
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
  override onBackendStatus(listener: (status: BackendStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects() { return { ok: true as const, value: this.list }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: this.list.workspaceId, sourceId: this.list.sourceId, revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "Exact text" }] } }; }
  override async listProjectCreations() { return { ok: true as const, value: { workspaceId: this.list.workspaceId, sourceId: this.list.sourceId, operations: [] } }; }
  override async renameProject(input: Parameters<WorkspaceServiceClient["renameProject"]>[0]) { this.renames.push(input); return this.handler(); }
  override async getProjectRename(workspace: string, operation: string) { this.statusCalls.push([workspace, operation]); return this.statusHandler(); }
}
for (const language of ["en", "ru"] as const) {
  test(`${language}: Table Name submits exact authored text and reloads committed Name`, async () => {
    const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const trigger = await screen.findByRole("button", { name: `${language === "en" ? "Rename project folder" : "Переименовать папку проекта"}: Original` });
    await userEvent.click(trigger);
    const input = screen.getByRole("textbox", { name: t("projectName") });
    assert.equal(document.activeElement, input);
    await userEvent.clear(input); await userEvent.type(input, "  Текст 📝  {Enter}");
    await screen.findByText("  Текст 📝  ", { selector: "td span", normalizer: (text) => text });
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
  const edit = async () => { const trigger = await screen.findByRole("button", { name: `${t("renameProject")}: Original` }); await userEvent.click(trigger); return trigger; };
  test(`${language}: Escape restores initiating focus without submitting`, async () => {
    const client = new Client(); mount(client); const trigger = await edit();
    await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Escape}");
    assert.equal(screen.queryByRole("textbox", { name: t("projectName") }), null);
    assert.equal(document.activeElement, trigger); assert.equal(client.renames.length, 0);
  });
  test(`${language}: pending dismissal retains operation and prevents double/replacement submission`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
    mount(client); await edit(); const input = screen.getByRole("textbox", { name: t("projectName") });
    await userEvent.clear(input); await userEvent.type(input, "Draft");
    const submit = screen.getByRole("button", { name: t("renameSubmit") });
    fireEvent.click(submit); fireEvent.click(submit); assert.equal(client.renames.length, 1);
    assert.ok(screen.getByText("Original", { selector: "td span" })); assert.equal(document.activeElement, screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    await userEvent.click(screen.getByRole("button", { name: t("cancelRenameWorkspace") }));
    assert.equal(document.activeElement, screen.getByRole("heading", { name: t("tableViewTitle") }));
    const trigger = screen.getByRole("button", { name: `${t("renameProject")}: Original` }); assert.equal((trigger as HTMLButtonElement).disabled, true);
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
    assert.ok([trigger, screen.getByRole("heading", { name: t("tableViewTitle") })].includes(document.activeElement as HTMLElement));
    assert.equal(client.list.revision, 1);
  });
  for (const [problem, key] of [["invalid_name", "renameInvalid"], ["occupied", "renameCollision"], ["stale_configuration", "renameStale"], ["source_unavailable", "renameUnavailable"], ["storage_error", "renameFailed"]] as const) {
    test(`${language}: ${problem} retains authored draft and committed Name`, async () => {
      const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "rejected", operation: null, problem } });
      mount(client); await edit(); const input = screen.getByRole("textbox", { name: t("projectName") });
      await userEvent.clear(input); await userEvent.type(input, "  Draft  {Enter}");
      await screen.findByText(t(key)); assert.equal((input as HTMLInputElement).value, "  Draft  "); assert.equal((input as HTMLInputElement).disabled, false);
      assert.equal(document.activeElement, input); assert.ok(screen.getByText("Original", { selector: "td span" }));
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
    assert.ok(screen.getByText("Original", { selector: "td span" })); assert.equal(client.renames.length, 1);
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  test(`${language}: backend-generation remount preserves unknown identity for explicit status`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRenameResult>>(); client.handler = () => response.promise;
    const props = { client, workspaceId: "workspace", sourceId: "source", language, disabled: false };
    const view = render(<DiscoveryWorkspace key="backend-0" {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
    await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
    view.rerender(<DiscoveryWorkspace key="backend-1" {...props} />);
    await act(async () => response.resolve({ ok: true, value: client.completed() }));
    assert.equal(screen.queryByText(t("renameSaved")), null);
    await userEvent.click(await screen.findByRole("button", { name: t("renameStatus") }));
    await screen.findByText(t("renameSaved")); assert.deepEqual(client.statusCalls, [["workspace", client.renames[0].operationId]]); assert.equal(client.renames.length, 1);
  });
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, disabled: false });
  const open = async () => userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
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
  const open = async () => userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
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
      if (change === "unrelated") assert.ok(screen.getByText("Original", { selector: "td span" }));
      await act(async () => response.resolve({ ok: true, value: receipt }));
      const newer = ["newer-sibling", "observation", "unavailable", "refresh"].includes(change);
      await screen.findByText(t(newer ? "renameNewer" : "renameSaved"));
      assert.ok(screen.getByText(change === "newer-sibling" ? "Newer external" : "Requested", { selector: "td span" }));
      if (change === "newer-sibling") assert.equal(screen.queryByText("Requested", { selector: "td span" }), null);
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
    await userEvent.click(await screen.findByRole("button", { name: t("renameStatus") }));
    await screen.findByText(t("renameSaved")); assert.deepEqual(client.statusCalls, [["sibling", client.renames[0].operationId]]); assert.equal(client.renames.length, 1);
  });
  test(`${language}: retained rows keep Text editing while Name mutation is unavailable`, async () => {
    const client = new Client(); client.list = { ...client.list, state: "unavailable", projects: [], retainedProjects: [{ ...initial.projects[0], associationState: "unresolved", resolution: "unresolved" }], retainedCount: 1 };
    render(<DiscoveryWorkspace {...props(client)} />);
    const text = await screen.findByRole("button", { name: `${t("editTextValue")}: Original / Notes` });
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
  await userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
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
  await userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
  await userEvent.type(screen.getByRole("textbox", { name: t("projectName") }), "{Enter}");
  await userEvent.click(await screen.findByRole("button", { name: t("renameStatus") }));
  assert.equal((screen.getByRole("button", { name: t("renameSubmit") }) as HTMLButtonElement).disabled, true);
  assert.ok(screen.getByRole("button", { name: t("renameStatus") }));
  client.statusHandler = async () => ({ ok: true, value: client.completed() });
  await userEvent.click(screen.getByRole("button", { name: t("renameStatus") }));
  await screen.findByText(t("renameSaved")); assert.equal(client.renames.length, 1);
});
