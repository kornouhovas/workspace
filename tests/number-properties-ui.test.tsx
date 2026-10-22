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
  test(`${language} keyboard creates Number, computes, retains invalid draft, cancels and clears through real service`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "number-ui-")), root = join(directory, "root");
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
      render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false} hideReveal />);
      const create = await findAction("button", { name: t("addProperty") });
      await waitFor(() => assert.equal(create.hasAttribute("disabled"), false));
      create.focus(); await user.keyboard("{Enter}");
      await user.selectOptions(screen.getByRole("combobox", { name: t("propertyType") }), "number");
      await user.click(screen.getByRole("textbox", { name: t("propertyName") }));
      await user.keyboard("Budget{Enter}");
      const label = `${language === "en" ? "Edit Number value" : "Редактировать Number-значение"}: Project / Budget`;
      const button = await findAction("button", { name: label });
      button.focus(); await user.keyboard("{Enter}");
      await user.keyboard(language === "en" ? "(2+3)*4/2+0.5{Enter}" : "(2+3)*4/2+0,5{Enter}");
      await waitFor(() => assert.equal(screen.getByRole("button", { name: label }).textContent, language === "en" ? "10.5" : "10,5"));
      assert.equal(document.activeElement, button);
      await user.keyboard("{Enter}"); await user.clear(screen.getByRole("textbox", { name: label }));
      await user.keyboard("1/0{Enter}");
      await screen.findByRole("alert");
      assert.equal(document.activeElement, screen.getByRole("textbox", { name: label }));
      assert.equal((screen.getByRole("textbox", { name: label }) as HTMLInputElement).value, "1/0");
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.numberValues[0].value, 10.5);
      await user.keyboard("{Escape}"); assert.equal(document.activeElement, button);
      await user.keyboard("{Enter}"); await user.clear(screen.getByRole("textbox", { name: label })); await user.keyboard("{Enter}");
      await waitFor(() => assert.equal(button.textContent, t("textValueAbsent")));
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}


for (const outcome of ["accepted", "newer", "lost"] as const) test(`${outcome} value reply observes current values without replay`, async () => {
  const directory = mkdtempSync(join(tmpdir(), "value-reply-ui-")), root = join(directory, "root");
  mkdirSync(root); mkdirSync(join(root, "Project"));
  const service = openSettingsService(join(directory, "app.sqlite"));
  const { workspaceId, sourceId } = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
  const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
  const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects;
  service.handleCommand({ type: "workspace.createProperty", workspaceId, name: "Budget", propertyType: "number" });
  let hold = false, mutations = 0, reads = 0;
  const releases: (() => void)[] = [];
  const api = {
    workspace: async (input: { type: string }) => {
      if (input.type === "workspace.setNumberValue") {
        hold = outcome === "accepted"; mutations++;
        const result = service.handleCommand(input);
        if (outcome === "newer") service.handleCommand({ ...input, expression: "84", workspaceId });
        if (outcome === "lost") throw new Error("Lost reply after commit");
        return result;
      }
      if (input.type === "workspace.listTextProperties") reads++;
      if (input.type === "workspace.listTextProperties" && hold) await new Promise<void>(resolve => releases.push(resolve));
      return input.type === "workspace.listTextProperties" ? service.handleQuery(input) : service.handleCommand(input);
    }, onWorkspaceChange: service.workspaces.subscribe,
  } as unknown as WorkspaceDesktopApi;
  try {
    const user = userEvent.setup({ document });
    render(<TextPropertiesTable client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language="en" disabled={false} hideReveal />);
    const label = "Edit Number value: Project / Budget";
    const button = await findAction("button", { name: label });
    await user.click(button); await user.keyboard("42{Enter}");
    if (outcome === "lost") { await screen.findByRole("alert"); await user.keyboard("{Escape}"); }
    await waitFor(() => {
      const saved = screen.getByRole("button", { name: label });
      assert.equal(saved.textContent, outcome === "newer" ? "84" : "42");
      assert.equal(saved.hasAttribute("disabled"), false, "The accepted complete snapshot must finish without an event-triggered read");
    });
    assert.equal(releases.length, 0, "The complete accepted reply avoids a duplicate property request");
    assert.equal(reads, outcome === "accepted" ? 1 : 2);
    assert.equal(mutations, 1);
    assert.equal(document.activeElement, (await findAction("button",{ name: label })));
  } finally {
    hold = false; for (const release of releases) release();
    cleanup(); service.close(); rmSync(directory, { recursive: true, force: true });
  }
});
