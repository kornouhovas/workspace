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
import { TextPropertiesTable } from "../src/renderer/components/TextPropertiesTable.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window();
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver, CustomEvent: browser.CustomEvent, Element: browser.Element, NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement, ResizeObserver: browser.ResizeObserver, getComputedStyle: browser.getComputedStyle.bind(browser), requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser) });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// The actual backend receives every Table command through the typed client.
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) {
  test(`${language} keyboard creates Date, saves exact day, retains invalid draft, cancels and clears through real service`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "date-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const workspaceId = workspace.workspaceId, sourceId = workspace.sourceId;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
    const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects;
    const api = { workspace: async (input: { type: string }) => input.type === "workspace.listTextProperties" ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: (listener: unknown) => service.workspaces.subscribe(listener) } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup();
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      const mounted = render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false} hideReveal />);
      const create = await findAction("button", { name: t("addProperty") });
      await waitFor(() => assert.equal(create.hasAttribute("disabled"), false));
      create.focus(); await user.keyboard("{Enter}");
      await user.selectOptions(screen.getByRole("combobox", { name: t("propertyType") }), "date");
      await user.click(screen.getByRole("textbox", { name: t("propertyName") }));
      await user.keyboard("Deadline{Enter}");
      const label = `${language === "en" ? "Edit Date value" : "Редактировать Date-значение"}: Project / Deadline`;
      const button = await findAction("button", { name: label });
      button.focus(); await user.keyboard("{Enter}");
      await user.keyboard("2024-02-29{Enter}");
      await waitFor(() => assert.equal(screen.getByRole("button", { name: label }).textContent, language === "en" ? "Feb 29, 2024" : "29 февр. 2024 г."));
      assert.equal(document.activeElement, button);
      await user.keyboard("{Enter}"); await user.clear(screen.getByRole("textbox", { name: label }));
      await user.keyboard("2025-02-29{Enter}");
      await screen.findByRole("alert");
      assert.equal(document.activeElement, screen.getByRole("textbox", { name: label }));
      assert.equal((screen.getByRole("textbox", { name: label }) as HTMLInputElement).value, "2025-02-29");
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.dateValues[0].value, "2024-02-29");
      const otherLanguage = language === "en" ? "ru" : "en";
      mounted.rerender(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={otherLanguage} disabled={false} hideReveal />);
      const otherLabel = `${otherLanguage === "en" ? "Edit Date value" : "Редактировать Date-значение"}: Project / Deadline`;
      assert.equal((screen.getByRole("textbox", { name: otherLabel }) as HTMLInputElement).value, "2025-02-29", "language switching preserves invalid draft");
      await user.keyboard("{Escape}"); assert.equal(document.activeElement, button);
      assert.equal(button.textContent, otherLanguage === "en" ? "Feb 29, 2024" : "29 февр. 2024 г.");
      await user.keyboard("{Enter}");
      assert.equal((screen.getByRole("textbox", { name: otherLabel }) as HTMLInputElement).value, "2024-02-29", "editor uses canonical stored date");
      await user.clear(screen.getByRole("textbox", { name: otherLabel }));
      await user.keyboard("0001-01-01{Enter}");
      await waitFor(() => assert.equal(button.textContent, otherLanguage === "en" ? "Jan 1, 1" : "1 янв. 1 г."));
      mounted.rerender(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false} hideReveal />);
      await user.keyboard("{Enter}"); await user.clear(screen.getByRole("textbox", { name: label })); await user.keyboard("{Enter}");
      await waitFor(() => assert.equal(button.textContent, t("textValueAbsent")));
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}
