import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync, mkdirSync, readdirSync, renameSync, realpathSync, rmSync } from "node:fs";
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

const { act, cleanup, render, screen, waitFor, within, fireEvent } = await import("@testing-library/react");
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
  onCreations?: MockOptions["onWorkspace"];
  onProperties?: MockOptions["onWorkspace"];
  onObservation?: MockOptions["onWorkspace"];
  onSettings?: WorkspaceDesktopApi["settings"];
  backend?: "ready" | "unavailable";
}

function mockApi(options: MockOptions = {}) {
  cleanup();
  const changeListeners = new Set<(event: WorkspaceChangeEvent) => void>();
  const statusListeners = new Set<(status: BackendStatus) => void>();
  const onSettings = options.onSettings ?? (async (input) => input.type === "settings.load"
    ? options.settingsResult ?? settings(options.language ?? "en")
    : settings(input.language));
  const onWorkspace = options.onWorkspace ?? (async (input) => input.type === "workspace.load"
    ? options.load ?? ok(emptyLoad())
    : fail("invalid_input"));
  window.workspace = {
    getBackendStatus: async () => ({ state: options.backend ?? "ready" }),
    onBackendStatus: (listener) => {
      statusListeners.add(listener);
      return () => { statusListeners.delete(listener); };
    },
    onWorkspaceChange: (listener) => {
      changeListeners.add(listener);
      return () => { changeListeners.delete(listener); };
    },
    settings: onSettings,
    workspace: ((input: WorkspaceRequest) => input.type === "workspace.listProjectCreations"
      ? options.onCreations?.(input) ?? Promise.resolve(ok({ workspaceId: input.workspaceId, sourceId: (options.load?.ok ? options.load.value.activeWorkspace?.sourceId : null) ?? `source-${input.workspaceId}`, operations: [] }))
      : input.type === "workspace.getSourceObservation"
      ? options.onObservation?.(input) ?? Promise.resolve(ok({ observation: null }))
      : input.type === "workspace.listTextProperties"
      ? options.onProperties?.(input) ?? Promise.resolve(ok({ workspaceId: input.workspaceId, sourceId: `source-${input.workspaceId}`, revision: 0, definitions: [], values: [] }))
      : input.type === "workspace.listProjects"
      ? options.onProjects?.(input) ?? Promise.resolve(ok({ workspaceId: input.workspaceId,
        sourceId: `source-${input.workspaceId}`, revision: 0, mode: null, categories: [], categoryProperty: null, categoryPropertyRevision: 0, configured: false, state: "empty" as const,
        projects: [], retainedProjects: [], retainedCount: 0 })) : onWorkspace(input)) as WorkspaceDesktopApi["workspace"],
    pickRoot: options.picker ?? (async () => ({ outcome: "cancelled" })),
  };
  return { changeListenerCount: () => changeListeners.size, emitChange: (event: WorkspaceChangeEvent) => changeListeners.forEach((listener) => listener(event)), emitStatus: (nextState: BackendStatus["state"]) => statusListeners.forEach((listener) => listener({ state: nextState })) };
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
        return ok({ ...previewResult(active), workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 0,
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
        return ok({ ...previewResult(active), workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 0, canonicalRoot: active.canonicalRoot,
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
  workspaceId: active.workspaceId, sourceId: active.sourceId, revision, configured: true, mode: "direct" as const, categories: [], categoryProperty: null, categoryPropertyRevision: 0,
  state: (projects.length ? "ready" : "empty") as "ready" | "empty", retainedProjects: [], retainedCount: 0,
  projects: projects.map((name) => ({ projectId: `project-${name}`, categoryId: null, name, relativePath: name, associationState: "active" as const, resolution: "active" as const, categoryName: null })),
});
const previewResult = (active: ActiveWorkspace, token = "reviewed", excludedRelativePaths: string[] = []) => ({
  currentMode: null, projectEffects: { added: [], retained: [], noLongerRecognized: [], alreadyRetained: [] },
  categoryAvailability: { current: false, target: false, propertyId: null, name: null },
  effectiveExcludedRelativePaths: excludedRelativePaths, inactiveExcludedRelativePaths: [],
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
      assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false);
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
      assert.ok(screen.getByRole("combobox", { name: translate(language, "discoveryMode") }));
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

test("EN/RU grouped selection shows pending, recoverable failure and empty review with explicit Apply", async () => {
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
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false);
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
    assert.equal(screen.getByRole("cell", { name: "Authored project" }).querySelector("span")?.textContent, "  Authored project  ");
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

test("EN/RU observer before or after stale Apply response preserves rows and requires another explicit Apply", async () => {
  for (const language of ["en", "ru"] as const) for (const order of ["before", "after"] as const) {
    const active = sharedEventWorkspace(), saved = projectList(active, ["Saved project"], 1);
    let previews = 0, applies = 0;
    let finishApply: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const api = mockApi({ language, onProjects: async () => ok(saved), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active));
      if (input.type === "workspace.previewDiscovery") {
        previews++;
        return ok({ ...previewResult(active, `review-${previews}`), revision: 1,
          entries: [{ kind: "project", categoryPath: null, name: previews === 1 ? "Saved project" : "Late project",
            relativePath: previews === 1 ? "Saved project" : "Late project", reason: null }] });
      }
      if (input.type === "workspace.applyDiscovery") {
        if (++applies === 1) return new Promise((resolve) => { finishApply = resolve; });
        return ok(projectList(active, ["Saved project", "Late project"], 2));
      }
      return fail("invalid_input");
    } });
    render(<App />); await screen.findByRole("cell", { name: "Saved project" });
    await userEvent.click(screen.getByRole("button", { name: t("discoveryAction") }));
    await screen.findByRole("checkbox", { name: /Saved project/ });
    await userEvent.click(screen.getByRole("button", { name: t("discoveryApply") }));
    const observed: WorkspaceChangeEvent = { type: "workspace.sourceObserved", sourceId: active.sourceId,
      workspaceIds: [active.workspaceId], observationRevision: 1, state: "ready", automaticUpdates: "active" };
    if (order === "before") await act(async () => api.emitChange(observed));
    await act(async () => finishApply?.(fail("stale_preview")));
    await waitFor(() => assert.equal(previews, 2));
    if (order === "after") {
      await act(async () => api.emitChange(observed));
      assert.equal(screen.queryByRole("checkbox", { name: /Late project/ }), null);
      assert.equal((screen.getByRole("button", { name: t("discoveryApply") }) as HTMLButtonElement).disabled, true);
    }
    assert.ok(screen.getByRole("heading", { name: t("discoveryStale") }));
    assert.ok(screen.getByRole("cell", { name: "Saved project" }));
    assert.equal(screen.queryByRole("cell", { name: "Late project" }), null);
    assert.equal(applies, 1);
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    await screen.findByRole("checkbox", { name: /Late project/ });
    assert.equal(previews, 3); assert.equal(applies, 1);
    await userEvent.click(screen.getByRole("button", { name: t("discoveryApply") }));
    await screen.findByRole("cell", { name: "Late project" });
    assert.equal(applies, 2);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
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
        : ok({ ...projectList(active), retainedCount: 2, retainedProjects: ["Missing", "Excluded"].map((name) => ({ projectId: name, categoryId: null, categoryName: null, name, relativePath: name, associationState: name === "Missing" ? "missing" as const : "excluded" as const, resolution: null })), state: "unavailable" }) });
    render(<App />);
    assert.ok(await screen.findByRole("heading", { name: translate(language, "projectsLoading") }));
    await waitFor(() => assert.ok(finish));
    assert.ok(finish);
    const finishFirstRequest = finish;
    await act(async () => { finishFirstRequest(fail("storage")); });
    assert.ok(await screen.findByRole("heading", { name: translate(language, "projectsError") }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "projectsRetry") }));
    assert.ok(await screen.findByText(translate(language, "projectExcluded")));
    assert.equal(screen.queryByText(translate(language, "projectsEmpty")), null);
    assert.ok(screen.getByRole("heading", { name: translate(language, "projectsRetained") }));
    assert.ok(screen.getByRole("heading", { name: translate(language, "sourceUnavailableTitle") }));
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

test("EN/RU delayed Apply success preserves a newer same-revision missing-folder observation", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let revision = 1, missing = false, applies = 0;
    let finishApply: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const applied = projectList(active, ["Saved"], 2);
    const currentList = () => missing ? { ...applied, state: "empty" as const, projects: [], retainedCount: 1,
      retainedProjects: applied.projects.map((row) => ({ ...row, resolution: "missing" as const })) }
      : projectList(active, ["Saved"], revision);
    const api = mockApi({ language, load: ok(snapshotOf(active, [active])), onProjects: async () => ok(currentList()),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active, [active]));
        if (input.type === "workspace.previewDiscovery") return ok({ ...previewResult(active), revision });
        if (input.type === "workspace.applyDiscovery") { applies++; return new Promise((resolve) => { finishApply = resolve; }); }
        return fail("invalid_input");
      } });
    render(<App />); await screen.findByRole("cell", { name: "Saved" });
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryApply") }));
    await act(async () => { revision = 2; api.emitChange(projectEvent(active, revision)); });
    await act(async () => {
      missing = true;
      api.emitChange({ type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId],
        observationRevision: 2, state: "empty", automaticUpdates: "active" });
    });
    await screen.findByRole("button", { name: `${translate(language, "recoveryLocate")}: Saved` });
    await act(async () => { finishApply?.(ok(applied)); });
    assert.ok(await screen.findByRole("button", { name: `${translate(language, "recoveryLocate")}: Saved` }));
    assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryTitle") }), null);
    assert.equal(applies, 1, "confirmed success must not replay Apply");
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
      projects={[{ projectId, categoryId: null, name: "Project", relativePath: "Project" }]} language={language} disabled={false} />);
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
    projects: [{ associationState: "active" as const, resolution: "active" as const, categoryName: null, projectId, categoryId: null, sourceId, name: "Project", relativePath: "Project" }] };
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
        mode: "direct" as const, categories: [], categoryProperty: null, categoryPropertyRevision: 0, configured: true, state: "ready" as const, projects: f.projects, retainedProjects: [], retainedCount: 0 };
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
        assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
        assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
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
      mode: "direct" as const, categories: [], categoryProperty: null, categoryPropertyRevision: 0, configured: true, state: "ready" as const, projects: f.projects, retainedProjects: [], retainedCount: 0 };
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
          revision: 1, mode: "direct", categories: [], categoryProperty: null, categoryPropertyRevision: 0, configured: true, state: "ready", retainedProjects: [], retainedCount: 0, projects: input.workspaceId === other.workspaceId ? next.projects : f.projects });
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

