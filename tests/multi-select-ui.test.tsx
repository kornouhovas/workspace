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
const { cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// The actual backend receives every Table command through the typed client.
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) for (const surface of ["table", "board", "details"] as const) {
  test(`${language} ${surface}: immediate MultiSelect choices, hidden removal, empty and sibling ownership`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "multi-select-ui-")), root = join(directory, "root");
    mkdirSync(root); mkdirSync(join(root, "Project"));
    const service = openSettingsService(join(directory, "workspace.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const workspaceId = workspace.workspaceId, sourceId = workspace.sourceId;
    const sibling = service.handleCommand({ type: "workspace.create", rootPath: root, name: "Sibling" }).value;
    const preview = service.handleQuery({ type: "workspace.previewDiscovery", workspaceId }).value;
    const projects = service.handleCommand({ type: "workspace.applyDiscovery", workspaceId, previewToken: preview.previewToken }).value.projects;
    const propertyId = service.handleCommand({type:"workspace.createProperty",workspaceId,name:"Tags",propertyType:"multi_select"}).value.propertyId;
    for (const name of ["Ready", "Done", "Hidden"]) service.handleCommand({type:"workspace.createSelectOption",workspaceId,propertyId,name,color:"blue"});
    const list = (id = workspaceId) => service.handleQuery({type:"workspace.listTextProperties",workspaceId:id}).value;
    const singleId=service.handleCommand({type:"workspace.createProperty",workspaceId,name:"State",propertyType:"single_select"}).value.propertyId;
    const singleOption=service.handleCommand({type:"workspace.createSelectOption",workspaceId,propertyId:singleId,name:"Active",color:"green"}).value.snapshot.selectOptions.find((option:{propertyId:string})=>option.propertyId===singleId).optionId;
    const [ready,done,hidden]=list().selectOptions.filter((option:{propertyId:string})=>option.propertyId===propertyId);
    service.handleCommand({type:"workspace.setSelectOptionHidden",workspaceId,propertyId,optionId:hidden.optionId,hidden:true});
    const api = { workspace: async (input: { type: string }) => input.type === "workspace.listTextProperties" ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: (listener: unknown) => service.workspaces.subscribe(listener) } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup();
    const t = (key: Parameters<typeof translate>[1]) => translate(language,key);
    const label = `${t("editMultiSelectValue")}: Project / Tags`;
    try {
      render(<TextPropertiesTable client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} language={language} layout={surface === "board" ? "board" : "table"} detail={surface === "details"} disabled={false} hideReveal />);
      const singleLabel=`${t("editSelectValue")}: Project / State`;
      const single=await screen.findByRole("button",{name:singleLabel});await user.click(single);
      await user.selectOptions(screen.getByRole("combobox",{name:singleLabel}),singleOption);
      await waitFor(()=>assert.equal(single.textContent,"Active"));
      await waitFor(()=>assert.equal(screen.queryByRole("dialog",{name:singleLabel}),null));
      assert.equal(list(sibling.workspaceId).selectValues[0].optionId,singleOption);
      const button=await screen.findByRole("button",{name:label}); await user.click(button);
      assert.equal(screen.queryByRole("checkbox",{name:"Hidden"}),null);
      const readyBox=screen.getByRole("checkbox",{name:"Ready"}); assert.equal(document.activeElement,readyBox);
      await user.keyboard(" "); await user.click(screen.getByRole("checkbox",{name:"Done"}));
      await waitFor(()=>assert.equal(list().multiSelectValues.length,2));
      assert.ok(screen.getByRole("checkbox",{name:"Done"}));
      await user.keyboard("{Escape}"); await waitFor(()=>assert.equal(document.activeElement,button));
      assert.equal(button.textContent,"ReadyDone");
      service.handleCommand({type:"workspace.setSelectOptionHidden",workspaceId,propertyId,optionId:ready.optionId,hidden:true});
      await user.click(button);
      await user.click(await screen.findByRole("checkbox",{name:`Ready (${t("selectHidden")})`}));
      await waitFor(()=>assert.deepEqual(list().multiSelectValues.map((v:{optionId:string})=>v.optionId),[done.optionId]));
      await user.keyboard("{Escape}");await user.click(button);
      assert.equal(screen.queryByRole("checkbox",{name:/Ready/}),null);
      // The same menu exposes the ordinary option manager on each surface.
      const menu=screen.getByRole("dialog",{name:label});
      await user.click(within(menu).getByText(`${t("selectOptions")}: Tags`));
      await user.click(within(menu).getByRole("button",{name:`${t("selectEditOption")}: Done`}));
      const name=within(menu).getByRole("textbox",{name:t("selectOptionName")});
      await user.clear(name);await user.type(name,"Renamed");await user.keyboard("{Enter}");
      await waitFor(()=>assert.equal(list(sibling.workspaceId).selectOptions.find((option:{optionId:string})=>option.optionId===done.optionId).name,"Renamed"));
      assert.equal(list(sibling.workspaceId).selectOptions.find((option:{optionId:string})=>option.optionId===ready.optionId).hidden,false);
      await user.click(within(menu).getByRole("button",{name:t("clearTextValue")}));
      await waitFor(()=>assert.deepEqual(list().multiSelectValues,[]));
      await user.keyboard("{Escape}"); assert.equal(button.textContent,t("textValueAbsent"));
      service.handleCommand({type:"workspace.setMultiSelectValue",workspaceId:sibling.workspaceId,propertyId,projectId:projects[0].projectId,optionIds:[hidden.optionId]});
      await waitFor(()=>assert.equal(button.textContent,"Hidden"));
      await user.click(button);await user.click(screen.getByRole("checkbox",{name:`Hidden (${t("selectHidden")})`}));
      await waitFor(()=>assert.deepEqual(list().multiSelectValues,[]));
    } finally {cleanup();service.close();rmSync(directory,{recursive:true,force:true});}
  });
}
