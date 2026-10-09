import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import type { BackendStatus, WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../src/contracts/desktop-api.js";
import type { ServiceResult, Settings } from "../src/contracts/settings.js";
import type { ActiveWorkspace, WorkspaceLoad, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
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
  let changeListener: ((event: WorkspaceChangeEvent) => void) | undefined;
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
    onWorkspaceChange: (listener) => {
      changeListener = listener;
      return () => { changeListener = undefined; };
    },
    settings: onSettings,
    workspace: onWorkspace as WorkspaceDesktopApi["workspace"],
    pickRoot: options.picker ?? (async () => ({ outcome: "cancelled" })),
  };
  return { emitChange: (event: WorkspaceChangeEvent) => changeListener?.(event), emitStatus: (nextState: BackendStatus["state"]) => statusListener?.({ state: nextState }) };
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
      if (input.type !== "workspace.activate") return fail("invalid_input");
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
  assert.ok(screen.getByText(/Просмотрите папки проектов/));
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

test("reports failed workspace activation and keeps the current workspace selected", async () => {
  const first = makeActive("one", "First", "/Projects/A");
  const second = makeActive("two", "Second", "/Projects/B");
  mockApi({
    language: "ru",
    load: ok({
      workspaces: [{ workspaceId: first.workspaceId, name: first.name }, { workspaceId: second.workspaceId, name: second.name }],
      activeWorkspace: first,
    }),
    onWorkspace: async (input) => input.type === "workspace.activate" ? fail("storage") : ok({
      workspaces: [{ workspaceId: first.workspaceId, name: first.name }, { workspaceId: second.workspaceId, name: second.name }],
      activeWorkspace: first,
    }),
  });
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Сохранённые рабочие пространства" });
  await userEvent.selectOptions(selector, "two");
  assert.ok(await screen.findByRole("heading", { name: "Не удалось открыть рабочее пространство" }));
  assert.ok(screen.getByText(/Выберите его снова или перезапустите приложение/));
  assert.equal(screen.getByRole("heading", { name: "First" }).textContent, "First");
  assert.equal((selector as HTMLSelectElement).value, "one");
  assert.equal(screen.queryByText("private service detail"), null);
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
      if (input.type === "workspace.rename") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: input.name }], activeWorkspace: { ...active, name: input.name } });
      if (input.type === "workspace.remove") return ok(emptyLoad());
      return ok({ sourceId: active.sourceId, workspaceId: active.workspaceId, viewId: active.viewId, name: active.name, canonicalRoot: active.canonicalRoot });
    },
  });
  const client = new WorkspaceServiceClient(window.workspace);
  assert.deepEqual(await client.loadSettings(), settings("ru"));
  assert.deepEqual(await client.loadWorkspaces(), ok(emptyLoad()));
  assert.deepEqual(await client.activateWorkspace("id"), ok(active));
  assert.deepEqual(await client.createWorkspace("Name", "/tmp/root"), ok({ sourceId: active.sourceId, workspaceId: active.workspaceId, viewId: active.viewId, name: active.name, canonicalRoot: active.canonicalRoot }));
  assert.deepEqual(await client.renameWorkspace("id", "New name"), ok({ workspaces: [{ workspaceId: "id", name: "New name" }], activeWorkspace: { ...active, name: "New name" } }));
  assert.deepEqual(await client.removeWorkspace("id"), ok(emptyLoad()));
  assert.deepEqual(await client.pickRoot(), { outcome: "selected", path: "/tmp/root" });
  assert.deepEqual(calls, [
    { type: "settings.load" },
    { type: "workspace.load" },
    { type: "workspace.activate", workspaceId: "id" },
    { type: "workspace.create", name: "Name", rootPath: "/tmp/root" },
    { type: "workspace.rename", workspaceId: "id", name: "New name" },
    { type: "workspace.remove", workspaceId: "id" },
  ]);
});

test("provides complete Russian workspace copy and English fallback for settings language names", () => {
  assert.equal(translate("ru", "workspacePermissionTitle"), "Нет доступа к папке");
  assert.equal(translate("ru", "emptyTableGuidance"), "Рабочее пространство и таблица готовы. Просмотрите папки проектов; применение поиска появится в одном из следующих обновлений.");
  assert.equal(translate("ru", "appTitle"), "Workspace");
});

