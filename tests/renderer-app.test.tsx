import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import type { BackendStatus, WorkspaceDesktopApi, WorkspaceRequest, WorkspaceResponse } from "../src/contracts/desktop-api.js";
import type { ServiceResult, Settings } from "../src/contracts/settings.js";
import type { ActiveWorkspace, WorkspaceLoad, WorkspaceChangeEvent } from "../src/contracts/workspaces.js";
import { App } from "../src/renderer/App.js";
import { translate } from "../src/renderer/localization.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { TextPropertiesTable } from "../src/renderer/components/TextPropertiesTable.js";
import type { TextPropertySnapshot, TextPropertyMutation } from "../src/contracts/text-properties.js";
import { randomUUID } from "node:crypto";
import { DiscoveryPanel } from "../src/renderer/components/DiscoveryPanel.js";
import { openSettingsService } from "../src/service/settings.js";

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
const fail = <T,>(code: "invalid_input" | "filesystem" | "storage" | "service_unavailable" | "stale_preview"): ServiceResult<T> => ({
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

test("EN/RU discovery state controls require a reviewed token and respect pending/automatic exclusions", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const state of ["ready", "empty", "pending", "applying", "error", "stale"] as const) {
      cleanup();
      let applies = 0, cancels = 0;
      const pending = state === "pending" || state === "applying";
      const preview = state === "error" || state === "stale" ? null : {
        ...previewResult(makeActive("panel", "Workspace")), state: state === "empty" ? "empty" as const : "ready" as const,
        previewToken: pending ? null : "reviewed",
        entries: state === "empty" ? [] : [
          { kind: "project" as const, categoryPath: null, name: "  Authored project  ", relativePath: "  Authored project  ", reason: null },
          { kind: "project" as const, categoryPath: null, name: "External link", relativePath: "External link", reason: "link" as const },
        ],
      };
      render(<DiscoveryPanel language={language} preview={preview} pending={pending} applying={state === "applying"}
        error={state === "error"} stale={state === "stale"} onApply={() => { applies++; }} onCancel={() => { cancels++; }}
        onExclude={() => {}} onRetry={() => {}} />);
      const apply = screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement;
      const cancel = screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }) as HTMLButtonElement;
      assert.equal(apply.disabled, state !== "ready" && state !== "empty");
      assert.equal(cancel.disabled, state === "applying");
      if (preview?.entries.length) {
        const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
        assert.equal(checkboxes[0].disabled, pending);
        assert.equal(checkboxes[1].checked, true);
        assert.equal(checkboxes[1].disabled, true);
        assert.equal(screen.getByText("Authored project").textContent, "  Authored project  ");
      }
      apply.focus(); await userEvent.keyboard("{Enter}");
      assert.equal(applies, apply.disabled ? 0 : 1);
      cancel.focus(); await userEvent.keyboard("{Enter}");
      assert.equal(cancels, cancel.disabled ? 0 : 1);
    }
  }
  cleanup();
});

interface MockOptions {
  language?: "en" | "ru";
  load?: ServiceResult<WorkspaceLoad>;
  settingsResult?: ServiceResult<Settings>;
  picker?: WorkspaceDesktopApi["pickRoot"];
  onWorkspace?: (input: WorkspaceRequest) => Promise<ServiceResult<WorkspaceResponse>>;
  onProjects?: MockOptions["onWorkspace"];
  onProperties?: MockOptions["onWorkspace"];
  onSettings?: WorkspaceDesktopApi["settings"];
  backend?: "ready" | "unavailable";
}

function mockApi(options: MockOptions = {}) {
  cleanup();
  const changeListeners = new Set<(event: WorkspaceChangeEvent) => void>();
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
      changeListeners.add(listener);
      return () => { changeListeners.delete(listener); };
    },
    settings: onSettings,
    workspace: ((input: WorkspaceRequest) => input.type === "workspace.listTextProperties"
      ? options.onProperties?.(input) ?? Promise.resolve(ok({ workspaceId: input.workspaceId, sourceId: `source-${input.workspaceId}`, revision: 0, definitions: [], values: [] }))
      : input.type === "workspace.listProjects"
      ? options.onProjects?.(input) ?? Promise.resolve(ok({ workspaceId: input.workspaceId,
        sourceId: `source-${input.workspaceId}`, revision: 0, configured: false, state: "empty" as const,
        projects: [], retainedCount: 0 })) : onWorkspace(input)) as WorkspaceDesktopApi["workspace"],
    pickRoot: options.picker ?? (async () => ({ outcome: "cancelled" })),
  };
  return { changeListenerCount: () => changeListeners.size, emitChange: (event: WorkspaceChangeEvent) => changeListeners.forEach((listener) => listener(event)), emitStatus: (nextState: BackendStatus["state"]) => statusListener?.({ state: nextState }) };
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
  assert.ok(await screen.findByText(/Просмотрите папки, выберите исключения/));
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
  assert.equal(translate("ru", "emptyTableGuidance"), "Просмотрите папки, выберите исключения и примените проверенные проекты к этой таблице.");
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
          mode: "direct" as const, configured: false, previewToken: "opaque-preview", entries: [
            { kind: "project" as const, categoryPath: null, relativePath: "  Authored project  ", name: "  Authored project  ", reason: input.excludedRelativePaths?.length ? "manual" as const : null },
            { kind: "project" as const, categoryPath: null, relativePath: ".service", name: ".service", reason: "hidden" as const },
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
          excludedRelativePaths: [], entries: [], state, mode: "direct" as const, configured: false, previewToken: state === "empty" ? "token" : null });
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

const projectList = (active: ActiveWorkspace, projects: string[] = [], revision = 1) => ({
  workspaceId: active.workspaceId, sourceId: active.sourceId, revision, configured: true,
  state: (projects.length ? "ready" : "empty") as "ready" | "empty", retainedCount: 0,
  projects: projects.map((name) => ({ projectId: `project-${name}`, name, relativePath: name })),
});
const previewResult = (active: ActiveWorkspace, token = "reviewed", excludedRelativePaths: string[] = []) => ({
  workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 1, canonicalRoot: active.canonicalRoot,
  state: "ready" as const, mode: "direct" as const, configured: false, previewToken: token, excludedRelativePaths,
  entries: [{ kind: "project" as const, categoryPath: null, name: "  Authored project  ", relativePath: "  Authored project  ", reason: null }],
});

