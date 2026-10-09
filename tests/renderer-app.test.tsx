import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import type { BackendStatus, WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../src/contracts/desktop-api.js";
import type { ServiceResult, Settings } from "../src/contracts/settings.js";
import type { ActiveWorkspace, WorkspaceLoad } from "../src/contracts/workspaces.js";
import { App } from "../src/renderer/App.js";
import { translate } from "../src/renderer/localization.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  HTMLElement: browser.HTMLElement,
  Node: browser.Node,
  MutationObserver: browser.MutationObserver,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });

const { act, cleanup, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

const ok = <T,>(value: T): ServiceResult<T> => ({ ok: true, value });
const fail = <T,>(code: "invalid_input" | "filesystem" | "storage" | "service_unavailable"): ServiceResult<T> => ({
  ok: false,
  error: { code, message: "private service detail" },
});
const settings = (language: "en" | "ru" = "en") => ok<Settings>({ language });
const makeActive = (workspaceId: string, name: string, root = "/Projects/Work") : ActiveWorkspace => ({
  workspaceId,
  sourceId: `source-${workspaceId}`,
  canonicalRoot: root,
  viewId: `view-${workspaceId}`,
  name,
  sourceAvailable: true,
});
const emptyLoad = (): WorkspaceLoad => ({ workspaces: [], activeWorkspace: null });

interface MockOptions {
  language?: "en" | "ru";
  load?: ServiceResult<WorkspaceLoad>;
  settingsResult?: ServiceResult<Settings>;
  picker?: WorkspaceDesktopApi["pickRoot"];
  onWorkspace?: (input: WorkspaceRequest) => Promise<ServiceResult<WorkspaceResponse>>;
  onSettings?: WorkspaceDesktopApi["settings"];
  backend?: "ready" | "unavailable";
}

function mockApi(options: MockOptions = {}) {
  cleanup();
  let statusListener: ((status: BackendStatus) => void) | undefined;
  const onSettings = options.onSettings ?? (async (input) => input.type === "settings.load"
    ? options.settingsResult ?? settings(options.language ?? "en")
    : settings(input.language));
  const onWorkspace = options.onWorkspace ?? (async (input) => input.type === "workspace.load"
    ? options.load ?? ok(emptyLoad())
    : fail("invalid_input"));
  window.workspace = {
    getBackendStatus: async () => ({ state: options.backend ?? "ready" }),
    onBackendStatus: (listener) => {
      statusListener = listener;
      return () => { statusListener = undefined; };
    },
    settings: onSettings,
    workspace: onWorkspace as WorkspaceDesktopApi["workspace"],
    pickRoot: options.picker ?? (async () => ({ outcome: "cancelled" })),
  };
  return { emitStatus: (nextState: BackendStatus["state"]) => statusListener?.({ state: nextState }) };
}

test("loads English settings and preserves the language only after a successful save", async () => {
  const calls: string[] = [];
  let finishSave: ((result: ServiceResult<Settings>) => void) | undefined;
  const pendingSave = new Promise<ServiceResult<Settings>>((resolve) => { finishSave = resolve; });
  mockApi({ onSettings: async (input) => {
    calls.push(input.type);
    return input.type === "settings.load" ? settings() : pendingSave;
  } });

  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Interface language" });
  assert.equal((selector as HTMLSelectElement).value, "en");
  assert.equal(document.documentElement.lang, "en");
  await userEvent.tab();
  assert.equal(document.activeElement, selector);
  await userEvent.selectOptions(selector, "ru");
  assert.equal((selector as HTMLSelectElement).value, "en");
  assert.equal((selector as HTMLSelectElement).disabled, true);
  await act(async () => { finishSave?.(settings("ru")); await pendingSave; });
  await waitFor(() => assert.equal((selector as HTMLSelectElement).value, "ru"));
  assert.equal(document.documentElement.lang, "ru");
  assert.deepEqual(calls, ["settings.load", "settings.setLanguage"]);
  assert.ok(screen.getByRole("heading", { name: "Создать рабочее пространство" }));
  cleanup();
});

test("shows a keyboard-operable create form and displays selected paths verbatim", async () => {
  const selectedPath = "/Volumes/Projects/  Team & Work  ";
  mockApi({ picker: async () => ({ outcome: "selected", path: selectedPath }) });
  render(<App />);
  const nameInput = await screen.findByRole("textbox", { name: "Workspace name" });
  await userEvent.type(nameInput, "  My workspace  ");
  await userEvent.tab();
  const picker = screen.getByRole("button", { name: "Choose project folder" });
  assert.equal(document.activeElement, picker);
  await userEvent.keyboard("{Enter}");
  const displayedPath = screen.getByText((_content, element) => element?.classList.contains("selected-root__path") ?? false);
  assert.equal(displayedPath.textContent, selectedPath);
  assert.equal((nameInput as HTMLInputElement).value, "  My workspace  ");
  cleanup();
});

test("picker cancellation is actionable and never sends a create command", async () => {
  let createCalls = 0;
  mockApi({
    picker: async () => ({ outcome: "cancelled" }),
    onWorkspace: async (input) => {
      if (input.type === "workspace.create") createCalls++;
      return input.type === "workspace.load" ? ok(emptyLoad()) : fail("invalid_input");
    },
  });
  render(<App />);
  await screen.findByRole("textbox", { name: "Workspace name" });
  await userEvent.click(screen.getByRole("button", { name: "Choose project folder" }));
  assert.ok(await screen.findByRole("heading", { name: "Folder selection cancelled" }));
  assert.equal(createCalls, 0);
  cleanup();
});

test("validates blank names and keeps the form usable", async () => {
  let createCalls = 0;
  mockApi({
    picker: async () => ({ outcome: "selected", path: "/tmp/real-root" }),
    onWorkspace: async (input) => {
      if (input.type === "workspace.create") createCalls++;
      return input.type === "workspace.load" ? ok(emptyLoad()) : fail("invalid_input");
    },
  });
  render(<App />);
  await screen.findByRole("textbox", { name: "Workspace name" });
  await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  assert.ok(await screen.findByRole("heading", { name: "Check the workspace details" }));
  assert.equal(createCalls, 0);
  assert.ok(screen.getByRole("button", { name: "Create workspace" }));
  cleanup();
});

test("reports inaccessible roots in Russian without exposing service details", async () => {
  mockApi({
    language: "ru",
    picker: async () => ({ outcome: "selected", path: "/private/source" }),
    onWorkspace: async (input) => input.type === "workspace.load"
      ? ok(emptyLoad())
      : fail("filesystem"),
  });
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Название рабочего пространства" });
  await userEvent.type(name, "Мои проекты");
  await userEvent.click(screen.getByRole("button", { name: "Выбрать папку проекта" }));
  await userEvent.click(screen.getByRole("button", { name: "Создать рабочее пространство" }));
  assert.ok(await screen.findByRole("heading", { name: "Нет доступа к папке" }));
  assert.equal(screen.queryByText("private service detail"), null);
  assert.ok(screen.getByRole("button", { name: "Создать рабочее пространство" }));
  assert.equal((name as HTMLInputElement).value, "Мои проекты");
  cleanup();
});

test("failed storage create does not render a saved workspace", async () => {
  mockApi({
    picker: async () => ({ outcome: "selected", path: "/tmp/work" }),
    onWorkspace: async (input) => input.type === "workspace.load"
      ? ok(emptyLoad())
      : fail("storage"),
  });
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Workspace name" });
  await userEvent.type(name, "Not saved");
  await userEvent.click(screen.getByRole("button", { name: "Choose project folder" }));
  await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  assert.ok(await screen.findByRole("heading", { name: "Workspace not saved" }));
  assert.equal(screen.queryByRole("heading", { name: "Not saved" }), null);
  assert.ok(screen.getByRole("textbox", { name: "Workspace name" }));
  cleanup();
});

test("creates named workspaces and then lets the user activate either one", async () => {
  const created: ActiveWorkspace[] = [];
  mockApi({
    picker: async () => ({ outcome: "selected", path: "/tmp/Workspace Root" }),
    onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({
        workspaces: created.map((workspace) => ({ workspaceId: workspace.workspaceId, name: workspace.name })),
        activeWorkspace: created.at(-1) ?? null,
      });
      if (input.type === "workspace.create") {
        const workspace = makeActive(`workspace-${created.length + 1}`, input.name, "/tmp/Workspace Root");
        created.push(workspace);
        return ok({
          sourceId: workspace.sourceId,
          workspaceId: workspace.workspaceId,
          viewId: workspace.viewId,
          name: workspace.name,
          canonicalRoot: workspace.canonicalRoot,
        });
      }
      const workspace = created.find((item) => item.workspaceId === input.workspaceId);
      return workspace ? ok(workspace) : fail("invalid_input");
    },
  });
  render(<App />);
  const firstName = await screen.findByRole("textbox", { name: "Workspace name" });
  await userEvent.type(firstName, "  Alpha  ");
  await userEvent.click(screen.getByRole("button", { name: "Choose project folder" }));
  await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  await waitFor(() => assert.equal(document.querySelector("#workspace-title")?.textContent, "  Alpha  "));

  await userEvent.click(screen.getByRole("button", { name: "Create another workspace" }));
  const secondName = screen.getByRole("textbox", { name: "Workspace name" });
  await userEvent.type(secondName, "Beta");
  await userEvent.click(screen.getByRole("button", { name: "Choose project folder" }));
  await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  await waitFor(() => assert.equal(document.querySelector("#workspace-title")?.textContent, "Beta"));

  const selector = screen.getByRole("combobox", { name: "Saved workspaces" });
  assert.equal((selector as HTMLSelectElement).options.length, 2);
  await userEvent.selectOptions(selector, "workspace-1");
  await waitFor(() => assert.equal(document.querySelector("#workspace-title")?.textContent, "  Alpha  "));
  assert.deepEqual(created.map(({ name: workspaceName }) => workspaceName), ["  Alpha  ", "Beta"]);
  cleanup();
});