test("narrow layout stacks the picker and workspace controls", async () => {
  const css = await readFile(new URL("../src/renderer/app.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.match(css, /\.root-picker-row,[\s\S]*?flex-direction: column/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("renames through the typed client and applies the committed snapshot using keyboard submission", async () => {
  const active = makeActive("one", "Original");
  const sibling = { ...makeActive("two", "Sibling"), sourceId: active.sourceId };
  const unrelated = makeActive("three", "Different", "/Projects/Other");
  const workspaces = [active, sibling, unrelated].map(({ workspaceId, name }) => ({ workspaceId, name }));
  const calls: WorkspaceRequest[] = [];
  mockApi({ onWorkspace: async (input) => {
    calls.push(input);
    if (input.type === "workspace.load") return ok({ workspaces, activeWorkspace: active });
    if (input.type === "workspace.rename") return ok({
      workspaces: workspaces.map((item) => item.workspaceId === input.workspaceId ? { ...item, name: input.name } : item),
      activeWorkspace: { ...active, name: input.name },
    });
    return fail("invalid_input");
  } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Rename workspace" }));
  const input = screen.getByRole("textbox", { name: "Workspace name" });
  assert.equal(document.activeElement, input);
  await userEvent.clear(input);
  await userEvent.type(input, "  Authored имя  ");
  await userEvent.keyboard("{Enter}");
  await waitFor(() => assert.equal(document.querySelector("#workspace-title")?.textContent, "  Authored имя  "));
  const selector = screen.getByRole("combobox", { name: "Saved workspaces" }) as HTMLSelectElement;
  assert.deepEqual(Array.from(selector.options, (option) => option.textContent), ["  Authored имя  ", "Sibling", "Different"]);
  assert.equal(selector.value, active.workspaceId);
  assert.deepEqual(calls, [{ type: "workspace.load" }, { type: "workspace.rename", workspaceId: active.workspaceId, name: "  Authored имя  " }]);
  assert.equal(screen.queryByRole("textbox"), null);
  cleanup();
});

test("Russian rename supports cancel and blank validation without sending a command", async () => {
  const active = makeActive("one", "Original");
  let renameCalls = 0;
  mockApi({ language: "ru", onWorkspace: async (input) => {
    if (input.type === "workspace.rename") renameCalls++;
    return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
  } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Переименовать рабочее пространство" }));
  const input = screen.getByRole("textbox", { name: "Название рабочего пространства" });
  await userEvent.clear(input);
  await userEvent.type(input, "   ");
  await userEvent.keyboard("{Enter}");
  assert.ok(await screen.findByText("Введите непустое название рабочего пространства."));
  assert.equal(renameCalls, 0);
  await userEvent.keyboard("{Escape}");
  assert.equal(screen.queryByRole("textbox"), null);
  assert.equal(document.activeElement, screen.getByRole("button", { name: "Переименовать рабочее пространство" }));
  await userEvent.click(screen.getByRole("button", { name: "Переименовать рабочее пространство" }));
  await userEvent.type(screen.getByRole("textbox"), " changed");
  await userEvent.click(screen.getByRole("button", { name: "Отмена" }));
  assert.ok(screen.getByRole("heading", { name: "Original" }));
  assert.equal(renameCalls, 0);
  cleanup();
});

test("pending and failed rename preserve the actual name and entered draft and allow retry", async () => {
  const active = makeActive("one", "Actual");
  const snapshot = { workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active };
  let finish: ((result: ServiceResult<WorkspaceLoad>) => void) | undefined;
  const pending = new Promise<ServiceResult<WorkspaceLoad>>((resolve) => { finish = resolve; });
  let renameCalls = 0;
  mockApi({ onWorkspace: async (input) => {
    if (input.type === "workspace.load") return ok(snapshot);
    if (input.type === "workspace.rename") {
      renameCalls++;
      return renameCalls === 1 ? pending : ok({ workspaces: [{ workspaceId: active.workspaceId, name: input.name }], activeWorkspace: { ...active, name: input.name } });
    }
    return fail("invalid_input");
  } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Rename workspace" }));
  const input = screen.getByRole("textbox");
  await userEvent.clear(input);
  await userEvent.type(input, "Draft");
  await userEvent.click(screen.getByRole("button", { name: "Save name" }));
  assert.equal((screen.getByRole("button", { name: "Saving name…" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("combobox", { name: "Saved workspaces" }) as HTMLSelectElement).disabled, true);
  assert.equal((input as HTMLInputElement).disabled, true);
  assert.ok(screen.getByRole("heading", { name: "Actual" }));
  await act(async () => { finish?.(fail("storage")); await pending; });
  assert.ok(await screen.findByRole("heading", { name: "Name not saved" }));
  assert.equal((input as HTMLInputElement).value, "Draft");
  assert.ok(screen.getByRole("heading", { name: "Actual" }));
  assert.equal(screen.queryByText("private service detail"), null);
  await userEvent.click(screen.getByRole("button", { name: "Save name" }));
  assert.ok(await screen.findByRole("heading", { name: "Draft" }));
  assert.equal(renameCalls, 2);
  cleanup();
});

test("rename reports unavailable transport and stale targets in both languages", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const failure of ["invalid_input", "service_unavailable", "throw"] as const) {
      const active = makeActive("one", "Actual");
      mockApi({ language, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (failure === "throw") throw new Error("channel closed");
        return fail(failure);
      } });
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: translate(language, "renameWorkspaceAction") }));
      const input = screen.getByRole("textbox");
      await userEvent.clear(input);
      await userEvent.type(input, "Draft");
      await userEvent.keyboard("{Enter}");
      assert.ok(await screen.findByRole("heading", { name: translate(language, "renameErrorTitle") }));
      assert.ok(screen.getByRole("heading", { name: "Actual" }));
      assert.equal((input as HTMLInputElement).value, "Draft");
      cleanup();
    }
  }
});

test("reorder is localized, keyboard operable and preserves focus and active workspace using committed order", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("two", "Two");
    let data: WorkspaceLoad = { workspaces: [{ workspaceId: "one", name: "One" }, { workspaceId: "two", name: "Two" }, { workspaceId: "three", name: "Three" }], activeWorkspace: active };
    const calls: WorkspaceRequest[] = [];
    mockApi({ language, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(data);
      calls.push(input);
      if (input.type !== "workspace.reorder") return fail("invalid_input");
      data = { ...data, workspaces: input.workspaceIds.map((id) => data.workspaces.find((row) => row.workspaceId === id)!) };
      return ok(data);
    } });
    render(<App />);
    const label = (key: "moveWorkspaceUp" | "moveWorkspaceDown", name: string) => `${translate(language, key)}: ${name}`;
    const up = await screen.findByRole("button", { name: label("moveWorkspaceUp", "Two") });
    assert.equal((screen.getByRole("button", { name: label("moveWorkspaceUp", "One") }) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: label("moveWorkspaceDown", "Three") }) as HTMLButtonElement).disabled, true);
    // Reach the reorder control using native tab navigation, then submit with Enter.
    for (let step = 0; document.activeElement !== up && step < 15; step++) await userEvent.tab();
    assert.equal(document.activeElement, up);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => assert.deepEqual(calls[0], { type: "workspace.reorder", workspaceIds: ["two", "one", "three"] }));
    const down = screen.getByRole("button", { name: label("moveWorkspaceDown", "Two") });
    await waitFor(() => assert.equal(document.activeElement, down));
    assert.equal((up as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).value, "two");
    assert.deepEqual(Array.from((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).options).map((option) => option.value), ["two", "one", "three"]);
    await userEvent.keyboard(" ");
    await waitFor(() => assert.equal(calls.length, 2));
    await waitFor(() => assert.equal(document.activeElement, down));
    assert.deepEqual(calls[1], { type: "workspace.reorder", workspaceIds: ["one", "two", "three"] });
    assert.ok(screen.getByRole("heading", { name: "Two" }));
    cleanup();
  }
});