test("EN/RU grouped review uses the real service and keyboard mode/exclusion controls without configuring the source", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "workspace-grouped-ui-"));
    const root = join(directory, "root");
    for (const path of ["Category/Project/Deeper", "Empty", "DirectLooking/src"]) mkdirSync(join(root, path), { recursive: true });
    const service = openSettingsService(join(directory, "data", "workspace.sqlite"));
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root });
      if (!created.ok) throw new Error("Fixture creation failed");
      const workspaceId = created.value.workspaceId;
      const calls: WorkspaceRequest[] = [];
      mockApi({ language,
        onProjects: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
        onWorkspace: async (input) => {
          calls.push(input);
          return (input.type === "workspace.load" || input.type === "workspace.previewDiscovery"
            ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
        } });
      render(<App />);
      const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
      await userEvent.click(trigger);
      const mode = await screen.findByRole("combobox", { name: translate(language, "discoveryMode") });
      mode.focus();
      await userEvent.selectOptions(mode, "grouped");
      await screen.findByRole("heading", { name: translate(language, "discoveryGroupedTitle") });
      await waitFor(() => assert.equal(document.activeElement, mode));
      assert.ok(screen.getByText(translate(language, "discoveryGroupedDescription")));
      assert.ok(screen.getByText(translate(language, "discoveryEmptyCategory")));
      const checkbox = (kind: "discoveryCategory" | "discoveryProject", name: string) => screen.getByRole("checkbox", {
        name: `${translate(language, "discoveryExclude")}: ${translate(language, kind)}: ${name}`,
      }) as HTMLInputElement;
      assert.ok(checkbox("discoveryProject", "src"));
      assert.equal(screen.queryByText("Deeper"), null);
      assert.ok(checkbox("discoveryCategory", "Category").closest("li")?.contains(checkbox("discoveryProject", "Project")));
      assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
      const project = checkbox("discoveryProject", "Project"); project.focus();
      await userEvent.keyboard(" ");
      await waitFor(() => assert.equal(checkbox("discoveryProject", "Project").disabled, false));
      assert.equal(checkbox("discoveryProject", "Project").checked, true);
      assert.equal(document.activeElement, checkbox("discoveryProject", "Project"));
      assert.deepEqual(calls.at(-1), { type: "workspace.previewDiscovery", workspaceId, mode: "grouped", excludedRelativePaths: ["Category/Project"] });
      await userEvent.click(checkbox("discoveryCategory", "DirectLooking"));
      await waitFor(() => assert.equal(checkbox("discoveryCategory", "DirectLooking").disabled, false));
      assert.equal(screen.queryByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: ${translate(language, "discoveryProject")}: src` }), null);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }));
      assert.equal(document.activeElement, trigger);
      const list = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId });
      assert.equal(list.ok && list.value.configured, false);
      await userEvent.click(trigger);
      const restoredMode = await screen.findByRole("combobox", { name: translate(language, "discoveryMode") });
      assert.equal((restoredMode as HTMLSelectElement).value, "direct");
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryApply") }));
      await screen.findByRole("cell", { name: "Category" });
      await userEvent.click(trigger);
      await screen.findByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: Category` });
      assert.equal(screen.queryByRole("combobox", { name: translate(language, "discoveryMode") }), null);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("delayed grouped requests cannot revive cancelled, switched, removed or restarted reviews", async () => {
  for (const transition of ["cancel", "switch", "remove", "restart", "newerEvent"] as const) {
    const active = sharedEventWorkspace(); const other = eventWorkspace("Other");
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ load: ok(snapshotOf(active, [active, other])), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active, [active, other]));
      if (input.type === "workspace.previewDiscovery") return input.mode === "grouped"
        ? new Promise((resolve) => { finish = resolve; }) : ok(previewResult(active));
      return fail("invalid_input");
    } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Preview project folders" }));
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Folder interpretation" }), "grouped");
    assert.ok(screen.getByRole("heading", { name: "Scanning project folders…" }));
    if (transition === "cancel") {
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await userEvent.click(screen.getByRole("button", { name: "Preview project folders" }));
      await screen.findByRole("checkbox");
    } else if (transition === "restart") {
      await act(async () => { api.emitStatus("starting"); });
      await act(async () => { api.emitStatus("ready"); });
    } else if (transition === "newerEvent") {
      await act(async () => { api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 2 }); });
    } else {
      await act(async () => { api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(other, transition === "remove" ? [other] : [active, other]) }); });
    }
    await act(async () => { finish?.(ok({ ...previewResult(active), mode: "grouped", entries: [{ kind: "category", empty: true, name: "Late category", relativePath: "Late category", reason: null }] })); });
    assert.equal(screen.queryByRole("heading", { name: "Grouped project preview" }), null);
    assert.equal(screen.queryByText("Late category"), null);
    cleanup();
  }
});

test("EN/RU grouped selection shows pending, recoverable failure and empty review without enabling Apply", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let groupedCalls = 0;
    mockApi({ language, load: ok(snapshotOf(active)), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active));
      if (input.type === "workspace.previewDiscovery") {
        if (input.mode !== "grouped") return ok(previewResult(active));
        if (++groupedCalls === 1) return new Promise((resolve) => { finish = resolve; });
        return ok({ ...previewResult(active), mode: "grouped", state: "empty", entries: [] });
      }
      return fail("invalid_input");
    } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryAction") }));
    const mode = await screen.findByRole("combobox", { name: translate(language, "discoveryMode") });
    await userEvent.selectOptions(mode, "grouped");
    assert.equal((mode as HTMLSelectElement).disabled, true);
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryLoading") }));
    await act(async () => { finish?.(fail("storage")); });
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryError") }));
    const retry = screen.getByRole("button", { name: translate(language, "discoveryRefresh") });
    assert.equal(document.activeElement, retry);
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("heading", { name: translate(language, "discoveryGroupedTitle") });
    assert.equal(groupedCalls, 2);
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryEmpty") }));
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
    cleanup();
  }
});

test("EN/RU keyboard Apply prevents duplicate submission and displays committed names without changing Table identity", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("apply", "Workspace");
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const calls: WorkspaceRequest[] = [];
    mockApi({ language, onWorkspace: async (input) => {
      calls.push(input);
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
      if (input.type === "workspace.previewDiscovery") return ok(previewResult(active));
      if (input.type === "workspace.applyDiscovery") return new Promise((resolve) => { finish = resolve; });
      return fail("invalid_input");
    } });
    render(<App />);
    const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
    await userEvent.click(trigger);
    const apply = await screen.findByRole("button", { name: translate(language, "discoveryApply") });
    await waitFor(() => assert.equal((apply as HTMLButtonElement).disabled, false));
    apply.focus(); await userEvent.keyboard("{Enter}{Enter}");
    assert.equal((apply as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryApplying") }));
    assert.equal(calls.filter((input) => input.type === "workspace.applyDiscovery").length, 1);
    await act(async () => { finish?.(ok(projectList(active, ["  Authored project  "]))); });
    assert.equal(screen.getByRole("cell").textContent, "  Authored project  ");
    assert.ok(screen.getByRole("heading", { name: translate(language, "tableViewTitle") }));
    assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryTitle") }), null);
    assert.equal(document.activeElement, trigger);
    assert.deepEqual(calls.find((input) => input.type === "workspace.applyDiscovery"), {
      type: "workspace.applyDiscovery", workspaceId: active.workspaceId, previewToken: "reviewed",
    });
    cleanup();
  }
});

test("stale Apply refreshes the draft and requires explicit review/Apply; storage errors keep saved rows", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("stale", "Workspace");
    let previewCalls = 0;
    let applyCalls = 0;
    mockApi({ language, onProjects: async () => ok(projectList(active, ["Saved project"])), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
      if (input.type === "workspace.previewDiscovery") return ok(previewResult(active, `token-${++previewCalls}`, input.excludedRelativePaths));
      if (input.type === "workspace.applyDiscovery") {
        applyCalls++;
        assert.equal(input.previewToken, `token-${previewCalls}`);
        return applyCalls === 1 ? fail("storage") : applyCalls === 2 ? fail("stale_preview") : ok(projectList(active, ["Refreshed project"], 2));
      }
      return fail("invalid_input");
    } });
    render(<App />);
    await screen.findByRole("cell", { name: "Saved project" });
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    const apply = await screen.findByRole("button", { name: translate(language, "discoveryApply") });
    await userEvent.click(apply);
    assert.ok(await screen.findByRole("heading", { name: translate(language, "discoveryApplyError") }));
    assert.ok(screen.getByRole("cell", { name: "Saved project" }));
    await userEvent.click(apply);
    assert.ok(await screen.findByRole("heading", { name: translate(language, "discoveryStale") }));
    await waitFor(() => assert.equal(previewCalls, 2));
    assert.equal(applyCalls, 2);
    assert.equal((apply as HTMLButtonElement).disabled, false);
    assert.ok(screen.getByRole("cell", { name: "Saved project" }));
    await userEvent.click(apply);
    assert.ok(await screen.findByRole("cell", { name: "Refreshed project" }));
    assert.equal(applyCalls, 3);
    cleanup();
  }
});