test("renders the persisted active Table workspace and flags an unavailable source", async () => {
  const active = { ...makeActive("saved-id", "Saved workspace", "/Users/me/Keep  Verbatim"), sourceAvailable: false };
  mockApi({
    language: "ru",
    load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
  });
  render(<App />);
  assert.ok(await screen.findByRole("heading", { name: "Saved workspace" }));
  assert.equal(screen.getByText((_content, element) => element?.classList.contains("workspace-root") ?? false).textContent, "/Users/me/Keep  Verbatim");
  assert.ok(screen.getByRole("heading", { name: "Таблица" }));
  assert.ok(screen.getByText(/Поиск проектов появится/));
  assert.ok(screen.getByRole("heading", { name: "Папка проекта недоступна" }));
  cleanup();
});

test("activates another saved workspace from the selector", async () => {
  const first = makeActive("one", "First", "/Projects/A");
  const second = makeActive("two", "Second", "/Projects/B");
  const calls: string[] = [];
  mockApi({
    load: ok({
      workspaces: [{ workspaceId: first.workspaceId, name: first.name }, { workspaceId: second.workspaceId, name: second.name }],
      activeWorkspace: first,
    }),
    onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [
        { workspaceId: first.workspaceId, name: first.name }, { workspaceId: second.workspaceId, name: second.name },
      ], activeWorkspace: first });
      if (input.type === "workspace.activate") {
        calls.push(input.workspaceId);
        return ok(second);
      }
      return fail("invalid_input");
    },
  });
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Saved workspaces" });
  await userEvent.selectOptions(selector, "two");
  await waitFor(() => assert.equal(screen.getByRole("heading", { name: "Second" }).textContent, "Second"));
  assert.deepEqual(calls, ["two"]);
  assert.equal(screen.getByText("/Projects/B").textContent, "/Projects/B");
  cleanup();
});