test("reorder disables conflicting controls while pending and failures preserve the actual order", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const failure of ["storage", "invalid_input", "service_unavailable", "throw"] as const) {
      const active = makeActive("two", "Two");
      const data: WorkspaceLoad = { workspaces: [{ workspaceId: "one", name: "One" }, { workspaceId: "two", name: "Two" }], activeWorkspace: active };
      let finish: ((result: ServiceResult<WorkspaceLoad>) => void) | undefined;
      const pending = new Promise<ServiceResult<WorkspaceLoad>>((resolve) => { finish = resolve; });
      let calls = 0;
      mockApi({ language, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(data);
        calls++;
        const result = await pending;
        if (failure === "throw") throw new Error("closed");
        return result;
      } });
      render(<App />);
      const up = await screen.findByRole("button", { name: `${translate(language, "moveWorkspaceUp")}: Two` });
      await userEvent.click(up);
      assert.equal((up as HTMLButtonElement).disabled, true);
      assert.equal((screen.getByRole("button", { name: translate(language, "renameWorkspaceAction") }) as HTMLButtonElement).disabled, true);
      assert.equal((screen.getByRole("button", { name: translate(language, "addWorkspaceAction") }) as HTMLButtonElement).disabled, true);
      assert.equal((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).disabled, true);
      assert.ok(screen.getByRole("status"));
      await act(async () => { finish?.(fail(failure === "throw" ? "storage" : failure)); await pending; });
      assert.ok(await screen.findByRole("heading", { name: translate(language, "reorderErrorTitle") }));
      assert.equal(screen.queryByText("private service detail"), null);
      assert.deepEqual(Array.from((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).options).map((option) => option.value), ["one", "two"]);
      assert.equal(document.activeElement, up);
      assert.equal(calls, 1);
      cleanup();
    }
  }
});