test("authoritative exclusion refresh keeps checkbox mounted, invalidates Apply while pending and restores keyboard focus", async () => {
  const active = makeActive("focus", "Workspace");
  let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
  mockApi({ onWorkspace: async (input) => {
    if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
    if (input.type === "workspace.previewDiscovery") return input.excludedRelativePaths
      ? new Promise((resolve) => { finish = resolve; }) : ok(previewResult(active));
    return fail("invalid_input");
  } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview project folders" }));
  const checkbox = await screen.findByRole("checkbox");
  checkbox.focus(); await userEvent.keyboard(" ");
  assert.equal(screen.getByRole("checkbox"), checkbox);
  assert.equal((screen.getByRole("button", { name: "Apply reviewed projects" }) as HTMLButtonElement).disabled, true);
  await act(async () => { finish?.(ok({ ...previewResult(active, "new", ["  Authored project  "]),
    entries: [{ kind: "project" as const, categoryPath: null, name: "  Authored project  ", relativePath: "  Authored project  ", reason: "manual" }] })); });
  assert.equal(document.activeElement, checkbox);
  assert.equal((checkbox as HTMLInputElement).checked, true);
  assert.equal((screen.getByRole("button", { name: "Apply reviewed projects" }) as HTMLButtonElement).disabled, false);
  cleanup();
});

test("EN/RU stale draft recovery drops vanished unsaved exclusions and preserves remaining exclusions through the real service", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "workspace-draft-recovery-"));
    const root = join(directory, "root"); mkdirSync(root);
    for (const name of ["A", "B", "C"]) mkdirSync(join(root, name));
    const service = openSettingsService(join(directory, "data", "workspace.sqlite"));
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "Test", rootPath: root });
      assert.equal(created.ok, true);
      if (!created.ok) throw new Error("Fixture workspace was not created");
      const workspaceId = created.value.workspaceId;
      mockApi({ language,
        onProjects: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
        onWorkspace: async (input) => (input.type === "workspace.load" || input.type === "workspace.previewDiscovery"
          ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse> });
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryAction") }));
      const checkbox = (name: string) => screen.getByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: ${name}` });
      await screen.findByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: A` });
      await userEvent.click(checkbox("A"));
      await waitFor(() => assert.equal((checkbox("A") as HTMLInputElement).disabled, false));
      await userEvent.click(checkbox("B"));
      await waitFor(() => assert.equal((checkbox("B") as HTMLInputElement).disabled, false));
      renameSync(join(root, "A"), join(directory, "removed-A"));
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryApply") }));
      await waitFor(() => {
        assert.equal(screen.queryByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: A` }), null);
        assert.equal((checkbox("B") as HTMLInputElement).disabled, false);
      });
      assert.equal((checkbox("B") as HTMLInputElement).checked, true);
      assert.equal((checkbox("C") as HTMLInputElement).checked, false);
      assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
      const unapplied = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId });
      assert.equal(unapplied.ok, true);
      if (!unapplied.ok) throw new Error("Fixture projection could not be read");
      assert.equal(unapplied.value.configured, false);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
      await waitFor(() => assert.equal((checkbox("B") as HTMLInputElement).disabled, false));
      assert.equal((checkbox("B") as HTMLInputElement).checked, true);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryApply") }));
      assert.ok(await screen.findByRole("cell", { name: "C" }));
      const saved = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId });
      assert.equal(saved.ok, true);
      if (!saved.ok) throw new Error("Fixture preview could not be read");
      assert.deepEqual(saved.value.excludedRelativePaths, ["B"]);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("Cancel during authoritative draft recovery discards its delayed response and follow-up request", async () => {
  const active = sharedEventWorkspace();
  let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
  let baseCalls = 0, draftCalls = 0;
  mockApi({ load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
    onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
      if (input.type === "workspace.previewDiscovery") {
        if (input.excludedRelativePaths) { draftCalls++; return fail("invalid_input"); }
        return ++baseCalls === 1 ? ok(previewResult(active)) : new Promise((resolve) => { finish = resolve; });
      }
      return fail("invalid_input");
    } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview project folders" }));
  await userEvent.click(await screen.findByRole("checkbox"));
  await waitFor(() => assert.equal(baseCalls, 2));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => { finish?.(ok(previewResult(active, "late-recovery"))); });
  assert.equal(draftCalls, 1);
  assert.equal(screen.queryByRole("heading", { name: "Direct project preview" }), null);
  assert.equal(screen.queryByRole("checkbox"), null);
  cleanup();
});

test("project lists distinguish applied-empty, retained, unavailable and loading/error recovery in EN/RU", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = makeActive("list", "Workspace");
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let calls = 0;
    mockApi({ language, load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onProjects: async () => ++calls === 1 ? new Promise((resolve) => { finish = resolve; })
        : ok({ ...projectList(active), retainedCount: 2, state: "unavailable" }) });
    render(<App />);
    assert.ok(await screen.findByRole("heading", { name: translate(language, "projectsLoading") }));
    await act(async () => { finish?.(fail("storage")); });
    assert.ok(screen.getByRole("heading", { name: translate(language, "projectsError") }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    assert.ok(await screen.findByText(translate(language, "projectsEmpty")));
    assert.ok(screen.getByRole("heading", { name: translate(language, "projectsRetained") }));
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryUnavailable") }));
    cleanup();
  }
});

const sharedEventWorkspace = () => ({ ...makeActive("00000000-0000-4000-8000-000000000011", "Shared"),
  sourceId: "00000000-0000-4000-8000-000000000012" });
const projectEvent = (active: ActiveWorkspace, revision: number): WorkspaceChangeEvent => ({
  type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision,
});

test("EN/RU source notifications reject delayed rows/previews, preserve draft exclusions and require refreshed review", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let listCalls = 0, previewCalls = 0;
    let finishList: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let finishPreview: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const drafts: (string[] | undefined)[] = [];
    const api = mockApi({ language,
      load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onProjects: async () => {
        listCalls++;
        if (listCalls === 2) return new Promise((resolve) => { finishList = resolve; });
        return ok(projectList(active, [listCalls === 1 ? "Saved" : "Current"], listCalls === 1 ? 1 : 3));
      }, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type === "workspace.previewDiscovery") {
          drafts.push(input.excludedRelativePaths);
          if (++previewCalls === 2) return new Promise((resolve) => { finishPreview = resolve; });
          return ok({ ...previewResult(active, `review-${previewCalls}`, input.excludedRelativePaths), revision: previewCalls === 1 ? 1 : 3 });
        }
        return fail("invalid_input");
      } });
    render(<App />);
    await screen.findByRole("cell", { name: "Saved" });
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    const checkbox = await screen.findByRole("checkbox", { name: /Authored project/ });
    await userEvent.click(checkbox);
    await act(async () => {
      api.emitChange({ ...projectEvent(active, 2), sourceId: "00000000-0000-4000-8000-000000000099" } as WorkspaceChangeEvent);
    });
    assert.equal(listCalls, 1);
    await act(async () => { api.emitChange(projectEvent(active, 2)); });
    assert.equal(document.activeElement, screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
    assert.equal(screen.queryByRole("checkbox"), null);
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
    await act(async () => { api.emitChange(projectEvent(active, 3)); });
    await screen.findByRole("cell", { name: "Current" });
    await act(async () => {
      finishList?.(ok(projectList(active, ["Delayed old rows"], 2)));
      finishPreview?.(ok({ ...previewResult(active, "old-token"), revision: 1 }));
    });
    assert.equal(screen.queryByRole("cell", { name: "Delayed old rows" }), null);
    assert.equal(screen.queryByRole("checkbox"), null);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
    await screen.findByRole("checkbox", { name: /Authored project/ });
    assert.deepEqual(drafts.at(-1), ["  Authored project  "]);
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false);
    await act(async () => { api.emitChange(projectEvent(active, 2)); api.emitChange(projectEvent(active, 3)); });
    assert.equal(listCalls, 3);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("Apply accepts its preceding commit event but rejects a delayed result older than a sibling revision", async () => {
  for (const newerSibling of [false, true]) {
    const active = sharedEventWorkspace();
    let revision = 1;
    let finishApply: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onProjects: async () => ok(projectList(active, [revision === 1 ? "Saved" : "Latest"], revision)),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type === "workspace.previewDiscovery") return ok({ ...previewResult(active), revision });
        if (input.type === "workspace.applyDiscovery") return new Promise((resolve) => { finishApply = resolve; });
        return fail("invalid_input");
      } });
    render(<App />); await screen.findByRole("cell", { name: "Saved" });
    await userEvent.click(screen.getByRole("button", { name: "Preview project folders" }));
    await userEvent.click(await screen.findByRole("button", { name: "Apply reviewed projects" }));
    await act(async () => { revision = newerSibling ? 3 : 2; api.emitChange(projectEvent(active, revision)); });
    await screen.findByRole("cell", { name: "Latest" });
    await act(async () => { finishApply?.(ok(projectList(active, ["Applied response"], 2))); });
    if (newerSibling) {
      assert.equal(screen.queryByRole("cell", { name: "Applied response" }), null);
      assert.ok(screen.getByRole("heading", { name: translate("en", "discoveryStale") }));
      assert.equal((screen.getByRole("button", { name: "Apply reviewed projects" }) as HTMLButtonElement).disabled, true);
    } else {
      assert.ok(screen.getByRole("cell", { name: "Applied response" }));
      assert.equal(screen.queryByRole("heading", { name: "Direct project preview" }), null);
    }
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("backend restart discards old project and preview responses and reloads the shared projection", async () => {
  const active = sharedEventWorkspace();
  let listCalls = 0;
  let finishList: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
  let finishPreview: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
  const api = mockApi({ load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
    onProjects: async () => ++listCalls === 1 ? new Promise((resolve) => { finishList = resolve; }) : ok(projectList(active, ["Restarted"], 2)),
    onWorkspace: async (input) => input.type === "workspace.load"
      ? ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active })
      : new Promise((resolve) => { finishPreview = resolve; }) });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview project folders" }));
  await act(async () => { api.emitStatus("unavailable"); });
  await act(async () => { api.emitStatus("ready"); });
  await screen.findByRole("cell", { name: "Restarted" });
  await act(async () => {
    finishList?.(ok(projectList(active, ["Old process"], 1)));
    finishPreview?.(ok(previewResult(active, "expired-token")));
  });
  assert.equal(screen.queryByRole("cell", { name: "Old process" }), null);
  assert.equal(screen.queryByRole("heading", { name: "Direct project preview" }), null);
  cleanup(); assert.equal(api.changeListenerCount(), 0);
});

test("selection and removal discard delayed discovery list, preview and Apply responses", async () => {
  for (const phase of ["list", "preview", "apply"] as const) {
    for (const removed of [false, true]) {
      const active = eventWorkspace("Old discovery"), other = eventWorkspace("Current discovery");
      let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
      const api = mockApi({
        onProjects: async (input) => input.type === "workspace.listProjects" && input.workspaceId === active.workspaceId
          ? phase === "list" ? new Promise((resolve) => { finish = resolve; }) : ok(projectList(active, ["Old saved"]))
          : ok(projectList(other, ["Current saved"])),
        onWorkspace: async (input) => {
          if (input.type === "workspace.load") return ok(snapshotOf(active, [active, other]));
          if (input.type === "workspace.previewDiscovery") return phase === "preview"
            ? new Promise((resolve) => { finish = resolve; }) : ok(previewResult(active));
          if (input.type === "workspace.applyDiscovery") return new Promise((resolve) => { finish = resolve; });
          return fail("invalid_input");
        } });
      render(<App />);
      const trigger = await screen.findByRole("button", { name: "Preview project folders" });
      if (phase !== "list") {
        await screen.findByRole("cell", { name: "Old saved" });
        await userEvent.click(trigger);
        if (phase === "apply") await userEvent.click(await screen.findByRole("button", { name: "Apply reviewed projects" }));
      }
      await act(async () => { api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(other, removed ? [other] : [active, other]) }); });
      await screen.findByRole("cell", { name: "Current saved" });
      await act(async () => { finish?.(ok(phase === "preview" ? previewResult(active) : projectList(active, ["Delayed discovery"]))); });
      assert.equal(screen.queryByRole("cell", { name: "Delayed discovery" }), null);
      assert.equal(screen.queryByRole("heading", { name: "Direct project preview" }), null);
      assert.ok(screen.getByRole("heading", { name: "Current discovery" }));
      cleanup(); assert.equal(api.changeListenerCount(), 0);
    }
  }
});

test("EN/RU notification reload failures and below-revision replies recover through project Retry", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let calls = 0;
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => {
      if (++calls === 1) return ok(projectList(active, ["Saved"], 1));
      if (calls === 2) return fail("storage");
      if (calls === 3) return ok(projectList(active, ["Outdated reply"], 1));
      return ok(projectList(active, ["Recovered"], 2));
    } });
    render(<App />); await screen.findByRole("cell", { name: "Saved" });
    await act(async () => { api.emitChange(projectEvent(active, 2)); });
    await screen.findByRole("heading", { name: translate(language, "projectsError") });
    assert.ok(screen.getByRole("cell", { name: "Saved" }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    await screen.findByRole("heading", { name: translate(language, "projectsError") });
    assert.equal(screen.queryByRole("cell", { name: "Outdated reply" }), null);
    assert.ok(screen.getByRole("cell", { name: "Saved" }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    await screen.findByRole("cell", { name: "Recovered" });
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU Text definition creation and rename preserve failed drafts, keyboard cancellation, pending prevention and focus", async () => {
  for (const language of ["en", "ru"] as const) {
    cleanup();
    const workspaceId = randomUUID(), sourceId = randomUUID(), propertyId = randomUUID();
    let snapshot: TextPropertySnapshot = { workspaceId, sourceId, revision: 0, definitions: [], values: [] };
    let finish: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
    let saves = 0;
    const api = mockApi({ onProperties: async () => ok(snapshot), onWorkspace: async (request) => {
      if (request.type === "workspace.createProperty" || request.type === "workspace.renameProperty") {
        saves++; return new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finish = resolve; });
      }
      return fail("invalid_input");
    } });
    const client = new WorkspaceServiceClient(window.workspace);
    render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={[]} language={language} disabled={false} />);
    const create = await screen.findByRole("button", { name: translate(language, "createTextProperty") });
    await waitFor(() => assert.equal((create as HTMLButtonElement).disabled, false));
    create.focus(); await userEvent.keyboard("{Enter}");
    let name = screen.getByRole("textbox", { name: translate(language, "propertyName") });
    assert.equal(document.activeElement, name);
    await userEvent.type(name, "   "); await userEvent.keyboard("{Enter}");
    assert.ok(screen.getByRole("alert")); assert.equal(saves, 0);
    await userEvent.clear(name); await userEvent.type(name, "  Заметка 📝  "); await userEvent.keyboard("{Enter}{Enter}");
    assert.equal(saves, 1);
    assert.equal((name as HTMLInputElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    await act(async () => { finish?.(fail("storage")); });
    assert.equal((name as HTMLInputElement).value, "  Заметка 📝  ");
    assert.ok(screen.getByText(translate(language, "propertySaveError")));
    name.focus(); await userEvent.keyboard("{Enter}");
    snapshot = { ...snapshot, revision: 1, definitions: [{ propertyId, sourceId, propertyType: "text", name: "  Заметка 📝  " }] };
    await act(async () => {
      api.emitChange({ type: "workspace.propertiesChanged", sourceId, workspaceIds: [workspaceId], revision: 1 });
      finish?.(ok({ snapshot, propertyId, projectId: null }));
    });
    assert.ok(await screen.findByText(translate(language, "propertySaved")));
    assert.equal(document.activeElement, create);
    const renameButton = screen.getByRole("button", { name: `${translate(language, "renameProperty")}: ${snapshot.definitions[0].name.trim()}` });
    assert.equal(screen.getByText("Заметка 📝").textContent, "  Заметка 📝  ");
    renameButton.focus(); await userEvent.keyboard("{Enter}");
    name = screen.getByRole("textbox", { name: translate(language, "propertyName") });
    await userEvent.clear(name); await userEvent.type(name, "Cancelled"); await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement, renameButton); assert.equal(saves, 2);
    await userEvent.click(renameButton); name = screen.getByRole("textbox", { name: translate(language, "propertyName") });
    await userEvent.clear(name); await userEvent.type(name, "  新しい имя  "); await userEvent.keyboard("{Enter}");
    await act(async () => { finish?.(fail("service_unavailable")); });
    assert.equal((name as HTMLInputElement).value, "  新しい имя  ");
    name.focus(); await userEvent.keyboard("{Enter}");
    snapshot = { ...snapshot, revision: 2, definitions: [{ ...snapshot.definitions[0], name: "  新しい имя  " }] };
    await act(async () => { finish?.(ok({ snapshot, propertyId, projectId: null })); });
    assert.equal(screen.getByText("新しい имя").textContent, "  新しい имя  ");
    assert.equal(document.activeElement, screen.getByRole("button", { name: `${translate(language, "renameProperty")}: ${snapshot.definitions[0].name.trim()}` }));
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("Text property lists and saves reject older revisions and responses after workspace/source replacement", async () => {
  const workspaceId = randomUUID(), sourceId = randomUUID(), propertyId = randomUUID();
  const snapshot = (revision: number, name: string): TextPropertySnapshot => ({ workspaceId, sourceId, revision, definitions: [{ sourceId, propertyId, name, propertyType: "text" }], values: [] });
  const lists: ((result: ServiceResult<TextPropertySnapshot>) => void)[] = [];
  let finishSave: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
  const api = mockApi({ onProperties: async () => new Promise<ServiceResult<TextPropertySnapshot>>((resolve) => lists.push(resolve)),
    onWorkspace: async () => new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finishSave = resolve; }) });
  const client = new WorkspaceServiceClient(window.workspace);
  const props = { client, workspaceId, sourceId, projects: [], language: "en" as const, disabled: false };
  const rendered = render(<TextPropertiesTable {...props} />);
  await act(async () => { lists[0](ok(snapshot(1, "Original"))); });
  await userEvent.click(screen.getByRole("button", { name: "Rename property: Original" }));
  await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), "Own"); await userEvent.keyboard("{Enter}");
  await act(async () => {
    api.emitChange({ type: "workspace.propertiesChanged", sourceId, workspaceIds: [workspaceId], revision: 2 });
    api.emitChange({ type: "workspace.propertiesChanged", sourceId, workspaceIds: [workspaceId], revision: 3 });
  });
  await act(async () => { lists[2](ok(snapshot(3, "Sibling"))); lists[1](ok(snapshot(2, "Own"))); finishSave?.(ok({ snapshot: snapshot(2, "Own"), propertyId, projectId: null })); });
  assert.ok(screen.getByRole("button", { name: "Rename property: Sibling" }));
  assert.equal(screen.queryByRole("button", { name: "Rename property: Own" }), null);
  assert.ok(screen.getByText(translate("en", "propertyNewerChange")));
  await userEvent.click(screen.getByRole("button", { name: "Rename property: Sibling" }));
  await userEvent.keyboard("{Enter}");
  const next = { ...props, workspaceId: randomUUID(), sourceId: randomUUID() };
  rendered.rerender(<TextPropertiesTable {...next} />);
  await act(async () => { finishSave?.(ok({ snapshot: snapshot(4, "Old workspace"), propertyId, projectId: null })); lists[3](ok({ ...snapshot(0, "New workspace"), workspaceId: next.workspaceId, sourceId: next.sourceId })); });
  assert.equal(screen.queryByText("Old workspace"), null);
  assert.ok(screen.getByText("New workspace"));
  cleanup(); assert.equal(api.changeListenerCount(), 0);
});

test("EN/RU default Table creates and renames source-owned Text definitions through real SQLite and the typed client", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "text-table-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    try {
      const created = service.workspaces.create({ type: "workspace.create", rootPath: root, name: "Real workspace" });
      assert.equal(created.ok, true); if (!created.ok) throw new Error("Fixture failed");
      const sibling = service.workspaces.create({ type: "workspace.create", rootPath: root, name: "Sibling" });
      assert.equal(sibling.ok, true); if (!sibling.ok) throw new Error("Fixture failed");
      service.workspaces.activate({ type: "workspace.activate", workspaceId: created.value.workspaceId });
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: created.value.workspaceId });
      assert.equal(preview.ok, true); if (!preview.ok) throw new Error("Fixture failed");
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: created.value.workspaceId, previewToken: preview.value.previewToken }).ok, true);
      const api = mockApi({ language,
        onProperties: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
        onProjects: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
        onWorkspace: async (input) => (input.type === "workspace.load" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>,
      });
      const unsubscribe = service.workspaces.subscribe(api.emitChange);
      render(<App />);
      const create = await screen.findByRole("button", { name: translate(language, "createTextProperty") });
      await waitFor(() => assert.equal((create as HTMLButtonElement).disabled, false));
      await userEvent.click(create); await userEvent.type(screen.getByRole("textbox", { name: translate(language, "propertyName") }), "  Real Text  "); await userEvent.keyboard("{Enter}");
      const rename = await screen.findByRole("button", { name: `${translate(language, "renameProperty")}: Real Text` });
      assert.ok(screen.getByRole("cell", { name: "Project" }));
      await userEvent.click(rename); await userEvent.clear(screen.getByRole("textbox", { name: translate(language, "propertyName") }));
      await userEvent.type(screen.getByRole("textbox", { name: translate(language, "propertyName") }), "  Общее имя  "); await userEvent.keyboard("{Enter}");
      await screen.findByRole("button", { name: `${translate(language, "renameProperty")}: Общее имя` });
      const shared = service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: sibling.value.workspaceId });
      assert.equal(shared.ok, true); if (!shared.ok) throw new Error("Fixture failed");
      assert.equal(shared.value.definitions[0].name, "  Общее имя  "); assert.equal(shared.value.revision, 2);
      assert.ok(screen.getByText(translate(language, "propertySaved")));
      const cellLabel = `${translate(language, "editTextValue")}: Project / Общее имя`;
      const cell = screen.getByRole("button", { name: cellLabel });
      cell.focus(); await userEvent.keyboard("{Enter}");
      await userEvent.type(screen.getByRole("textbox", { name: cellLabel }), "  Real 📝");
      await userEvent.keyboard("{Enter}"); await userEvent.type(screen.getByRole("textbox", { name: cellLabel }), "значение  ");
      await userEvent.keyboard("{Control>}{Enter}{/Control}");
      await screen.findByText(translate(language, "textValueSaved"));
      const values = service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: sibling.value.workspaceId });
      assert.equal(values.ok, true); if (!values.ok) throw new Error("Fixture failed");
      assert.equal(values.value.values[0].value, "  Real 📝\nзначение  "); assert.equal(values.value.revision, 3);
      assert.equal(cell.textContent, "  Real 📝\nзначение  ");
      await userEvent.click(cell); await userEvent.click(screen.getByRole("button", { name: translate(language, "clearTextValue") }));
      await waitFor(() => assert.equal(cell.textContent, translate(language, "textValueAbsent")));
      const cleared = service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId: sibling.value.workspaceId });
      assert.equal(cleared.ok, true); if (!cleared.ok) throw new Error("Fixture failed");
      assert.deepEqual(cleared.value.values, []); assert.equal(cleared.value.revision, 4);
      cleanup(); unsubscribe();
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU Text cells preserve failed drafts, support multiline keyboard saves, clear and restore focus", async () => {
  for (const language of ["en", "ru"] as const) {
    const workspaceId = randomUUID(), sourceId = randomUUID(), propertyId = randomUUID(), projectId = randomUUID();
    let snapshot: TextPropertySnapshot = { workspaceId, sourceId, revision: 1, definitions: [{ propertyId, sourceId, name: "Notes", propertyType: "text" }], values: [] };
    const calls: (string | null)[] = [];
    let finish: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
    let throws = false;
    mockApi({ onProperties: async () => ok(snapshot), onWorkspace: async (request) => {
      if (request.type !== "workspace.setTextValue") return fail("invalid_input");
      calls.push(request.value);
      if (throws) throw new Error("Transport unavailable");
      return new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finish = resolve; });
    } });
    render(<TextPropertiesTable client={new WorkspaceServiceClient()} workspaceId={workspaceId} sourceId={sourceId}
      projects={[{ projectId, name: "Project", relativePath: "Project" }]} language={language} disabled={false} />);
    const label = `${translate(language, "editTextValue")}: Project / Notes`;
    const cell = await screen.findByRole("button", { name: label });
    assert.equal(cell.textContent, translate(language, "textValueAbsent"));
    cell.focus(); await userEvent.keyboard("{Enter}");
    const editor = screen.getByRole("textbox", { name: label });
    assert.equal(document.activeElement === editor, true);
    await userEvent.type(editor, "  日本語 📝"); await userEvent.keyboard("{Enter}"); await userEvent.type(editor, "Строка  ");
    assert.deepEqual(calls, []);
    await userEvent.click(screen.getByRole("cell", { name: "Project" })); assert.deepEqual(calls, [], "blur must not save");
    editor.focus(); await userEvent.keyboard("{Control>}{Enter}{/Control}");
    assert.deepEqual(calls, ["  日本語 📝\nСтрока  "]);
    assert.equal((editor as HTMLTextAreaElement).disabled, true);
    const cancel = screen.getByRole("button", { name: translate(language, "cancelTextValue") }) as HTMLButtonElement;
    assert.equal(cancel.disabled, true);
    assert.equal((screen.getByRole("button", { name: translate(language, "clearTextValue") }) as HTMLButtonElement).disabled, true);
    await userEvent.keyboard("{Control>}{Enter}{/Control}{Escape}"); assert.equal(calls.length, 1);
    await act(async () => { finish?.(fail("storage")); });
    await screen.findByText(translate(language, "textValueSaveError"));
    assert.equal((editor as HTMLTextAreaElement).value, "  日本語 📝\nСтрока  ");
    editor.focus(); await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await act(async () => { finish?.(fail("invalid_input")); });
    await screen.findByText(translate(language, "textValueValidation"));
    assert.equal((editor as HTMLTextAreaElement).value, "  日本語 📝\nСтрока  ");
    throws = true; await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    await screen.findByText(translate(language, "textValueSaveError"));
    throws = false;
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    snapshot = { ...snapshot, revision: 2, values: [{ projectId, propertyId, value: "  日本語 📝\nСтрока  " }] };
    await act(async () => { finish?.(ok({ snapshot, projectId, propertyId })); });
    await screen.findByText(translate(language, "textValueSaved"));
    assert.equal(document.activeElement === cell, true);
    assert.equal(cell.textContent, "  日本語 📝\nСтрока  ");
    await userEvent.click(cell); await userEvent.clear(screen.getByRole("textbox", { name: label })); await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement === cell, true); assert.equal(cell.textContent, "  日本語 📝\nСтрока  ");
    await userEvent.click(cell); await userEvent.clear(screen.getByRole("textbox", { name: label }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    assert.equal(calls.at(-1), ""); snapshot = { ...snapshot, revision: 3, values: [{ projectId, propertyId, value: "" }] };
    await act(async () => { finish?.(ok({ snapshot, projectId, propertyId })); });
    assert.equal(cell.textContent, translate(language, "textValueEmpty"));
    await userEvent.click(cell); await userEvent.click(screen.getByRole("button", { name: translate(language, "clearTextValue") }));
    assert.equal(calls.at(-1), null); snapshot = { ...snapshot, revision: 4, values: [] };
    await act(async () => { finish?.(ok({ snapshot, projectId, propertyId })); });
    assert.equal(cell.textContent, translate(language, "textValueAbsent"));
    cleanup();
  }
});

function textFixture() {
  const workspaceId = randomUUID(), sourceId = randomUUID(), propertyId = randomUUID(), projectId = randomUUID();
  const snapshot = (revision: number, value: string | null = "Original", name = "Notes"): TextPropertySnapshot => ({
    workspaceId, sourceId, revision, definitions: [{ propertyId, sourceId, name, propertyType: "text" }],
    values: value === null ? [] : [{ projectId, propertyId, value }],
  });
  return { workspaceId, sourceId, propertyId, projectId, snapshot,
    projects: [{ projectId, sourceId, name: "Project", relativePath: "Project" }] };
}

test("backend generations discard old source observations and preserve newer events over delayed reloads", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const batched of [false, true]) {
      for (const newerEvent of [false, true]) {
        const f = textFixture(), active = { ...makeActive(f.workspaceId, "Workspace"), sourceId: f.sourceId };
        const data = { workspaces: [{ workspaceId: f.workspaceId, name: active.name }], activeWorkspace: active };
        let loads = 0;
        let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
        const api = mockApi({ language, onProperties: async () => ok(f.snapshot(1)), onWorkspace: async (input) => {
          if (input.type !== "workspace.load") return fail("invalid_input");
          return ++loads === 1 ? ok(data) : new Promise((resolve) => { finish = resolve; });
        } });
        render(<App />);
        await screen.findByRole("button", { name: `${translate(language, "renameProperty")}: Notes` });
        const sourceEvent = (root: string): WorkspaceChangeEvent => ({ type: "workspace.sourceChanged", source: {
          sourceId: f.sourceId, workspaceIds: [f.workspaceId], canonicalRoot: root, sourceAvailable: false,
        } });
        await act(async () => api.emitChange(sourceEvent("/Old-generation")));
        await screen.findByText(translate(language, "sourceUnavailableTitle"));
        if (batched) await act(async () => { api.emitStatus("unavailable"); api.emitStatus("ready"); });
        else { await act(async () => api.emitStatus("unavailable")); await act(async () => api.emitStatus("ready")); }
        await waitFor(() => assert.equal(loads, 2));
        if (newerEvent) await act(async () => api.emitChange(sourceEvent("/New-generation")));
        await act(async () => finish?.(ok(data)));
        await screen.findByRole("button", { name: `${translate(language, "renameProperty")}: Notes` });
        assert.equal(screen.queryByText(translate(language, "sourceUnavailableTitle")) !== null, newerEvent);
        assert.ok(screen.getByText(newerEvent ? "/New-generation" : active.canonicalRoot));
        assert.equal(screen.queryByText("/Old-generation"), null);
        cleanup();
      }
    }
  }
});

test("same-source availability and locator notifications preserve Text drafts while invalidating discovery", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const kind of ["cell", "rename"] as const) {
      const f = textFixture();
      const active = { ...makeActive(f.workspaceId, "Workspace"), sourceId: f.sourceId };
      let finishProjects: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
      let delay = false;
      const projection = { workspaceId: f.workspaceId, sourceId: f.sourceId, revision: 1,
        configured: true, state: "ready" as const, projects: f.projects, retainedCount: 0 };
      const api = mockApi({ language, load: ok({ workspaces: [{ workspaceId: f.workspaceId, name: active.name }], activeWorkspace: active }),
        onProperties: async () => ok(f.snapshot(1)),
        onProjects: async () => delay ? new Promise((resolve) => { finishProjects = resolve; }) : ok(projection),
        onWorkspace: async (input) => input.type === "workspace.load" ? ok({ workspaces: [{ workspaceId: f.workspaceId, name: active.name }], activeWorkspace: active })
          : input.type === "workspace.previewDiscovery" ? ok(previewResult(active)) : fail("invalid_input"),
      });
      render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryAction") }));
      await screen.findByRole("button", { name: translate(language, "discoveryApply") });
      await userEvent.click(screen.getByRole("button", { name: kind === "cell" ? `${translate(language, "editTextValue")}: Project / Notes` : `${translate(language, "renameProperty")}: Notes` }));
      const editor = screen.getByRole("textbox");
      await userEvent.clear(editor); await userEvent.type(editor, "  Unsaved 日本語  ");
      delay = true;
      for (const available of [false, true]) {
        await act(async () => api.emitChange({ type: "workspace.sourceChanged", source: {
          sourceId: f.sourceId, workspaceIds: [f.workspaceId], canonicalRoot: "/Projects/New spelling", sourceAvailable: available,
        } }));
        assert.equal(screen.getByRole("textbox") === editor, true, "Source observation remounted the editor");
        assert.equal((editor as HTMLInputElement).value, "  Unsaved 日本語  ");
        assert.equal(screen.queryByRole("button", { name: translate(language, "discoveryApply") }), null);
        await act(async () => finishProjects?.(ok({ ...projection, state: available ? "ready" : "unavailable" })));
        assert.equal(screen.getByRole("textbox") === editor, true, "Project reload discarded the editor");
      }
      editor.focus(); await userEvent.keyboard("{Escape}");
      await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: Project / Notes` });
      cleanup();
    }
  }
});

