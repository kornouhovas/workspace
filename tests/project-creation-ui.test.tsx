import { findAction } from "./context-tools-driver.js";
import assert from "node:assert/strict";
import { scanDirectSource, scanGroupedSource } from "../src/service/discovery.js";
import test from "node:test";
import React from "react";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { openSettingsService } from "../src/service/settings.js";
import { nativeObserverDependencies, type ObserverDependencies } from "../src/service/source-observer.js";
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
const { render, screen, cleanup, act, fireEvent, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "empty", projects: [], retainedProjects: [], retainedCount: 0, categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
const operation: ProjectCreationOperation = { operationId: "operation", sourceId: "source", initiatingWorkspaceId: "workspace", projectId: "project", name: "Authored folder", relativePath: "Authored folder", mode: "direct", categoryId: null, expectedRevision: 1, stage: "uncertain", evidenceRecorded: false, problem: "ownership_uncertain", completedRevision: null };
function completed(op = operation): ProjectCreationResult { return { outcome: "completed", operation: { ...op, stage: "completed", completedRevision: 2 }, project: { operationId: op.operationId, sourceId: op.sourceId, projectId: op.projectId, name: op.name, relativePath: op.relativePath, categoryId: op.categoryId, revision: 2 } }; }
function value<T>(result: ServiceResult<T>): T { assert.ok(result.ok, JSON.stringify(result)); return result.value; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
class Client extends WorkspaceServiceClient {
  // Non-filter workflow fixtures expose the new empty-filter projection without
  // calling listProjects again (some tests intentionally control that read).
  override async getTableLayout(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { columns: [], rowOrder: [] } } }; }
  override async getViewFilter(workspaceId: string, viewId: string) { return { ok: true as const, value: { workspaceId, viewId, config: { search: "", rules: [] } } }; }
  override async queryView(workspaceId: string, viewId: string, archived: boolean) { return { ok: true as const, value: { workspaceId, viewId, archived, projectIds: [...this.list.projects, ...this.list.retainedProjects].map(p => p.projectId) } }; }
  override async listViews(workspaceId: string) { return { ok: true as const, value: { workspaceId, activeViewId: "view", views: [{ viewId: "view", name: "Table", kind: "table" as const }] } }; }
  statuses = new Set<(status: BackendStatus) => void>(); events = new Set<(event: WorkspaceChangeEvent) => void>();
  list = initial; operations: ProjectCreationOperation[] = []; creates: Omit<WorkspaceCreateProjectCommand, "type">[] = []; recoveries: string[][] = []; statusesRequested: string[] = []; reveals = 0;
  handler: () => Promise<ServiceResult<ProjectCreationResult>> = async () => ({ ok: true, value: completed({ ...operation, ...this.creates.at(-1)! }) });
  listHandler: (() => Promise<ServiceResult<{ workspaceId: string; sourceId: string; operations: ProjectCreationOperation[] }>>) | null = null;
  preview = { workspaceId: "workspace", sourceId: "source", operation, revision: 1, destinationState: "unverified", problem: "ownership_uncertain", actions: ["associate_reviewed"], previewToken: "token" } as ProjectCreationRecoveryPreview;
  reviewHandler: (() => Promise<ServiceResult<ProjectCreationRecoveryPreview>>) | null = null;
  revealHandler: () => Promise<ServiceResult<ProjectRevealResult>> = async () => ({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } });
  override async listProjectCategoryMoves(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: this.list.sourceId, operations: [] } }; }
  override onBackendStatus(listener: (status: BackendStatus) => void) { this.statuses.add(listener); return () => { this.statuses.delete(listener); }; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects(): ReturnType<WorkspaceServiceClient["listProjects"]> { return { ok: true as const, value: this.list }; }
  override async listTextProperties(): ReturnType<WorkspaceServiceClient["listTextProperties"]> { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "Exact text" }] } }; }
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
    const trigger = (await findAction("button",{ name: t("createProject") })); trigger.focus(); await userEvent.keyboard("{Enter}");
    const input = screen.getByRole("textbox", { name: t("creationName") }); assert.equal(document.activeElement, input);
    await userEvent.type(input, "  New folder  ");
    if (mode === "grouped") { assert.equal(((await findAction("button",{ name: t("creationSubmit") })) as HTMLButtonElement).disabled, true); await userEvent.selectOptions(screen.getByRole("combobox"), "category"); }
    input.focus(); await userEvent.keyboard("{Enter}"); await screen.findByText(t("creationSaved"));
    assert.equal(client.creates.length, 1); assert.equal(client.creates[0].name, "  New folder  "); assert.equal(client.creates[0].mode, mode);
    assert.match(client.creates[0].operationId, /^[a-f0-9-]{36}$/); assert.equal(client.creates[0].expectedRevision, 1);
    assert.equal("categoryId" in client.creates[0], mode === "grouped"); assert.equal(reloads, 1); assert.equal(document.activeElement, trigger);
  });
  test(`${language}: empty/unconfigured/no-category/unavailable guidance`, async () => {
    for (const [list, key] of [[{ ...initial, configured: false, mode: null }, "creationUnconfigured"], [{ ...initial, mode: "grouped" }, "creationNoCategory"], [{ ...initial, state: "unavailable" }, "creationUnavailable"]] as const) {
      panel(new Client(), { projects: list }); assert.ok(screen.getByText(t(key))); assert.equal(((await findAction("button",{ name: t("createProject") })) as HTMLButtonElement).disabled, true); cleanup();
    }
    panel(); assert.equal(screen.queryByText(t("creationEmpty")) === null, true);
  });
  test(`${language}: Escape retains draft, double submission is blocked and pending cancel never implies rollback`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise;
    panel(client); const trigger = (await findAction("button",{ name: t("createProject") })); await userEvent.click(trigger);
    await userEvent.type(screen.getByRole("textbox"), "Authored folder{Escape}"); assert.equal(document.activeElement, trigger); assert.equal(client.creates.length, 0);
    await userEvent.click(trigger); const input = screen.getByRole("textbox") as HTMLInputElement; assert.equal(input.value, "Authored folder");
    fireEvent.submit(input.closest("form")!); fireEvent.submit(input.closest("form")!); assert.equal(client.creates.length, 1);
    assert.ok(screen.getByText(t("creationCancelHint"))); await userEvent.keyboard("{Escape}"); assert.equal(screen.queryByRole("textbox"), null);
    await act(async () => response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) }));
    assert.ok(screen.getByText(t("creationSaved"))); assert.equal(document.activeElement, trigger);
  });
  test(`${language}: unknown response keeps operation ID and requires explicit status/review/acceptance`, async () => {
    const client = new Client(); client.handler = async () => { throw new Error("lost response"); }; const { unmount } = panel(client);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    const status = await findAction("button", { name: t("creationStatus") }); assert.equal(client.creates.length, 1);
    assert.equal(((await findAction("button",{ name: t("creationSubmit") })) as HTMLButtonElement).disabled, true);
    await userEvent.click(status); assert.deepEqual(client.statusesRequested, [client.creates[0].operationId]);
    client.preview = { ...client.preview, operation: { ...operation, operationId: client.creates[0].operationId } };
    await userEvent.click((await findAction("button",{ name: t("creationReview") }))); await screen.findByText(t("creationOwnershipWarning"));
    assert.equal(client.recoveries.length, 0); assert.equal(client.creates.length, 1);
    await userEvent.click((await findAction("button",{ name: t("creationAssociateReviewed") })));
    // This fixture deliberately responds with the wrong operation: do not claim success.
    await screen.findByText(t("creationUncertain")); assert.equal(screen.queryByText(t("creationSaved")), null);
    unmount(); assert.equal(client.statuses.size, 0);
  });
  for (const action of ["retry_missing", "complete_recorded", "associate_reviewed"] as const) test(`${language}: reopened operation explicitly recovers with ${action}`, async () => {
    const client = new Client(); client.operations = [operation]; client.preview = { ...client.preview, actions: [action] }; panel(client);
    await userEvent.click(await findAction("button", { name: t("creationReview") }));
    const key = ({ retry_missing: "creationRetryMissing", complete_recorded: "creationCompleteRecorded", associate_reviewed: "creationAssociateReviewed" } as const)[action];
    await userEvent.click(await findAction("button", { name: t(key) })); await screen.findByText(t("creationSaved"));
    assert.deepEqual(client.recoveries, [["workspace", "operation", "token", action]]); assert.equal(client.creates.length, 0);
  });
  test(`${language}: source/revision/observation invalidation rejects delayed recovery and stale confirmation`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationRecoveryPreview>>(); client.operations = [operation]; client.reviewHandler = () => response.promise;
    const view = panel(client); await userEvent.click(await findAction("button", { name: t("creationReview") }));
    view.props.observationVersion.current++;
    await act(async () => response.resolve({ ok: true, value: client.preview })); await screen.findByText(t("creationReviewChanged"));
    assert.equal(screen.queryByRole("button", { name: t("creationAssociateReviewed") }), null);
    client.reviewHandler = null; await userEvent.click((await findAction("button",{ name: t("creationReview") })));
    const accept = await findAction("button", { name: t("creationAssociateReviewed") }); view.props.minimumRevision.current = 2;
    await userEvent.click(accept); assert.equal(client.recoveries.length, 0); assert.ok(screen.getByText(t("creationReviewChanged")));
  });
  test(`${language}: selection/removal/backend changes discard delayed creation responses`, async () => {
    for (const change of ["selection", "removal", "backend"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise; const view = panel(client);
      await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
      if (change === "selection") view.rerender(<ProjectCreationPanel {...view.props} workspaceId="other" sourceId="other-source" projects={null} />);
      else if (change === "removal") view.unmount();
      else await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
      await act(async () => response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) }));
      assert.equal(screen.queryByText(t("creationSaved")), null); assert.equal(client.creates.length, 1); cleanup(); assert.equal(client.statuses.size, 0);
    }
  });
  for (const problem of ["invalid_name", "occupied", "source_unavailable", "filesystem_error"] as const) test(`${language}: ${problem} gives useful feedback and keeps draft`, async () => {
    const client = new Client(); client.handler = async () => ({ ok: true, value: { outcome: "rejected", problem, operation: null } }); panel(client);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    const key = ({ invalid_name: "creationInvalid", occupied: "creationCollision", source_unavailable: "creationUnavailable", filesystem_error: "creationFailed" } as const)[problem];
    await screen.findByText(t(key)); assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Authored folder"); assert.ok(document.activeElement === screen.getByRole("textbox"));
  });
  test(`${language}: Reveal prevents duplicate dispatch and handles missing/retained/native errors`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(); client.revealHandler = () => response.promise;
    render(<ProjectRevealButton client={client} workspaceId="workspace" projectId="project" name="Folder" language={language} disabled={false} />);
    const button = (await findAction("button",{ name: `${t("revealProject")}: Folder` })); fireEvent.click(button); fireEvent.click(button); assert.equal(client.reveals, 1);
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } })); assert.ok(screen.getByText(t("revealDispatched")));
    for (const [problem, key] of [["missing", "revealMissing"], ["mode_retained", "revealRetained"], ["native_error", "revealError"]] as const) {
      client.revealHandler = async () => ({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "rejected", problem } }); await userEvent.click(button);
      await screen.findByText(t(key)); assert.equal(screen.queryByText(t("revealDispatched")), null);
    }
  });
  test(`${language}: Reveal ignores foreign IDs and stale backend/removal responses`, async () => {
    for (const change of ["foreign", "foreign-project", "backend", "selection", "removal"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(); client.revealHandler = () => response.promise;
      const view = render(<ProjectRevealButton client={client} workspaceId="workspace" projectId="project" name="Folder" language={language} disabled={false} />);
      await userEvent.click((await findAction("button")));
      if (change === "backend") await act(async () => {
        client.statuses.forEach((listener) => listener({ state: "unavailable" }));
        client.statuses.forEach((listener) => listener({ state: "ready" }));
      });
      if (change === "selection") view.rerender(<ProjectRevealButton client={client} workspaceId="other" projectId="other-project" name="Other" language={language} disabled={false} />);
      if (change === "removal") view.unmount();
      await act(async () => response.resolve({ ok: true, value: { workspaceId: change === "foreign" ? "other" : "workspace", projectId: change === "foreign-project" ? "other-project" : "project", outcome: "dispatched" } }));
      assert.equal(screen.queryByText(t("revealDispatched")), null); cleanup(); assert.equal(client.statuses.size, 0);
    }
  });
  test(`${language}: creation event-before-response keeps Text draft and focus through sibling reload`, async () => {
    const client = new Client(); client.list = { ...initial, state: "ready", projects: [{ projectId: "project", name: "Existing", relativePath: "Existing", categoryId: null, categoryName: null, associationState: "active", resolution: "active" }] };
    const response = deferred<ServiceResult<ProjectCreationResult>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await findAction("button", { name: `${t("editTextValue")}: Existing / Notes` }));
    const text = screen.getByRole("textbox", { name: `${t("editTextValue")}: Existing / Notes` }); await userEvent.clear(text); await userEvent.type(text, "Unsaved exact Text");
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "Authored folder{Enter}");
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
    await userEvent.click(await findAction("button", { name: t("creationReview") }));
    await userEvent.keyboard("{Escape}"); assert.ok(document.activeElement === (await findAction("button",{ name: t("createProject") })));
    await act(async () => response.resolve({ ok: true, value: client.preview }));
    assert.equal(screen.queryByText(t("creationOwnershipWarning")), null); assert.equal(client.recoveries.length, 0);
  });
  test(`${language}: list replies cannot erase an operation recorded by a newer response or show foreign operations`, async () => {
    const client = new Client(), response = deferred<Awaited<ReturnType<Client["listProjectCreations"]>>>(); client.listHandler = () => response.promise;
    client.handler = async () => ({ ok: true, value: { outcome: "recoverable", operation: { ...operation, operationId: client.creates[0].operationId } } });
    render(<ProjectCreationPanel {...props(client)} />);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Authored folder{Enter}");
    await findAction("button", { name: t("creationReview") });
    await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", sourceId: "source", operations: [] } }));
    assert.ok((await findAction("button",{ name: t("creationReview") })));
    client.listHandler = async () => ({ ok: true, value: { workspaceId: "other", sourceId: "source", operations: [{ ...operation, name: "Foreign", relativePath: "Foreign" }] } });
    await userEvent.click((await findAction("button",{ name: t("creationReload") }))); await screen.findByText(t("creationListError")); assert.equal(screen.queryByText("Foreign"), null);
  });
  test(`${language}: grouped category removal disables submission while preserving its draft`, async () => {
    const client = new Client(); client.list = { ...initial, mode: "grouped", categories: [{ categoryId: "category", name: "Existing", relativePath: "Existing" }] };
    const p = props(client), view = render(<ProjectCreationPanel {...p} />);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Authored folder"); await userEvent.selectOptions(screen.getByRole("combobox"), "category");
    view.rerender(<ProjectCreationPanel {...p} projects={{ ...client.list, revision: 2, categories: [] }} invalidation={1} />);
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Authored folder"); assert.equal(((await findAction("button",{ name: t("creationSubmit") })) as HTMLButtonElement).disabled, true); assert.equal(client.creates.length, 0);
  });
  test(`${language}: Reveal rejects changed source, discovery and target lifetimes without another pending dispatch`, async () => {
    for (const change of ["revision", "source", "target", "target-roundtrip"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(), revision = { current: 1 }, source = { current: 0 }; client.revealHandler = () => response.promise;
      const props = { client, workspaceId: "workspace", projectId: "project", name: "Folder", language, disabled: false, minimumRevision: revision, sourceLifetime: source, targetKey: "original" };
      const view = render(<ProjectRevealButton {...props} />);
      await userEvent.click((await findAction("button")));
      if (change === "revision") revision.current++;
      else if (change === "source") source.current++;
      else view.rerender(<ProjectRevealButton {...props} targetKey="changed" />);
      if (change === "target-roundtrip") view.rerender(<ProjectRevealButton {...props} />);
      fireEvent.click((await findAction("button"))); assert.equal(client.reveals, 1);
      await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } }));
      assert.ok(screen.getByText(t("revealUncertain"))); assert.equal(screen.queryByText(t("revealDispatched")), null); cleanup();
    }
  });
  test(`${language}: active observation preserves Reveal, Text and category drafts while changed project projection rejects a delayed acknowledgment`, async () => {
    for (const change of ["benign", "path", "category", "retained", "source"] as const) {
      const client = new Client(), response = deferred<ServiceResult<ProjectRevealResult>>(); client.revealHandler = () => response.promise;
      client.list = { ...initial, mode: "grouped", state: "ready", categories: [{ categoryId: "category", name: "Existing", relativePath: "Existing" }],
        categoryProperty: { propertyId: "label", sourceId: "source", name: "Category" },
        projects: [{ projectId: "project", name: "Folder", relativePath: "Existing/Folder", categoryId: "category", categoryName: "Existing", associationState: "active", resolution: "active" }] };
      render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
      await userEvent.click(await findAction("button", { name: `${t("editTextValue")}: Folder / Notes` }));
      const text = screen.getByRole("textbox", { name: `${t("editTextValue")}: Folder / Notes` });
      await userEvent.clear(text); await userEvent.type(text, "Unsaved Text");
      await userEvent.click((await findAction("button",{ name: `${t("renameCategoryProperty")}: Category` })));
      const label = screen.getByRole("textbox", { name: t("categoryPropertyName") });
      await userEvent.clear(label); await userEvent.type(label, "Unsaved label");
      await userEvent.click((await findAction("button",{ name: `${t("revealProject")}: Folder` })));
      text.focus();
      await act(async () => {
        if (change === "path") client.list = { ...client.list, projects: [{ ...client.list.projects[0], relativePath: "Existing/Moved" }] };
        if (change === "category") client.list = { ...client.list, categories: [{ ...client.list.categories[0], relativePath: "Moved" }] };
        if (change === "retained") client.list = { ...client.list, projects: [], retainedProjects: [{ ...client.list.projects[0], resolution: "replaced" }], retainedCount: 1 };
        client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId: "source", workspaceIds: ["workspace"], observationRevision: 1,
          state: change === "source" ? "unavailable" : "ready", automaticUpdates: change === "source" ? "degraded" : "active" }));
      });
      assert.equal(screen.getByRole("textbox", { name: `${t("editTextValue")}: Folder / Notes` }), text);
      assert.equal((text as HTMLTextAreaElement).value, "Unsaved Text");
      assert.equal((label as HTMLInputElement).value, "Unsaved label"); assert.equal(document.activeElement, text);
      assert.equal(((await findAction("button",{ name: `${t("revealProject")}: Folder` })) as HTMLButtonElement).disabled, true);
      await act(async () => response.resolve({ ok: true, value: { workspaceId: "workspace", projectId: "project", outcome: "dispatched" } }));
      assert.ok(screen.getByText(t(change === "benign" ? "revealDispatched" : "revealUncertain")));
      assert.equal(client.reveals, 1); cleanup();
    }
  });
  test(`${language}: grouped creation and sibling changes preserve category-label draft and focus`, async () => {
    const client = new Client(); client.list = { ...initial, mode: "grouped", categories: [{ categoryId: "category", name: "Existing", relativePath: "Existing" }], categoryProperty: { propertyId: "category-label", sourceId: "source", name: "Category" } };
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await findAction("button", { name: `${t("renameCategoryProperty")}: Category` }));
    const label = screen.getByRole("textbox", { name: t("categoryPropertyName") }); await userEvent.clear(label); await userEvent.type(label, "Unsaved label");
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "Authored folder"); await userEvent.selectOptions(within(screen.getByRole("region", { name: t("createProject") })).getByRole("combobox"), "category");
    label.focus(); await act(async () => { client.list = { ...client.list, revision: 2 }; client.events.forEach((listener) => listener({ type: "workspace.projectsChanged", sourceId: "source", workspaceIds: ["workspace"], revision: 2 })); });
    assert.equal((label as HTMLInputElement).value, "Unsaved label"); assert.ok(document.activeElement === label); assert.equal((screen.getByRole("textbox", { name: t("creationName") }) as HTMLInputElement).value, "Authored folder");
  });
}