test("removal confirmation names the configuration, explains retention and restores focus on cancel in EN/RU", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("one", "  Authored имя  ");
    let commands = 0;
    mockApi({ language, onWorkspace: async (input) => {
      if (input.type !== "workspace.load") commands++;
      return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
    } });
    render(<App />);
    const remove = await screen.findByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: ${active.name.trim()}` });
    await userEvent.click(remove);
    assert.ok(screen.getByRole("form", { name: `${translate(language, "removeWorkspaceTitle")}: ${active.name.trim()}` }));
    assert.ok(screen.getByText(translate(language, "removeWorkspaceDescription")));
    assert.equal(document.activeElement, screen.getByRole("button", { name: translate(language, "cancelRemoveWorkspace") }));
    await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("form"), null);
    assert.equal(document.activeElement, remove);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");
    assert.equal(screen.queryByRole("form"), null);
    assert.equal(document.activeElement, remove);
    assert.equal(commands, 0);
    cleanup();
  }
});

test("keyboard removal applies committed inactive, active and final snapshots and recovers focus", async () => {
  for (const language of ["en", "ru"] as const) {
    const one = makeActive("one", "One");
    const sibling = { ...makeActive("two", "Sibling"), sourceId: one.sourceId };
    const other = makeActive("three", "Other", "/Projects/Other");
    let data: WorkspaceLoad = { workspaces: [one, sibling, other].map(({ workspaceId, name }) => ({ workspaceId, name })), activeWorkspace: other };
    const calls: WorkspaceRequest[] = [];
    mockApi({ language, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(data);
      calls.push(input);
      if (input.type !== "workspace.remove") return fail("invalid_input");
      const workspaces = data.workspaces.filter((workspace) => workspace.workspaceId !== input.workspaceId);
      data = { workspaces, activeWorkspace: input.workspaceId === data.activeWorkspace?.workspaceId ? (workspaces.length ? sibling : null) : data.activeWorkspace };
      return ok(data);
    } });
    render(<App />);
    for (const target of [one, other, sibling]) {
      const remove = await screen.findByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: ${target.name}` });
      remove.focus();
      await userEvent.keyboard("{Enter}");
      assert.ok(screen.getByRole("button", { name: translate(language, "cancelRemoveWorkspace") }));
      await userEvent.tab();
      assert.equal(document.activeElement, screen.getByRole("button", { name: translate(language, "confirmRemoveWorkspace") }));
      await userEvent.keyboard("{Enter}");
      await waitFor(() => assert.equal(screen.queryByRole("form"), null));
      assert.equal(screen.queryByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: ${target.name}` }), null);
      if (data.activeWorkspace) {
        assert.equal(document.querySelector("#workspace-title")?.textContent, data.activeWorkspace.name);
        assert.equal((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).value, data.activeWorkspace.workspaceId);
        assert.equal(document.activeElement, screen.getByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: Sibling` }));
      } else {
        assert.ok(screen.getByRole("heading", { name: translate(language, "createWorkspaceTitle") }));
        assert.equal(document.activeElement, screen.getByRole("textbox", { name: translate(language, "workspaceNameLabel") }));
        assert.equal(screen.queryByRole("combobox", { name: translate(language, "workspaceSelectLabel") }), null);
      }
    }
    assert.deepEqual(calls, [one, other, sibling].map(({ workspaceId }) => ({ type: "workspace.remove", workspaceId })));
    cleanup();
  }
});