test("EN/RU failed project refreshes preserve recoverable Text drafts through errors, stale replies and retry", async () => {
  for (const language of ["en", "ru"] as const) {
    const f = textFixture(), active = { ...makeActive(f.workspaceId, "Workspace"), sourceId: f.sourceId };
    const projection = { workspaceId: f.workspaceId, sourceId: f.sourceId, revision: 1,
      configured: true, state: "ready" as const, projects: f.projects, retainedCount: 0 };
    let phase: "initial" | "storage" | "transport" | "stale" | "retry" = "initial";
    let finish: ((value: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const saves: (string | null)[] = [];
    const api = mockApi({ language,
      onProperties: async () => ok(f.snapshot(1)),
      onProjects: async () => {
        if (phase === "storage") return fail("storage");
        if (phase === "transport") throw new Error("Disconnected transport");
        if (phase === "retry") return new Promise((resolve) => { finish = resolve; });
        return ok(projection);
      },
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: f.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type !== "workspace.setTextValue") return fail("invalid_input");
        saves.push(input.value);
        return saves.length === 1 ? fail("storage") : ok({ snapshot: f.snapshot(2, input.value), projectId: f.projectId, propertyId: f.propertyId });
      },
    });
    render(<App />);
    const label = `${translate(language, "editTextValue")}: Project / Notes`;
    await userEvent.click(await screen.findByRole("button", { name: label }));
    const editor = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.clear(editor); await userEvent.type(editor, "  Unsaved 日本語 📝  ");
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    await screen.findByText(translate(language, "textValueSaveError"));
    const assertDraft = () => {
      assert.equal(screen.queryByRole("textbox") === editor, true, "Project reload discarded a recoverable Text draft");
      assert.equal(editor.value, "  Unsaved 日本語 📝  ");
      assert.deepEqual(saves, ["  Unsaved 日本語 📝  "], "Project refresh must not replay the failed save");
    };
    phase = "storage";
    await act(async () => api.emitChange({ type: "workspace.sourceChanged", source: {
      sourceId: f.sourceId, workspaceIds: [f.workspaceId], canonicalRoot: active.canonicalRoot, sourceAvailable: false,
    } }));
    await screen.findByRole("heading", { name: translate(language, "projectsError") }); assertDraft();
    phase = "transport";
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    await screen.findByRole("heading", { name: translate(language, "projectsError") }); assertDraft();
    phase = "stale";
    await act(async () => api.emitChange(projectEvent(active, 2)));
    await screen.findByRole("heading", { name: translate(language, "projectsError") }); assertDraft();
    phase = "retry";
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    await screen.findByRole("heading", { name: translate(language, "projectsLoading") }); assertDraft();
    await act(async () => finish?.(ok({ ...projection, revision: 2 }))); assertDraft();
    assert.equal(screen.queryByRole("heading", { name: translate(language, "projectsError") }), null);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    await screen.findByText(translate(language, "textValueSaved"));
    assert.deepEqual(saves, ["  Unsaved 日本語 📝  ", "  Unsaved 日本語 📝  "]);
    assert.equal(screen.getByRole("button", { name: label }).textContent, "  Unsaved 日本語 📝  ");
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU sibling changes preserve cell and rename drafts; Cancel reveals the newest committed field", async () => {
  for (const language of ["en", "ru"] as const) {
    const f = textFixture(); let committed = f.snapshot(1), mutations = 0;
    const api = mockApi({ onProperties: async () => ok(committed), onWorkspace: async () => { mutations++; return fail("storage"); } });
    render(<TextPropertiesTable {...f} client={new WorkspaceServiceClient(window.workspace)} language={language} disabled={false} />);
    const label = `${translate(language, "editTextValue")}: Project / Notes`;
    await userEvent.click(await screen.findByRole("button", { name: label }));
    await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), "  Unsaved 📝  ");
    committed = f.snapshot(2, "Sibling");
    await act(async () => { api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision: 2 }); });
    assert.equal((screen.getByRole("textbox") as HTMLTextAreaElement).value, "  Unsaved 📝  ");
    assert.ok(screen.getByText(translate(language, "textValueExternalChange")));
    assert.equal(mutations, 0);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "cancelTextValue") }));
    assert.equal(screen.getByRole("button", { name: label }).textContent, "Sibling");
    await userEvent.click(screen.getByRole("button", { name: `${translate(language, "renameProperty")}: Notes` }));
    await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), "My name");
    committed = f.snapshot(3, "Sibling", "Their name");
    await act(async () => { api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision: 3 }); });
    assert.equal((screen.getByRole("textbox") as HTMLInputElement).value, "My name");
    assert.ok(screen.getByText(translate(language, "propertyExternalChange")));
    await userEvent.keyboard("{Escape}");
    assert.ok(screen.getByRole("button", { name: `${translate(language, "renameProperty")}: Their name` }));
    assert.equal(mutations, 0); cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("Text cell saves keep own event-before-response success and reject overtaken lists/save snapshots", async () => {
  for (const language of ["en", "ru"] as const) {
    const f = textFixture();
    const lists: ((result: ServiceResult<TextPropertySnapshot>) => void)[] = [];
    let finish: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
    let saves = 0;
    const api = mockApi({ onProperties: async () => new Promise<ServiceResult<TextPropertySnapshot>>((resolve) => lists.push(resolve)),
      onWorkspace: async () => { saves++; return new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finish = resolve; }); } });
    render(<TextPropertiesTable {...f} client={new WorkspaceServiceClient(window.workspace)} language={language} disabled={false} />);
    await act(async () => { lists[0](ok(f.snapshot(1))); });
    const label = `${translate(language, "editTextValue")}: Project / Notes`;
    const editSave = async (value: string) => {
      await userEvent.click(screen.getByRole("button", { name: label }));
      await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), value);
      await userEvent.keyboard("{Control>}{Enter}{/Control}");
    };
    const event = (revision: number) => api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision });
    await editSave("Own");
    await act(async () => { event(2); lists[1](ok(f.snapshot(2, "Own"))); });
    await act(async () => { finish?.(ok({ snapshot: f.snapshot(2, "Own"), projectId: f.projectId, propertyId: f.propertyId })); });
    assert.ok(screen.getByText(translate(language, "textValueSaved")));
    assert.equal(screen.queryByText(translate(language, "textValueExternalChange")), null);
    await act(async () => { event(3); lists[2](ok(f.snapshot(3, "Later sibling"))); });
    assert.ok(screen.getByText(translate(language, "textValueNewerChange")));
    await editSave("Older own");
    await act(async () => { event(4); event(5); event(5); });
    assert.equal(lists.length, 5, "duplicate events must not create reloads");
    await act(async () => {
      lists[4](ok(f.snapshot(5, "Newest sibling"))); lists[3](ok(f.snapshot(4, "Older own")));
      finish?.(ok({ snapshot: f.snapshot(4, "Older own"), projectId: f.projectId, propertyId: f.propertyId }));
    });
    assert.equal(screen.getByRole("button", { name: label }).textContent, "Newest sibling");
    assert.ok(screen.getByText(translate(language, "textValueNewerChange")));
    assert.equal(screen.queryByText(translate(language, "textValueSaved")), null);
    assert.equal(saves, 2); cleanup(); assert.equal(api.changeListenerCount(), 0);
    await act(async () => { event(6); }); assert.equal(lists.length, 5);
  }
});