// Keep real probing/reconciliation while choosing which side of native completion
// receives watch hints. Wall-clock timers must not choose the expected problem.
function controlledRevealObserver() {
  const watches = new Map<string, () => void>();
  const timers = new Set<{ callback(): void; delay: number }>();
  const dependencies: ObserverDependencies = {
    ...nativeObserverDependencies,
    // This fixture explicitly drains its fake observation clock.
    scan: request => (request.mode === "grouped" ? scanGroupedSource : scanDirectSource)(request.canonicalRoot, request.archiveRelativePath, request.exclusions),
    watch(path, hint) { watches.set(path, hint); return { close() { watches.delete(path); } }; },
    schedule(callback, delay) {
      const timer = { callback, delay }; timers.add(timer);
      return { cancel() { timers.delete(timer); } };
    },
  };
  const flush = () => {
    for (let count = 0; ; count++) {
      const timer = [...timers].find((entry) => entry.delay < 5000);
      if (!timer) return;
      assert.ok(count < 100, "bounded observer scheduling");
      timers.delete(timer); timer.callback();
    }
  };
  return { dependencies, flush, observe(root: string) {
    const hint = watches.get(root); assert.ok(hint, "the selected root must have an active watcher");
    hint(); flush();
  } };
}

for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) {
  test(`${language}: ${mode} real creation feedback survives stale list reads and independent list failure/recovery`, async () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "creation-feedback-"))), root = join(directory, "root");
    fs.mkdirSync(root); if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
    const observer = controlledRevealObserver(), service = openSettingsService(join(directory, "workspace.sqlite"), "src/service/db/migrations", undefined, observer.dependencies);
    try {
      const { workspaceId, sourceId } = value(service.workspaces.create({ type: "workspace.create", name: "Feedback", rootPath: root }));
      const preview = value(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode }));
      value(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }));
      const projects = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      const client = new Client(); client.list = projects;
      let creates = 0, completions = 0;
      client.createProject = async (input) => { creates++; return service.workspaces.createProject({ type: "workspace.createProject", ...input }); };
      const query = () => service.workspaces.listProjectCreations({ type: "workspace.listProjectCreations", workspaceId });
      client.listHandler = async () => query();
      const observationVersion = { current: 0 }, t = (key: Parameters<typeof translate>[1]) => translate(language, key);
      const props = { client, workspaceId, sourceId, language, projects, disabled: false, invalidation: 0,
        minimumRevision: { current: projects.revision }, observationVersion, onCompleted: () => completions++ };
      const view = render(<ProjectCreationPanel {...props} />);
      await userEvent.click((await findAction("button",{ name: t("createProject") })));
      await userEvent.type(screen.getByRole("textbox"), "Created Текст");
      if (mode === "grouped") await userEvent.selectOptions(screen.getByRole("combobox"), projects.categories[0].categoryId);
      await userEvent.click((await findAction("button",{ name: t("creationSubmit") })));
      await screen.findByText(t("creationSaved"));
      const reloadControl=await findAction("button",{name:t("creationReload")});
      const reload = () => reloadControl;
      const snapshot = query(); assert.deepEqual(value(snapshot).operations, []);
      const delayed = deferred<typeof snapshot>(); client.listHandler = () => delayed.promise;
      await userEvent.click(reload());
      // Reproduce the synchronous counter change before the next invalidation effect.
      observationVersion.current++;
      await act(async () => delayed.resolve(snapshot));
      assert.ok(screen.getByText(t("creationSaved")));
      assert.equal(screen.queryByText(t("creationListError")), null);
      assert.equal((reload() as HTMLButtonElement).disabled, false);

      // A real query rejection remains a useful, independent error after success.
      const failure = service.workspaces.listProjectCreations({ type: "workspace.listProjectCreations", workspaceId: randomUUID() });
      assert.equal(failure.ok, false);
      client.listHandler = async () => failure;
      await userEvent.click(reload()); await screen.findByText(t("creationListError"));
      assert.ok(screen.getByText(t("creationSaved")));

      // Neither stale successful data nor a stale thrown failure may change list status.
      const staleSuccess = deferred<typeof snapshot>(); client.listHandler = () => staleSuccess.promise;
      await userEvent.click(reload()); observationVersion.current++;
      await act(async () => staleSuccess.resolve(snapshot));
      assert.ok(screen.getByText(t("creationListError")));
      client.listHandler = async () => query();
      view.rerender(<ProjectCreationPanel {...props} invalidation={1} />);
      await act(async () => {});
      assert.equal(screen.queryByText(t("creationListError")), null);
      assert.ok(screen.getByText(t("creationSaved")));
      const staleFailure = deferred<void>(); client.listHandler = async () => { await staleFailure.promise; throw new Error("Delayed transport failure"); };
      await userEvent.click(reload()); observationVersion.current++;
      await act(async () => staleFailure.resolve());
      assert.equal(screen.queryByText(t("creationListError")), null);
      assert.ok(screen.getByText(t("creationSaved")));
      assert.equal(creates, 1); assert.equal(completions, 1);
      const final = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      assert.equal(final.projects.length, 1); assert.equal(final.projects[0].name, "Created Текст");
      assert.deepEqual(fs.readdirSync(join(root, final.projects[0].relativePath)), []);
    } finally { cleanup(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
}

for (const language of ["en", "ru"] as const) for (const change of ["backend", "workspace", "source", "unmount", "command"] as const) {
  test(`${language}: delayed list failure cannot cross ${change} lifetime`, async () => {
    const client = new Client(), delayed = deferred<Awaited<ReturnType<Client["listProjectCreations"]>>>();
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const props = { client, workspaceId: "workspace", sourceId: "source", language, projects: client.list, disabled: false,
      invalidation: 0, minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {} };
    const view = render(<ProjectCreationPanel {...props} />);
    await act(async () => {});
    client.listHandler = () => delayed.promise;
    await userEvent.click((await findAction("button",{ name: t("creationReload") })));
    client.listHandler = null;
    if (change === "backend") await act(async () => {
      client.statuses.forEach((listener) => listener({ state: "unavailable" }));
      client.statuses.forEach((listener) => listener({ state: "ready" }));
    });
    else if (change === "unmount") view.unmount();
    else if (change === "workspace" || change === "source") {
      client.list = { ...client.list, ...(change === "workspace" ? { workspaceId: "other" } : { sourceId: "other" }) };
      view.rerender(<ProjectCreationPanel {...props} workspaceId={client.list.workspaceId} sourceId={client.list.sourceId} projects={client.list} />);
      await act(async () => {});
    } else {
      await userEvent.click((await findAction("button",{ name: t("createProject") })));
      await userEvent.type(screen.getByRole("textbox"), "Folder{Enter}");
      await screen.findByText(t("creationSaved"));
    }
    await act(async () => delayed.resolve({ ok: false, error: { code: "service_unavailable", message: "Old backend" } }));
    assert.equal(screen.queryByText(t("creationListError")), null);
    if (change === "command") assert.ok(screen.getByText(t("creationSaved")));
    else assert.equal(client.creates.length, 0);
  });
}

for (const language of ["en", "ru"] as const) test(`${language}: fresh list recovery preserves uncertain command and original retry`, async () => {
  const client = new Client(), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  client.handler = async () => { throw new Error("Lost command response"); };
  render(<ProjectCreationPanel client={client} workspaceId="workspace" sourceId="source" language={language} projects={client.list}
    disabled={false} invalidation={0} minimumRevision={{ current: 1 }} observationVersion={{ current: 0 }} onCompleted={() => assert.fail("Unknown command cannot complete")} />);
  await userEvent.click((await findAction("button",{ name: t("createProject") })));
  await userEvent.type(screen.getByRole("textbox"), "Original draft{Enter}");
  await findAction("button", { name: t("creationRetryRequest") });
  client.listHandler = async () => ({ ok: false, error: { code: "service_unavailable", message: "List unavailable" } });
  await userEvent.click((await findAction("button",{ name: t("creationReload") }))); await screen.findByText(t("creationListError"));
  client.listHandler = null;
  await userEvent.click((await findAction("button",{ name: t("creationReload") })));
  assert.equal(screen.queryByText(t("creationListError")), null);
  assert.ok(screen.getAllByText(t("creationUncertain")).length > 0);
  assert.ok((await findAction("button",{ name: t("creationRetryRequest") })));
  assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Original draft");
  assert.equal((screen.getByRole("textbox") as HTMLInputElement).disabled, true);
  assert.equal(client.creates.length, 1);
});

for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) for (const order of ["before-observation", "after-observation"] as const) {
  test(`${language}: ${mode} delayed real-service Reveal rejects actual folder changes ${order}`, async () => {
    const changes = ["project-path", "project-identity", ...(order === "before-observation" ? ["root-path", "root-identity"] : []), ...(mode === "grouped" ? ["category-path", "category-identity"] : [])];
    for (const change of changes) {
      const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "reveal-ui-lifetime-"))), root = join(directory, "root");
      fs.mkdirSync(root); if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
      const observer = controlledRevealObserver();
      const service = openSettingsService(join(directory, "workspace.sqlite"), "src/service/db/migrations", undefined, observer.dependencies);
      const client = new Client(), nativeCompletion = deferred<void>();
      let calls = 0, initialValidation: string | undefined, receipt: ServiceResult<ProjectRevealResult> | undefined;
      let off: (() => void) | undefined;
      try {
        const { workspaceId, sourceId } = value(service.workspaces.create({ type: "workspace.create", name: "Reveal", rootPath: root }));
        const preview = value(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode }));
        value(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }));
        const revision = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })).revision;
        const created = value(service.workspaces.createProject({ type: "workspace.createProject", workspaceId, operationId: randomUUID(), name: "Folder", mode, expectedRevision: revision,
          ...(mode === "grouped" ? { categoryId: value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })).categories[0].categoryId } : {}) }));
        assert.equal(created.outcome, "completed");
        observer.flush();
        client.list = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
        const original = structuredClone(client.list);
        client.listProjects = async () => service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId });
        client.listTextProperties = async () => service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId });
        client.revealProject = async () => {
          calls++;
          receipt = await service.revealProject({ type: "workspace.revealProject", workspaceId, projectId: client.list.projects[0].projectId }, async (_target, validate) => {
            initialValidation = validate().outcome;
            await nativeCompletion.promise;
            // The backend must also reject changes made during an acknowledged
            // native call, independently of the renderer's projection guards.
            return { outcome: "dispatched" };
          });
          return receipt;
        };
        off = service.workspaces.subscribe((event) => client.events.forEach((listener) => listener(event)));
        const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
        render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} disabled={false} />);
        const reveal = await findAction("button", { name: `${t("revealProject")}: Folder` });
        await act(async () => observer.flush());
        await userEvent.click(reveal); assert.equal(calls, 1); assert.equal(initialValidation, "verified");
        const path = change.startsWith("root") ? root : change.startsWith("category") ? join(root, "Category") : join(root, ...(mode === "grouped" ? ["Category", "Folder"] : ["Folder"]));
        await act(async () => {
          fs.renameSync(path, `${path}-moved`);
          if (change.endsWith("identity")) fs.mkdirSync(path);
          if (order === "after-observation") observer.observe(root);
          else client.events.forEach((listener) => listener({ type: "workspace.sourceObserved", sourceId, workspaceIds: [workspaceId], observationRevision: 1000,
            state: change.startsWith("root") ? "unavailable" : "ready", automaticUpdates: "active" }));
        });
        if (order === "after-observation") {
          const observed = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
          assert.equal(observed.revision, original.revision + 1, change);
          assert.equal(observed.projects.length, 1, change);
          assert.equal(observed.projects[0].projectId, original.projects[0].projectId, change);
          assert.equal(observed.projects[0].relativePath, change.startsWith("category") ? "Category-moved/Folder"
            : mode === "grouped" ? "Category/Folder-moved" : "Folder-moved", change);
          assert.equal(observed.projects[0].associationState, "active", change);
          assert.equal(observed.projects[0].resolution, "active", change);
        }
        fireEvent.click(reveal); assert.equal(calls, 1);
        await act(async () => nativeCompletion.resolve());
        assert.ok(receipt?.ok); assert.equal(receipt.value.outcome, "rejected", change);
        if (receipt.value.outcome !== "rejected") throw new Error("Changed target unexpectedly dispatched");
        const expected = order === "after-observation" ? "unresolved" : change.startsWith("category") ? "category_unavailable" : change.startsWith("root")
          ? change.endsWith("identity") ? "root_replaced" : "root_unavailable" : change.endsWith("identity") ? "replaced" : "missing";
        assert.equal(receipt.value.problem, expected, change);
        assert.equal(screen.queryByText(t("revealDispatched")), null, change);
        if (order === "after-observation") assert.ok(screen.getByText(t("revealUncertain")), change);
        assert.ok(["revealUncertain", "revealMissing", "revealError"].some((key) => screen.queryByText(t(key as Parameters<typeof translate>[1]))), change);
        assert.equal(calls, 1);
      } finally { cleanup(); off?.(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
    }
  });
}

