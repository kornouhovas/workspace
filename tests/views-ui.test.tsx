import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node, MutationObserver: browser.MutationObserver, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser), NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement, ResizeObserver: browser.ResizeObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { DiscoveryWorkspace } = await import("../src/renderer/components/DiscoveryPanel.js");
const { ViewsPanel } = await import("../src/renderer/components/ViewsPanel.js");
const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) {
  test(`${language} keyboard creates and duplicates Board views and edits independent layout settings`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "views-ui-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const workspaceId = workspace.workspaceId;
    const api = { workspace: async (input: { type: string }) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input),
      onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document }), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      render(<ViewsPanel client={client} workspaceId={workspaceId} language={language} disabled={false} onChange={() => {}} />);
      await screen.findByRole("tab", { name: "Table" });
      const actions = screen.getByRole("button", { name: /^(View actions|Действия с представлением):/ });
      actions.focus(); await user.keyboard("{Enter}");
      assert.equal((screen.getByRole("menuitem", { name: t("viewDelete") }) as HTMLElement).getAttribute("aria-disabled"), "true");
      await user.keyboard("{Escape}"); assert.equal(document.activeElement === actions, true);
      screen.getByRole("button", { name: t("viewCreate") }).focus(); await user.keyboard("{Enter}");
      await user.type(screen.getByLabelText(t("viewName")), "Review");
      await user.selectOptions(screen.getByLabelText(t("viewLayout")), "board"); await user.keyboard("{Tab}{Enter}");
      await waitFor(() => assert.equal(screen.getByRole("tab", { selected: true }).textContent, "Review"));
      // Creation restores New view; reorder must restore its own menu trigger.
      await user.click(actions); await user.click(screen.getByRole("menuitem", { name: t("viewEarlier") }));
      await waitFor(() => assert.deepEqual(screen.getAllByRole("tab").map(tab => tab.textContent), ["Review", "Table"]));
      await waitFor(() => assert.equal(document.activeElement === actions, true));
      await user.keyboard("{Enter}"); await user.click(screen.getByRole("menuitem", { name: t("viewLater") }));
      await waitFor(() => assert.deepEqual(screen.getAllByRole("tab").map(tab => tab.textContent), ["Table", "Review"]));
      await waitFor(() => assert.equal(document.activeElement === actions, true));
      await user.click(screen.getByRole("button", { name: /^(?:View actions|Действия с представлением)/ })); await user.click(screen.getByRole("menuitem", { name: t("viewDuplicate") }));
      const name = screen.getByLabelText(t("viewName")); await user.clear(name); await user.type(name, "Copy{Enter}");
      await screen.findByRole("tab", { name: "Copy" });
      await user.click(screen.getByRole("button", { name: /^(?:View actions|Действия с представлением)/ })); await user.click(screen.getByRole("menuitem", { name: t("viewEdit") }));
      await user.selectOptions(screen.getByLabelText(t("viewLayout")), "table"); await user.keyboard("{Tab}{Enter}");
      await waitFor(() => assert.deepEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.map((v: {name:string;kind:string}) => [v.name, v.kind]), [["Table", "table"], ["Review", "board"], ["Copy", "table"]]));
      await user.click(screen.getByRole("button", { name: /^(?:View actions|Действия с представлением)/ })); await user.click(screen.getByRole("menuitem", { name: t("viewEarlier") }));
      await waitFor(() => assert.deepEqual(screen.getAllByRole("tab").map(o => o.textContent), ["Table", "Copy", "Review"]));
      await user.click(screen.getByRole("button", { name: /^(?:View actions|Действия с представлением)/ })); await user.click(screen.getByRole("menuitem", { name: t("viewDelete") }));
      await user.click(screen.getByRole("button", { name: t("viewConfirmDelete") }));
      await waitFor(() => assert.equal(screen.queryByRole("tab", { name: "Copy" }), null));
      screen.getByRole("tab", { name: "Table" }).focus();
      await user.keyboard("{ArrowRight}{Enter}");
      await waitFor(() => assert.equal(screen.getByRole("tab", { name: "Review" }).getAttribute("aria-selected"), "true"));
      await waitFor(() => assert.equal(document.activeElement, screen.getByRole("tab", { name: "Review" })));
      await user.keyboard("{ArrowLeft}{Enter}");
      await waitFor(() => assert.equal(document.activeElement, screen.getByRole("tab", { name: "Table", selected: true })));
      await user.keyboard("{ArrowRight}{Enter}");
      await waitFor(() => assert.equal(document.activeElement, screen.getByRole("tab", { name: "Review", selected: true })));
      await user.click(screen.getByRole("button", { name: /^(?:View actions|Действия с представлением)/ })); await user.click(screen.getByRole("menuitem", { name: t("viewEdit") })); await user.keyboard("{Escape}");
      assert.equal(screen.queryByLabelText(t("viewName")), null);
      assert.match(document.activeElement?.getAttribute("aria-label") ?? "", /View actions|Действия с представлением/);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}