test("backend restart, workspace switch/removal and cleanup invalidate delayed Text lists and cell/definition saves without replay", async () => {
  for (const phase of ["list", "value", "rename"] as const) {
    for (const transition of ["restart", "restart-batched", "switch", "remove", "cleanup"] as const) {
      const f = textFixture(), next = textFixture();
      const active: ActiveWorkspace = { workspaceId: f.workspaceId, sourceId: f.sourceId, viewId: randomUUID(), name: "Old workspace", canonicalRoot: "/Fixture", sourceAvailable: true };
      const other = { ...active, workspaceId: next.workspaceId, sourceId: next.sourceId, viewId: randomUUID(), name: "New workspace" };
      const lists: ((result: ServiceResult<TextPropertySnapshot>) => void)[] = [];
      let finish: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
      let ready = false, saves = 0;
      const api = mockApi({ onProperties: async (input) => {
        if (input.type !== "workspace.listTextProperties") return fail("invalid_input");
        if (input.workspaceId === other.workspaceId) return ok(next.snapshot(1, "Current", "New property"));
        if (ready) return ok(f.snapshot(3, "Restarted", "Restarted property"));
        if (phase !== "list" && lists.length === 0) { lists.push(() => {}); return ok(f.snapshot(1)); }
        return new Promise<ServiceResult<TextPropertySnapshot>>((resolve) => lists.push(resolve));
      }, onProjects: async (input) => {
        if (input.type !== "workspace.listProjects") return fail("invalid_input");
        return ok({ workspaceId: input.workspaceId, sourceId: input.workspaceId === other.workspaceId ? next.sourceId : f.sourceId,
          revision: 1, configured: true, state: "ready", retainedCount: 0, projects: input.workspaceId === other.workspaceId ? next.projects : f.projects });
      },
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active, [active, other]));
        saves++; return new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finish = resolve; });
      } });
      render(<App />);
      await screen.findByRole("heading", { name: "Old workspace" });
      if (phase === "value") {
        await userEvent.click(await screen.findByRole("button", { name: "Edit Text value: Project / Notes" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Edit Text value: Project / Notes" }), " old draft");
        await userEvent.click(screen.getByRole("button", { name: "Save value" }));
      } else if (phase === "rename") {
        await userEvent.click(await screen.findByRole("button", { name: "Rename property: Notes" }));
        await userEvent.type(screen.getByRole("textbox", { name: "Property name" }), " old draft"); await userEvent.keyboard("{Enter}");
      }
      if (transition === "restart-batched") {
        ready = true;
        await act(async () => { api.emitStatus("unavailable"); api.emitStatus("ready"); });
        await screen.findByRole("button", { name: "Rename property: Restarted property" });
      } else if (transition === "restart") {
        await act(async () => { api.emitStatus("unavailable"); }); ready = true;
        await act(async () => { api.emitStatus("ready"); });
        await screen.findByRole("button", { name: "Rename property: Restarted property" });
      } else if (transition === "cleanup") cleanup();
      else {
        await act(async () => { api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(other, transition === "remove" ? [other] : [active, other]) }); });
        await screen.findByRole("button", { name: "Rename property: New property" });
      }
      await act(async () => {
        lists.at(-1)?.(ok(f.snapshot(2, "Delayed value", "Delayed property")));
        finish?.(ok({ snapshot: f.snapshot(2, "Delayed value", "Delayed property"), projectId: phase === "value" ? f.projectId : null, propertyId: f.propertyId }));
      });
      assert.equal(screen.queryByText("Delayed value"), null);
      assert.equal(screen.queryByText("Delayed property"), null);
      assert.equal(screen.queryByText("Value saved."), null);
      assert.equal(screen.queryByText("Property saved."), null);
      assert.equal(saves, phase === "list" ? 0 : 1);
      cleanup(); assert.equal(api.changeListenerCount(), 0);
    }
  }
});

