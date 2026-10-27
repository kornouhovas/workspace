// @ts-expect-error Explicit archive arrangement fixture has no declarations.
import {archiveProjectFixture} from "./support/archived-project-fixture.mjs";
import { findAction } from "./context-tools-driver.js";
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
const { cleanup, fireEvent, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { DiscoveryWorkspace } = await import("../src/renderer/components/DiscoveryPanel.js");
const { ViewsPanel } = await import("../src/renderer/components/ViewsPanel.js");
const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
test("switching views does not insert a loading message above existing tabs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-switch-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delayed = false;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === "workspace.listViews" && delayed) await new Promise<void>(resolve => setTimeout(resolve, 500));
    return /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={client} workspaceId={workspaceId} language="en" disabled={false} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Board", selected: true }); delayed = true;
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await waitFor(() => assert.equal(screen.getByRole("region", { name: "Views" }).getAttribute("aria-busy"), "true"));
    assert.equal(screen.queryByText(translate("en", "viewsLoading")), null);
    await screen.findByRole("tab", { name: "Table", selected: true });
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("view switch must not expose a hidden column before its layout loads", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-hidden-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  const propertyId = service.handleCommand({ type: "workspace.createProperty", workspaceId, name: "Secret", propertyType: "text" }).value.propertyId;
  assert.equal(service.handleCommand({ type: "workspace.setTableLayout", workspaceId, viewId: workspace.viewId, config: { columns: [{ propertyId, hidden: true, width: 224, wrap: true }], rowOrder: [] } }).ok, true);
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delayed = false, delayedRequests = 0;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string}) => {
    if (input.type === "workspace.getTableLayout" && delayed) { delayedRequests++; await new Promise<void>(resolve => setTimeout(resolve, 700)); }
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    const notices: string[] = [];
    const observer = new MutationObserver(() => { const table = screen.queryByRole("table"); if (table && within(table).queryByRole("columnheader", { name: /Secret/ })) notices.push("hidden-column-visible"); });
    observer.observe(document.body, { childList: true, subtree: true });
    delayed = true; await user.click(screen.getByRole("tab", { name: "Table" }));
    await within(await screen.findByRole("table", {}, { timeout: 4000 })).findByText("Project");
    observer.disconnect();
    assert.deepEqual(notices, []); assert.ok(delayedRequests > 0);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("slow view selection keeps the previous view until the new filtered presentation is ready", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-surface-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  service.handleCommand({ type: "workspace.setViewFilter", workspaceId, viewId: workspace.viewId, config: { search: "missing", rules: [] } });
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delay = false, requests = 0;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string;viewId?:string}) => {
    if (input.type === "workspace.queryView" && input.viewId === workspace.viewId && delay) { requests++; await new Promise<void>(resolve => setTimeout(resolve, 700)); }
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={client} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    delay = true; await user.click(screen.getByRole("tab", { name: "Table" }));
    await waitFor(() => assert.ok(requests > 0));
    assert.equal(screen.getByRole("tab", { name: "Board" }).getAttribute("aria-selected"), "true");
    assert.equal((screen.getByRole("button", { name: "Archived" }) as HTMLButtonElement).disabled, true);
    assert.ok(within(screen.getByRole("list", { name: "Project cards" })).getByText("Project"));
    await screen.findByRole("tab", { name: "Table", selected: true }, { timeout: 4000 });
    await screen.findByText(translate("en", "filterEmpty"));
    assert.equal(within(screen.getByRole("table")).queryByText("Project") === null, true);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("a second slow switch retains the current rows until the target is ready", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-second-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  const boardId = service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" }).value.activeViewId;
  let delay = false;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string;viewId?:string}) => {
    if ((input.type === "workspace.queryView" && (input.viewId === boardId || input.viewId === workspace.viewId) || input.type === "workspace.getTableLayout" && input.viewId === workspace.viewId) && delay) await new Promise<void>(resolve => setTimeout(resolve, 500));
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await within(await screen.findByRole("table")).findByText("Project");
    const gaps: string[] = [];
    const observer = new MutationObserver(() => {
      const tableTab = screen.queryByRole("tab", { name: "Table", selected: true });
      if (tableTab && !screen.queryByRole("button", { name: "Preview project: Project" })) gaps.push("missing row");
      if (tableTab && screen.queryByText(translate("en", "filterLoading"))) gaps.push("filter loading");
      if (tableTab && screen.queryByText(translate("en", "tableLoading"))) gaps.push("layout loading");
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    delay = true; await user.click(screen.getByRole("tab", { name: "Board" }));
    await screen.findByRole("tab", { name: "Board", selected: true }, { timeout: 4000 });
    observer.disconnect(); assert.deepEqual(gaps, []);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("view changes received during a final list read are reloaded", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-list-race-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let activated = false, inject = true;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === "workspace.activateView") activated = true;
    if (input.type === "workspace.listViews" && activated && inject) {
      inject = false; const stale = service.handleQuery(input);
      service.handleCommand({ type: "workspace.renameView", workspaceId, viewId: workspace.viewId, name: "Renamed" });
      return stale;
    }
    return /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Board", selected: true });
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await screen.findByRole("tab", { name: "Renamed", selected: true });
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("a filter changed during activation is not lost after view preparation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-race-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let inject = true;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string}) => {
    if (input.type === "workspace.activateView" && inject) { inject = false; service.handleCommand({ type: "workspace.setViewFilter", workspaceId, viewId: workspace.viewId, config: { search: "missing", rules: [] } }); }
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await screen.findByRole("tab", { name: "Table", selected: true });
    await screen.findByText(translate("en", "filterEmpty"));
    assert.equal(within(screen.getByRole("table")).queryByText("Project") === null, true);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("a filter changed during the final view reload is not lost", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-race-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let inject = true, activated = false;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string}) => {
    if (input.type === "workspace.activateView") activated = true;
    if (input.type === "workspace.listViews" && activated && inject) { inject = false; service.handleCommand({ type: "workspace.setViewFilter", workspaceId, viewId: workspace.viewId, config: { search: "missing", rules: [] } }); }
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    await user.click(screen.getByRole("tab", { name: "Table" }));
    await screen.findByRole("tab", { name: "Table", selected: true });
    await screen.findByText(translate("en", "filterEmpty"));
    assert.equal(within(screen.getByRole("table")).queryByText("Project") === null, true);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("archived view preparation freezes archive mode and retains its current rows", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-archived-wait-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  const projectId = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects[0].projectId;
  archiveProjectFixture(join(directory, "workspace.sqlite"), workspaceId, projectId);
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delay = false, requested = false;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string;viewId?:string;archived?:boolean}) => {
    if (input.type === "workspace.queryView" && input.viewId === workspace.viewId && input.archived && delay) { requested = true; await new Promise<void>(resolve => setTimeout(resolve, 500)); }
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await screen.findByRole("tab", { name: "Board", selected: true }); await user.click(screen.getByRole("button", { name: "Archived" }));
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    delay = true; await user.click(screen.getByRole("tab", { name: "Table" })); await waitFor(() => assert.equal(requested, true));
    assert.equal((screen.getByRole("button", { name: "Active" }) as HTMLButtonElement).disabled, true);
    assert.equal(screen.getByRole("tab", { name: "Board" }).getAttribute("aria-selected"), "true");
    assert.ok(within(screen.getByRole("list", { name: "Project cards" })).getByText("Project"));
    await screen.findByRole("tab", { name: "Table", selected: true }, { timeout: 4000 });
    await within(await screen.findByRole("table")).findByText("Project");
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("preparing a view makes the expanded project area inert until the transition completes", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-project-wait-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delay = false, release: (() => void) | undefined;
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string;viewId?:string}) => {
    if (input.type === "workspace.queryView" && input.viewId === workspace.viewId && delay) await new Promise<void>(resolve => { release = resolve; });
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await user.click(await screen.findByRole("button", { name: "Preview project: Project" }));
    await user.click(await screen.findByRole("button", { name: "Expand project" }));
    delay = true; await user.click(screen.getByRole("tab", { name: "Table" }));
    await waitFor(() => assert.ok(release));
    assert.equal(screen.getByRole("region", { name: "Project: Project" }).closest(".project-host")?.hasAttribute("inert"), true);
    delay = false; release?.(); await screen.findByRole("tab", { name: "Table", selected: true }, { timeout: 4000 });
  } finally { release?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("unmount during preparation releases subscriptions and ignores the late response", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-unmount-")), root = join(directory, "root"); mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value, workspaceId = workspace.workspaceId;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken });
  service.handleCommand({ type: "workspace.createView", workspaceId, name: "Board", kind: "board" });
  let delay = false, release: (() => void) | undefined;
  const subscriptions = new Set<() => void>();
  const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string;viewId?:string}) => {
    if (input.type === "workspace.queryView" && input.viewId === workspace.viewId && delay) await new Promise<void>(resolve => { release = resolve; });
    return /workspace\.(list|get|preview|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: (listener: (...args: never[]) => void) => { const unsubscribe = service.workspaces.subscribe(listener); const stop = () => { subscriptions.delete(stop); unsubscribe(); }; subscriptions.add(stop); return stop; } } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    const rendered = render(<DiscoveryWorkspace client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={workspace.sourceId} language="en" disabled={false} />);
    await within(await screen.findByRole("list", { name: "Project cards" })).findByText("Project");
    delay = true; await user.click(screen.getByRole("tab", { name: "Table" })); await waitFor(() => assert.ok(release));
    rendered.unmount(); assert.equal(subscriptions.size, 0); release?.();
    await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(subscriptions.size, 0);
    assert.equal(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.activeViewId, service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.find((view: {name:string}) => view.name === "Board").viewId);
  } finally { release?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("a failed reload after preparation retains the view load error", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-reload-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  let ready = false, failLoad = false;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === "workspace.listViews" && failLoad) return { ok: false, error: { code: "storage", message: "Unavailable" } };
    return /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} onPrepareView={async () => ready} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Table" });
    await user.click(screen.getByRole("button", { name: /^View actions/ })); await user.click(screen.getByRole("menuitem", { name: "Duplicate view" }));
    await user.type(screen.getByLabelText("View name"), " copy{Enter}");
    await screen.findByText(translate("en", "viewPrepareError"));
    ready = true; failLoad = true; await user.click(screen.getByRole("button", { name: "Reload views" }));
    await screen.findByText(translate("en", "viewsError"));
    assert.equal((screen.getByRole("button", { name: "New view" }) as HTMLButtonElement).disabled, true);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("failed preparation after duplication cannot repeat a committed copy", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-copy-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  const api = { workspace: async (input: {type:string}) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  let ready = false;
  const user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} onPrepareView={async () => ready} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Table" });
    await user.click(screen.getByRole("button", { name: /^View actions/ })); await user.click(screen.getByRole("menuitem", { name: "Duplicate view" }));
    const name = screen.getByLabelText("View name"); await user.clear(name); await user.type(name, "Copy{Enter}");
    await screen.findByText(translate("en", "viewPrepareError"));
    assert.equal(screen.queryByLabelText("View name") === null, true);
    assert.deepEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.map((view: {name:string}) => view.name), ["Table", "Copy"]);
    ready = true; await user.click(screen.getByRole("button", { name: "Reload views" }));
    await waitFor(() => assert.equal(screen.queryByText(translate("en", "viewPrepareError")) === null, true));
    assert.deepEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.map((view: {name:string}) => view.name), ["Table", "Copy"]);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("creating a view returns from an expanded project to the new view", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-project-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  const api = { workspace: async (input: {type:string}) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  let selected = 0;
  const user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} projectActive onSelectView={() => { selected++; }} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Table" });
    await user.click(screen.getByRole("button", { name: "New view" }));
    await user.click(screen.getByRole("menuitem", { name: "Board" }));
    await screen.findByRole("tab", { name: "Board" });
    assert.equal(selected, 1);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("dragging across an overflowing tab strip scrolls towards off-screen views", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-overflow-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  for (const name of ["One", "Two", "Three"]) service.handleCommand({ type: "workspace.createView", workspaceId, name, kind: "board" });
  const api = { workspace: async (input: {type:string}) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Three" });
    const tabs = screen.getAllByRole("tab"), list = screen.getByRole("tablist");
    list.getBoundingClientRect = () => ({ left: 0, right: 200, width: 200 } as DOMRect);
    Object.defineProperty(list, "clientWidth", { configurable: true, value: 200 });
    Object.defineProperty(list, "scrollWidth", { configurable: true, value: 400 });
    tabs.forEach((tab, index) => { tab.getBoundingClientRect = () => ({ left: index * 100 - list.scrollLeft, width: 100 } as DOMRect); });
    fireEvent.pointerDown(tabs[0], { button: 0, clientX: 50, pointerId: 1 });
    fireEvent.pointerMove(tabs[0], { clientX: 195, pointerId: 1 });
    await waitFor(() => assert.ok(list.scrollLeft > 0));
    fireEvent.pointerUp(tabs[0], { clientX: 195, pointerId: 1 });
    await waitFor(() => assert.notEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views[0].name, "Table"));
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("new view menu immediately creates a Board", async () => {
  const directory = mkdtempSync(join(tmpdir(), "view-menu-")), root = join(directory, "root"); mkdirSync(root);
  const service = openSettingsService(join(directory, "workspace.sqlite"));
  const workspaceId = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value.workspaceId;
  const api = { workspace: async (input: {type:string}) => /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document });
  try {
    render(<ViewsPanel client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} language="en" disabled={false} onChange={() => {}} />);
    await screen.findByRole("tab", { name: "Table" });
    await user.click(screen.getByRole("button", { name: "New view" }));
    await user.click(screen.getByRole("menuitem", { name: "Board" }));
    await screen.findByRole("tab", { name: "Board", selected: true });
    assert.equal(screen.queryByLabelText("View name"), null);
    const contextTab = screen.getByRole("tab", { name: "Table" });
    await user.pointer({ keys: "[MouseRight]", target: contextTab });
    await user.keyboard("{Escape}");
    assert.equal(document.activeElement === contextTab, true);
    await user.pointer({ keys: "[MouseRight]", target: contextTab });
    await user.click(screen.getByRole("menuitem", { name: "Edit view" }));
    assert.equal((screen.getByLabelText("View name") as HTMLInputElement).value, "Table");
    await user.keyboard("{Escape}");
    const board = screen.getByRole("tab", { name: "Board" }), table = screen.getByRole("tab", { name: "Table" });
    (table.parentElement as HTMLElement).style.columnGap = "2px";
    table.getBoundingClientRect = () => ({ left: 0, width: 100 } as DOMRect);
    board.getBoundingClientRect = () => ({ left: 102, width: 100 } as DOMRect);
    fireEvent.pointerDown(board, { button: 0, clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 25, clientY: 500, pointerId: 1 });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(board, { clientX: 25, clientY: 500, pointerId: 1 });
    assert.deepEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.map((view: { name: string }) => view.name), ["Table", "Board"]);
    fireEvent.pointerDown(board, { button: 0, clientX: 150, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 25, clientY: 500, pointerId: 1 });
    assert.equal(board.style.transform, "translateX(-125px)");
    assert.equal(table.style.transform, "translateX(102px)");
    fireEvent.pointerUp(board, { clientX: 25, clientY: 500, pointerId: 1 });
    await waitFor(() => assert.deepEqual(service.handleQuery({ type: "workspace.listViews", workspaceId }).value.views.map((view: { name: string }) => view.name), ["Board", "Table"]));
    await user.click(screen.getByRole("button", { name: "New view" }));
    await user.click(screen.getByRole("menuitem", { name: "Board" }));
    await waitFor(() => assert.equal(screen.getAllByRole("tab", { name: "Board" }).length, 2));
    assert.equal(screen.getAllByRole("tab", { name: "Board", selected: true }).length, 1);
    assert.equal(screen.queryByLabelText("View name") === null, true);
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});

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
      await user.click(screen.getByRole("menuitem", { name: t("boardViewTitle") }));
      await screen.findByRole("tab", { name: "Board", selected: true });
      await user.click(actions); await user.click(screen.getByRole("menuitem", { name: t("viewEdit") }));
      await user.clear(screen.getByLabelText(t("viewName"))); await user.type(screen.getByLabelText(t("viewName")), "Review{Enter}");
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
  archiveProjectFixture(join(directory,"workspace.sqlite"),workspaceId,projectId);
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
    await user.click(await findAction("button", { name: t("filterClear") }));
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
    await user.type(await findAction("searchbox", { name: t("filterSearch") }), "missing{Enter}");
    await within(archivedRegion).findByText(t("filterEmpty"));
    assert.equal(within(archivedRegion).queryByText("Archived project") === null, true);
    assert.equal(within(archivedRegion).queryByText(new RegExp(t("archiveOriginal"))) === null, true);
    await user.click(await findAction("button", { name: t("filterClear") }));
    await within(screen.getByRole("list", { name: t("boardProjects") })).findByText("Archived project");
    await user.click(screen.getByRole("button", { name: t("archiveActive") }));
    await within(await screen.findByRole("list", { name: t("boardProjects") })).findByText("Active project");
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});