test("EN/RU production grouped Apply normalizes child-then-parent exclusions and preserves Text drafts on rescan", async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.js");
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "grouped-apply-ui-")), root = join(directory, "root");
    mkdirSync(join(root, "Category/Project"), { recursive: true }); mkdirSync(join(root, "Empty"));
    const hints = new Map<string, () => void>();
    const timers = new Set<{ callback(): void; delay: number }>();
    const service = openSettingsService(join(directory, "data.sqlite"), undefined, undefined, {
      probe: nativeObserverDependencies.probe,
      watch(path, hint) { hints.set(path, hint); return { close: () => { hints.delete(path); } }; },
      schedule(callback, delay) { const timer = { callback, delay }; timers.add(timer); return { cancel: () => { timers.delete(timer); } }; },
    });
    const deliverNotifications = (path: string) => {
      const hint = hints.get(path); assert.ok(hint, "configured source has a live observer"); hint();
      for (const timer of [...timers]) if (timer.delay === 100) { timers.delete(timer); timer.callback(); }
    };
    let unsubscribe: (() => void) | undefined;
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "Grouped", rootPath: root });
      if (!created.ok) throw new Error("Fixture creation failed");
      const workspaceId = created.value.workspaceId, viewId = created.value.viewId;
      const property = service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
      assert.equal(property.ok, true);
      const requests: WorkspaceRequest[] = [];
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      let holdReload = false;
      let finishApply: (() => void) | undefined;
      const pendingLists: (() => void)[] = [];
      const surface = mockApi({ language, onProjects: async (input) => {
        const result = await query(input);
        return holdReload ? new Promise((resolve) => { pendingLists.push(() => resolve(result)); }) : result;
      }, onProperties: query, onWorkspace: async (input) => {
        requests.push(input);
        const result = (input.type === "workspace.load" || input.type === "workspace.previewDiscovery" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
        if (input.type === "workspace.applyDiscovery" && holdReload) {
          return new Promise((resolve) => { finishApply = () => resolve(result); });
        }
        return result;
      } });
      unsubscribe = service.workspaces.subscribe(surface.emitChange);
      render(<App />);
      const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
      await userEvent.click(trigger);
      await userEvent.selectOptions(await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }), "grouped");
      const checkbox = (kind: "discoveryCategory" | "discoveryProject", name: string) => screen.getByRole("checkbox", {
        name: `${translate(language, "discoveryExclude")}: ${translate(language, kind)}: ${name}`,
      }) as HTMLInputElement;
      await waitFor(() => assert.equal(checkbox("discoveryProject", "Project").disabled, false));
      await userEvent.click(checkbox("discoveryProject", "Project"));
      await waitFor(() => assert.equal(checkbox("discoveryProject", "Project").disabled, false));
      const category = checkbox("discoveryCategory", "Category"); category.focus(); await userEvent.keyboard(" ");
      await waitFor(() => assert.equal(checkbox("discoveryCategory", "Category").disabled, false));
      assert.equal(checkbox("discoveryCategory", "Category").checked, true);
      assert.equal(screen.queryByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: ${translate(language, "discoveryProject")}: Project` }), null);
      assert.deepEqual(requests.at(-1), { type: "workspace.previewDiscovery", workspaceId, mode: "grouped", excludedRelativePaths: ["Category"] });
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
      await waitFor(() => assert.equal(checkbox("discoveryCategory", "Category").disabled, false));
      await userEvent.click(checkbox("discoveryCategory", "Category"));
      await waitFor(() => assert.equal(checkbox("discoveryProject", "Project").disabled, false));
      assert.equal(checkbox("discoveryProject", "Project").checked, false);
      const apply = screen.getByRole("button", { name: translate(language, "discoveryApply") });
      apply.focus(); await userEvent.keyboard("{Enter}");
      await screen.findByRole("cell", { name: "Project" });
      assert.equal(document.activeElement, trigger);
      const header = screen.getByRole("columnheader", { name: translate(language, "discoveryCategory") });
      assert.equal(header.querySelectorAll("button").length, 1);
      assert.equal(header.querySelector("input, select"), null);
      const categoryCell = screen.getByRole("cell", { name: "Category" }); assert.equal(categoryCell.querySelector("button, input, select"), null);
      assert.ok(screen.getByText("Empty")); assert.ok(screen.getByText(translate(language, "discoveryGroupedMode")));
      const loadedView = service.workspaces.load(); assert.equal(loadedView.ok && loadedView.value.activeWorkspace?.viewId, viewId);
      const valueLabel = `${translate(language, "editTextValue")}: Project / Notes`;
      await userEvent.click(await screen.findByRole("button", { name: valueLabel }));
      const editor = screen.getByRole("textbox", { name: valueLabel }); await userEvent.type(editor, "Retained draft");
      mkdirSync(join(root, "AnotherEmpty"));
      await userEvent.click(trigger);
      await screen.findByRole("checkbox", { name: `${translate(language, "discoveryExclude")}: ${translate(language, "discoveryCategory")}: AnotherEmpty` });
      assert.ok(screen.getByRole("combobox", { name: translate(language, "discoveryMode") }));
      // Deliver the folder hint after Preview, proving that a stale review
      // prevents submission before explicitly requesting a fresh review.
      await act(async () => { deliverNotifications(created.value.canonicalRoot); });
      await screen.findByRole("heading", { name: translate(language, "discoveryStale") });
      const staleApply = screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement;
      assert.equal(staleApply.disabled, true);
      await userEvent.click(staleApply);
      assert.equal(requests.filter((request) => request.type === "workspace.applyDiscovery").length, 1);
      assert.equal(finishApply, undefined);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
      await waitFor(() => assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false));
      holdReload = true;
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryApply") }));
      await waitFor(() => assert.ok(finishApply));
      // Deliver the real post-commit observation before the held successful
      // response; this must close the review while reloading current placement.
      await act(async () => { assert.equal(service.workspaces.refreshSource({ type: "workspace.refreshSource", workspaceId }).ok, true); });
      await act(async () => { finishApply?.(); });
      assert.equal(Boolean(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") })), false);
      assert.ok(pendingLists.length > 0, "confirmed Apply reload must still be pending after the panel closes");
      assert.equal(screen.queryByText("AnotherEmpty"), null);
      assert.equal(document.activeElement, trigger);
      assert.equal(screen.getByRole("textbox", { name: valueLabel }), editor);
      assert.equal((editor as HTMLTextAreaElement).value, "Retained draft");
      assert.equal(requests.filter((request) => request.type === "workspace.applyDiscovery").length, 2);
      holdReload = false;
      await act(async () => { for (const finish of pendingLists.splice(0)) finish(); });
      assert.ok(await screen.findByText("AnotherEmpty"));
      assert.equal(screen.getByRole("textbox", { name: valueLabel }), editor);
      assert.equal((editor as HTMLTextAreaElement).value, "Retained draft");
      assert.equal(document.activeElement, trigger);
      assert.equal(requests.filter((request) => request.type === "workspace.applyDiscovery").length, 2);
      const rescannedView = service.workspaces.load(); assert.equal(rescannedView.ok && rescannedView.value.activeWorkspace?.viewId, viewId);
    } finally {
      unsubscribe?.(); cleanup(); service.close();
      assert.equal(hints.size, 0); assert.equal(timers.size, 0);
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("EN/RU grouped Table exposes saved empty categories for siblings and no category for direct sources", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "grouped-empty-ui-")), root = join(directory, "root"), directRoot = join(directory, "direct");
    mkdirSync(join(root, "Empty"), { recursive: true }); mkdirSync(join(directRoot, "DirectProject"), { recursive: true });
    const service = openSettingsService(join(directory, "data.sqlite"));
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
      if (!one.ok) throw new Error("Fixture creation failed");
      const review = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: one.value.workspaceId, mode: "grouped" });
      if (!review.ok) throw new Error("Fixture preview failed");
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: one.value.workspaceId, previewToken: review.value.previewToken }).ok, true);
      const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root });
      if (!sibling.ok) throw new Error("Fixture creation failed");
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      mockApi({ language, onProjects: query, onProperties: query, onWorkspace: query }); render(<App />);
      await screen.findByRole("columnheader", { name: translate(language, "discoveryCategory") });
      assert.ok(screen.getByText("Empty")); assert.ok(screen.getByText(translate(language, "projectsEmpty")));
      assert.equal(screen.queryByRole("cell"), null);
      cleanup();
      const direct = service.workspaces.create({ type: "workspace.create", name: "Direct", rootPath: directRoot });
      if (!direct.ok) throw new Error("Fixture creation failed");
      const directReview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: direct.value.workspaceId });
      if (!directReview.ok) throw new Error("Fixture preview failed");
      assert.equal(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: direct.value.workspaceId, previewToken: directReview.value.previewToken }).ok, true);
      mockApi({ language, onProjects: query, onProperties: query, onWorkspace: query }); render(<App />);
      await screen.findByRole("cell", { name: "DirectProject" });
      assert.equal(screen.queryByRole("columnheader", { name: translate(language, "discoveryCategory") }), null);
      assert.equal(screen.queryByText(translate(language, "savedCategories")), null);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU delayed grouped Apply respects newer discovery and independent category-label snapshots", async () => {
  for (const language of ["en", "ru"] as const) for (const outcome of ["ownCommit", "newerDiscovery", "newerLabel"] as const) {
    const active = sharedEventWorkspace(), categoryId = randomUUID(), propertyId = randomUUID();
    let revision = 1, labelRevision = 0;
    const listed = (name: string, discoveryRevision: number, categoryPropertyRevision = labelRevision) => ({
      ...projectList(active, [name], discoveryRevision), mode: "grouped" as const,
      projects: [{ associationState: "active" as const, resolution: "active" as const, categoryName: "Category", projectId: "project-stable", categoryId, name, relativePath: `Category/${name}` }],
      categories: [{ categoryId, name: "Category", relativePath: "Category" }], categoryPropertyRevision,
      categoryProperty: { propertyId, sourceId: active.sourceId, name: categoryPropertyRevision ? "Current label" : null },
    });
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onProjects: async () => ok(listed(revision === 1 ? "Saved" : "Current", revision)),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type === "workspace.previewDiscovery") return ok({ ...previewResult(active), mode: "grouped", configured: true, entries: [
          { kind: "category", empty: false, relativePath: "Category", name: "Category", reason: null },
          { kind: "project", categoryPath: "Category", relativePath: "Category/Saved", name: "Saved", reason: null },
        ] });
        if (input.type === "workspace.applyDiscovery") return new Promise((resolve) => { finish = resolve; });
        return fail("invalid_input");
      } });
    render(<App />); await screen.findByRole("cell", { name: "Saved" });
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryApply") }));
    await act(async () => {
      revision = outcome === "newerDiscovery" ? 3 : 2; labelRevision = outcome === "newerLabel" ? 4 : 0;
      api.emitChange(projectEvent(active, revision));
    });
    await screen.findByRole("cell", { name: "Current" });
    await act(async () => { finish?.(ok(listed("Own response", 2, 0))); });
    if (outcome === "ownCommit") {
      assert.ok(screen.getByRole("cell", { name: "Own response" }));
      assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") }), null);
    } else {
      assert.equal(screen.queryByRole("cell", { name: "Own response" }), null);
      assert.ok(screen.getByRole("cell", { name: "Current" }));
      if (outcome === "newerLabel") assert.ok(screen.getByRole("columnheader", { name: "Current label" }));
      else assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
    }
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU category label keyboard editor retains drafts and changes only shared metadata through production client", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "category-label-ui-")), root = join(directory, "root");
    mkdirSync(join(root, "Category/Project"), { recursive: true });
    const service = openSettingsService(join(directory, "data.sqlite")); let off: (() => void) | undefined;
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
      const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root });
      if (!one.ok || !sibling.ok) throw new Error("Fixture creation failed");
      const workspaceId = one.value.workspaceId;
      service.workspaces.activate({ type: "workspace.activate", workspaceId });
      const review = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" });
      if (!review.ok) throw new Error("Fixture preview failed");
      const applied = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: review.value.previewToken });
      if (!applied.ok || !applied.value.categoryProperty) throw new Error("Fixture Apply failed");
      const propertyId = applied.value.categoryProperty.propertyId;
      service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" });
      const requests: WorkspaceRequest[] = []; let failSave = false;
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProperties: query, onProjects: query, onWorkspace: async (input) => {
        requests.push(input);
        if (input.type === "workspace.renameCategoryProperty" && failSave) return fail("storage");
        return (input.type === "workspace.load" || input.type === "workspace.previewDiscovery" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
      } });
      off = service.workspaces.subscribe(api.emitChange); render(<App />);
      const trigger = await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: ${translate(language, "discoveryCategory")}` });
      trigger.focus(); await userEvent.keyboard("{Enter}");
      let editor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
      assert.equal(document.activeElement, editor);
      await userEvent.clear(editor); await userEvent.type(editor, "   "); await userEvent.keyboard("{Enter}");
      assert.ok(screen.getByText(translate(language, "categoryPropertyValidation"))); assert.equal(requests.some((r) => r.type === "workspace.renameCategoryProperty"), false);
      await userEvent.keyboard("{Escape}"); assert.equal(document.activeElement, trigger);
      const textLabel = `${translate(language, "editTextValue")}: Project / Notes`;
      await userEvent.click(await screen.findByRole("button", { name: textLabel }));
      const textEditor = screen.getByRole("textbox", { name: textLabel }); await userEvent.type(textEditor, "Keep Text draft");
      await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
      const apply = await screen.findByRole("button", { name: translate(language, "discoveryApply") });
      await userEvent.click(trigger); editor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
      await userEvent.clear(editor); await userEvent.type(editor, "  Draft label 日本語  ");
      await act(async () => { assert.equal(service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: sibling.value.workspaceId, propertyId, name: "Sibling label" }).ok, true); });
      await screen.findByText(translate(language, "categoryPropertyExternalChange"));
      assert.equal(editor.value, "  Draft label 日本語  ");
      assert.ok(screen.getByRole("columnheader", { name: "Sibling label" }));
      assert.equal((apply as HTMLButtonElement).disabled, false);
      failSave = true; await userEvent.keyboard("{Enter}");
      await screen.findByText(translate(language, "categoryPropertySaveError")); assert.equal(editor.value, "  Draft label 日本語  ");
      failSave = false; await userEvent.keyboard("{Enter}");
      await screen.findByText(translate(language, "categoryPropertySaved"));
      assert.equal(document.activeElement, trigger);
      assert.ok(screen.getByRole("columnheader", { name: "Draft label 日本語" }));
      assert.equal(screen.getByRole("textbox", { name: textLabel }), textEditor); assert.equal((textEditor as HTMLTextAreaElement).value, "Keep Text draft");
      const categoryCell = screen.getByRole("cell", { name: "Category" }); assert.equal(categoryCell.querySelector("button, input, select"), null);
      const siblingList = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.value.workspaceId });
      assert.equal(siblingList.ok && siblingList.value.categoryProperty?.name, "  Draft label 日本語  ");
      assert.equal(applied.value.revision, siblingList.ok && siblingList.value.revision);
      await userEvent.click(apply); await waitFor(() => assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") }), null));
      assert.equal(requests.filter((r) => r.type === "workspace.renameCategoryProperty").length, 2);
    } finally { off?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

function categoryLabelFixture(active: ActiveWorkspace) {
  const propertyId = randomUUID(), categoryId = randomUUID();
  const list = (label: string | null, labelRevision = 0, discoveryRevision = 1, projectName = "Project") => ({
    ...projectList(active, [], discoveryRevision), mode: "grouped" as const,
    projects: [{ associationState: "active" as const, resolution: "active" as const, categoryName: "Category", projectId: randomUUID(), name: projectName, relativePath: `Category/${projectName}`, categoryId }],
    categories: [{ categoryId, name: "Category", relativePath: "Category" }],
    categoryProperty: { propertyId, sourceId: active.sourceId, name: label }, categoryPropertyRevision: labelRevision,
  });
  const event = (revision: number): Extract<WorkspaceChangeEvent, { type: "workspace.categoryPropertyChanged" }> => ({ type: "workspace.categoryPropertyChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision });
  const saved = (name: string, revision = 1) => ok({ workspaceId: active.workspaceId, sourceId: active.sourceId, propertyId, name, revision });
  return { propertyId, list, event, saved };
}

test("EN/RU opening category rename during a pending sibling refresh keeps the rendered draft and change notice", async () => {
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "category-pending-refresh-ui-")), root = join(directory, "root");
    mkdirSync(join(root, "Category/Project"), { recursive: true });
    const service = openSettingsService(join(directory, "data.sqlite"));
    let off: (() => void) | undefined;
    try {
      const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root });
      const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root });
      if (!one.ok || !sibling.ok) throw new Error("Fixture creation failed");
      const workspaceId = one.value.workspaceId;
      service.workspaces.activate({ type: "workspace.activate", workspaceId });
      const review = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" });
      if (!review.ok) throw new Error("Fixture preview failed");
      const applied = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: review.value.previewToken });
      if (!applied.ok || !applied.value.categoryProperty) throw new Error("Fixture Apply failed");
      const propertyId = applied.value.categoryProperty.propertyId;
      const initial = service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId, propertyId, name: "Old label" });
      assert.equal(initial.ok && initial.value.revision, 1);
      let delayList = false, finishList: (() => void) | undefined;
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProperties: query, onWorkspace: query, onProjects: async (input) => {
        const result = service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
        return delayList ? new Promise((resolve) => { finishList = () => resolve(result); }) : result;
      } });
      off = service.workspaces.subscribe(api.emitChange);
      render(<App />);
      const trigger = await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Old label` });
      delayList = true;
      await act(async () => {
        const renamed = service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId: sibling.value.workspaceId, propertyId, name: "Sibling label" });
        assert.equal(renamed.ok && renamed.value.revision, 2);
      });
      await waitFor(() => assert.equal(typeof finishList, "function"));
      assert.ok(screen.getByRole("columnheader", { name: "Old label" }));
      assert.ok(screen.getByText(translate(language, "projectsLoading")));
      trigger.focus(); await userEvent.keyboard("{Enter}");
      const editor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
      assert.equal(editor.value, "Old label");
      assert.equal(document.activeElement, editor);
      await act(async () => { finishList!(); });
      await screen.findByRole("columnheader", { name: "Sibling label" });
      assert.equal(screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }), editor);
      assert.equal(editor.value, "Old label");
      assert.ok(screen.getByText(translate(language, "categoryPropertyExternalChange")));
      const current = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId });
      assert.equal(current.ok && current.value.categoryProperty?.name, "Sibling label");
      assert.equal(current.ok && current.value.revision, applied.value.revision);
      await userEvent.keyboard("{Escape}");
      assert.equal(document.activeElement, trigger);
      assert.equal(screen.queryByRole("textbox", { name: translate(language, "categoryPropertyName") }), null);
    } finally { off?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU category label races accept own events but preserve newer labels and independently refreshed projects", async () => {
  for (const language of ["en", "ru"] as const) for (const outcome of ["own", "newer", "oldList"] as const) {
    const active = sharedEventWorkspace(), f = categoryLabelFixture(active);
    let currentList = f.list(null), finishSave: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let finishList: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined, delayList = false;
    const api = mockApi({ language,
      onProjects: async () => delayList ? new Promise((resolve) => { finishList = resolve; }) : ok(currentList),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type === "workspace.renameCategoryProperty") return new Promise((resolve) => { finishSave = resolve; });
        return fail("invalid_input");
      } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: ${translate(language, "discoveryCategory")}` }));
    const editor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") });
    await userEvent.clear(editor); await userEvent.type(editor, "Own label"); await userEvent.keyboard("{Enter}");
    assert.equal((editor as HTMLInputElement).disabled, true);
    assert.ok(screen.getByRole("button", { name: translate(language, "categoryPropertySaving") }));
    await act(async () => {
      currentList = f.list(outcome === "newer" ? "Newer label" : "Own label", outcome === "newer" ? 2 : 1);
      if (outcome === "oldList") delayList = true;
      api.emitChange(f.event(outcome === "newer" ? 2 : 1));
    });
    if (outcome !== "oldList") await screen.findByRole("columnheader", { name: outcome === "newer" ? "Newer label" : "Own label" });
    await act(async () => { finishSave?.(f.saved("Own label")); });
    await screen.findByText(translate(language, outcome === "newer" ? "categoryPropertyNewerChange" : "categoryPropertySaved"));
    if (outcome === "oldList") {
      await act(async () => { finishList?.(ok(f.list(null, 0, 2, "New project"))); });
      await screen.findByRole("cell", { name: "New project" });
    }
    assert.ok(screen.getByRole("columnheader", { name: outcome === "newer" ? "Newer label" : "Own label" }));
    assert.equal(screen.queryByRole("textbox", { name: translate(language, "categoryPropertyName") }), null);
    assert.equal(screen.queryByText(translate(language, "projectsError")), null);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU category saves and lists cannot revive switched, removed, restarted or unmounted workspaces", async () => {
  for (const language of ["en", "ru"] as const) for (const reason of ["switch", "remove", "restart", "cleanup", "list"] as const) {
    const active = sharedEventWorkspace(), other = { ...sharedEventWorkspace(), workspaceId: randomUUID(), sourceId: randomUUID(), viewId: randomUUID(), name: "Other" }, f = categoryLabelFixture(active), next = categoryLabelFixture(other);
    let current = active, restarted = false, finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, onProjects: async (input) => {
      if (input.type !== "workspace.listProjects") return fail("invalid_input");
      if (input.workspaceId === other.workspaceId) return ok(next.list("Other label"));
      if (reason === "list" && !restarted) return new Promise((resolve) => { finish = resolve; });
      return ok(f.list(restarted ? "Restart label" : null));
    }, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: current.workspaceId, name: current.name }], activeWorkspace: current });
      if (input.type === "workspace.renameCategoryProperty") return new Promise((resolve) => { finish = resolve; });
      return fail("invalid_input");
    } });
    render(<App />);
    if (reason !== "list") {
      await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: ${translate(language, "discoveryCategory")}` }));
      const input = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") });
      await userEvent.clear(input); await userEvent.type(input, "Late label"); await userEvent.keyboard("{Enter}");
    } else await screen.findByRole("heading", { name: active.name });
    if (reason === "switch") {
      current = other;
      await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: { workspaces: [{ workspaceId: other.workspaceId, name: other.name }], activeWorkspace: other } }));
      await screen.findByRole("columnheader", { name: "Other label" });
    } else if (reason === "remove") {
      await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: emptyLoad() }));
    } else if (reason === "cleanup") cleanup();
    else {
      await act(async () => api.emitStatus("unavailable")); restarted = true;
      await act(async () => api.emitStatus("ready"));
      await screen.findByRole("columnheader", { name: "Restart label" });
    }
    await act(async () => { finish?.(reason === "list" ? ok(f.list("Late list")) : f.saved("Late label")); });
    assert.equal(screen.queryByRole("columnheader", { name: "Late label" }), null);
    assert.equal(screen.queryByRole("columnheader", { name: "Late list" }), null);
    assert.equal(screen.queryByText(translate(language, "categoryPropertySaved")), null);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU same-source refresh preserves category drafts and newer label snapshots without accepting old project rows", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace(), f = categoryLabelFixture(active);
    let listed = f.list(null), lists = 0;
    const api = mockApi({ language, onProjects: async () => { lists++; return ok(listed); }, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
      if (input.type === "workspace.renameCategoryProperty") return fail("invalid_input");
      return fail("invalid_input");
    } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: ${translate(language, "discoveryCategory")}` }));
    const input = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
    await userEvent.clear(input); await userEvent.type(input, "Recoverable draft");
    const originalLists = lists;
    await act(async () => {
      api.emitChange({ ...f.event(2), sourceId: randomUUID() });
      api.emitChange({ ...f.event(2), workspaceIds: [randomUUID()] });
    });
    assert.equal(lists, originalLists);
    await act(async () => api.emitChange({ type: "workspace.sourceChanged", source: { sourceId: active.sourceId, workspaceIds: [active.workspaceId], canonicalRoot: "/Refreshed root", sourceAvailable: true } }));
    await waitFor(() => assert.ok(lists > originalLists));
    assert.equal(screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }), input);
    assert.equal(input.value, "Recoverable draft");
    await act(async () => {
      listed = f.list(null, 0, 2, "Current project"); api.emitChange(projectEvent(active, 2));
    });
    await screen.findByRole("cell", { name: "Current project" });
    await act(async () => {
      listed = f.list("Current label", 1, 1, "Old project"); api.emitChange(f.event(1));
    });
    await screen.findByRole("columnheader", { name: "Current label" });
    assert.ok(screen.getByRole("cell", { name: "Current project" })); assert.equal(screen.queryByRole("cell", { name: "Old project" }), null);
    assert.ok(screen.getByText(translate(language, "categoryPropertyExternalChange")));
    input.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(translate(language, "categoryPropertyValidation")); assert.equal(input.value, "Recoverable draft");
    await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement, screen.getByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Current label` }));
    assert.equal(screen.queryByText(translate(language, "projectsError")), null);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU long grouped Table labels remain exact and category values expose no mutation controls, including empty categories", async () => {
  const categoryName = "Категория-日本語-" + "long-category-".repeat(16);
  const label = "  Authored-категория-" + "long-label-".repeat(18) + "  ";
  for (const language of ["en", "ru"] as const) {
    mockApi({ language });
    const client = new WorkspaceServiceClient(window.workspace);
    const props = {
      client, workspaceId: "long-table", sourceId: "source-long-table", language, disabled: false,
      categoryProperty: { propertyId: "category-property", sourceId: "source-long-table", name: label },
      categories: [{ categoryId: "category", name: categoryName, relativePath: "Category" }, { categoryId: "empty", name: "Empty category", relativePath: "Empty category" }],
      projects: [{ projectId: "project", categoryId: "category", name: "日本語-проект-" + "long-project-".repeat(16), relativePath: "Category/Project" }],
    };
    const view = render(<TextPropertiesTable {...props} />);
    await waitFor(() => assert.equal(document.querySelector(".text-properties")?.getAttribute("aria-busy"), "false"));
    assert.equal(screen.getByText(label.trim()).textContent, label);
    const category = screen.getByRole("cell", { name: categoryName });
    assert.equal(category.textContent, categoryName);
    assert.equal(category.querySelectorAll("button, input, select").length, 0);
    assert.equal(document.querySelector(".project-table-scroll")?.firstElementChild?.tagName, "TABLE");
    view.rerender(<TextPropertiesTable {...props} projects={[]} categoryProperty={{ ...props.categoryProperty, name: null }} />);
    assert.equal(screen.getByRole("columnheader", { name: translate(language, "discoveryCategory") }).textContent, translate(language, "discoveryCategory"));
    assert.equal(document.querySelectorAll("tbody tr").length, 0);
    cleanup();
  }
});

test("EN/RU retained transitions, source retry and failed list loads preserve the same unsaved Text editor", async () => {
  for (const language of ["en", "ru"] as const) {
    const f = textFixture(), active = { ...makeActive(f.workspaceId, "Workspace"), sourceId: f.sourceId };
    let resolution: "active" | "missing" = "active";
    let state: "ready" | "unavailable" = "ready";
    let loadFailure = false, retries = 0, mutations = 0;
    const list = () => ({ ...projectList(active), projects: resolution === "active" ? f.projects : [],
      retainedProjects: resolution === "missing" ? [{ ...f.projects[0], resolution: state === "unavailable" ? null : "missing" as const }] : [],
      retainedCount: resolution === "missing" ? 1 : 0, state });
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => loadFailure ? fail("storage") : ok(list()),
      onProperties: async () => ok(f.snapshot(1)), onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active));
        if (input.type === "workspace.refreshSource") {
          retries++;
          return ok({ sourceId: f.sourceId, workspaceIds: [f.workspaceId], canonicalRoot: active.canonicalRoot, sourceAvailable: true });
        }
        mutations++; return fail("invalid_input");
      } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: Project / Notes` }));
    const editor = screen.getByRole("textbox", { name: `${translate(language, "editTextValue")}: Project / Notes` }) as HTMLTextAreaElement;
    await userEvent.clear(editor); await userEvent.type(editor, "Unsaved retained draft 📝");
    resolution = "missing";
    const observation: WorkspaceChangeEvent = { type: "workspace.sourceChanged", source: { sourceId: f.sourceId,
      workspaceIds: [f.workspaceId], canonicalRoot: active.canonicalRoot, sourceAvailable: true } };
    await act(async () => { api.emitChange(observation); });
    await screen.findByText(translate(language, "projectMissing"));
    assert.equal(screen.getByRole("textbox", { name: `${translate(language, "editTextValue")}: Project / Notes` }), editor);
    assert.equal(editor.value, "Unsaved retained draft 📝");
    state = "unavailable";
    await act(async () => { api.emitChange({ ...observation, source: { ...observation.source, sourceAvailable: false } }); });
    await screen.findByText(translate(language, "sourceUnavailableTitle"));
    assert.equal(screen.getAllByText(translate(language, "sourceUnavailableTitle")).length, 1);
    assert.equal(screen.queryByText(translate(language, "discoveryUnavailable")), null);
    loadFailure = true;
    const retry = screen.getByRole("button", { name: translate(language, "retrySourceAction") });
    retry.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(translate(language, "projectsError"));
    assert.equal(editor.value, "Unsaved retained draft 📝");
    assert.equal(screen.getByRole("textbox", { name: `${translate(language, "editTextValue")}: Project / Notes` }), editor);
    loadFailure = false; state = "ready";
    await userEvent.click(screen.getByRole("button", { name: translate(language, "retrySourceAction") }));
    await waitFor(() => assert.ok(screen.queryByText(translate(language, "projectsError")) === null));
    await waitFor(() => assert.ok(screen.queryByText(translate(language, "sourceUnavailableTitle")) === null));
    assert.equal(retries, 2); assert.equal(mutations, 0);
    assert.equal(editor.value, "Unsaved retained draft 📝");
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU unavailable, unreadable and conflicting sources show feedback once at the source retry location", async () => {
  for (const language of ["en", "ru"] as const) {
    for (const [state, label] of [["unavailable", "sourceUnavailableTitle"], ["unreadable", "discoveryUnreadable"], ["root_identity_conflict", "discoveryRootConflict"]] as const) {
      const f = textFixture(), active = { ...makeActive(f.workspaceId, "Workspace"), sourceId: f.sourceId };
      mockApi({ language, load: ok(snapshotOf(active)), onProperties: async () => ok(f.snapshot(1)),
        onProjects: async () => ok({ ...projectList(active), state, projects: f.projects.map((row) => ({ ...row, resolution: null })) }) });
      render(<App />);
      await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: Project / Notes` });
      await screen.findByRole("heading", { name: translate(language, label) });
      assert.equal(screen.getAllByRole("heading", { name: translate(language, label) }).length, 1);
      const retry = screen.getByRole("button", { name: translate(language, "retrySourceAction") });
      assert.ok(retry.closest("[role=alert]")?.textContent?.includes(translate(language, label)));
      assert.equal(screen.queryByText(translate(language, "projectMissing")), null);
      assert.equal(screen.queryByText(translate(language, "projectUnresolved")), null);
      cleanup();
    }
  }
});

test("EN/RU delayed recovery previews and accepted responses cannot revive switched, removed or restarted workspaces", async () => {
  for (const language of ["en", "ru"] as const) for (const phase of ["preview", "commit"] as const) for (const reason of ["switch", "remove", "restart", "batchedRestart", "cleanup"] as const) {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const active = { ...sharedEventWorkspace(), viewId: randomUUID() }, other = { ...sharedEventWorkspace(), workspaceId: randomUUID(), sourceId: randomUUID(), viewId: randomUUID(), name: "Other workspace" };
    const projectId = randomUUID();
    const retained = { projectId, name: "Missing project", relativePath: "Missing project", categoryId: null, categoryName: null, associationState: "active" as const, resolution: "missing" as const };
    const initial = { workspaceId: active.workspaceId, sourceId: active.sourceId, revision: 1, configured: true, mode: "direct" as const,
      state: "ready" as const, projects: [], retainedProjects: [retained], retainedCount: 1, categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
    const preview = { workspaceId: active.workspaceId, sourceId: active.sourceId, projectId, revision: 1, mode: "direct" as const, state: "ready" as const,
      previewToken: randomUUID(), entries: [{ name: "Target", relativePath: "Target", categoryPath: null, status: "selectable" as const }] };
    const committed = { ...initial, revision: 2, projects: [{ ...retained, name: "Target", relativePath: "Target", resolution: "active" as const }], retainedProjects: [], retainedCount: 0 };
    let current = active, restarted = false, saves = 0, previews = 0;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, onProjects: async (input) => {
      if (input.type !== "workspace.listProjects") return fail("invalid_input");
      if (input.workspaceId === other.workspaceId) return ok({ ...initial, workspaceId: other.workspaceId, sourceId: other.sourceId, retainedProjects: [], retainedCount: 0 });
      return ok(restarted && phase === "commit" ? committed : initial);
    }, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: current.workspaceId, name: current.name }], activeWorkspace: current });
      if (input.type === "workspace.previewProjectRecovery") {
        previews++; return phase === "preview" ? new Promise((resolve) => { finish = resolve; }) : ok(preview);
      }
      if (input.type === "workspace.reassociateProject") { saves++; return new Promise((resolve) => { finish = resolve; }); }
      return fail("invalid_input");
    } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: Missing project` }));
    if (phase === "commit") {
      await userEvent.click(await screen.findByRole("radio", { name: "Target" }));
      await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    }
    if (reason === "switch") {
      current = other;
      await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: { workspaces: [{ workspaceId: other.workspaceId, name: other.name }], activeWorkspace: other } }));
      await screen.findByRole("heading", { name: other.name });
    } else if (reason === "remove") {
      await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: emptyLoad() }));
      await screen.findByRole("heading", { name: t("createWorkspaceTitle") });
    } else if (reason === "cleanup") cleanup();
    else {
      restarted = true;
      if (reason === "batchedRestart") await act(async () => { api.emitStatus("unavailable"); api.emitStatus("ready"); });
      else {
        await act(async () => api.emitStatus("unavailable"));
        if (phase === "commit") assert.ok(screen.getByText(t("recoveryUncertain")));
        await act(async () => api.emitStatus("ready"));
      }
      await screen.findByRole("heading", { name: active.name });
      if (phase === "commit") {
        await screen.findByRole("cell", { name: "Target" });
        assert.ok(screen.getByText(t("recoveryUncertain")));
      }
    }
    await act(async () => finish?.(ok(phase === "preview" ? preview : committed)));
    assert.equal(screen.queryByRole("heading", { name: t("recoveryTitle") }), null);
    assert.equal(screen.queryByText(t("recoverySaved")), null);
    assert.equal(previews, 1); assert.equal(saves, phase === "commit" ? 1 : 0);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU observer-only changes reject delayed same-revision lists/previews and ignore duplicate, older and foreign observations", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let lists = 0, previews = 0;
    let finishList: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let finishPreview: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language,
      load: ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active }),
      onProjects: async () => {
        if (++lists === 2) return new Promise((resolve) => { finishList = resolve; });
        return ok(projectList(active, [lists === 1 ? "Saved" : "Current observation"], 1));
      }, onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok({ workspaces: [{ workspaceId: active.workspaceId, name: active.name }], activeWorkspace: active });
        if (input.type === "workspace.previewDiscovery") {
          if (++previews === 1) return new Promise((resolve) => { finishPreview = resolve; });
          return ok({ ...previewResult(active, "current-review"), revision: 1 });
        }
        return fail("invalid_input");
      },
    });
    render(<App />); await screen.findByRole("cell", { name: "Saved" });
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    const event: WorkspaceChangeEvent = { type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId],
      observationRevision: 2, state: "ready", automaticUpdates: "active" };
    await act(async () => { api.emitChange({ ...event, sourceId: "00000000-0000-4000-8000-000000000099" }); api.emitChange({ ...event, workspaceIds: [] }); });
    assert.equal(lists, 1);
    await act(async () => { api.emitChange(event); });
    assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
    await act(async () => { api.emitChange({ ...event, observationRevision: 3, automaticUpdates: "degraded" }); });
    await screen.findByRole("cell", { name: "Current observation" });
    await act(async () => {
      finishList?.(ok(projectList(active, ["Delayed same revision"], 1)));
      finishPreview?.(ok({ ...previewResult(active, "old-review"), revision: 1 }));
      api.emitChange(event); api.emitChange({ ...event, observationRevision: 3 });
    });
    assert.equal(lists, 3); assert.equal(screen.queryByRole("cell", { name: "Delayed same revision" }), null);
    assert.equal(screen.queryByRole("checkbox"), null);
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
    await screen.findByRole("checkbox", { name: /Authored project/ });
    assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU available and empty sources expose Refresh, prevent duplicate submissions and retry failures", async () => {
  for (const language of ["en", "ru"] as const) for (const empty of [false, true]) {
    const active = sharedEventWorkspace(); let refreshes = 0;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => ok(projectList(active, empty ? [] : ["Known"], 1)),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active));
        if (input.type === "workspace.refreshSource") { refreshes++; return new Promise((resolve) => { finish = resolve; }); }
        return fail("invalid_input");
      } });
    render(<App />); const button = await screen.findByRole("button", { name: translate(language, "refreshSourceAction") });
    button.focus(); await userEvent.keyboard("{Enter}{Enter}");
    assert.equal(refreshes, 1); assert.equal((button as HTMLButtonElement).disabled, true);
    assert.ok(screen.getByRole("heading", { name: translate(language, "refreshingSource") }));
    await act(async () => { finish?.(fail("storage")); });
    await screen.findByRole("heading", { name: translate(language, "refreshSourceErrorTitle") });
    assert.equal(screen.queryByText("private service detail"), null);
    await userEvent.keyboard("{Enter}"); assert.equal(refreshes, 2);
    // Reconciliation events are delivered before the initiating command response.
    await act(async () => {
      api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 2 });
      api.emitChange({ type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId], observationRevision: 2, state: "ready", automaticUpdates: "degraded" });
      finish?.(ok({ sourceId: active.sourceId, workspaceIds: [active.workspaceId], canonicalRoot: active.canonicalRoot, sourceAvailable: true }));
    });
    await screen.findByRole("heading", { name: translate(language, "automaticUpdatesDegraded") });
    assert.equal((button as HTMLButtonElement).disabled, false); assert.equal(document.activeElement, button);
    assert.equal(screen.queryByText(translate(language, "refreshSourceErrorTitle")), null);
    cleanup();
  }
});