test("EN/RU sibling commits during a failed save retain drafts and require an explicit retry command", async () => {
  for (const language of ["en", "ru"] as const) {
    const f = textFixture(); let committed = f.snapshot(1);
    const commands: WorkspaceRequest[] = [];
    let finish: ((result: ServiceResult<TextPropertyMutation>) => void) | undefined;
    const api = mockApi({ onProperties: async () => ok(committed), onWorkspace: async (input) => {
      commands.push(input); return new Promise<ServiceResult<TextPropertyMutation>>((resolve) => { finish = resolve; });
    } });
    render(<TextPropertiesTable {...f} client={new WorkspaceServiceClient(window.workspace)} language={language} disabled={false} />);
    const label = `${translate(language, "editTextValue")}: Project / Notes`;
    await userEvent.click(await screen.findByRole("button", { name: label }));
    await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), "  My draft\n  ");
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    committed = f.snapshot(2, "Sibling during save");
    await act(async () => {
      api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision: 2 });
      finish?.(fail("storage"));
    });
    assert.equal((screen.getByRole("textbox") as HTMLTextAreaElement).value, "  My draft\n  ");
    assert.ok(screen.getByText(translate(language, "textValueExternalChange")));
    assert.ok(screen.getByText(translate(language, "textValueSaveError")));
    assert.equal(commands.length, 1);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    assert.equal(commands.length, 2);
    assert.deepEqual(commands[1], { type: "workspace.setTextValue", workspaceId: f.workspaceId,
      projectId: f.projectId, propertyId: f.propertyId, value: "  My draft\n  " });
    committed = f.snapshot(3, "  My draft\n  ");
    await act(async () => { finish?.(ok({ snapshot: committed, projectId: f.projectId, propertyId: f.propertyId })); });
    assert.ok(screen.getByText(translate(language, "textValueSaved")));
    assert.equal(screen.queryByText(translate(language, "textValueExternalChange")), null);
    assert.equal(screen.getByRole("button", { name: label }).textContent, "  My draft\n  ");
    await userEvent.click(screen.getByRole("button", { name: `${translate(language, "renameProperty")}: Notes` }));
    await userEvent.clear(screen.getByRole("textbox")); await userEvent.type(screen.getByRole("textbox"), "Renamed"); await userEvent.keyboard("{Enter}");
    committed = f.snapshot(4, "  My draft\n  ", "Renamed");
    await act(async () => {
      api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision: 4 });
      finish?.(ok({ snapshot: committed, projectId: null, propertyId: f.propertyId }));
    });
    assert.ok(screen.getByText(translate(language, "propertySaved")));
    committed = f.snapshot(5, "After rename", "Renamed");
    await act(async () => { api.emitChange({ type: "workspace.propertiesChanged", sourceId: f.sourceId, workspaceIds: [f.workspaceId], revision: 5 }); });
    assert.ok(screen.getByText(translate(language, "propertyNewerChange")));
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});
