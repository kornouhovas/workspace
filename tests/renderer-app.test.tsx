import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import type { BackendStatus, WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import type { ServiceResult, Settings } from "../src/contracts/settings.js";
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

const success = (language: "en" | "ru"): ServiceResult<Settings> => ({
  ok: true,
  value: { language },
});

function mockApi(
  settings: WorkspaceDesktopApi["settings"],
  state: "ready" | "unavailable" = "ready",
) {
  let statusListener: ((status: BackendStatus) => void) | undefined;
  window.workspace = {
    getBackendStatus: async () => ({ state }),
    onBackendStatus: (listener) => {
      statusListener = listener;
      return () => { statusListener = undefined; };
    },
    settings,
    workspace: async () => ({ ok: false, error: { code: "invalid_input", message: "Not used in settings tests." } }),
    pickRoot: async () => ({ outcome: "cancelled" }),
  };
  return { emitStatus: (nextState: BackendStatus["state"]) => statusListener?.({ state: nextState }) };
}

test("initially loads English and switches language only after a successful save", async () => {
  const calls: string[] = [];
  let finishSave: ((result: ServiceResult<Settings>) => void) | undefined;
  const pendingSave = new Promise<ServiceResult<Settings>>((resolve) => { finishSave = resolve; });
  mockApi(async (input) => {
    calls.push(input.type);
    if (input.type === "settings.load") return success("en");
    return pendingSave;
  });

  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Interface language" });
  assert.equal((selector as HTMLSelectElement).value, "en");
  assert.equal(document.documentElement.lang, "en");
  await userEvent.tab();
  assert.equal(document.activeElement, selector);
  await userEvent.selectOptions(selector, "ru");
  assert.equal((selector as HTMLSelectElement).value, "en");
  assert.equal((selector as HTMLSelectElement).disabled, true);
  await act(async () => { finishSave?.(success("ru")); await pendingSave; });
  await waitFor(() => assert.equal((selector as HTMLSelectElement).value, "ru"));
  assert.equal(document.documentElement.lang, "ru");
  assert.deepEqual(calls, ["settings.load", "settings.setLanguage"]);
  assert.ok(screen.getByText("Настройки"));
  cleanup();
});

test("loads and displays a previously saved Russian preference", async () => {
  mockApi(async () => success("ru"));
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Язык интерфейса" });
  assert.equal((selector as HTMLSelectElement).value, "ru");
  assert.equal(document.documentElement.lang, "ru");
  assert.ok(screen.getByText("Рабочее пространство готово. Поиск проектов появится в одном из следующих обновлений."));
  cleanup();
});

test("shows startup failure instead of loading forever", async () => {
  mockApi(async () => success("en"), "unavailable");
  render(<App />);
  const heading = await screen.findByRole("heading", { name: "Local service unavailable" });
  assert.equal(heading.parentElement?.getAttribute("role"), "alert");
  assert.equal(screen.queryByText("Loading settings…"), null);
  cleanup();
});

test("an in-flight settings load cannot hide a backend failure", async () => {
  let finishLoad: ((result: ServiceResult<Settings>) => void) | undefined;
  let loadStarted = false;
  const pendingLoad = new Promise<ServiceResult<Settings>>((resolve) => { finishLoad = resolve; });
  const api = mockApi(() => { loadStarted = true; return pendingLoad; });
  render(<App />);
  await waitFor(() => assert.equal(loadStarted, true));
  act(() => api.emitStatus("unavailable"));
  await screen.findByRole("heading", { name: "Local service unavailable" });
  await act(async () => { finishLoad?.(success("en")); await pendingLoad; });
  assert.equal(screen.queryByRole("combobox"), null);
  assert.ok(screen.getByRole("heading", { name: "Local service unavailable" }));
  cleanup();
});

test("failed save keeps the current language and reports that it was not saved", async () => {
  mockApi(async (input) => input.type === "settings.load"
    ? success("en")
    : { ok: false, error: { code: "storage", message: "ignored service detail" } });
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Interface language" });
  await userEvent.selectOptions(selector, "ru");
  const heading = await screen.findByRole("heading", { name: "Language not saved" });
  assert.equal(heading.parentElement?.getAttribute("role"), "alert");
  assert.equal((selector as HTMLSelectElement).value, "en");
  assert.equal(document.documentElement.lang, "en");
  assert.equal(screen.queryByText("ignored service detail"), null);
  cleanup();
});

test("newer backend status events win over a delayed initial snapshot", async () => {
  let finishSnapshot: ((status: BackendStatus) => void) | undefined;
  const snapshot = new Promise<BackendStatus>((resolve) => { finishSnapshot = resolve; });
  const api = mockApi(async () => success("en"));
  window.workspace.getBackendStatus = () => snapshot;
  render(<App />);
  act(() => api.emitStatus("ready"));
  await screen.findByRole("combobox", { name: "Interface language" });
  await act(async () => { finishSnapshot?.({ state: "starting" }); await snapshot; });
  assert.ok(screen.getByRole("combobox", { name: "Interface language" }));
  cleanup();
});

test("typed client keeps settings envelopes outside the component", async () => {
  const calls: unknown[] = [];
  const api = mockApi(async (input) => { calls.push(input); return success("ru"); });
  const client = new WorkspaceServiceClient(window.workspace);
  assert.deepEqual(await client.loadSettings(), success("ru"));
  assert.deepEqual(await client.setLanguage("ru"), success("ru"));
  assert.deepEqual(await client.getBackendStatus(), { state: "ready" });
  const states: BackendStatus[] = [];
  const unsubscribe = client.onBackendStatus((status) => states.push(status));
  api.emitStatus("unavailable");
  unsubscribe();
  assert.deepEqual(states, [{ state: "unavailable" }]);
  assert.deepEqual(calls, [{ type: "settings.load" }, { type: "settings.setLanguage", language: "ru" }]);
});

test("falls back to English when a Russian translation is missing", () => {
  assert.equal(translate("ru", "appTitle"), "Workspace");
});

test("shows a localized error when loading settings fails", async () => {
  mockApi(async () => ({ ok: false, error: { code: "storage", message: "private detail" } }));
  render(<App />);
  const heading = await screen.findByRole("heading", { name: "Settings unavailable" });
  assert.equal(heading.parentElement?.getAttribute("role"), "alert");
  assert.equal(screen.queryByText("private detail"), null);
  cleanup();
});