test("pending and failed removal retain selection, confirmation and list and permit retry in both languages", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const failure of ["storage", "invalid_input", "service_unavailable", "throw"] as const) {
      const active = makeActive("one", "Actual");
      const data: WorkspaceLoad = { workspaces: [{ workspaceId: "one", name: "Actual" }, { workspaceId: "two", name: "Sibling" }], activeWorkspace: active };
      let finish: ((result: ServiceResult<WorkspaceLoad>) => void) | undefined;
      const pending = new Promise<ServiceResult<WorkspaceLoad>>((resolve) => { finish = resolve; });
      let calls = 0;
      mockApi({ language, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(data);
        calls++;
        if (calls > 1) return ok({ workspaces: [{ workspaceId: "two", name: "Sibling" }], activeWorkspace: makeActive("two", "Sibling") });
        const result = await pending;
        if (failure === "throw") throw new Error("closed");
        return result;
      } });
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: Actual` }));
      await userEvent.click(screen.getByRole("button", { name: translate(language, "confirmRemoveWorkspace") }));
      assert.equal((screen.getByRole("button", { name: translate(language, "removingWorkspace") }) as HTMLButtonElement).disabled, true);
      for (const label of ["cancelRemoveWorkspace", "renameWorkspaceAction", "addWorkspaceAction"] as const) {
        assert.equal((screen.getByRole("button", { name: translate(language, label) }) as HTMLButtonElement).disabled, true);
      }
      assert.equal((screen.getByRole("button", { name: `${translate(language, "moveWorkspaceDown")}: Actual` }) as HTMLButtonElement).disabled, true);
      assert.equal((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).disabled, true);
      await userEvent.keyboard("{Escape}");
      assert.ok(screen.getByRole("form"));
      await act(async () => { finish?.(fail(failure === "throw" ? "storage" : failure)); await pending; });
      assert.ok(await screen.findByRole("heading", { name: translate(language, "removeErrorTitle") }));
      assert.ok(screen.getByText(translate(language, failure === "invalid_input" ? "removeStaleDescription" : "removeErrorDescription")));
      assert.equal(document.querySelector("#workspace-title")?.textContent, "Actual");
      assert.deepEqual(Array.from((screen.getByRole("combobox", { name: translate(language, "workspaceSelectLabel") }) as HTMLSelectElement).options, (option) => option.value), ["one", "two"]);
      assert.equal(screen.queryByText("private service detail"), null);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "confirmRemoveWorkspace") }));
      await waitFor(() => assert.equal(document.querySelector("#workspace-title")?.textContent, "Sibling"));
      assert.equal(calls, 2);
      cleanup();
    }
  }
});

const eventWorkspace = (name: string, sourceId: string = crypto.randomUUID()): ActiveWorkspace => ({
  workspaceId: crypto.randomUUID(), sourceId, viewId: crypto.randomUUID(),
  name, canonicalRoot: "/Projects/" + name, sourceAvailable: true,
});
const snapshotOf = (active: ActiveWorkspace | null, workspaces = active ? [active] : []): WorkspaceLoad => ({
  workspaces: workspaces.map(({ workspaceId, name }) => ({ workspaceId, name })), activeWorkspace: active,
});
const sourceEvent = (active: ActiveWorkspace, workspaceIds = [active.workspaceId], sourceAvailable = false): WorkspaceChangeEvent => ({
  type: "workspace.sourceChanged",
  source: { sourceId: active.sourceId, canonicalRoot: active.canonicalRoot, workspaceIds, sourceAvailable },
});

test("source notifications affect only referencing workspaces and client rejects malformed events and unsubscribes", async () => {
  const one = eventWorkspace("First");
  const two = eventWorkspace("Sibling", one.sourceId);
  const other = eventWorkspace("Other");
  const mock = mockApi({ load: ok(snapshotOf(one, [one, two, other])) });
  render(<App />);
  await screen.findByRole("heading", { name: "First" });
  await act(async () => {
    mock.emitChange(sourceEvent(other));
    mock.emitChange({ type: "workspace.sourceChanged", source: { sourceId: one.sourceId } } as WorkspaceChangeEvent);
    mock.emitChange(sourceEvent(one, [two.workspaceId]));
  });
  assert.equal(screen.queryByRole("heading", { name: "Project folder unavailable" }), null);
  await act(async () => { mock.emitChange(sourceEvent(one, [one.workspaceId, two.workspaceId])); });
  assert.ok(screen.getByRole("button", { name: "Retry folder access" }));
  await act(async () => {
    mock.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(two, [one, two, other]) });
    mock.emitChange(sourceEvent(two, [one.workspaceId, two.workspaceId], false));
  });
  assert.ok(screen.getByRole("heading", { name: "Sibling" }));
  assert.ok(screen.getByRole("heading", { name: "Project folder unavailable" }));
  await act(async () => { mock.emitChange(sourceEvent(two, [one.workspaceId, two.workspaceId], true)); });
  assert.equal(screen.queryByRole("heading", { name: "Project folder unavailable" }), null);
  cleanup();

  const client = new WorkspaceServiceClient();
  let count = 0;
  const unsubscribe = client.onWorkspaceChange(() => { count++; });
  mock.emitChange(sourceEvent(one));
  assert.equal(count, 1);
  unsubscribe();
  mock.emitChange(sourceEvent(one));
  assert.equal(count, 1);
});

test("retry folder access supports EN/RU keyboard, pending, failure and recovered states", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = { ...eventWorkspace("Offline"), sourceAvailable: false };
    let resolveRefresh: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let calls = 0;
    const mock = mockApi({
      language,
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active));
        assert.equal(input.type, "workspace.refreshSource");
        if (input.type === "workspace.refreshSource") assert.equal(input.workspaceId, active.workspaceId);
        calls++;
        return new Promise((resolve) => { resolveRefresh = resolve; });
      },
    });
    render(<App />);
    const retry = await screen.findByRole("button", { name: translate(language, "retrySourceAction") });
    retry.focus();
    await userEvent.keyboard("{Enter}");
    assert.ok(screen.getByRole("button", { name: translate(language, "refreshingSource") }).hasAttribute("disabled"));
    assert.equal(calls, 1);
    await act(async () => { resolveRefresh?.(fail("service_unavailable")); });
    assert.ok(screen.getByRole("heading", { name: translate(language, "refreshSourceErrorTitle") }));
    assert.ok(screen.getByRole("heading", { name: translate(language, "sourceUnavailableTitle") }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "retrySourceAction") }));
    await act(async () => {
      const event = sourceEvent(active, [active.workspaceId], true);
      mock.emitChange(event);
      if (event.type === "workspace.sourceChanged") resolveRefresh?.(ok(event.source));
    });
    assert.equal(screen.queryByRole("heading", { name: translate(language, "sourceUnavailableTitle") }), null);
    assert.equal(screen.queryByRole("heading", { name: translate(language, "refreshSourceErrorTitle") }), null);
    cleanup();
  }
});

test("delayed initial loads and activation responses cannot restore removed or previously active workspaces", async () => {
  const one = eventWorkspace("Old");
  const two = eventWorkspace("Current");
  let resolveLoad: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
  let resolveActivate: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
  const mock = mockApi({
    onWorkspace: async (input) => new Promise((resolve) => {
      if (input.type === "workspace.load") resolveLoad = resolve;
      if (input.type === "workspace.activate") resolveActivate = resolve;
    }),
  });
  render(<App />);
  await waitFor(() => assert.ok(resolveLoad));
  await act(async () => {
    mock.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(two, [one, two]) });
    resolveLoad?.(ok(snapshotOf(one, [one, two])));
  });
  assert.ok(await screen.findByRole("heading", { name: "Current" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Saved workspaces" }), one.workspaceId);
  await act(async () => {
    mock.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(two) });
    resolveActivate?.(ok(one));
  });
  assert.ok(screen.getByRole("heading", { name: "Current" }));
  assert.equal(screen.queryByRole("heading", { name: "Old" }), null);
  await act(async () => { mock.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(null) }); });
  assert.ok(screen.getByRole("heading", { name: "Create a workspace" }));
  cleanup();
});

test("source observations arriving before initial load apply without a reload loop", async () => {
  const one = eventWorkspace("Late");
  let resolveLoad: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
  let loads = 0;
  const mock = mockApi({
    onWorkspace: async (input) => {
      assert.equal(input.type, "workspace.load");
      loads++;
      return new Promise((resolve) => { resolveLoad = resolve; });
    },
  });
  render(<App />);
  await waitFor(() => assert.ok(resolveLoad));
  await act(async () => {
    mock.emitChange(sourceEvent(one));
    resolveLoad?.(ok(snapshotOf(one)));
  });
  assert.ok(await screen.findByRole("heading", { name: "Project folder unavailable" }));
  assert.equal(loads, 1);
  cleanup();
});

test("a delayed retry result cannot restore a removed configuration or overwrite newer source observations", async () => {
  const one = { ...eventWorkspace("Offline"), sourceAvailable: false };
  const other = eventWorkspace("Other");
  let resolveRefresh: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
  const mock = mockApi({
    onWorkspace: async (input) => input.type === "workspace.load" ? ok(snapshotOf(one)) :
      new Promise((resolve) => { resolveRefresh = resolve; }),
  });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Retry folder access" }));
  await act(async () => {
    mock.emitChange(sourceEvent(other));
    mock.emitChange(sourceEvent(one, [one.workspaceId], true));
    const old = sourceEvent(one);
    if (old.type === "workspace.sourceChanged") resolveRefresh?.(ok(old.source));
  });
  assert.equal(screen.queryByRole("heading", { name: "Project folder unavailable" }), null);
  await act(async () => { mock.emitChange(sourceEvent(one)); });
  await userEvent.click(screen.getByRole("button", { name: "Retry folder access" }));
  await act(async () => {
    mock.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(null) });
    const source = sourceEvent(one, [one.workspaceId], true);
    if (source.type === "workspace.sourceChanged") resolveRefresh?.(ok(source.source));
  });
  assert.ok(screen.getByRole("heading", { name: "Create a workspace" }));
  assert.equal(screen.queryByRole("heading", { name: "Offline" }), null);
  cleanup();
});

test("long authored names and paths survive language changes and keyboard confirmation cancellation", async () => {
  const active = eventWorkspace("  " + "LongAuthoredИмя".repeat(12) + "  ");
  active.canonicalRoot = "/Projects/" + "UnbrokenPathСегмент".repeat(12);
  const sibling = eventWorkspace("Sibling", active.sourceId);
  mockApi({ load: ok(snapshotOf(active, [active, sibling])) });
  render(<App />);
  for (const language of ["en", "ru"] as const) {
    const languageSelect = await screen.findByRole("combobox", { name: /Interface language|Язык интерфейса/ });
    await userEvent.selectOptions(languageSelect, language);
    await waitFor(() => assert.equal(document.documentElement.lang, language));
    assert.equal(screen.getByRole("heading", { name: active.name.trim() }).textContent, active.name);
    assert.equal(screen.getByText(active.canonicalRoot, { exact: true }).textContent, active.canonicalRoot);
    const remove = screen.getByRole("button", { name: `${translate(language, "removeWorkspaceAction")}: ${active.name.trim()}` });
    remove.focus();
    await userEvent.keyboard("{Enter}");
    assert.ok(screen.getByRole("form", { name: `${translate(language, "removeWorkspaceTitle")}: ${active.name.trim()}` }));
    await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement, remove);
    assert.equal(screen.queryByRole("form"), null);
  }
  cleanup();
});

test("EN/RU preview requests authoritative exclusion drafts, uses keyboard controls and Cancel restores focus", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("preview-workspace", "Authored workspace");
    const calls: WorkspaceRequest[] = [];
    mockApi({ language, load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onWorkspace: async (input) => {
        calls.push(input);
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        assert.equal(input.type, "workspace.previewDiscovery");
        if (input.type !== "workspace.previewDiscovery") return fail("invalid_input");
        return ok({ workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 0,
          canonicalRoot: active.canonicalRoot, excludedRelativePaths: input.excludedRelativePaths ?? [], state: "ready" as const,
          previewToken: "opaque-preview", entries: [
            { relativePath: "  Authored project  ", name: "  Authored project  ", reason: input.excludedRelativePaths?.length ? "manual" as const : null },
            { relativePath: ".service", name: ".service", reason: "hidden" as const },
          ] });
      } });
    render(<App />);
    const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const checkbox = await screen.findByRole("checkbox", { name: /Authored project/ });
    assert.equal((screen.getByRole("checkbox", { name: /\.service/ }) as HTMLInputElement).disabled, true);
    checkbox.focus();
    await userEvent.keyboard(" ");
    await waitFor(() => assert.equal((screen.getByRole("checkbox", { name: /Authored project/ }) as HTMLInputElement).checked, true));
    await waitFor(() => assert.equal(document.activeElement, screen.getByRole("checkbox", { name: /Authored project/ })));
    assert.deepEqual(calls.filter((input) => input.type === "workspace.previewDiscovery"), [
      { type: "workspace.previewDiscovery", workspaceId: active.workspaceId },
      { type: "workspace.previewDiscovery", workspaceId: active.workspaceId, excludedRelativePaths: ["  Authored project  "] },
    ]);
    const cancel = screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") });
    cancel.focus();
    await userEvent.keyboard("{Enter}");
    assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryTitle") }), null);
    assert.equal(document.activeElement, trigger);
    assert.ok(screen.getByText(translate(language, "emptyTableDescription")));
    cleanup();
  }
});

test("preview handles pending cancellation and discards delayed responses", async () => {
  const active = makeActive("preview-workspace", "Workspace");
  let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
  mockApi({ onWorkspace: async (input) => input.type === "workspace.load"
    ? ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active })
    : new Promise((resolve) => { finish = resolve; }) });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview project folders" }));
  assert.ok(screen.getByRole("heading", { name: "Scanning project folders…" }));
  assert.equal((screen.getByRole("button", { name: "Refresh preview" }) as HTMLButtonElement).disabled, true);
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => { finish?.(fail("storage")); });
  assert.equal(screen.queryByRole("heading", { name: "Direct project preview" }), null);
  assert.equal(screen.queryByRole("alert"), null);
  cleanup();
});

test("preview exposes localized empty, unavailable, unreadable, changed and retry error states", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const [state, label] of [["empty", "discoveryEmpty"], ["unavailable", "discoveryUnavailable"],
      ["unreadable", "discoveryUnreadable"], ["root_identity_conflict", "discoveryRootConflict"], ["changed", "discoveryChanged"]] as const) {
      const active = makeActive("preview-workspace", "Workspace");
      let attempts = 0;
      mockApi({ language, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (++attempts === 1) return fail("storage");
        return ok({ workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 0, canonicalRoot: active.canonicalRoot,
          excludedRelativePaths: [], entries: [], state, previewToken: state === "empty" ? "token" : null });
      } });
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryAction") }));
      assert.ok(await screen.findByRole("heading", { name: translate(language, "discoveryError") }));
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
      assert.ok(await screen.findByRole("heading", { name: translate(language, label) }));
      cleanup();
    }
  }
});
