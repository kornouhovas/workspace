import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { ProjectCreationPanel } from "../src/renderer/components/ProjectCreationPanel.js";
import { ProjectRevealButton } from "../src/renderer/components/ProjectRevealButton.js";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { BackendStatus } from "../src/contracts/desktop-api.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectCreationOperation, ProjectCreationResult, ProjectCreationRecoveryPreview, WorkspaceCreateProjectCommand } from "../src/contracts/project-creation.js";
import type { ProjectRevealResult } from "../src/contracts/project-reveal.js";
import type { ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, act, fireEvent } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "empty", projects: [], retainedProjects: [], retainedCount: 0, categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
const operation: ProjectCreationOperation = { operationId: "operation", sourceId: "source", initiatingWorkspaceId: "workspace", projectId: "project", name: "Authored folder", relativePath: "Authored folder", mode: "direct", categoryId: null, expectedRevision: 1, stage: "uncertain", evidenceRecorded: false, problem: "ownership_uncertain", completedRevision: null };
function completed(op = operation): ProjectCreationResult { return { outcome: "completed", operation: { ...op, stage: "completed", completedRevision: 2 }, project: { operationId: op.operationId, sourceId: op.sourceId, projectId: op.projectId, name: op.name, relativePath: op.relativePath, categoryId: op.categoryId, revision: 2 } }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
class Client extends WorkspaceServiceClient {
  statuses = new Set<(status: BackendStatus) => void>(); events = new Set<(event: WorkspaceChangeEvent) => void>();
  list = initial; operations: ProjectCreationOperation[] = []; creates: Omit<WorkspaceCreateProjectCommand, "type">[] = []; recoveries: string[][] = []; statusesRequested: string[] = []; reveals = 0;
  handler: () => Promise<ServiceResult<ProjectCreationResult>> = async () => ({ ok: true, value: completed({ ...operation, ...this.creates.at(-1)! }) });
  listHandler: (() => Promise<ServiceResult<{ workspaceId: string; sourceId: string; operations: ProjectCreationOperation[] }>>) | null = null;
  preview = { workspaceId: "workspace", sourceId: "source", operation, revision: 1, destinationState: "unverified", problem: "ownership_uncertain", actions: ["associate_reviewed"], previewToken: "token" } as ProjectCreationRecoveryPreview;
  reviewHandler: (() => Promise<ServiceResult<ProjectCreationRecoveryPreview>>) | null = null;
  revealHandler: () => Promise<ServiceResult<ProjectRevealResult>> = async () => ({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } });
  override onBackendStatus(listener: (status: BackendStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects() { return { ok: true as const, value: this.list }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "Exact text" }] } }; }
  override async listProjectCreations() { return this.listHandler ? this.listHandler() : { ok: true as const, value: { workspaceId: this.list.workspaceId, sourceId: this.list.sourceId, operations: this.operations } }; }
  override async createProject(input: Parameters<WorkspaceServiceClient["createProject"]>[0]) { this.creates.push(input); return this.handler(); }
  override async getProjectCreation(_workspace: string, id: string) { this.statusesRequested.push(id); return { ok: true as const, value: { outcome: "recoverable" as const, operation: { ...operation, operationId: id } } }; }
  override async previewProjectCreationRecovery() { return this.reviewHandler ? this.reviewHandler() : { ok: true as const, value: this.preview }; }
  override async recoverProjectCreation(workspace: string, id: string, token: string, action: string) { this.recoveries.push([workspace, id, token, action]); return { ok: true as const, value: completed() }; }
  override async revealProject() { this.reveals++; return this.revealHandler(); }
}
for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  function panel(client = new Client(), extra: Partial<React.ComponentProps<typeof ProjectCreationPanel>> = {}) {
    const props = { client, workspaceId: "workspace", sourceId: "source", projects: client.list, language, disabled: false, invalidation: 0, minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {}, ...extra };
    return { client, props, ...render(<ProjectCreationPanel {...props} />) };
  }
  for (const mode of ["direct", "grouped"] as const) test(`${language}: ${mode} keyboard creation preserves authored text and restores focus`, async () => {
    const client = new Client(); client.list = { ...initial, mode, categories: mode === "grouped" ? [{ categoryId: "category", name: "Existing", relativePath: "Existing" }] : [] };
    let reloads = 0; panel(client, { onCompleted: () => { reloads++; } });
    const trigger = screen.getByRole("button", { name: t("createProject") }); trigger.focus(); await userEvent.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: t("creationName") }); assert.equal(document.activeElement, input);
    await userEvent.type(input, "  New folder  ");
    if (mode === "grouped") { assert.equal((screen.getByRole("button", { name: t("creationSubmit") }) as HTMLButtonElement).disabled, true); await userEvent.selectOptions(screen.getByRole("combobox"), "category"); }
    input.focus(); await userEvent.keyboard("{Enter}"); await screen.findByText(t("creationSaved"));
    assert.equal(client.creates.length, 1); assert.equal(client.creates[0].name, "  New folder  "); assert.equal(client.creates[0].mode, mode);
    assert.match(client.creates[0].operationId, /^[a-f0-9-]{36}$/); assert.equal(client.creates[0].expectedRevision, 1);
    assert.equal("categoryId" in client.creates[0], mode === "grouped"); assert.equal(reloads, 1); assert.equal(document.activeElement, trigger);
  });
  test(`${language}: empty/unconfigured/no-category/unavailable guidance`, async () => {
    for (const [list, key] of [[{ ...initial, configured: false, mode: null }, "creationUnconfigured"], [{ ...initial, mode: "grouped" }, "creationNoCategory"], [{ ...initial, state: "unavailable" }, "creationUnavailable"]] as const) {
      panel(new Client(), { projects: list }); assert.ok(screen.getByText(t(key))); assert.equal((screen.getByRole("button", { name: t("createProject") }) as HTMLButtonElement).disabled, true); cleanup();
    }
    panel(); assert.ok(screen.getByText(t("creationEmpty")));
  });
  test(`${language}: Escape retains draft, double submission is blocked and pending cancel never implies rollback`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise;
    panel(client); const trigger = screen.getByRole("button", { name: t("createProject") }); await userEvent.click(trigger);
    await userEvent.type(screen.getByRole("textbox"), "Authored folder{Escape}"); assert.equal(document.activeElement, trigger); assert.equal(client.creates.length, 0);
    await userEvent.click(trigger); const input = screen.getByRole("textbox") as HTMLInputElement; assert.equal(input.value, "Authored folder");
    fireEvent.submit(input.closest("form")!); fireEvent.submit(input.closest("form")!); assert.equal(client.creates.length, 1);
    assert.ok(screen.getByText(t("creationCancelHint"))); await userEvent.keyboard("{Escape}"); assert.equal(screen.queryByRole("textbox"), null);
    await act(async () => response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) }));
    assert.ok(screen.getByText(t("creationSaved"))); assert.equal(document.activeElement, trigger);
  });
  test(`${language}: unknown response keeps operation ID and requires explicit status/review/acceptance`, async () => {
    const client = new Client(); client.handler = async () => { throw new Error("lost response"); }; const { unmount } = panel(client);
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    const status = await screen.findByRole("button", { name: t("creationStatus") }); assert.equal(client.creates.length, 1);
    assert.equal((screen.getByRole("button", { name: t("creationSubmit") }) as HTMLButtonElement).disabled, true);
    await userEvent.click(status); assert.deepEqual(client.statusesRequested, [client.creates[0].operationId]);
    client.preview = { ...client.preview, operation: { ...operation, operationId: client.creates[0].operationId } };
    await userEvent.click(screen.getByRole("button", { name: t("creationReview") })); await screen.findByText(t("creationOwnershipWarning"));
    assert.equal(client.recoveries.length, 0); assert.equal(client.creates.length, 1);
    await userEvent.click(screen.getByRole("button", { name: t("creationAssociateReviewed") }));
    // This fixture deliberately responds with the wrong operation: do not claim success.
    await screen.findByText(t("creationUncertain")); assert.equal(screen.queryByText(t("creationSaved")), null);
    unmount(); assert.equal(client.statuses.size, 0);
  });
  for (const action of ["retry_missing", "complete_recorded", "associate_reviewed"] as const) test(`${language}: reopened operation explicitly recovers with ${action}`, async () => {
    const client = new Client(); client.operations = [operation]; client.preview = { ...client.preview, actions: [action] }; panel(client);
    await userEvent.click(await screen.findByRole("button", { name: t("creationReview") }));
    const key = ({ retry_missing: "creationRetryMissing", complete_recorded: "creationCompleteRecorded", associate_reviewed: "creationAssociateReviewed" } as const)[action];
    await userEvent.click(await screen.findByRole("button", { name: t(key) })); await screen.findByText(t("creationSaved"));
    assert.deepEqual(client.recoveries, [["workspace", "operation", "token", action]]); assert.equal(client.creates.length, 0);
  });
  test(`${language}: source/revision/observation invalidation rejects delayed recovery and stale confirmation`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationRecoveryPreview>>(); client.operations = [operation]; client.reviewHandler = () => response.promise;
    const view = panel(client); await userEvent.click(await screen.findByRole("button", { name: t("creationReview") }));
    view.props.observationVersion.current++;
    await act(async () => response.resolve({ ok: true, value: client.preview })); await screen.findByText(t("creationReviewChanged"));
    assert.equal(screen.queryByRole("button", { name: t("creationAssociateReviewed") }), null);
    client.reviewHandler = null; await userEvent.click(screen.getByRole("button", { name: t("creationReview") }));
    const accept = await screen.findByRole("button", { name: t("creationAssociateReviewed") }); view.props.minimumRevision.current = 2;
    await userEvent.click(accept); assert.equal(client.recoveries.length, 0); assert.ok(screen.getByText(t("creationReviewChanged")));
  });
  test(`${language}: selection/removal/backend changes discard delayed creation responses`, async () => {
    for (const change of ["selection", "removal", "backend"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise; const view = panel(client);
      await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
      if (change === "selection") view.rerender(<ProjectCreationPanel {...view.props} workspaceId="other" sourceId="other-source" projects={null} />);
      else if (change === "removal") view.unmount();
      else await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
      await act(async () => response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) }));
      assert.equal(screen.queryByText(t("creationSaved")), null); assert.equal(client.creates.length, 1); cleanup(); assert.equal(client.statuses.size, 0);
    }
  });
  for (const problem of ["invalid_name", "occupied", "source_unavailable", "filesystem_error"] as const) test(`${language}: ${problem} gives useful feedback and keeps draft`, async () => {
    const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "rejected", problem, operation: null } }); panel(client);
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    const key = ({ invalid_name: "creationInvalid", occupied: "creationCollision", source_unavailable: "creationUnavailable", filesystem_error: "creationFailed" } as const)[problem];
    await screen.findByText(t(key)); assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Authored folder"); assert.ok(document.activeElement === screen.getByRole("textbox"));
  });
  test(`${language}: Reveal prevents duplicate dispatch and handles missing/retained/native errors`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(); client.revealHandler = () => response.promise;
    render(<ProjectRevealButton client={client} workspaceId="workspace" projectId="project" name="Folder" language={language} disabled={false} />);
    const button = screen.getByRole("button", { name: `${t("revealProject")}: Folder` }); fireEvent.click(button); fireEvent.click(button); assert.equal(client.reveals, 1);
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } })); assert.ok(screen.getByText(t("revealDispatched")));
    for (const [problem, key] of [["missing", "revealMissing"], ["mode_retained", "revealRetained"], ["native_error", "revealError"]] as const) {
      client.revealHandler = async () => ({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "rejected", problem } }); await userEvent.click(button);
      await screen.findByText(t(key)); assert.equal(screen.queryByText(t("revealDispatched")), null);
    }
  });
  test(`${language}: Reveal ignores foreign IDs and stale backend/removal responses`, async () => {
    for (const change of ["foreign", "backend", "removal"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(); client.revealHandler = () => response.promise;
      const view = render(<ProjectRevealButton client={client} workspaceId="workspace" projectId="project" name="Folder" language={language} disabled={false} />);
      await userEvent.click(screen.getByRole("button"));
      if (change === "backend") await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); });
      if (change === "removal") view.unmount();
      await act(async () => response.resolve({ ok: true, value: { workspaceId: change === "foreign" ? "other" : "workspace", projectId: "project", outcome: "dispatched" } }));
      assert.equal(screen.queryByText(t("revealDispatched")), null); cleanup(); assert.equal(client.statuses.size, 0);
    }
  });
  test(`${language}: creation event-before-response keeps Text draft and focus through sibling reload`, async () => {
    const client = new Client(); client.list = { ...initial, state: "ready", projects: [{ projectId: "project", name: "Existing", relativePath: "Existing", categoryId: null, categoryName: null, associationState: "active", resolution: "active" }] };
    const response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("editTextValue")}: Existing / Notes` }));
    const text = screen.getByRole("textbox", { name: `${t("editTextValue")}: Existing / Notes` }); await userEvent.clear(text); await userEvent.type(text, "Unsaved exact Text");
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "Authored folder{Enter}");
    text.focus();
    await act(async () => {
      client.list = { ...client.list, revision: 3 };
      client.events.forEach((listener) => listener({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 3 }));
      response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) });
    });
    await screen.findByText(t("creationSaved")); assert.equal((text as HTMLTextAreaElement).value, "Unsaved exact Text");
    assert.equal(client.creates.length, 1); assert.equal(screen.getByRole("textbox", { name: `${t("editTextValue")}: Existing / Notes` }), text); assert.ok(document.activeElement === text);
  });
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const props = (client: Client) => ({ client, workspaceId: "workspace", sourceId: "source", language, projects: client.list, disabled: false,
    invalidation: 0, minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {} });
  test(`${language}: cancelling a delayed recovery review discards its response and restores focus`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationRecoveryPreview>>(); client.operations = [operation]; client.reviewHandler = () => response.promise;
    render(<ProjectCreationPanel {...props(client)} />);
    await userEvent.click(await screen.findByRole("button", { name: t("creationReview") }));
    await userEvent.keyboard("{Escape}"); assert.ok(document.activeElement === screen.getByRole("button", { name: t("createProject") }));
    await act(async () => response.resolve({ ok: true, value: client.preview }));
    assert.equal(screen.queryByText(t("creationOwnershipWarning")), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: list replies cannot erase an operation recorded by a newer response or show foreign operations`, async () => {
    const client = new Client(), response = deferred<Awaited<ReturnType<Client["listProjectCreations"]>>>(); client.listHandler = () => response.promise;
    client.handler = async () => ({ ok: true, value: { outcome: "recoverable", operation: { ...operation, operationId: client.creates[0].operationId } } });
    render(<ProjectCreationPanel {...props(client)} />);
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    await screen.findByRole("button", { name: t("creationReview") });
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", sourceId: "source", operations: [] } }));
    assert.ok(screen.getByRole("button", { name: t("creationReview") }));
    client.listHandler = async () => ({ ok: true, value: { workspaceId: "other", sourceId: "source", operations: [{ ...operation, name: "Foreign", relativePath: "Foreign" }] } });
    await userEvent.click(screen.getByRole("button", { name: t("creationReload") })); await screen.findByText(t("creationListError")); assert.equal(screen.queryByText("Foreign"), null);
  });
  test(`${language}: grouped category removal disables submission while preserving its draft`, async () => {
    const client = new Client(); client.list = { ...initial, mode: "grouped", categories: [{ categoryId: "category", name: "Existing", relativePath: "Existing" }] };
    const p = props(client), view = render(<ProjectCreationPanel {...p} />);
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox"), "Authored folder"); await userEvent.selectOptions(screen.getByRole("combobox"), "category");
    view.rerender(<ProjectCreationPanel {...p} projects={{ ...client.list, revision: 2, categories: [] }} invalidation={1} />);
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Authored folder"); assert.equal((screen.getByRole("button", { name: t("creationSubmit") }) as HTMLButtonElement).disabled, true); assert.equal(client.creates.length, 0);
  });
  test(`${language}: Reveal treats a newer source observation or discovery revision as an uncertain response`, async () => {
    for (const change of ["revision", "observation"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(), revision = { current: 1 }, observation = { current: 0 }; client.revealHandler = () => response.promise;
      render(<ProjectRevealButton client={client} workspaceId="workspace" projectId="project" name="Folder" language={language} disabled={false} minimumRevision={revision} observationVersion={observation} />);
      await userEvent.click(screen.getByRole("button")); if (change === "revision") revision.current++; else observation.current++;
      await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } }));
      assert.ok(screen.getByText(t("revealUncertain"))); assert.equal(screen.queryByText(t("revealDispatched")), null); cleanup();
    }
  });
  test(`${language}: grouped creation and sibling changes preserve category-label draft and focus`, async () => {
    const client = new Client(); client.list = { ...initial, mode: "grouped", categories: [{ categoryId: "category", name: "Existing", relativePath: "Existing" }], categoryProperty: { propertyId: "category-label", sourceId: "source", name: "Category" } };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("renameCategoryProperty")}: Category` }));
    const label = screen.getByRole("textbox", { name: t("categoryPropertyName") }); await userEvent.clear(label); await userEvent.type(label, "Unsaved label");
    await userEvent.click(screen.getByRole("button", { name: t("createProject") })); await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "Authored folder"); await userEvent.selectOptions(screen.getByRole("combobox"), "category");
    label.focus(); await act(async () => { client.list = { ...client.list, revision: 2 }; client.events.forEach((listener) => listener({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 })); });
    assert.equal((label as HTMLInputElement).value, "Unsaved label"); assert.ok(document.activeElement === label); assert.equal((screen.getByRole("textbox", { name: t("creationName") }) as HTMLInputElement).value, "Authored folder");
  });
}
