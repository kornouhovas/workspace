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
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// The actual backend receives every Table command through the typed client.
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) {
  test(`${language} keyboard edits MultiSelect sets, preserves hidden usages and retains failed and sibling-conflicted drafts`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "multi-select-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const workspaceId = workspace.workspaceId, sourceId = workspace.sourceId;
    const sibling = service.handleCommand({ type: "workspace.create", rootPath: root, name: "Sibling" }).value;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
    const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects;
    let failNext = true;
    let releaseFailure: (() => void) | undefined;
    const api = { workspace: async (input: { type: string }) => {
      if (input.type === "workspace.setMultiSelectValue" && failNext) {
        failNext = false;
        return new Promise(resolve => { releaseFailure = () => resolve({ ok: false, error: { code: "storage", message: "Fixture unavailable" } }); });
      }
      return input.type === "workspace.listTextProperties" ? service.handleQuery(input) : service.handleCommand(input);
    }, onWorkspaceChange: (listener: unknown) => service.workspaces.subscribe(listener) } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup();
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const list = () => service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value;
    try {
      render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} disabled={false} hideReveal />);
      const create = await findAction("button", { name: language === "en" ? "Create MultiSelect property" : "Создать MultiSelect-свойство" });
      await waitFor(() => assert.equal(create.hasAttribute("disabled"), false));
      create.focus(); await user.keyboard("{Enter}Tags{Enter}");
      await waitFor(() => assert.equal(document.activeElement, create));
      const propertyId = list().definitions[0].propertyId;
      const label = `${language === "en" ? "Edit MultiSelect value" : "Редактировать MultiSelect-значение"}: Project / Tags`;
      const button = (await findAction("button",{ name: label }));
      button.focus(); await user.keyboard("{Enter}");
      await within(screen.getByRole("group", { name: label })).findByText(t("selectOptionsEmpty"));
      await user.keyboard("{Escape}"); assert.equal(document.activeElement, button);
      for (const name of ["Ready", "Done", "Hidden"]) assert.equal(service.handleCommand({ type: "workspace.createSelectOption", workspaceId, propertyId, name, color: "blue" }).ok, true);
      const [ready, done, hidden] = list().selectOptions;
      service.handleCommand({ type: "workspace.setSelectOptionHidden", workspaceId, propertyId, optionId: hidden.optionId, hidden: true });
      await waitFor(() => assert.equal(list().selectOptions[2].hidden, true));
      await user.keyboard("{Enter}");
      const readyBox = await screen.findByRole("checkbox", { name: "Ready" });
      assert.equal(document.activeElement, readyBox);
      assert.equal(screen.queryByRole("checkbox", { name: "Hidden" }), null);
      await user.keyboard(" ");
      await user.tab(); assert.equal(document.activeElement, screen.getByRole("checkbox", { name: "Done" }));
      await user.keyboard(" {Enter}");
      await user.click(screen.getByRole("checkbox", { name: "Ready" }));
      assert.equal((screen.getByRole("checkbox", { name: "Ready" }) as HTMLInputElement).checked, true);
      assert.equal(((await findAction("button",{ name: t("cancelTextValue") })) as HTMLButtonElement).disabled, true);
      await findAction("button", { name: t("textValueSaving") });
      assert.ok(releaseFailure); releaseFailure();
      await screen.findByRole("alert"); assert.deepEqual(list().multiSelectValues, []);
      assert.equal((screen.getByRole("checkbox", { name: "Ready" }) as HTMLInputElement).checked, true);
      assert.equal((screen.getByRole("checkbox", { name: "Done" }) as HTMLInputElement).checked, true);
      await user.keyboard("{Enter}");
      await waitFor(() => assert.equal(button.textContent, "ReadyDone")); assert.equal(document.activeElement, button);
      assert.equal(list().multiSelectValues.length, 2);
      service.handleCommand({ type: "workspace.setSelectOptionHidden", workspaceId, propertyId, optionId: ready.optionId, hidden: true });
      await user.keyboard("{Enter}");
      const assigned = await screen.findByRole("checkbox", { name: `Ready (${t("selectHidden")})` });
      await user.click(assigned);
      service.handleCommand({ type: "workspace.setMultiSelectValue", workspaceId: sibling.workspaceId, propertyId, projectId: projects[0].projectId, optionIds: [done.optionId] });
      await screen.findByText(t("textValueExternalChange"));
      assert.equal((screen.getByRole("checkbox", { name: `Ready (${t("selectHidden")})` }) as HTMLInputElement).checked, false);
      await user.keyboard("{Escape}");
      await waitFor(() => assert.equal(button.textContent, "Done")); assert.equal(document.activeElement, button);
      await user.keyboard("{Enter}"); assert.equal(screen.queryByRole("checkbox", { name: /Ready/ }), null);
      await user.click((await findAction("button",{ name: t("clearTextValue") })));
      await waitFor(() => assert.equal(button.textContent, t("textValueAbsent")));
      assert.deepEqual(list().multiSelectValues, []);
      service.handleCommand({ type: "workspace.setMultiSelectValue", workspaceId: sibling.workspaceId, propertyId, projectId: projects[0].projectId, optionIds: [ready.optionId, done.optionId] });
      await waitFor(() => assert.equal(button.textContent, "ReadyDone"));
      await user.click(button); await user.click(screen.getByRole("checkbox", { name: `Ready (${t("selectHidden")})` }));
      await user.click((await findAction("button",{ name: t("saveTextValue") })));
      await waitFor(() => assert.equal(button.textContent, "Done"));
      assert.deepEqual(list().multiSelectValues.map((v: { optionId: string }) => v.optionId), [done.optionId]);
      await user.click(button); await user.click((await findAction("button",{ name: t("clearTextValue") })));
      service.handleCommand({ type: "workspace.setSelectOptionHidden", workspaceId, propertyId, optionId: done.optionId, hidden: true });
      await user.click(button);
      await within(screen.getByRole("group", { name: label })).findByText(t("multiSelectNoVisibleOptions"));
      assert.equal(document.activeElement, (await findAction("button",{ name: t("saveTextValue") })));
      await user.keyboard("{Escape}"); assert.equal(document.activeElement, button);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}
