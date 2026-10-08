import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import type { ServiceResult, Settings } from "../src/contracts/settings.js";
import { App } from "../src/renderer/App.js";
import { translate } from "../src/renderer/localization.js";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  HTMLElement: browser.HTMLElement,
  Node: browser.Node,
  MutationObserver: browser.MutationObserver,
});
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });

const { cleanup, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

const success = (language: "en" | "ru"): ServiceResult<Settings> => ({
  ok: true,
  value: { language },
});

function mockApi(
  settings: WorkspaceDesktopApi["settings"],
  state: "ready" | "unavailable" = "ready",
) {
  window.workspace = {
    getBackendStatus: async () => ({ state }),
    onBackendStatus: () => () => undefined,
    settings,
  };
}

test("initially loads English and switches language only after a successful save", async () => {
  const calls: string[] = [];
  mockApi(async (input) => {
    calls.push(input.type);
    if (input.type === "settings.load") return success("en");
    return success(input.language);
  });

  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Interface language" });
  assert.equal((selector as HTMLSelectElement).value, "en");
  await userEvent.tab();
  assert.equal(document.activeElement, selector);
  await userEvent.selectOptions(selector, "ru");
  await waitFor(() => assert.equal((selector as HTMLSelectElement).value, "ru"));
  assert.deepEqual(calls, ["settings.load", "settings.setLanguage"]);
  assert.ok(screen.getByText("Настройки"));
  cleanup();
});

test("loads and displays a previously saved Russian preference", async () => {
  mockApi(async () => success("ru"));
  render(<App />);
  const selector = await screen.findByRole("combobox", { name: "Язык интерфейса" });
  assert.equal((selector as HTMLSelectElement).value, "ru");
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
  assert.equal(screen.queryByText("ignored service detail"), null);
  cleanup();
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