for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) for (const delivery of ["undelivered", "completed_response_lost"] as const) {
  test(`${language}: ${mode} explicit retry reconciles ${delivery} with original payload and one durable project`, async () => {
    const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "creation-ui-retry-"))), root = join(directory, "root"), database = join(directory, "workspace.sqlite");
    fs.mkdirSync(root); if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
    let service = openSettingsService(database, "src/service/db/migrations");
    try {
      const workspace = value(service.workspaces.create({ type: "workspace.create", name: "Retry", rootPath: root }));
      const { workspaceId, sourceId } = workspace;
      const preview = value(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode }));
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).ok, true);
      const projects = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      const calls: Parameters<WorkspaceServiceClient["createProject"]>[0][] = [], statuses = new Set<(status: BackendStatus) => void>();
      const listResponses: ServiceResult<unknown>[] = [], statusResponses: ServiceResult<unknown>[] = [];
      const gate = deferred<void>(); let receipt: ServiceResult<ProjectCreationResult> | undefined, completions = 0;
      const client = {
        onBackendStatus(listener: (status: BackendStatus) => void) { statuses.add(listener); return () => statuses.delete(listener); },
        listProjectCreations: async () => {
          const response = service.handleQuery({ type: "workspace.listProjectCreations", workspaceId });
          listResponses.push(response); return response;
        },
        getProjectCreation: async (_id: string, operationId: string) => {
          const response = service.handleQuery({ type: "workspace.getProjectCreation", workspaceId, operationId });
          statusResponses.push(response); return response;
        },
        createProject: async (input: Parameters<WorkspaceServiceClient["createProject"]>[0]) => {
          calls.push(structuredClone(input));
          if (calls.length === 1) {
            if (delivery === "completed_response_lost") receipt = service.workspaces.createProject({ type: "workspace.createProject", ...input });
            return { ok: false, error: { code: "service_unavailable", message: "Lost transport" } };
          }
          await gate.promise;
          return service.handleCommand({ type: "workspace.createProject", ...input });
        },
      } as unknown as WorkspaceServiceClient;
      const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
      const view = render(<ProjectCreationPanel client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} projects={projects} disabled={false} invalidation={0} minimumRevision={{ current: projects.revision }} observationVersion={{ current: 0 }} onCompleted={() => completions++} />);
      await userEvent.click((await findAction("button",{ name: t("createProject") })));
      await userEvent.type(screen.getByRole("textbox"), "  Retry Текст 📝");
      if (mode === "grouped") await userEvent.selectOptions(screen.getByRole("combobox"), projects.categories[0].categoryId);
      await userEvent.click((await findAction("button",{ name: t("creationSubmit") })));
      const status = await findAction("button", { name: t("creationStatus") });
      assert.ok(listResponses.length > 0);
      for (const response of listResponses) assert.deepEqual(value(response), { workspaceId, sourceId, operations: [] });
      if (delivery === "undelivered") {
        await userEvent.click(status);
        assert.equal(statusResponses.length, 1);
        const missing = statusResponses[0];
        assert.equal(missing.ok, false);
        if (missing.ok) throw new Error("Undelivered operation unexpectedly exists");
        assert.equal(missing.error.code, "invalid_input");
        assert.deepEqual(value(service.workspaces.listProjectCreations({ type: "workspace.listProjectCreations", workspaceId })).operations, []);
      } else {
        assert.ok(receipt?.ok); if (!receipt?.ok) throw new Error("Creation was not accepted");
        assert.equal(receipt.value.outcome, "completed");
        assert.deepEqual(await client.getProjectCreation(workspaceId, calls[0].operationId), receipt);
      }
      await userEvent.click((await findAction("button",{ name: t("cancelRenameWorkspace") })));
      await act(async () => { statuses.forEach((listener) => listener({ state: "unavailable" })); statuses.forEach((listener) => listener({ state: "ready" })); });
      await userEvent.click((await findAction("button",{ name: t("createProject") })));
      assert.equal(calls.length, 1); assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, calls[0].name);
      const retry = (await findAction("button",{ name: t("creationRetryRequest") }));
      fireEvent.click(retry); fireEvent.click(retry);
      assert.equal(calls.length, 2); assert.deepEqual(calls[1], calls[0]); assert.equal((retry as HTMLButtonElement).disabled, true);
      await act(async () => gate.resolve());
      await screen.findByText(t("creationSaved")); assert.equal(completions, 1);
      const list = value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      assert.equal(list.projects.length, 1);
      assert.equal(calls[0].name, "  Retry Текст 📝");
      assert.equal(list.projects[0].name, calls[0].name);
      assert.equal(basename(list.projects[0].relativePath), calls[0].name);
      assert.deepEqual(fs.readdirSync(mode === "grouped" ? join(root, "Category") : root), [calls[0].name]);
      assert.deepEqual(fs.readdirSync(join(root, list.projects[0].relativePath)), []);
      const finalReceipt = service.handleCommand({ type: "workspace.createProject", ...calls[0] });
      assert.deepEqual(await client.getProjectCreation(workspaceId, calls[0].operationId), finalReceipt);
      assert.deepEqual(value(await client.listProjectCreations(workspaceId)), { workspaceId, sourceId, operations: [] });
      if (receipt) assert.deepEqual(finalReceipt, receipt);
      view.unmount(); assert.equal(statuses.size, 0); service.close(); service = openSettingsService(database, "src/service/db/migrations");
      assert.deepEqual(service.handleCommand({ type: "workspace.createProject", ...calls[0] }), finalReceipt);
      assert.equal(value(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })).projects[0].projectId, list.projects[0].projectId);
    } finally { cleanup(); service.close(); fs.rmSync(directory, { recursive: true, force: true }); }
  });
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  for (const action of ["status", "recover"] as const) test(`${language}: ${action} of another operation preserves an uncertain original request`, async () => {
    const client = new Client(); client.operations = [operation];
    client.handler = async () => client.creates.length === 1
      ? { ok: false, error: { code: "service_unavailable", message: "Undelivered" } }
      : { ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) };
    const props = { client, workspaceId: "workspace", sourceId: "source", projects: client.list, language, disabled: false, invalidation: 0,
      minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {} };
    render(<ProjectCreationPanel {...props} />);
    await screen.findByText(operation.relativePath);
    await userEvent.click((await findAction("button",{ name: t("createProject") })));
    await userEvent.type(screen.getByRole("textbox"), "Original{Enter}");
    await findAction("button", { name: t("creationRetryRequest") });
    if (action === "status") {
      // The outstanding-operation row is independent from the unknown-request status.
      await userEvent.click(screen.getByText(operation.relativePath).closest("li")!.querySelector("button")!);
      await screen.findAllByText(t("creationRecoverable"));
    } else {
      client.recoverProjectCreation = async () => ({ ok: true, value: completed(operation) });
      await userEvent.click((await findAction("button",{ name: t("creationReview") })));
      await userEvent.click(await findAction("button", { name: t("creationAssociateReviewed") }));
      await screen.findByText(t("creationSaved"));
    }
    const input = screen.getByRole("textbox") as HTMLInputElement;
    assert.equal(input.value, "Original"); assert.equal(input.disabled, true);
    assert.equal(((await findAction("button",{ name: t("creationSubmit") })) as HTMLButtonElement).disabled, true);
    await userEvent.click((await findAction("button",{ name: t("creationRetryRequest") })));
    await screen.findByText(t("creationSaved"));
    assert.equal(client.creates.length, 2); assert.deepEqual(client.creates[1], client.creates[0]);
    assert.equal(screen.queryByRole("button", { name: t("creationRetryRequest") }), null);
  });
  for (const change of ["selection", "removal", "backend"] as const) test(`${language}: explicit retry discards delayed ${change} response`, async () => {
    const client = new Client(), response = deferred<ServiceResult<ProjectCreationResult>>();
    client.handler = async () => client.creates.length === 1 ? { ok: false, error: { code: "service_unavailable", message: "Undelivered" } } : response.promise;
    const props = { client, workspaceId: "workspace", sourceId: "source", projects: client.list, language, disabled: false, invalidation: 0, minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {} };
    const view = render(<ProjectCreationPanel {...props} />);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Original{Enter}");
    await userEvent.click(await findAction("button", { name: t("creationRetryRequest") }));
    assert.deepEqual(client.creates[1], client.creates[0]);
    if (change === "selection") view.rerender(<ProjectCreationPanel {...props} workspaceId="other" sourceId="other-source" projects={null} />);
    else if (change === "removal") view.unmount();
    else await act(async () => { client.statuses.forEach((listener) => listener({ state: "unavailable" })); client.statuses.forEach((listener) => listener({ state: "ready" })); });
    await act(async () => response.resolve({ ok: true, value: completed({ ...operation, operationId: client.creates[0].operationId }) }));
    assert.equal(screen.queryByText(t("creationSaved")), null); assert.equal(client.creates.length, 2);
  });
  test(`${language}: definite no-effect stale retry unlocks original draft for an explicit new submission`, async () => {
    const client = new Client();
    client.handler = async () => client.creates.length === 1 ? { ok: false, error: { code: "service_unavailable", message: "Undelivered" } } : { ok: true, value: { outcome: "rejected", problem: "stale_configuration", operation: null } };
    const props = { client, workspaceId: "workspace", sourceId: "source", projects: client.list, language, disabled: false, invalidation: 0, minimumRevision: { current: 1 }, observationVersion: { current: 0 }, onCompleted() {} };
    const view = render(<ProjectCreationPanel {...props} />);
    await userEvent.click((await findAction("button",{ name: t("createProject") }))); await userEvent.type(screen.getByRole("textbox"), "Original{Enter}");
    await findAction("button", { name: t("creationRetryRequest") });
    view.rerender(<ProjectCreationPanel {...props} projects={{ ...client.list, revision: 5 }} invalidation={1} />);
    await userEvent.click((await findAction("button",{ name: t("creationRetryRequest") })));
    assert.deepEqual(client.creates[1], client.creates[0]); assert.equal(client.creates[1].expectedRevision, 1);
    await screen.findByText(t("creationUnavailable"));
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).disabled, false);
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "Original");
    assert.equal(screen.queryByRole("button", { name: t("creationRetryRequest") }), null);
  });
}