test("EN/RU stale Refresh responses cannot override newer observations or selection/removal/backend generations", async () => {
  for (const language of ["en", "ru"] as const) for (const reason of ["observation", "selection", "removal", "restart"] as const) {
    const active = { ...sharedEventWorkspace(), viewId: randomUUID() }, other = { ...sharedEventWorkspace(), workspaceId: randomUUID(), sourceId: randomUUID(), viewId: randomUUID(), name: "Other" };
    let current = active, empty = false;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, onProjects: async (input) => ok(projectList(input.type === "workspace.listProjects" && input.workspaceId === other.workspaceId ? other : active)),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(empty ? emptyLoad() : snapshotOf(current));
        if (input.type === "workspace.refreshSource") return new Promise((resolve) => { finish = resolve; });
        return fail("invalid_input");
      } });
    render(<App />); await userEvent.click(await screen.findByRole("button", { name: translate(language, "refreshSourceAction") }));
    await act(async () => {
      if (reason === "observation") api.emitChange({ type: "workspace.sourceChanged", source: { sourceId: active.sourceId, workspaceIds: [active.workspaceId], canonicalRoot: "/Current root", sourceAvailable: true } });
      if (reason === "selection" || reason === "removal") { current = other; empty = reason === "removal"; api.emitChange({ type: "workspace.listChanged", snapshot: empty ? emptyLoad() : snapshotOf(other) }); }
      if (reason === "restart") { api.emitStatus("unavailable"); api.emitStatus("ready"); }
    });
    if (reason === "restart") await screen.findByRole("button", { name: translate(language, "refreshSourceAction") });
    await act(async () => { finish?.(ok({ sourceId: active.sourceId, workspaceIds: [active.workspaceId], canonicalRoot: "/Stale root", sourceAvailable: false })); });
    assert.ok(screen.queryByText("/Stale root") === null, `${language} ${reason}: stale response replaced current root`);
    assert.ok(screen.queryByText(translate(language, "refreshSourceErrorTitle")) === null);
    if (reason === "observation") assert.ok(screen.getByText("/Current root"));
    if (reason === "selection") assert.ok(screen.getByRole("heading", { name: "Other" }));
    if (reason === "removal") assert.ok(screen.getByRole("heading", { name: translate(language, "createWorkspaceTitle") }));
    cleanup();
  }
});

