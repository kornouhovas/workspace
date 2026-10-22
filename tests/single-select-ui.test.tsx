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
for (const language of ["en", "ru"] as const) for (const surface of ["table", "board"] as const) {
  test(`${language} ${surface}: keyboard creates ordinary Select/options, edits presentation, assigns, retains hidden usages and clears through real service`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "select-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const workspaceId = workspace.workspaceId, sourceId = workspace.sourceId;
    const sibling = service.handleCommand({ type: "workspace.create", rootPath: root, name: "Sibling" }).value;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
    const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects;
    let failNextValue = true;
    const api = { workspace: async (input: { type: string }) => {
      if (input.type === "workspace.setSelectValue" && failNextValue) {
        failNextValue = false;
        return { ok: false, error: { code: "storage", message: "Fixture unavailable" } };
      }
      return input.type === "workspace.listTextProperties" ? service.handleQuery(input) : service.handleCommand(input);
    }, onWorkspaceChange: (listener: unknown) => service.workspaces.subscribe(listener) } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup();
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} layout={surface === "board" ? "board" : "table"} disabled={false} hideReveal />);
      const create = await findAction("button", { name: t("addProperty") });
      await waitFor(() => assert.equal(create.hasAttribute("disabled"), false));
      create.focus(); await user.keyboard("{Enter}");
      await user.selectOptions(screen.getByRole("combobox", { name: t("propertyType") }), "single_select");
      await user.click(screen.getByRole("textbox", { name: t("propertyName") })); await user.keyboard("Status{Enter}");
      const optionAction = async (name: string) => {
        if (!screen.queryByRole("dialog")) await user.click(await screen.findByRole("button", {name: `${t("editSelectValue")}: Project / Status`}));
        const summary = await screen.findByText(`${t("selectOptions")}: Status`);
        if (!summary.closest("details")?.open) await user.click(summary);
        return findAction("button", {name});
      };
      await user.click(await screen.findByRole("button", {name: `${t("editSelectValue")}: Project / Status`}));
      const summary = await screen.findByText(`${t("selectOptions")}: Status`); await user.click(summary);
      await screen.findByText(t("selectOptionsEmpty"));
      const add = (await findAction("button",{ name: t("selectAddOption") }));
      add.focus(); await user.keyboard("{Enter}");
      await user.keyboard("{Enter}"); await screen.findByRole("alert");
      assert.equal(document.activeElement, screen.getByRole("textbox", { name: t("selectOptionName") }));
      await user.keyboard("Ready");
      await user.selectOptions(screen.getByRole("combobox", { name: t("categoryColor") }), "blue");
      await user.click((await findAction("button",{ name: t("savePropertyName") })));
      await waitFor(() => assert.equal(document.activeElement, add));
      await user.keyboard("{Escape}");
      const label = `${t("editSelectValue")}: Project / Status`;
      const button = (await findAction("button",{ name: label }));
      button.focus(); await user.keyboard("{Enter}");
      let editor = screen.getByRole("combobox", { name: label });
      const optionId = service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.selectOptions[0].optionId;
      await user.selectOptions(editor, optionId);
      await screen.findByRole("alert");
      assert.equal((screen.getByRole("combobox", { name: label }) as HTMLSelectElement).value, optionId);
      assert.equal(document.activeElement, screen.getByRole("combobox", { name: label }));
      assert.deepEqual(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.selectValues, []);
      await user.click(screen.getByRole("button", { name: t("saveTextValue") }));
      await waitFor(() => assert.equal(button.textContent, "Ready")); assert.equal(document.activeElement, button);
      await user.click((await optionAction(`${t("selectHide")}: Ready`)));
      await optionAction(`${t("selectShow")}: Ready`);
      assert.equal(button.textContent, "Ready");
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId: sibling.workspaceId }).value.selectOptions[0].hidden, false);
      await user.click((await optionAction(`${t("selectEditOption")}: Ready`)));
      let name = screen.getByRole("textbox", { name: t("selectOptionName") }); await user.clear(name); await user.type(name, "Draft name");
      const propertyId = service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.definitions[0].propertyId;
      assert.equal(service.handleCommand({ type: "workspace.updateSelectOption", workspaceId: sibling.workspaceId, propertyId, optionId, name: "Sibling draft change", color: "purple" }).ok, true);
      await screen.findByText(language === "en" ? "This option changed in another workspace. Save submits your retained name and color; Cancel shows the latest option." : "Опция изменилась в другом рабочем пространстве. Сохранение отправит ваши название и цвет; отмена покажет текущую опцию.");
      assert.equal((name as HTMLInputElement).value, "Draft name");
      assert.equal((screen.getByRole("combobox", { name: t("categoryColor") }) as HTMLSelectElement).value, "blue");
      await user.keyboard("{Escape}");
      await waitFor(() => assert.equal(button.textContent, "Sibling draft change"));
      await user.click((await optionAction(`${t("selectEditOption")}: Sibling draft change`)));
      name = screen.getByRole("textbox", { name: t("selectOptionName") });
      assert.equal((name as HTMLInputElement).value, "Sibling draft change");
      assert.equal((screen.getByRole("combobox", { name: t("categoryColor") }) as HTMLSelectElement).value, "purple");
      await user.clear(name); await user.type(name, "Готово");
      await user.selectOptions(screen.getByRole("combobox", { name: t("categoryColor") }), "green");
      assert.equal(service.handleCommand({ type: "workspace.updateSelectOption", workspaceId: sibling.workspaceId, propertyId, optionId, name: "Another sibling change", color: "yellow" }).ok, true);
      await screen.findByText(language === "en" ? "This option changed in another workspace. Save submits your retained name and color; Cancel shows the latest option." : "Опция изменилась в другом рабочем пространстве. Сохранение отправит ваши название и цвет; отмена покажет текущую опцию.");
      assert.equal((name as HTMLInputElement).value, "Готово");
      await user.click((await findAction("button",{ name: t("savePropertyName") })));
      await waitFor(() => assert.equal(button.textContent, "Готово"));
      assert.equal(service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.selectOptions[0].color, "green");
      await user.keyboard("{Escape}");
      button.focus(); await user.keyboard("{Enter}"); editor = screen.getByRole("combobox", { name: label });
      assert.equal((editor as HTMLSelectElement).value, optionId);
      await user.click((await findAction("button",{ name: t("clearTextValue") })));
      await waitFor(() => assert.equal(button.textContent, t("textValueAbsent")));
      await user.keyboard("{Enter}"); assert.equal(screen.queryByRole("option", { name: /Готово/ }), null);
      await user.keyboard("{Escape}"); assert.equal(document.activeElement, button);
      // Sibling changes reload this mounted Table without transferring its visibility.
      assert.equal(service.handleCommand({ type: "workspace.updateSelectOption", workspaceId: sibling.workspaceId, propertyId: service.handleQuery({ type: "workspace.listTextProperties", workspaceId }).value.definitions[0].propertyId, optionId, name: "Shared rename", color: "red" }).ok, true);
      await optionAction(`${t("selectShow")}: Shared rename`);
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}