test("shows startup and load errors instead of leaving the screen in loading", async () => {
  mockApi({ backend: "unavailable" });
  render(<App />);
  assert.ok(await screen.findByRole("heading", { name: "Local service unavailable" }));
  cleanup();

  mockApi({ load: fail("storage") });
  render(<App />);
  assert.ok(await screen.findByRole("heading", { name: "Workspace unavailable" }));
  assert.equal(screen.queryByText("private service detail"), null);
  cleanup();
});

test("typed client forwards settings, workspace, activation and picker requests", async () => {
  const calls: unknown[] = [];
  const active = makeActive("id", "Workspace");
  mockApi({
    onSettings: async (input) => { calls.push(input); return settings("ru"); },
    load: ok(emptyLoad()),
    picker: async () => ({ outcome: "selected", path: "/tmp/root" }),
    onWorkspace: async (input) => {
      calls.push(input);
      if (input.type === "workspace.load") return ok(emptyLoad());
      if (input.type === "workspace.activate") return ok(active);
      return ok({ sourceId: active.sourceId, workspaceId: active.workspaceId, viewId: active.viewId, name: active.name, canonicalRoot: active.canonicalRoot });
    },
  });
  const client = new WorkspaceServiceClient(window.workspace);
  assert.deepEqual(await client.loadSettings(), settings("ru"));
  assert.deepEqual(await client.loadWorkspaces(), ok(emptyLoad()));
  assert.deepEqual(await client.activateWorkspace("id"), ok(active));
  assert.deepEqual(await client.createWorkspace("Name", "/tmp/root"), ok({ sourceId: active.sourceId, workspaceId: active.workspaceId, viewId: active.viewId, name: active.name, canonicalRoot: active.canonicalRoot }));
  assert.deepEqual(await client.pickRoot(), { outcome: "selected", path: "/tmp/root" });
  assert.deepEqual(calls, [
    { type: "settings.load" },
    { type: "workspace.load" },
    { type: "workspace.activate", workspaceId: "id" },
    { type: "workspace.create", name: "Name", rootPath: "/tmp/root" },
  ]);
});

test("provides complete Russian workspace copy and English fallback for settings language names", () => {
  assert.equal(translate("ru", "workspacePermissionTitle"), "Нет доступа к папке");
  assert.equal(translate("ru", "emptyTableGuidance"), "Рабочее пространство и таблица готовы. Поиск проектов появится в одном из следующих обновлений.");
  assert.equal(translate("ru", "appTitle"), "Workspace");
});

test("narrow layout stacks the picker and workspace controls", async () => {
  const css = await readFile(new URL("../src/renderer/app.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.match(css, /\.root-picker-row,[\s\S]*?flex-direction: column/);
  assert.match(css, /overflow-wrap: anywhere/);
});