for (const language of ["en", "ru"] as const) {
  test(`${language} Board and Table display all source fields and edit the same values across sibling workspaces`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "board-fields-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Category")); mkdirSync(join(root, "Category", "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
    const sibling = service.handleCommand({ type: "workspace.create", rootPath: root, name: "Sibling" }).value;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }).value;
    const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value;
    const command = (type: string, rest: object) => service.handleCommand({ type: `workspace.${type}`, workspaceId, ...rest });
    for (const [propertyType, type, field, value] of [["text", "setTextValue", "value", "Exact notes"], ["number", "setNumberValue", "expression", "42"], ["date", "setDateValue", "value", "2024-02-29"]]) {
      const propertyId = command("createProperty", { name: propertyType, propertyType }).value.propertyId;
      command(type, { propertyId, projectId: projects.projects[0].projectId, [field]: value });
    }
    for (const propertyType of ["single_select", "multi_select"]) {
      const propertyId = command("createProperty", { name: propertyType, propertyType }).value.propertyId;
      const added = command("createSelectOption", { propertyId, name: `Ready ${propertyType}`, color: "blue" });
      const optionId = added.value.snapshot.selectOptions.find((o: {propertyId:string}) => o.propertyId === propertyId).optionId;
      command(propertyType === "single_select" ? "setSelectValue" : "setMultiSelectValue", { propertyId, projectId: projects.projects[0].projectId, ...(propertyType === "single_select" ? { optionId } : { optionIds: [optionId] }) });
    }
    const api = { workspace: async (input: {type:string}) => ["workspace.listTextProperties", "workspace.listViews"].includes(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
    const props = { client, workspaceId, sourceId: workspace.sourceId, projects: projects.projects, categories: projects.categories, categoryProperty: projects.categoryProperty, language, disabled: false, hideReveal: true };
    try {
      const rendered = render(<TextPropertiesTable {...props} layout="board" />);
      const board = await screen.findByRole("list", { name: translate(language, "boardProjects") });
      await within(board).findByText("Exact notes");
      assert.equal(within(board).getAllByRole("listitem").length, 1);
      for (const text of ["Project", "Category", "42", "Ready single_select", "Ready multi_select"]) assert.ok(within(board).getByText(text));
      const textId = service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.definitions[0].propertyId;
      const edit = within(board).getByRole("button", { name: `${translate(language, "editTextValue")}: Project / text` });
      edit.focus(); await user.keyboard("{Enter}");
      const editor = within(board).getByRole("textbox"); await user.clear(editor); await user.type(editor, "Changed from Board");
      await user.click(within(board).getByRole("button", { name: translate(language, "saveTextValue") }));
      await within(board).findByText("Changed from Board");
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }).value.values[0].value, "Changed from Board");
      rendered.rerender(<TextPropertiesTable {...props} layout="table" />);
      await within(screen.getByRole("table")).findByText("Changed from Board");
      service.handleCommand({ type: "workspace.setTextValue", workspaceId: sibling.workspaceId, projectId: projects.projects[0].projectId, propertyId: textId, value: "Sibling update" });
      await within(screen.getByRole("table")).findByText("Sibling update");
      rendered.rerender(<TextPropertiesTable {...props} layout="board" />);
      await within(screen.getByRole("list", { name: translate(language, "boardProjects") })).findByText("Sibling update");
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}

