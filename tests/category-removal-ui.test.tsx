import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { CategoryRemovalPanel } from "../src/renderer/components/CategoryRemovalPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { act, render, screen, cleanup, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
const categories = [{ categoryId: "original", relativePath: "Original", name: "Original" }, { categoryId: "destination", relativePath: "Destination", name: "Destination" }];
const project = { projectId: "p", originalRelativePath: "Original/Project", requestedRelativePath: "Destination/Project" };
const operation = { operationId: "op", sourceId: "s", categoryId: "original", destinationCategoryId: "destination", originalRelativePath: "Original", destinationRelativePath: "Destination", stage: "moving", problem: "permission_denied", completedRevision: null, projects: [{ ...project, outcome: "rejected", problem: "permission_denied" }] };
for (const language of ["en", "ru"] as const) {
  test(`${language}: keyboard preview and cancel are read-only; Apply is explicit`, async () => {
    const calls: string[] = [], t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const api = { workspace: async (input: { type: string; operationId?: string }) => {
      calls.push(input.type);
      if (input.type === "workspace.listCategoryRemovals") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
      if (input.type === "workspace.previewCategoryRemoval") return { ok: true, value: { workspaceId: "w", sourceId: "s", categoryId: "original", destinationCategoryId: "destination", originalRelativePath: "Original", destinationRelativePath: "Destination", revision: 1, projects: [project], blockers: [], previewToken: "token" } };
      return { ok: true, value: { operation: { ...operation, operationId: input.operationId, stage: "completed", problem: null, projects: [{ ...project, outcome: "completed", problem: null }] } } };
    } } as unknown as WorkspaceDesktopApi;
    let committed = 0;
    render(<CategoryRemovalPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={categories} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => committed++} />);
    const user = userEvent.setup({ document });
    const trigger = screen.getByRole("button", { name: t("removalTitle") }); trigger.focus(); await user.keyboard("{Enter}");
    await user.selectOptions(await screen.findByLabelText(t("removalCategory")), "original");
    await user.selectOptions(screen.getByLabelText(t("removalDestination")), "destination");
    await user.click(screen.getByRole("button", { name: t("removalPreview") }));
    await screen.findByText(t("removalEffect"));
    assert.equal(calls.includes("workspace.applyCategoryRemoval"), false);
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByText(t("removalEffect")), null);
    await user.click(screen.getByRole("button", { name: t("removalPreview") }));
    await user.click(await screen.findByRole("button", { name: t("removalApply") }));
    await waitFor(() => assert.equal(committed, 1));
    assert.equal(calls.filter(c => c === "workspace.applyCategoryRemoval").length, 1);
  });
}

test("a lost Apply response retains its ID and checks status without replay", async () => {
  const calls: { type: string; operationId?: string }[] = [];
  let rejectApply: (error: Error) => void = () => { throw new Error("Apply was not dispatched"); };
  const api = { workspace: async (input: { type: string; operationId?: string }) => {
    calls.push(input);
    if (input.type === "workspace.listCategoryRemovals") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewCategoryRemoval") return { ok: true, value: { workspaceId: "w", sourceId: "s", categoryId: "original", destinationCategoryId: "destination", originalRelativePath: "Original", destinationRelativePath: "Destination", revision: 1, projects: [project], blockers: [], previewToken: "token" } };
    if (input.type === "workspace.applyCategoryRemoval") return new Promise((_resolve, reject) => { rejectApply = reject; });
    return { ok: true, value: { workspaceId: "w", sourceId: "s", operation: { ...operation, operationId: input.operationId, stage: "completed", problem: null, projects: [{ ...project, outcome: "completed", problem: null }] } } };
  } } as unknown as WorkspaceDesktopApi;
  const user = userEvent.setup({ document }); let committed = 0;
  render(<CategoryRemovalPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={categories} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => committed++} />);
  await user.click(screen.getByRole("button", { name: "Remove category" }));
  await user.selectOptions(screen.getByLabelText("Category to remove"), "original"); await user.selectOptions(screen.getByLabelText("Destination for its projects"), "destination");
  await user.click(screen.getByRole("button", { name: "Preview category removal" }));
  const apply = await screen.findByRole("button", { name: "Move projects and remove empty category" });
  await act(async () => { apply.click(); apply.click(); });
  await act(async () => { rejectApply(new Error("Lost reply")); });
  await screen.findByText(translate("en", "removalUnknown"));
  assert.equal((screen.getByRole("button", { name: "Close category removal" }) as HTMLButtonElement).disabled, true);
  assert.equal(committed, 0);
  await user.click(screen.getByRole("button", { name: "Check category removal outcome" }));
  await waitFor(() => assert.equal(committed, 1));
  assert.equal(calls.filter(c => c.type === "workspace.applyCategoryRemoval").length, 1);
  assert.equal(calls.find(c => c.type === "workspace.getCategoryRemoval")?.operationId, calls.find(c => c.type === "workspace.applyCategoryRemoval")?.operationId);
});

for (const language of ["en", "ru"] as const) {
  test(`${language}: saved partial results require a fresh explicit retry`, async () => {
    const calls: string[] = [], t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    let done = false;
    const api = { workspace: async (input: { type: string }) => {
      calls.push(input.type);
      if (input.type === "workspace.listCategoryRemovals") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: done ? [] : [operation] } };
      if (input.type === "workspace.previewCategoryRemovalRecovery") return { ok: true, value: { workspaceId: "w", sourceId: "s", operation, actions: ["retry_remaining", "abandon"], previewToken: "recovery" } };
      done = true; return { ok: true, value: { operation: { ...operation, stage: "completed", problem: null, projects: [{ ...project, outcome: "completed", problem: null }] } } };
    } } as unknown as WorkspaceDesktopApi;
    const user = userEvent.setup({ document });
    render(<CategoryRemovalPanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" categories={categories} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} />);
    await user.click(screen.getByRole("button", { name: t("removalTitle") }));
    await screen.findByText(t("removalPermission"));
    assert.equal(calls.includes("workspace.recoverCategoryRemoval"), false);
    await user.click(screen.getByRole("button", { name: t("categoryReviewRecovery") }));
    const retry = await screen.findByRole("button", { name: t("removalRetry") });
    retry.focus(); await user.keyboard("{Enter}");
    await screen.findByText(t("removalCompleted"));
    assert.equal(calls.filter(c => c === "workspace.recoverCategoryRemoval").length, 1);
    assert.equal(calls.includes("workspace.applyCategoryRemoval"), false);
  });
}
