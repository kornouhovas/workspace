import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectCategoryMoveOperation, ProjectCategoryMoveResult } from "../src/contracts/project-category-move.js";
import type { ProjectList, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";

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
  override onBackendStatus() { return () => {}; }
  override onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void) { this.events.add(listener); return () => { this.events.delete(listener); }; }
  override async listProjects() { this.lists++; return { ok: true as const, value: this.list }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1, definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "project", propertyId: "notes", value: "  Exact Text\nТекст  " }] } }; }
  override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  override async listProjectRenames(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
  override async moveProjectCategory(input: Parameters<WorkspaceServiceClient["moveProjectCategory"]>[0]) { this.moves.push(input); return this.handler(); }
}
for (const language of ["en", "ru"] as const) {
const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
test(`${language}: explicit grouped category selection moves the folder without changing Name or Text`, async () => {
  const client = new Client();
  render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
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
  assert.ok(screen.getByText("  Exact 📝  ", { selector: "td span", normalizer: (value) => value }));
  assert.ok(screen.getByText("  Exact Text\nТекст  ", { normalizer: (value) => value }));
});

}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const mount = (client: Client) => render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  const open = async () => {
    const trigger = await screen.findByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) });
    await userEvent.click(trigger); return trigger;
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
    assert.ok(document.activeElement === trigger || document.activeElement === screen.getByRole("heading", { name: t("tableViewTitle") }));
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
  });
  test(`${language}: Escape dismisses an unsubmitted editor and restores the category trigger`, async () => {
    const client = new Client(); mount(client); const trigger = await open();
    await userEvent.selectOptions(destination(), "empty");
    await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
    assert.equal(document.activeElement, trigger); assert.equal(client.moves.length, 0);
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
    assert.ok(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
    await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("combobox", { name: t("moveCategoryDestination") }), null);
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
      assert.equal((screen.getByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }) as HTMLButtonElement).disabled, true);
    });
  }
}

for (const language of ["en", "ru"] as const) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const mount = (client: Client) => render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
  const open = async () => userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }));
  const destination = () => screen.getByRole("combobox", { name: t("moveCategoryDestination") }) as HTMLSelectElement;
  const submit = () => screen.getByRole("button", { name: t("moveCategorySubmit") }) as HTMLButtonElement;
  for (const restriction of ["direct", "retained", "unresolved", "unavailable"] as const) {
    test(`${language}: ${restriction} projects have no category edit control`, async () => {
      const client = new Client();
      if (restriction === "direct") client.list = { ...client.list, mode: "direct", categoryProperty: null, projects: [{ ...client.list.projects[0], categoryId: null, relativePath: "  Exact 📝  " }] };
      if (restriction === "retained") client.list = { ...client.list, retainedCount: 1, retainedProjects: [{ ...client.list.projects[0], associationState: "missing", resolution: "missing" }], projects: [] };
      if (restriction === "unresolved") client.list = { ...client.list, projects: [{ ...client.list.projects[0], resolution: "unresolved" }] };
      if (restriction === "unavailable") client.list = { ...client.list, state: "unavailable", projects: [{ ...client.list.projects[0], resolution: null }] };
      mount(client); await screen.findByText("  Exact 📝  ", { selector: "td span", normalizer: (value) => value });
      assert.equal(screen.queryByRole("button", { name: new RegExp(`^${t("moveCategory")}:`) }), null);
      assert.ok(screen.getByRole("button", { name: new RegExp(`^${t("editTextValue")}:`) }));
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
    assert.ok(screen.getByText("Portfolio")); assert.equal(client.text, "  Independent\nТекст  ");
  });
}