test("EN/RU production Refresh and observer placement create only a needed category and retain drafts, focus and independent metadata", async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.js");
  const unwrap = <T,>(result: ServiceResult<T>): T => { if (!result.ok) throw new Error(result.error.code); return result.value; };
  for (const language of ["en", "ru"] as const) for (const mechanism of ["refresh", "observer"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "reconcile-ui-")), root = join(directory, "root");
    mkdirSync(join(root, "Old/Project"), { recursive: true });
    const hints = new Map<string, () => void>();
    const timers = new Set<{ delay: number; callback(): void }>();
    const service = openSettingsService(join(directory, "data.sqlite"), undefined, undefined, {
      probe: nativeObserverDependencies.probe,
      watch: (path, hint) => {
        if (mechanism === "refresh") throw new Error("ENOSPC");
        hints.set(path, hint); return { close: () => { hints.delete(path); } };
      },
      schedule: (callback, delay) => {
        if (delay === 0) return nativeObserverDependencies.schedule(callback, delay);
        const timer = { callback, delay }; timers.add(timer); return { cancel: () => { timers.delete(timer); } };
      },
    });
    let off: (() => void) | undefined;
    try {
      const one = unwrap(service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }));
      const sibling = unwrap(service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }));
      const workspaceId = one.workspaceId;
      unwrap(service.workspaces.activate({ type: "workspace.activate", workspaceId }));
      const preview = unwrap(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }));
      const applied = unwrap(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken! }));
      const projectId = applied.projects[0].projectId, categoryPropertyId = applied.categoryProperty!.propertyId;
      unwrap(service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId, propertyId: categoryPropertyId, name: "  Authored label  " }));
      const property = unwrap(service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" }));
      unwrap(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId, propertyId: property.propertyId, projectId, value: "  Exact\nТекст 📝  " }));
      const before = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      const beforeText = unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId }));
      const requests: WorkspaceRequest[] = [];
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProjects: query, onProperties: query, onWorkspace: async (input) => {
        requests.push(input);
        return (input.type === "workspace.load" || input.type === "workspace.previewDiscovery" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
      } });
      off = service.workspaces.subscribe(api.emitChange); render(<App />);
      const textLabel = `${translate(language, "editTextValue")}: Project / Notes`;
      await userEvent.click(await screen.findByRole("button", { name: textLabel }));
      const textEditor = screen.getByRole("textbox", { name: textLabel }) as HTMLTextAreaElement;
      await userEvent.clear(textEditor); await userEvent.type(textEditor, "  Unsaved Text 📝  ");
      await userEvent.click(screen.getByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Authored label` }));
      const labelEditor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
      await userEvent.clear(labelEditor); await userEvent.type(labelEditor, "  Unsaved label  ");
      // A late renderer must see the startup watcher failure without another topology change.
      if (mechanism === "refresh") await screen.findByRole("heading", { name: translate(language, "automaticUpdatesDegraded") });
      mkdirSync(join(root, "Needed")); renameSync(join(root, "Old/Project"), join(root, "Needed/Renamed"));
      mkdirSync(join(root, "Needed/Unrelated")); mkdirSync(join(root, "Other/Unrelated"), { recursive: true }); mkdirSync(join(root, "Empty"));
      if (mechanism === "refresh") {
        const refresh = screen.getByRole("button", { name: translate(language, "refreshSourceAction") }); refresh.focus(); await userEvent.keyboard("{Enter}");
      } else {
        textEditor.focus();
        await act(async () => {
          hints.get(one.canonicalRoot)!();
          for (const timer of [...timers]) if (timer.delay === 100) { timers.delete(timer); timer.callback(); }
        });
      }
      await screen.findByRole("cell", { name: "Renamed" });
      assert.equal(screen.getByRole("textbox", { name: `${translate(language, "editTextValue")}: Renamed / Notes` }), textEditor);
      assert.equal(textEditor.value, "  Unsaved Text 📝  "); assert.equal(labelEditor.value, "  Unsaved label  ");
      assert.equal(screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }), labelEditor);
      if (mechanism === "observer") assert.equal(document.activeElement, textEditor);
      assert.equal(document.querySelectorAll("tbody tr").length, 1);
      assert.ok(screen.getByRole("cell", { name: "Needed" })); assert.equal(screen.queryByText("Unrelated"), null); assert.equal(screen.queryByText("Other"), null); assert.equal(screen.queryByText("Empty"), null);
      const after = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId }));
      assert.equal(after.projects[0].projectId, projectId); assert.equal(after.categories.length, 2);
      assert.equal(after.categoryProperty!.propertyId, categoryPropertyId); assert.equal(after.categoryProperty!.name, "  Authored label  ");
      assert.equal(after.categoryPropertyRevision, before.categoryPropertyRevision); assert.equal(after.revision, before.revision + 1);
      assert.deepEqual(unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId })), beforeText);
      assert.equal(unwrap(service.workspaces.load()).activeWorkspace!.viewId, one.viewId);
      assert.equal(requests.filter((request) => request.type === "workspace.applyDiscovery").length, 0);
      assert.equal(requests.filter((request) => request.type === "workspace.setTextValue" || request.type === "workspace.renameCategoryProperty").length, 0);
      await userEvent.click(screen.getByRole("button", { name: translate(language, "refreshSourceAction") }));
      assert.equal(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })).revision, after.revision);
    } finally { off?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU production Refresh retains metadata and recovery when an existing destination category is conflicting", async () => {
  const unwrap = <T,>(result: ServiceResult<T>): T => { if (!result.ok) throw new Error(result.error.code); return result.value; };
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "conflicting-category-ui-")), root = join(directory, "root");
    mkdirSync(join(root, "Old/Project"), { recursive: true }); mkdirSync(join(root, "Conflict"));
    const service = openSettingsService(join(directory, "data.sqlite")); let off: (() => void) | undefined;
    try {
      const created = unwrap(service.workspaces.create({ type: "workspace.create", name: "Grouped", rootPath: root })), workspaceId = created.workspaceId;
      const review = unwrap(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode: "grouped" }));
      const initial = unwrap(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: review.previewToken! }));
      const property = unwrap(service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" }));
      unwrap(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId, projectId: initial.projects[0].projectId, propertyId: property.propertyId, value: "  Retained exact Text 📝  " }));
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProjects: query, onProperties: query, onWorkspace: async (input) =>
        (input.type === "workspace.load" || input.type === "workspace.previewProjectRecovery" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse> });
      off = service.workspaces.subscribe(api.emitChange); render(<App />);
      await screen.findByRole("cell", { name: "Project" });
      renameSync(join(root, "Conflict"), join(directory, "original-category")); mkdirSync(join(root, "Conflict"));
      renameSync(join(root, "Old/Project"), join(root, "Conflict/Project"));
      await userEvent.click(screen.getByRole("button", { name: translate(language, "refreshSourceAction") }));
      await screen.findByText(translate(language, "projectMissing"));
      const after = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      assert.equal(after.retainedProjects[0].projectId, initial.projects[0].projectId); assert.equal(after.revision, initial.revision);
      assert.deepEqual(after.categories.map((category) => category.categoryId), initial.categories.filter((category) => category.relativePath !== "Conflict").map((category) => category.categoryId));
      assert.deepEqual(after.categoryProperty, initial.categoryProperty);
      const text = screen.getByRole("button", { name: `${translate(language, "editTextValue")}: Project / Notes` });
      assert.equal(text.textContent, "  Retained exact Text 📝  ");
      await userEvent.click(screen.getByRole("button", { name: `${translate(language, "recoveryLocate")}: Project` }));
      await screen.findByText(translate(language, "recoveryCategoryUnavailable"));
      const target = screen.getByRole("radio", { name: /Conflict\/Project/ }) as HTMLInputElement;
      assert.equal(target.disabled, true); assert.equal((screen.getByRole("button", { name: translate(language, "recoveryConfirm") }) as HTMLButtonElement).disabled, true);
      await userEvent.keyboard("{Escape}"); assert.equal(screen.queryByRole("heading", { name: translate(language, "recoveryTitle") }) === null, true);
      assert.equal(text.textContent, "  Retained exact Text 📝  ");
    } finally { off?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU cached source guidance follows a newly selected sibling and resets at backend generation changes", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = { ...sharedEventWorkspace(), viewId: randomUUID() }, sibling = { ...sharedEventWorkspace(), workspaceId: randomUUID(), viewId: randomUUID(), name: "New sibling" };
    let selected = active;
    const api = mockApi({ language, onWorkspace: async (input) => input.type === "workspace.load" ? ok(snapshotOf(selected)) : fail("invalid_input") });
    render(<App />); await screen.findByRole("button", { name: translate(language, "refreshSourceAction") });
    const event: WorkspaceChangeEvent = { type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId], observationRevision: 3, state: "ready", automaticUpdates: "degraded" };
    await act(async () => api.emitChange(event));
    await screen.findByRole("heading", { name: translate(language, "automaticUpdatesDegraded") });
    selected = sibling;
    await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(sibling) }));
    await screen.findByRole("heading", { name: "New sibling" });
    assert.ok(screen.getByRole("heading", { name: translate(language, "automaticUpdatesDegraded") }));
    await act(async () => api.emitChange({ ...event, observationRevision: 4, automaticUpdates: "active" }));
    assert.ok(screen.getByRole("heading", { name: translate(language, "automaticUpdatesDegraded") }));
    await userEvent.click(screen.getByRole("button", { name: translate(language, "refreshSourceAction") }));
    await screen.findByRole("heading", { name: translate(language, "refreshSourceErrorTitle") });
    await act(async () => { api.emitStatus("unavailable"); api.emitStatus("ready"); });
    await screen.findByRole("button", { name: translate(language, "refreshSourceAction") });
    assert.ok(screen.queryByText(translate(language, "automaticUpdatesDegraded")) === null);
    assert.ok(screen.queryByText(translate(language, "refreshSourceErrorTitle")) === null);
    await act(async () => api.emitChange({ ...event, workspaceIds: [sibling.workspaceId], observationRevision: 1 }));
    await screen.findByRole("heading", { name: translate(language, "automaticUpdatesDegraded") });
    cleanup();
  }
});

test("EN/RU late App mount reads real startup degraded status after early delivery and resets it after backend restart", async () => {
  const { nativeObserverDependencies } = await import("../src/service/source-observer.js");
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "late-startup-ui-")), root = join(directory, "root"), database = join(directory, "workspace.sqlite");
    mkdirSync(join(root, "Project"), { recursive: true });
    let service = openSettingsService(database);
    const created = service.workspaces.create({ type: "workspace.create", name: "Late startup", rootPath: root });
    assert.equal(created.ok, true); if (!created.ok) throw new Error("Fixture failed");
    const workspaceId = created.value.workspaceId;
    const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId });
    assert.equal(preview.ok, true); if (!preview.ok) throw new Error("Preview failed");
    const applied = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.value.previewToken });
    assert.equal(applied.ok, true); service.close();
    const timers = new Set<{ callback(): void; delay: number }>();
    let failWatch = true;
    const dependencies = { ...nativeObserverDependencies,
      schedule(callback: () => void, delay: number) { const timer = { callback, delay }; timers.add(timer); return { cancel: () => timers.delete(timer) }; },
      watch() { if (failWatch) throw new Error("Watch unavailable"); return { close() {} }; },
    };
    service = openSettingsService(database, undefined, undefined, dependencies);
    let api: ReturnType<typeof mockApi> | undefined;
    let off = service.workspaces.subscribe((event) => api?.emitChange(event));
    // Mirror backend delivery before App subscriptions exist.
    for (const timer of [...timers].filter((timer) => timer.delay === 0)) { timers.delete(timer); timer.callback(); }
    let reads = 0, mutations = 0;
    const queries = new Set(["workspace.load", "workspace.getSourceObservation", "workspace.listProjects", "workspace.listTextProperties"]);
    api = mockApi({ language, onObservation: async (input) => { reads++; return service.handleQuery(input) as ServiceResult<WorkspaceResponse>; }, onProjects: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
      onProperties: async (input) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>,
      onWorkspace: async (input) => {
        if (queries.has(input.type)) return service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
        mutations++; return service.handleCommand(input) as ServiceResult<WorkspaceResponse>;
      } });
    try {
      render(<App />);
      await screen.findByRole("cell", { name: "Project" });
      await screen.findByRole("heading", { name: translate(language, "automaticUpdatesDegraded") });
      assert.equal(reads, 1); assert.equal(mutations, 0);
      assert.deepEqual(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }), applied);
      off(); service.close(); failWatch = false;
      service = openSettingsService(database, undefined, undefined, dependencies);
      // Again drop startup replay before renderer readiness; current read repairs it.
      off = service.workspaces.subscribe((event) => { if (event.type !== "workspace.sourceObserved") api?.emitChange(event); });
      await act(async () => { api?.emitStatus("unavailable"); api?.emitStatus("ready"); });
      await screen.findByRole("cell", { name: "Project" });
      await waitFor(() => assert.equal(screen.queryByRole("heading", { name: translate(language, "automaticUpdatesDegraded") }), null));
      assert.equal(reads, 2); assert.equal(mutations, 0);
      assert.deepEqual(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }), applied);
    } finally { cleanup(); off(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("a delayed current-observation read cannot override newer events or a backend generation", async () => {
  for (const reason of ["event", "restart", "selection"] as const) {
    const active = { ...sharedEventWorkspace(), viewId: randomUUID() }, other = { ...sharedEventWorkspace(), workspaceId: randomUUID(), sourceId: randomUUID(), viewId: randomUUID(), name: "Other" };
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let reads = 0, selected = active;
    const observation: Extract<WorkspaceChangeEvent, { type: "workspace.sourceObserved" }> = {
      type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId], observationRevision: 1, state: "ready", automaticUpdates: "degraded",
    };
    const read = async (): Promise<ServiceResult<WorkspaceResponse>> => {
      if (++reads === 1) return new Promise((resolve) => { finish = resolve; });
      return ok({ observation: null });
    };
    const api = mockApi({ onObservation: read, onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(selected));
      return fail("invalid_input");
    } });
    render(<App />); await screen.findByRole("button", { name: "Refresh source" });
    await waitFor(() => assert.equal(reads, 1));
    await act(async () => {
      if (reason === "event") api.emitChange({ ...observation, observationRevision: 2, automaticUpdates: "active" });
      else if (reason === "restart") { api.emitStatus("unavailable"); api.emitStatus("ready"); finish?.(ok({ observation })); }
      else { selected = other; api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(other) }); }
    });
    if (reason === "restart") await waitFor(() => assert.equal(reads, 2));
    if (reason === "selection") await screen.findByRole("heading", { name: "Other" });
    await act(async () => { finish?.(ok({ observation })); });
    assert.equal(screen.queryByRole("heading", { name: translate("en", "automaticUpdatesDegraded") }), null);
    cleanup();
  }
});

test("EN/RU configured mode review cancels safely and preserves exact Text and hidden category drafts across a round trip", async () => {
  const unwrap = <T,>(result: ServiceResult<T>): T => { if (!result.ok) throw new Error(result.error.code); return result.value; };
  for (const language of ["en", "ru"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "mode-review-ui-")), root = join(directory, "root"), otherRoot = join(directory, "other");
    mkdirSync(join(root, "Category/Project"), { recursive: true }); mkdirSync(join(root, "Category/Excluded")); mkdirSync(otherRoot);
    const service = openSettingsService(join(directory, "data.sqlite"));
    let off: (() => void) | undefined;
    try {
      const one = unwrap(service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }));
      const sibling = unwrap(service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }));
      const other = unwrap(service.workspaces.create({ type: "workspace.create", name: "Other", rootPath: otherRoot }));
      const workspaceId = one.workspaceId;
      unwrap(service.workspaces.activate({ type: "workspace.activate", workspaceId }));
      const switchMode = (mode: "direct" | "grouped") => {
        const review = unwrap(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode, excludedRelativePaths: ["Category/Excluded"] }));
        return unwrap(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: review.previewToken! }));
      };
      const grouped = switchMode("grouped"), projectId = grouped.projects[0].projectId;
      const labelId = grouped.categoryProperty!.propertyId;
      unwrap(service.workspaces.renameCategoryProperty({ type: "workspace.renameCategoryProperty", workspaceId, propertyId: labelId, name: "  Authored label  " }));
      const propertyId = unwrap(service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" })).propertyId;
      unwrap(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId, propertyId, projectId, value: "  Exact\nТекст  " }));
      const before = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      const beforeText = unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId }));
      const requests: WorkspaceRequest[] = [];
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProjects: query, onProperties: query, onWorkspace: async (input) => {
        requests.push(input); return (input.type === "workspace.load" || input.type === "workspace.previewDiscovery" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
      } });
      off = service.workspaces.subscribe(api.emitChange); render(<App />);
      const textLabel = `${translate(language, "editTextValue")}: Project / Notes`;
      await userEvent.click(await screen.findByRole("button", { name: textLabel }));
      const textEditor = screen.getByRole("textbox", { name: textLabel }) as HTMLTextAreaElement;
      await userEvent.clear(textEditor); await userEvent.type(textEditor, "  Unsaved exact Text 📝  ");
      await userEvent.click(screen.getByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Authored label` }));
      await userEvent.clear(screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }));
      await userEvent.type(screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") }), "  Unsaved label  ");
      const trigger = screen.getByRole("button", { name: translate(language, "discoveryAction") });
      await userEvent.click(trigger);
      await userEvent.selectOptions(await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }), "direct");
      await waitFor(() => assert.equal((screen.getByRole("combobox", { name: translate(language, "discoveryMode") }) as HTMLSelectElement).disabled, false));
      const reviewRegion = screen.getByRole("region", { name: translate(language, "discoveryTitle") });
      assert.ok(within(reviewRegion).getByText(translate(language, "discoverySharedScope")));
      assert.ok(within(reviewRegion).getByText(translate(language, "discoveryCategoryHidden")));
      assert.ok(within(reviewRegion).getByRole("heading", { name: `${translate(language, "discoveryAdded")} (1)` }));
      assert.ok(within(reviewRegion).getByRole("heading", { name: `${translate(language, "discoveryNoLongerRecognized")} (1)` }));
      assert.ok(within(reviewRegion).getByText("Category/Project"));
      assert.ok(within(reviewRegion).getByText("Category/Excluded"));
      assert.ok(within(reviewRegion).getByText(translate(language, "discoveryDirectExclusionScope")));
      assert.ok(within(reviewRegion).getByRole("heading", { name: translate(language, "discoveryInactiveExclusions") }));
      within(reviewRegion).getByRole("button", { name: translate(language, "cancelRenameWorkspace") }).focus(); await userEvent.keyboard("{Enter}");
      assert.equal(document.activeElement, trigger);
      assert.deepEqual(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })), before);
      assert.deepEqual(unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId })), beforeText);
      await userEvent.click(trigger);
      await userEvent.selectOptions(await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }), "direct");
      await waitFor(() => assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, false));
      screen.getByRole("button", { name: translate(language, "discoveryApply") }).focus(); await userEvent.keyboard("{Enter}");
      await waitFor(() => assert.equal(screen.queryByRole("columnheader", { name: "  Authored label  " }), null));
      assert.equal(screen.queryByRole("textbox", { name: translate(language, "categoryPropertyName") }), null);
      assert.equal(screen.getByRole("textbox", { name: textLabel }), textEditor);
      assert.equal(textEditor.value, "  Unsaved exact Text 📝  ");
      assert.ok(screen.getByRole("button", { name: `${translate(language, "recoveryLocate")}: Project` }));
      assert.equal(document.activeElement, trigger);
      assert.equal(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId })).mode, "direct");
      assert.equal(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: other.workspaceId })).mode, null);
      textEditor.focus();
      await act(async () => { switchMode("grouped"); });
      const restored = await screen.findByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
      assert.equal(restored.value, "  Unsaved label  "); assert.equal(textEditor.value, "  Unsaved exact Text 📝  ");
      assert.equal(document.activeElement, textEditor);
      assert.equal(screen.getAllByText(translate(language, "projectModeRetained")).length, 2);
      const after = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      assert.equal(after.categoryProperty!.propertyId, labelId); assert.ok(after.retainedProjects.some((project) => project.projectId === projectId));
      assert.deepEqual(unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId })), beforeText);
      assert.equal(requests.filter((request) => request.type === "workspace.applyDiscovery").length, 1);
      assert.equal(requests.some((request) => request.type === "workspace.setTextValue" || request.type === "workspace.renameCategoryProperty"), false);
    } finally { off?.(); cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU newer label revision from an older grouped list cannot resurrect the category column in direct mode", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace(), f = categoryLabelFixture(active);
    const grouped = f.list("Old label");
    const direct = { ...projectList(active, ["Direct"], 2), configured: true };
    let listed = grouped as import("../src/contracts/workspaces.js").ProjectList;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let delayed = false;
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => delayed
      ? new Promise((resolve) => { finish = resolve; }) : ok(listed) });
    render(<App />); await screen.findByRole("columnheader", { name: "Old label" });
    listed = direct;
    await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 2 }));
    await screen.findByRole("cell", { name: "Direct" });
    assert.equal(screen.queryByRole("columnheader", { name: "Old label" }), null);
    delayed = true;
    await act(async () => api.emitChange(f.event(1)));
    await act(async () => finish?.(ok({ ...grouped, categoryProperty: { ...grouped.categoryProperty!, name: "Late label" }, categoryPropertyRevision: 1 })));
    assert.equal(screen.queryByRole("columnheader", { name: "Late label" }), null);
    assert.ok(screen.getByRole("cell", { name: "Direct" }));
    listed = { ...grouped, revision: 3 }; delayed = false;
    await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 3 }));
    await screen.findByRole("columnheader", { name: "Late label" });
    cleanup();
  }
});