test('view load retry and rejected duplication retain the authored draft without exposing a partial view', async () => {
  const directory = mkdtempSync(join(tmpdir(), "views-errors-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  let failLoad = true, failCopy = true;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === "workspace.listViews" && failLoad) { failLoad = false; throw new Error("Read unavailable"); }
    if (input.type === "workspace.duplicateView" && failCopy) { failCopy = false; return { ok: false, error: { code: "storage", message: "Unavailable" } }; }
    return /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={client} workspaceId={workspaceId} language="en" disabled={false} onChange={() => {}} />);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Reload views" })); await screen.findByRole("tab", { name: "Table" });
    await user.click(screen.getByRole("button", { name: /^View actions/ })); await user.click(screen.getByRole("menuitem", { name: "Duplicate view" }));
    const name = screen.getByLabelText("View name"); await user.clear(name); await user.type(name, "Preserved draft{Enter}");
    await screen.findByText(translate("en", "viewSaveError"));
    assert.equal((screen.getByLabelText("View name") as HTMLInputElement).value, "Preserved draft");
    assert.equal(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.length, 1);
    await user.click(screen.getByRole("button", { name: "Save view" }));
    await screen.findByRole("tab", { name: "Preserved draft" });
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

for (const language of ["en", "ru"] as const) test(`${language} selected layout follows Active and Archived projects`, async () => {
  const directory = mkdtempSync(join(tmpdir(), "views-archived-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Archived project")); mkdirSync(join(root, "Active project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const request = (type: string, rest: object = {}) => /workspace\.(list|get|preview|query)/.test(type) ? service.handleQuery({ type, workspaceId, ...rest }) : service.handleCommand({ type, workspaceId, ...rest });
  const preview = request("workspace.previewDiscovery").value;
  const projectId = request("workspace.applyDiscovery", { previewToken: preview.previewToken }).value.projects.find((p: {name:string}) => p.name === "Archived project").projectId;
  const location = request("workspace.previewArchiveLocation", { relativePath: "Archive" }).value;
  request("workspace.applyArchiveLocation", { operationId: randomUUID(), previewToken: location.previewToken });
  const archive = request("workspace.previewProjectArchive", { projectId, action: "archive", name: null, createParent: false }).value;
  assert.equal(request("workspace.applyProjectArchive", { operationId: randomUUID(), previewToken: archive.previewToken }).value.operation.stage, "completed");
  const boardId = request("workspace.createView", { name: "Board", kind: "board" }).value.activeViewId;
  request("workspace.setViewFilter", { viewId: boardId, config: { search: "missing", rules: [] } });
  let failViews = true;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string}) => failViews && input.type === "workspace.listViews" ? { ok: false, error: { code: "storage", message: "unavailable" } } : /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document }), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  try {
    render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={workspace.sourceId} language={language} disabled={false} />);
    await screen.findByText(t("viewsError"));
    await user.click(screen.getByRole("button", { name: t("archiveArchived") }));
    const archiveRegion = screen.getByRole("region", { name: t("archiveTitle") });
    // Without a selected view, Archived must not bypass its saved filters.
    await user.click(screen.getByRole("button", {name:t("archiveTitle")}));
    await waitFor(() => assert.equal((screen.getByLabelText(t("archiveRestoreProject")) as HTMLSelectElement).disabled, false));
    await user.keyboard("{Escape}");
    assert.equal(within(archiveRegion).queryByRole("table") === null, true);
    assert.equal(within(archiveRegion).queryByText(new RegExp(t("archiveOriginal"))) === null, true);
    failViews = false; await user.click(screen.getByRole("button", { name: t("viewsRetry") }));
    await within(archiveRegion).findByText(t("filterEmpty"));
    assert.equal(within(archiveRegion).queryByText("Archived project") === null, true);
    await user.click(within(archiveRegion).getByRole("button", { name: t("filterClear") }));
    await within(screen.getByRole("list", { name: t("boardProjects") })).findByText("Archived project");
    await user.click(screen.getByRole("button", { name: t("archiveActive") }));
    await within(await screen.findByRole("list", { name: t("boardProjects") })).findByText("Active project");
    await user.click(screen.getByRole("button", { name: t("archiveArchived") }));
    await within(await screen.findByRole("list", { name: t("boardProjects") })).findByText("Archived project");
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await within(await screen.findByRole("table")).findByText("Archived project");
    await user.click(screen.getByRole("tab", { name: "Board" }));
    await within(await screen.findByRole("list", { name: t("boardProjects") })).findByText("Archived project");
    const archivedRegion = screen.getByRole("region", { name: t("archiveTitle") });
    await user.type(within(archivedRegion).getByLabelText(t("filterSearch")), "missing{Enter}");
    await within(archivedRegion).findByText(t("filterEmpty"));
    assert.equal(within(archivedRegion).queryByText("Archived project") === null, true);
    assert.equal(within(archivedRegion).queryByText(new RegExp(t("archiveOriginal"))) === null, true);
    await user.click(within(archivedRegion).getByRole("button", { name: t("filterClear") }));
    await within(screen.getByRole("list", { name: t("boardProjects") })).findByText("Archived project");
    await user.click(screen.getByRole("button", { name: t("archiveActive") }));
    await within(await screen.findByRole("list", { name: t("boardProjects") })).findByText("Active project");
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});
