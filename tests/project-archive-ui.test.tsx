import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { ProjectArchivePanel } from "../src/renderer/components/ProjectArchivePanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
import { translate } from "../src/renderer/localization.js";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, waitFor } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
for (const language of ["en", "ru"] as const) test(`${language}: archive review requires explicit Apply and keyboard cancel restores focus`, async () => {
  const calls: string[] = [], t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const api = { workspace: async (input: { type: string }) => {
    calls.push(input.type);
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    throw new Error("No command authorized by this test");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[{ projectId: "p", categoryId: null, name: "Project", relativePath: "Project" }]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const user = userEvent.setup({ document });
  await user.selectOptions(await screen.findByLabelText(t("archiveProject")), "p");
  const review = screen.getByRole("button", { name: t("archiveReview") }); review.focus(); await user.keyboard("{Enter}");
  await screen.findByRole("button", { name: t("archiveApply") });
  await user.keyboard("{Escape}");
  await waitFor(() => assert.equal(document.activeElement, review));
  assert.equal(calls.some(c => c === "workspace.applyProjectArchive"), false);
});

test("a lost Apply response keeps its exact request and checks status without another move", async () => {
  const calls: { type: string; operationId?: string; previewToken?: string }[] = [];
  let acceptedId = "";
  const api = { workspace: async (input: { type: string; operationId?: string; previewToken?: string }) => {
    calls.push(input);
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    if (input.type === "workspace.applyProjectArchive") { acceptedId = input.operationId!; throw new Error("Lost reply"); }
    if (input.type === "workspace.getProjectArchiveOperation") return { ok: true, value: { operation: { operationId: acceptedId, sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "completed", problem: null, completedRevision: 2 } } };
    throw new Error("Unexpected request");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  let committed = 0;
  render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[{ projectId: "p", categoryId: null, name: "Project", relativePath: "Project" }]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => committed++} onViewChange={() => {}} />);
  const user = userEvent.setup({ document });
  await user.selectOptions(await screen.findByLabelText("Project to archive"), "p");
  await user.click(screen.getByRole("button", { name: "Review archive" }));
  await user.click(await screen.findByRole("button", { name: "Archive project" }));
  await screen.findByText(translate("en", "archiveUnknown"));
  assert.equal((screen.getByLabelText("Project to archive") as HTMLSelectElement).disabled, true);
  await user.click(screen.getByRole("button", { name: "Check saved outcome" }));
  await waitFor(() => assert.equal(committed, 1));
  assert.equal(calls.filter(c => c.type === "workspace.applyProjectArchive").length, 1);
  assert.equal(calls.find(c => c.type === "workspace.getProjectArchiveOperation")?.operationId, acceptedId);
});
