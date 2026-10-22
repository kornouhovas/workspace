import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { CategoryOptionsPanel } from "../src/renderer/components/CategoryOptionsPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, CustomEvent: browser.CustomEvent, getComputedStyle: browser.getComputedStyle.bind(browser), MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
for (const language of ["en", "ru"] as const) {
  test(`${language}: preview lists the physical effect; Escape cancels without mutation and Apply is explicit`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const calls: string[] = [];
    const api = { workspace: async (input: { type: string; operationId?: string }) => {
      calls.push(input.type);
      if (input.type === "workspace.listCategoryPresentation") return { ok: true, value: { workspaceId: "w", sourceId: "s", options: [] } };
      if (input.type === "workspace.listCategoryFolderOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
      if (input.type === "workspace.previewCategoryFolder") return { ok: true, value: { workspaceId: "w", sourceId: "s", action: "create", categoryId: null, originalRelativePath: null, requestedRelativePath: "New", revision: 1, affectedProjects: [], previewToken: "token" } };
      return { ok: true, value: { outcome: "completed", operation: { operationId: input.operationId, sourceId: "s", categoryId: "new", action: "create", stage: "completed", originalRelativePath: null, requestedRelativePath: "New", completedRevision: 2, problem: null } } };
    } } as unknown as WorkspaceDesktopApi;
    const user = userEvent.setup({ document: globalThis.document });
    let commits = 0;
    render(<CategoryOptionsPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={[]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => commits++} />);
    await user.click(screen.getByRole("button", { name: t("categoryOptions") }));
    await screen.findByRole("dialog", { name: t("categoryOptions") });
    await screen.findByLabelText(t("categoryFolderName"));
    await user.type(screen.getByLabelText(t("categoryFolderName")), "New");
    await user.click(screen.getByRole("button", { name: t("categoryPreview") }));
    await screen.findByText(t("categoryPhysicalEffect"));
    assert.equal(calls.includes("workspace.applyCategoryFolder"), false);
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByText(t("categoryPhysicalEffect")), null);
    assert.equal(calls.includes("workspace.applyCategoryFolder"), false);
    await user.click(screen.getByRole("button", { name: t("categoryPreview") }));
    await user.click(await screen.findByRole("button", { name: t("categoryApply") }));
    await waitFor(() => assert.equal(commits, 1));
    assert.equal(calls.filter(c => c === "workspace.applyCategoryFolder").length, 1);
  });
}

test("a lost Apply response retains its operation ID and checks status without replaying the mutation", async () => {
  const calls: { type: string; operationId?: string }[] = [];
  const api = { workspace: async (input: { type: string; operationId?: string }) => {
    calls.push(input);
    if (input.type === "workspace.listCategoryPresentation") return { ok: true, value: { workspaceId: "w", sourceId: "s", options: [] } };
    if (input.type === "workspace.listCategoryFolderOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewCategoryFolder") return { ok: true, value: { workspaceId: "w", sourceId: "s", action: "create", categoryId: null, originalRelativePath: null, requestedRelativePath: "New", revision: 1, affectedProjects: [], previewToken: "token" } };
    if (input.type === "workspace.applyCategoryFolder") throw new Error("Transport disconnected after dispatch");
    return { ok: true, value: { outcome: "completed", operation: { operationId: input.operationId, sourceId: "s", categoryId: "new", action: "create", stage: "completed", originalRelativePath: null, requestedRelativePath: "New", completedRevision: 2, problem: null } } };
  } } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document: globalThis.document }); let commits = 0;
  render(<CategoryOptionsPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={[]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => commits++} />);
  await user.click(screen.getByRole("button", { name: "Category options" }));
  await user.type(await screen.findByLabelText("Folder name"), "New");
  await user.click(screen.getByRole("button", { name: "Preview folder effect" }));
  await user.click(await screen.findByRole("button", { name: "Apply folder operation" }));
  await screen.findByText("The outcome is unknown. Check the saved operation before another folder action.");
  assert.equal(commits, 0);
  assert.equal(calls.filter(c => c.type === "workspace.applyCategoryFolder").length, 1);
  await user.click(screen.getByRole("button", { name: "Check operation outcome" }));
  await waitFor(() => assert.equal(commits, 1));
  assert.equal(calls.filter(c => c.type === "workspace.applyCategoryFolder").length, 1);
  assert.equal(calls.find(c => c.type === "workspace.getCategoryFolderOperation")?.operationId, calls.find(c => c.type === "workspace.applyCategoryFolder")?.operationId);
});

test("keyboard option ordering saves stable category IDs through presentation only", async () => {
  let saved: unknown;
  const api = { workspace: async (input: { type: string; options?: unknown }) => {
    if (input.type === "workspace.listCategoryFolderOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.setCategoryPresentation") { saved = input.options; return { ok: true, value: { workspaceId: "w", sourceId: "s", options: input.options } }; }
    if (input.type === "workspace.listCategoryPresentation") return { ok: true, value: { workspaceId: "w", sourceId: "s", options: [
      { categoryId: "first", color: "default", hidden: false, position: 0 }, { categoryId: "second", color: "blue", hidden: false, position: 1 },
    ] } };
    throw new Error("Folder mutations are unavailable in a presentation test");
  } } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document: globalThis.document });
  render(<CategoryOptionsPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={[{ categoryId: "first", name: "First", relativePath: "First" }, { categoryId: "second", name: "Second", relativePath: "Second" }]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} />);
  await user.click(screen.getByRole("button", { name: "Category options" }));
  const down = await screen.findByRole("button", { name: "Move down: First" });
  down.focus(); await user.keyboard("{Enter}");
  const save = screen.getByRole("button", { name: "Save presentation" }); save.focus(); await user.keyboard("{Enter}");
  await waitFor(() => assert.deepEqual(saved, [{ categoryId: "second", color: "blue", hidden: false, position: 0 }, { categoryId: "first", color: "default", hidden: false, position: 1 }]));
});

test("Escape cancels the review first, then dismisses the dialog to its visible context trigger", async () => {
  const { ContextTools } = await import("../src/renderer/components/ContextTools.js");
  const api = { workspace: async (input: {type:string}) => {
    if(input.type === "workspace.listCategoryPresentation") return {ok:true,value:{workspaceId:"w",sourceId:"s",options:[]}};
    if(input.type === "workspace.listCategoryFolderOperations") return {ok:true,value:{workspaceId:"w",sourceId:"s",operations:[]}};
    if(input.type === "workspace.previewCategoryFolder") return {ok:true,value:{workspaceId:"w",sourceId:"s",action:"create",categoryId:null,originalRelativePath:null,requestedRelativePath:"New",revision:1,affectedProjects:[],previewToken:"token"}};
    throw new Error("Cancellation must not mutate");
  }} as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({document});
  render(<ContextTools label="Source tools"><CategoryOptionsPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={[]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={()=>{}}/></ContextTools>);
  const source = screen.getByRole("button",{name:"Source tools"});
  await user.click(source);await user.click(screen.getByRole("button",{name:"Category options"}));
  await user.type(await screen.findByLabelText("Folder name"),"New");
  await user.click(screen.getByRole("button",{name:"Preview folder effect"}));
  await screen.findByRole("button",{name:"Apply folder operation"});
  await user.keyboard("{Escape}");
  assert.ok(screen.getByRole("dialog",{name:"Category options"}));
  assert.equal(document.activeElement,screen.getByLabelText("Folder name"));
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("dialog",{name:"Category options"}),null);
  assert.equal(document.activeElement,source);
});