test("EN/RU delayed category save after sibling mode changes preserves the hidden draft without restoring a direct column or replaying", async () => {
  for (const language of ["en", "ru"] as const) for (const delivery of ["beforeList", "afterList"] as const) {
    const active = sharedEventWorkspace(), f = categoryLabelFixture(active);
    let listed = f.list("Original") as import("../src/contracts/workspaces.js").ProjectList;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let saves = 0;
    let holdList = false, finishList: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => holdList ? new Promise((resolve) => { finishList = resolve; }) : ok(listed), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active));
      if (input.type === "workspace.renameCategoryProperty") { saves++; return new Promise((resolve) => { finish = resolve; }); }
      return fail("invalid_input");
    } });
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Original` }));
    const editor = screen.getByRole("textbox", { name: translate(language, "categoryPropertyName") });
    await userEvent.clear(editor); await userEvent.type(editor, "  Pending draft  "); await userEvent.keyboard("{Enter}");
    assert.equal((editor as HTMLInputElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    listed = { ...projectList(active, ["Direct"], 2), configured: true, categoryPropertyRevision: 1 };
    holdList = delivery === "beforeList";
    await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 2 }));
    if (delivery === "afterList") await screen.findByRole("cell", { name: "Direct" });
    await act(async () => finish?.(f.saved("  Pending draft  ")));
    if (delivery === "beforeList") {
      assert.equal((editor as HTMLInputElement).value, "  Pending draft  ");
      assert.equal(screen.queryByText(translate(language, "categoryPropertySaved")), null);
      holdList = false; await act(async () => finishList?.(ok(listed)));
    }
    await screen.findByRole("cell", { name: "Direct" });
    assert.equal(screen.queryByRole("columnheader", { name: "Pending draft" }), null);
    assert.equal(screen.queryByText(translate(language, "categoryPropertySaved")), null);
    listed = f.list("Committed sibling label", 2, 3);
    await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 3 }));
    const restored = await screen.findByRole("textbox", { name: translate(language, "categoryPropertyName") }) as HTMLInputElement;
    assert.equal(restored.value, "  Pending draft  "); assert.equal(restored.disabled, false);
    assert.ok(screen.getByText(translate(language, "categoryPropertyExternalChange"))); assert.equal(saves, 1);
    await userEvent.keyboard("{Escape}");
    assert.equal(document.activeElement, screen.getByRole("button", { name: `${translate(language, "renameCategoryProperty")}: Committed sibling label` }));
    assert.equal(saves, 1); cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU configured mode validation and storage failures retain a review; stale Apply refreshes but needs explicit confirmation", async () => {
  for (const language of ["en", "ru"] as const) {
    const active = sharedEventWorkspace();
    let applies = 0, previews = 0, finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => ok({ ...projectList(active, ["Category"], 1), configured: true }), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active));
      if (input.type === "workspace.previewDiscovery") {
        previews++;
        const mode = input.mode ?? "direct";
        return ok({ ...previewResult(active, `review-${previews}`), configured: true, currentMode: "direct", mode,
          categoryAvailability: { current: false, target: mode === "grouped", propertyId: null, name: null }, entries: [] });
      }
      if (input.type === "workspace.applyDiscovery") {
        applies++;
        if (applies === 1) return new Promise((resolve) => { finish = resolve; });
        return fail(applies === 2 ? "storage" : "stale_preview");
      }
      return fail("invalid_input");
    } });
    render(<App />); await userEvent.click(await screen.findByRole("button", { name: translate(language, "discoveryAction") }));
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }), "grouped");
    const apply = screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement;
    await userEvent.click(apply);
    assert.equal(apply.disabled, true);
    assert.equal((screen.getByRole("combobox", { name: translate(language, "discoveryMode") }) as HTMLSelectElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    await userEvent.click(apply); assert.equal(applies, 1);
    await act(async () => finish?.(fail("invalid_input")));
    await screen.findByRole("heading", { name: translate(language, "discoveryValidation") });
    await userEvent.click(apply);
    await screen.findByRole("heading", { name: translate(language, "discoveryApplyError") });
    await userEvent.click(apply);
    await screen.findByRole("heading", { name: translate(language, "discoveryStale") });
    assert.equal(applies, 3); assert.equal(previews, 3); assert.equal(apply.disabled, false);
    assert.equal((screen.getByRole("combobox", { name: translate(language, "discoveryMode") }) as HTMLSelectElement).value, "grouped");
    screen.getByRole("heading", { name: translate(language, "discoveryGroupedTitle") }).focus(); await userEvent.keyboard("{Escape}");
    assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") }), null);
    assert.equal(applies, 3); assert.equal(document.activeElement, screen.getByRole("button", { name: translate(language, "discoveryAction") }));
    cleanup();
  }
});

test("EN/RU initial project list invalidates an early preview and requires explicit Refresh in either reply order", async () => {
  for (const language of ["en", "ru"] as const) for (const delivery of ["beforePreview", "afterPreview"] as const) {
    const active = sharedEventWorkspace();
    let finishList!: (result: ServiceResult<WorkspaceResponse>) => void;
    let finishPreview!: (result: ServiceResult<WorkspaceResponse>) => void;
    let previews = 0, applies = 0;
    const api = mockApi({ language, load: ok(snapshotOf(active)),
      onProjects: () => new Promise((resolve) => { finishList = resolve; }),
      onWorkspace: async (input) => {
        if (input.type === "workspace.load") return ok(snapshotOf(active));
        if (input.type === "workspace.previewDiscovery") {
          previews++;
          if (previews === 1) return new Promise((resolve) => { finishPreview = resolve; });
          return ok({ ...previewResult(active, "fresh-review"), configured: true, currentMode: "direct" });
        }
        if (input.type === "workspace.applyDiscovery") applies++;
        return fail("invalid_input");
      } });
    render(<App />);
    const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
    assert.equal((trigger as HTMLButtonElement).disabled, false);
    await userEvent.click(trigger);
    assert.equal(previews, 1);
    const oldPreview: ServiceResult<WorkspaceResponse> = ok({ ...previewResult(active, "early-review"), configured: true, currentMode: "direct" });
    if (delivery === "afterPreview") {
      await act(async () => finishPreview(oldPreview));
      await screen.findByRole("combobox", { name: translate(language, "discoveryMode") });
    }
    await act(async () => finishList(ok(projectList(active, ["Current"], 1))));
    await screen.findByRole("cell", { name: "Current" });
    if (delivery === "beforePreview") await act(async () => finishPreview(oldPreview));
    await screen.findByRole("heading", { name: translate(language, "discoveryStale") });
    assert.equal(screen.queryByRole("combobox", { name: translate(language, "discoveryMode") }), null);
    const apply = screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement;
    assert.equal(apply.disabled, true);
    await userEvent.click(apply);
    assert.equal(applies, 0); assert.equal(previews, 1);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
    const mode = await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }) as HTMLSelectElement;
    assert.equal(mode.value, "direct"); assert.equal(mode.disabled, false);
    assert.equal(apply.disabled, false); assert.equal(previews, 2); assert.equal(applies, 0);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }));
    assert.equal(document.activeElement, trigger);
    cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU configured mode selection discards delayed previews after cancellation, selection/removal, source loss, sibling Apply or backend restart", async () => {
  for (const language of ["en", "ru"] as const) for (const transition of ["cancel", "switch", "remove", "sourceLoss", "sibling", "restart"] as const) {
    const active = sharedEventWorkspace(), other = eventWorkspace("Other");
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let previews = 0;
    const api = mockApi({ language, load: ok(snapshotOf(active, [active, other])), onProjects: async (input) => input.type === "workspace.listProjects" ? ok({ ...projectList(input.workspaceId === active.workspaceId ? active : other, ["Current"], 1), configured: true }) : fail("invalid_input"), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active, [active, other]));
      if (input.type === "workspace.previewDiscovery") {
        previews++;
        return input.mode === "grouped" ? new Promise((resolve) => { finish = resolve; }) : ok({ ...previewResult(active), currentMode: "direct", configured: true });
      }
      return fail("invalid_input");
    } });
    render(<App />);
    // Establish the initial source revision before testing later transitions.
    // A late initial list correctly invalidates a review opened during loading.
    await screen.findByRole("cell", { name: "Current" });
    const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
    await userEvent.click(trigger);
    const mode = await screen.findByRole("combobox", { name: translate(language, "discoveryMode") });
    await userEvent.selectOptions(mode, "grouped");
    assert.equal((mode as HTMLSelectElement).disabled, true);
    if (transition === "cancel") {
      await userEvent.click(screen.getByRole("button", { name: translate(language, "cancelRenameWorkspace") }));
      assert.equal(document.activeElement, trigger); await userEvent.click(trigger); await screen.findByRole("checkbox");
    } else if (transition === "restart") {
      await act(async () => api.emitStatus("starting")); await act(async () => api.emitStatus("ready"));
    } else if (transition === "sourceLoss") {
      await act(async () => api.emitChange({ type: "workspace.sourceObserved", sourceId: active.sourceId, workspaceIds: [active.workspaceId], observationRevision: 1, state: "unavailable", automaticUpdates: "degraded" }));
    } else if (transition === "sibling") {
      mode.focus();
      await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: 2 }));
      assert.equal(document.activeElement, screen.getByRole("button", { name: translate(language, "discoveryRefresh") }));
    } else {
      await act(async () => api.emitChange({ type: "workspace.listChanged", snapshot: snapshotOf(other, transition === "remove" ? [other] : [active, other]) }));
    }
    await act(async () => finish?.(ok({ ...previewResult(active), configured: true, currentMode: "direct", mode: "grouped",
      entries: [{ kind: "category", empty: true, name: "Obsolete category", relativePath: "Obsolete category", reason: null }] })));
    assert.equal(screen.queryByText("Obsolete category"), null);
    assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") }), null);
    assert.equal(previews, transition === "cancel" ? 3 : 2); cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU configured mode Apply keeps confirmed delayed success and never overwrites a newer sibling mode or replays", async () => {
  for (const language of ["en", "ru"] as const) for (const newerSibling of [false, true]) {
    const active = sharedEventWorkspace(), f = categoryLabelFixture(active);
    let listed = { ...projectList(active, ["Direct"], 1), configured: true } as import("../src/contracts/workspaces.js").ProjectList;
    let finish: ((result: ServiceResult<WorkspaceResponse>) => void) | undefined;
    let applies = 0;
    const applied = f.list("Label", 0, 2, "Grouped child");
    const api = mockApi({ language, load: ok(snapshotOf(active)), onProjects: async () => ok(listed), onWorkspace: async (input) => {
      if (input.type === "workspace.load") return ok(snapshotOf(active));
      if (input.type === "workspace.previewDiscovery") return ok({ ...previewResult(active), configured: true, currentMode: "direct", mode: input.mode ?? "direct" });
      if (input.type === "workspace.applyDiscovery") { applies++; return new Promise((resolve) => { finish = resolve; }); }
      return fail("invalid_input");
    } });
    render(<App />); const trigger = await screen.findByRole("button", { name: translate(language, "discoveryAction") });
    await userEvent.click(trigger); await userEvent.selectOptions(await screen.findByRole("combobox", { name: translate(language, "discoveryMode") }), "grouped");
    await userEvent.click(screen.getByRole("button", { name: translate(language, "discoveryApply") }));
    listed = newerSibling ? { ...projectList(active, ["Latest direct"], 3), configured: true } : applied;
    await act(async () => api.emitChange({ type: "workspace.projectsChanged", sourceId: active.sourceId, workspaceIds: [active.workspaceId], revision: listed.revision }));
    await screen.findByRole("cell", { name: newerSibling ? "Latest direct" : "Grouped child" });
    await act(async () => finish?.(ok(applied)));
    if (newerSibling) {
      assert.ok(screen.getByRole("cell", { name: "Latest direct" }));
      assert.equal(screen.queryByRole("columnheader", { name: "Label" }), null);
      assert.ok(screen.getByRole("heading", { name: translate(language, "discoveryStale") }));
      assert.equal((screen.getByRole("button", { name: translate(language, "discoveryApply") }) as HTMLButtonElement).disabled, true);
    } else {
      assert.ok(screen.getByRole("columnheader", { name: "Label" }));
      assert.equal(screen.queryByRole("heading", { name: translate(language, "discoveryGroupedTitle") }), null);
      assert.equal(document.activeElement, trigger);
    }
    assert.equal(applies, 1); cleanup(); assert.equal(api.changeListenerCount(), 0);
  }
});

test("EN/RU production App immediately Reveals creation through an active observation, preserves IDs after reopen and reports verified outcomes", async () => {
  for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "creation-app-ui-")), root = join(directory, "root"), database = join(directory, "workspace.sqlite");
    mkdirSync(root); if (mode === "grouped") mkdirSync(join(root, "Existing category"));
    let service = openSettingsService(database), off: (() => void) | undefined, dispatches = 0;
    let finishNative!: () => void, projectionReads = 0, observationRevision = 0;
    const nativeCompletion = new Promise<void>((resolve) => { finishNative = resolve; });
    const targets: { canonicalRoot: string; relativePath: string; validation: string }[] = [];
    const creationRequests: WorkspaceRequest[] = [];
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      const created = service.workspaces.create({ type: "workspace.create", name: "Real creation workspace", rootPath: root });
      assert.ok(created.ok); if (!created.ok) throw new Error("Fixture failed");
      const workspaceId = created.value.workspaceId;
      const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode });
      assert.ok(preview.ok); if (!preview.ok) throw new Error("Fixture failed");
      assert.ok(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.value.previewToken }).ok);
      const setup = () => {
        const query = async (input: WorkspaceRequest) => {
          if (input.type === "workspace.listProjects") projectionReads++;
          return service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
        };
        const api = mockApi({ language, onProjects: query, onProperties: query, onCreations: query,
          onWorkspace: async (input) => {
            if (input.type === "workspace.revealProject") return service.revealProject(input, async (target, validate) => {
              targets.push({ canonicalRoot: target.canonicalRoot, relativePath: target.relativePath, validation: validate().outcome });
              dispatches++; await nativeCompletion; return { outcome: "dispatched" };
            });
            if (input.type === "workspace.createProject") creationRequests.push(input);
            return (input.type === "workspace.load" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
          } });
        off = service.workspaces.subscribe((event) => {
          if (event.type === "workspace.sourceObserved") observationRevision = Math.max(observationRevision, event.observationRevision);
          api.emitChange(event);
        }); render(<App />);
        return api;
      };
      const api = setup(); const trigger = await screen.findByRole("button", { name: t("createProject") });
      await waitFor(() => assert.equal((trigger as HTMLButtonElement).disabled, false)); await userEvent.click(trigger);
      await userEvent.type(screen.getByRole("textbox", { name: t("creationName") }), "Authored folder");
      if (mode === "grouped") {
        const select = screen.getByRole("combobox", { name: t("creationCategory") });
        const option = within(select).getByRole("option", { name: "Existing category" }) as HTMLOptionElement;
        await userEvent.selectOptions(select, option.value);
      }
      screen.getByRole("textbox", { name: t("creationName") }).focus(); await userEvent.keyboard("{Enter}");
      await screen.findByText(t("creationSaved")); await screen.findByRole("cell", { name: "Authored folder" });
      const before = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }); assert.ok(before.ok); if (!before.ok) throw new Error("Fixture failed");
      assert.equal(before.value.projects.length, 1); const projectId = before.value.projects[0].projectId;
      const reveal = screen.getByRole("button", { name: `${t("revealProject")}: Authored folder` });
      reveal.focus(); await userEvent.keyboard("{Enter}");
      assert.equal(dispatches, 1);
      const readsBeforeObservation = projectionReads;
      // Deterministic event delivery around a delayed native adapter, with the
      // actual service, filesystem and production observer still active.
      await act(async () => api.emitChange({ type: "workspace.sourceObserved", sourceId: created.value.sourceId,
        workspaceIds: [workspaceId], observationRevision: ++observationRevision, state: "ready", automaticUpdates: "active" }));
      assert.ok(projectionReads > readsBeforeObservation);
      assert.equal((reveal as HTMLButtonElement).disabled, true);
      fireEvent.click(reveal); assert.equal(dispatches, 1);
      await act(async () => finishNative());
      await screen.findByText(t("revealDispatched")); assert.equal(dispatches, 1);
      assert.deepEqual(targets, [{ canonicalRoot: realpathSync.native(root), relativePath: mode === "grouped" ? "Existing category/Authored folder" : "Authored folder", validation: "verified" }]);
      assert.equal(targets[0].canonicalRoot, created.value.canonicalRoot);
      assert.equal(creationRequests.length, 1);
      const request = creationRequests[0];
      assert.equal(request.type, "workspace.createProject");
      if (request.type !== "workspace.createProject") throw new Error("Unexpected creation request");
      assert.equal(request.name, "Authored folder");
      assert.equal(before.value.projects[0].name, request.name);
      assert.deepEqual(readdirSync(mode === "grouped" ? join(root, "Existing category") : root), [request.name]);
      cleanup(); off?.(); service.close(); service = openSettingsService(database); setup();
      await screen.findByRole("cell", { name: "Authored folder" });
      const after = service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }); assert.ok(after.ok); if (!after.ok) throw new Error("Fixture failed");
      assert.equal(after.value.projects[0].projectId, projectId);
      rmSync(join(root, ...(mode === "grouped" ? ["Existing category", "Authored folder"] : ["Authored folder"])), { recursive: true });
      await userEvent.click(screen.getByRole("button", { name: `${t("revealProject")}: Authored folder` }));
      await screen.findByText(t("revealMissing")); assert.equal(screen.queryByText(t("revealDispatched")), null); assert.equal(dispatches, 1);
    } finally { cleanup(); off?.(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("EN/RU production Name editing preserves identity and exact Text and resolves a lost response after backend remount", async () => {
  const { openSettingsService: openRenameService } = await import(new URL("../dist/service/settings.mjs", import.meta.url).href) as { openSettingsService: typeof openSettingsService };
  const unwrap = <T,>(result: ServiceResult<T>) => { assert.ok(result.ok, JSON.stringify(result)); return result.value; };
  for (const language of ["en", "ru"] as const) for (const mode of ["direct", "grouped"] as const) {
    const directory = realpathSync.native(mkdtempSync(join(tmpdir(), "rename-app-ui-"))), root = join(directory, "root"), database = join(directory, "workspace.sqlite");
    mkdirSync(root); const parent = mode === "grouped" ? join(root, "Existing category") : root;
    if (mode === "grouped") mkdirSync(parent); mkdirSync(join(parent, "Original"));
    let service = openRenameService(database), off: (() => void) | undefined;
    const renames: WorkspaceRequest[] = [], statuses: WorkspaceRequest[] = [];
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      const workspace = unwrap(service.workspaces.create({ type: "workspace.create", name: "Rename workspace", rootPath: root }));
      const workspaceId = workspace.workspaceId;
      const preview = unwrap(service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId, mode }));
      unwrap(service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }));
      const before = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })), project = before.projects[0];
      const sibling = unwrap(service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }));
      unwrap(service.workspaces.activate({ type: "workspace.activate", workspaceId }));
      const property = unwrap(service.workspaces.createProperty({ type: "workspace.createProperty", workspaceId, name: "Notes", propertyType: "text" }));
      const exactText = "  Exact\nТекст 📝  ";
      unwrap(service.workspaces.setTextValue({ type: "workspace.setTextValue", workspaceId, propertyId: property.propertyId, projectId: project.projectId, value: exactText }));
      const query = async (input: WorkspaceRequest) => service.handleQuery(input) as ServiceResult<WorkspaceResponse>;
      const api = mockApi({ language, onProjects: query, onProperties: query, onCreations: query, onObservation: query, onWorkspace: async (input) => {
        if (input.type === "workspace.getProjectRename") { statuses.push(input); return query(input); }
        if (input.type === "workspace.renameProject") {
          renames.push(input); const result = service.workspaces.renameProject(input); assert.equal(unwrap(result).outcome, "completed");
          return fail("service_unavailable"); // Native effect and commit succeeded; only the response is lost.
        }
        return (input.type === "workspace.load" ? service.handleQuery(input) : service.handleCommand(input)) as ServiceResult<WorkspaceResponse>;
      } });
      off = service.workspaces.subscribe(api.emitChange); render(<App />);
      await userEvent.click(await screen.findByRole("button", { name: `${t("renameProject")}: Original` }));
      const input = screen.getByRole("textbox", { name: t("projectName") });
      await userEvent.clear(input); await userEvent.type(input, "  Renamed Текст 📝  {Enter}");
      await screen.findByText(t("renameUncertain"));
      await act(async () => { api.emitStatus("unavailable"); api.emitStatus("ready"); });
      await userEvent.click(await screen.findByRole("button", { name: t("renameStatus") }));
      await screen.findByText(t("renameSaved"));
      const after = unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId }));
      assert.equal(after.projects[0].projectId, project.projectId); assert.equal(after.projects[0].categoryId, project.categoryId);
      assert.equal(after.projects[0].name, "  Renamed Текст 📝  "); assert.equal(after.revision, before.revision + 1);
      assert.equal(unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId })).values[0].value, exactText);
      assert.equal(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId: sibling.workspaceId })).projects[0].projectId, project.projectId);
      assert.deepEqual(readdirSync(parent), ["  Renamed Текст 📝  "]);
      assert.equal(renames.length, 1); assert.equal(statuses.length, 1);
      const command = renames[0]; assert.equal(command.type, "workspace.renameProject");
      if (command.type !== "workspace.renameProject") throw new Error("Unexpected command");
      assert.deepEqual(statuses[0], { type: "workspace.getProjectRename", workspaceId, operationId: command.operationId });
      cleanup(); off(); off = undefined; service.close(); service = openRenameService(database);
      assert.deepEqual(unwrap(service.workspaces.listProjects({ type: "workspace.listProjects", workspaceId })).projects, after.projects);
      assert.equal(unwrap(service.workspaces.listTextProperties({ type: "workspace.listTextProperties", workspaceId })).values[0].value, exactText);
    } finally { cleanup(); off?.(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});