for (const language of ["en","ru"] as const) test(`${language}: same-path missing observation preserves the authoritative Reveal rejection`,async()=>{
  const directory=fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(),"reveal-missing-state-"))),root=join(directory,"root");fs.mkdirSync(join(root,"Folder"),{recursive:true});
  const observer=controlledRevealObserver(),service=openSettingsService(join(directory,"app.sqlite"),"src/service/db/migrations",undefined,observer.dependencies);
  const client=new Client(),response=deferred<void>();let off:(()=>void)|undefined,receipt:ServiceResult<ProjectRevealResult>|undefined;
  const t=(key:Parameters<typeof translate>[1])=>translate(language,key);
  try {
    const {workspaceId,sourceId}=value(service.workspaces.create({type:"workspace.create",rootPath:root,name:"Reveal"}));
    const preview=value(service.workspaces.previewDiscovery({type:"workspace.previewDiscovery",workspaceId}));
    client.list=value(service.workspaces.applyDiscovery({type:"workspace.applyDiscovery",workspaceId,previewToken:preview.previewToken}));observer.flush();
    const projectId=client.list.projects[0].projectId;
    client.listProjects=async()=>service.workspaces.listProjects({type:"workspace.listProjects",workspaceId});
    client.listTextProperties=async()=>service.workspaces.listTextProperties({type:"workspace.listTextProperties",workspaceId});
    client.revealProject=async()=>{
      fs.rmSync(join(root,"Folder"),{recursive:true});observer.observe(root);
      await response.promise;
      receipt=await service.revealProject({type:"workspace.revealProject",workspaceId,projectId},async()=>{throw new Error("Missing folders must not dispatch native Reveal");});return receipt;
    };
    off=service.workspaces.subscribe(event=>client.events.forEach(listener=>listener(event)));
    render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={sourceId} language={language} disabled={false}/>);
    await userEvent.click(await findAction("button",{name:`${t("revealProject")}: Folder`}));
    await screen.findByText(t("projectMissing"));
    await act(async()=>response.resolve());
    await screen.findByText(t("revealMissing"));
    assert.ok(receipt?.ok);assert.equal(receipt.value.outcome,"rejected");
    assert.equal(screen.queryByText(t("revealUncertain")),null);assert.equal(screen.queryByText(t("revealDispatched")),null);
    const retained=value(service.workspaces.listProjects({type:"workspace.listProjects",workspaceId})).retainedProjects;
    assert.equal(retained[0].projectId,projectId);assert.equal(retained[0].relativePath,"Folder");
  }finally{cleanup();off?.();service.close();fs.rmSync(directory,{recursive:true,force:true});}
});
