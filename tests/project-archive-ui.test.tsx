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
const { render, screen, cleanup, waitFor, fireEvent, act } = await import("@testing-library/react");
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
  const projectSelect = await screen.findByLabelText(t("archiveProject")) as HTMLSelectElement;
  await waitFor(() => assert.equal(projectSelect.disabled, false));
  await user.selectOptions(projectSelect, "p");
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
  const projectSelect = await screen.findByLabelText("Project to archive") as HTMLSelectElement;
  await waitFor(() => assert.equal(projectSelect.disabled, false));
  await user.selectOptions(projectSelect, "p");
  await user.click(screen.getByRole("button", { name: "Review archive" }));
  await user.click(await screen.findByRole("button", { name: "Archive project" }));
  await screen.findByText(translate("en", "archiveUnknown"));
  assert.equal((screen.getByLabelText("Project to archive") as HTMLSelectElement).disabled, true);
  await user.click(screen.getByRole("button", { name: "Check saved outcome" }));
  await waitFor(() => assert.equal(committed, 1));
  assert.equal(calls.filter(c => c.type === "workspace.applyProjectArchive").length, 1);
  assert.equal(calls.find(c => c.type === "workspace.getProjectArchiveOperation")?.operationId, acceptedId);
});

for (const language of ["en", "ru"] as const) {
  for (const scenario of ["occupied", "missing_parent", "incompatible_mode", "source_unavailable"] as const) {
    test(`${language}: restore ${scenario} shows a blocker and requires an explicit corrected review`, async () => {
      const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
      const calls: Record<string, unknown>[] = [];
      let corrected = false;
      const archivedProject = { projectId: "p", categoryId: "category", categoryName: "Client", name: "Project", relativePath: "Archive/Client/Project", originalRelativePath: "Client/Project" };
      const api = { workspace: async (input: Record<string, unknown>) => {
        calls.push(input);
        if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [archivedProject] } };
        if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
        if (input.type === "workspace.listTextProperties") return { ok: true, value: { workspaceId: "w", sourceId: "s", revision: 0, definitions: [], values: [] } };
        if (input.type === "workspace.previewProjectArchive") {
          corrected = scenario === "occupied" ? input.name === "Alternative" : scenario === "missing_parent" ? input.createParent === true : false;
          return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "restore", originalRelativePath: archivedProject.relativePath, requestedRelativePath: `Client/${input.name ?? "Project"}`, revision: 1, missingParents: scenario === "missing_parent" ? ["Client"] : [], blockers: corrected ? [] : [scenario], previewToken: corrected ? "corrected" : null } };
        }
        if (input.type === "workspace.applyProjectArchive") return { ok: true, value: { operation: { operationId: input.operationId, sourceId: "s", projectId: "p", action: "restore", originalRelativePath: archivedProject.relativePath, requestedRelativePath: "Client/Project", stage: "completed", problem: null, completedRevision: 2 } } };
        throw new Error("Unexpected request");
      }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
      render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
      const user = userEvent.setup({ document });
      await user.click(screen.getByRole("button", { name: t("archiveArchived") }));
      const projectSelect = await screen.findByLabelText(t("archiveRestoreProject")) as HTMLSelectElement;
  await waitFor(() => assert.equal(projectSelect.disabled, false));
  await user.selectOptions(projectSelect, "p");
      await user.click(screen.getByRole("button", { name: t("archiveRestoreReview") }));
      const problemKey = scenario === "occupied" ? "archiveProblemOccupied" : scenario === "missing_parent" ? "archiveProblemMissingParent" : scenario === "incompatible_mode" ? "archiveProblemMode" : "archiveProblemUnavailable";
      await screen.findByText(t(problemKey));
      assert.equal(screen.queryByRole("button", { name: t("archiveRestoreApply") }), null);
      assert.equal(calls.some(c => c.type === "workspace.applyProjectArchive"), false);
      if (scenario === "occupied" || scenario === "missing_parent") {
        if (scenario === "occupied") await user.type(screen.getByLabelText(t("archiveName")), "Alternative");
        else await user.click(screen.getByLabelText(t("archiveCreateParent")));
        await user.click(screen.getByRole("button", { name: t("archiveRestoreReview") }));
        const apply = await screen.findByRole("button", { name: t("archiveRestoreApply") });
        apply.focus(); await user.keyboard("{Enter}");
        await screen.findByText(t("archiveCompleted"));
        const request = calls.filter(c => c.type === "workspace.previewProjectArchive").at(-1);
        assert.equal(request?.name, scenario === "occupied" ? "Alternative" : null);
        assert.equal(request?.createParent, scenario === "missing_parent");
        assert.equal(calls.filter(c => c.type === "workspace.applyProjectArchive").length, 1);
      }
    });
  }
  test(`${language}: interrupted operation recovery is explicit, token-bound and keyboard operable`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key), calls: Record<string, unknown>[] = [];
    const operation = { operationId: "interrupted", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "intent", problem: "busy", completedRevision: null };
    let done = false;
    const api = { workspace: async (input: Record<string, unknown>) => {
      calls.push(input);
      if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
      if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: done ? [] : [operation] } };
      if (input.type === "workspace.previewProjectArchiveRecovery") return { ok: true, value: { workspaceId: "w", sourceId: "s", operation, actions: ["retry_original", "keep_original"], problem: null, previewToken: "recovery-token" } };
      if (input.type === "workspace.recoverProjectArchive") { done = true; return { ok: true, value: { operation: { ...operation, stage: "completed", problem: null, completedRevision: 2 } } }; }
      throw new Error("Unexpected request");
    }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
    render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
    const user = userEvent.setup({ document });
    const recoveryTrigger = await screen.findByRole("button", { name: t("archiveRecovery") });
    await user.click(recoveryTrigger);
    await screen.findByRole("button", { name: t("archiveRetryOriginal") });
    await user.keyboard("{Escape}");
    await waitFor(() => assert.equal(document.activeElement, recoveryTrigger));
    await user.click(recoveryTrigger);
    assert.equal(calls.some(c => c.type === "workspace.recoverProjectArchive"), false);
    const retry = await screen.findByRole("button", { name: t("archiveRetryOriginal") }); retry.focus(); await user.keyboard("{Enter}");
    await screen.findByText(t("archiveCompleted"));
    assert.deepEqual(calls.find(c => c.type === "workspace.recoverProjectArchive"), { type: "workspace.recoverProjectArchive", workspaceId: "w", operationId: "interrupted", previewToken: "recovery-token", action: "retry_original" });
  });
}

test("unavailable recovery transport retains an unknown outcome until a read-only status check", async () => {
  const calls: Record<string, unknown>[] = [];
  const operation = { operationId: "interrupted", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "intent", problem: "busy", completedRevision: null };
  const api = { workspace: async (input: Record<string, unknown>) => {
    calls.push(input);
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [operation] } };
    if (input.type === "workspace.previewProjectArchiveRecovery") return { ok: true, value: { workspaceId: "w", sourceId: "s", operation, actions: ["retry_original"], problem: null, previewToken: "token" } };
    if (input.type === "workspace.recoverProjectArchive") return { ok: false, error: { code: "service_unavailable", message: "Disconnected" } };
    if (input.type === "workspace.getProjectArchiveOperation") return { ok: true, value: { operation: { ...operation, stage: "completed", problem: null, completedRevision: 2 } } };
    throw new Error("Unexpected request");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const user = userEvent.setup({ document });
  await user.click(await screen.findByRole("button", { name: "Review interrupted operation" }));
  await user.click(await screen.findByRole("button", { name: "Retry original move" }));
  await screen.findByText(translate("en", "archiveUnknown"));
  assert.equal(screen.queryByRole("button", { name: "Retry original request" }), null);
  assert.equal((screen.getByRole("button", { name: "Active" }) as HTMLButtonElement).disabled, true);
  await user.click(screen.getByRole("button", { name: "Check saved outcome" }));
  await screen.findByText(translate("en", "archiveCompleted"));
  assert.equal(calls.filter(c => c.type === "workspace.recoverProjectArchive").length, 1);
});

test("reopening archive location resets the draft and discards its previous review", async () => {
  const api = { workspace: async (input: { type: string }) => {
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewArchiveLocation") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Stored", revision: 1, blockers: [], previewToken: "stored-review" } };
    throw new Error("No mutation authorized");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<ProjectArchivePanel locationOnly client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const user = userEvent.setup({ document });
  const summary = document.querySelector("summary")!;
  await act(async () => { summary.parentElement!.setAttribute("open", ""); fireEvent(summary.parentElement!, new browser.Event("toggle") as unknown as Event); });
  const input = await screen.findByRole("textbox", { name: translate("en", "archiveLocation") }) as HTMLInputElement;
  await waitFor(() => assert.equal(input.disabled, false));
  await user.clear(input); await user.type(input, "Stored");
  await user.click(screen.getByRole("button", { name: translate("en", "archiveReviewLocation") }));
  await screen.findByRole("button", { name: translate("en", "archiveConfirmLocation") });
  await act(async () => { summary.parentElement!.removeAttribute("open"); fireEvent(summary.parentElement!, new browser.Event("toggle") as unknown as Event); });
  await act(async () => { summary.parentElement!.setAttribute("open", ""); fireEvent(summary.parentElement!, new browser.Event("toggle") as unknown as Event); });
  await waitFor(() => assert.equal((screen.getByRole("textbox", { name: translate("en", "archiveLocation") }) as HTMLInputElement).value, "Archive"));
  assert.equal(screen.queryByRole("button", { name: translate("en", "archiveConfirmLocation") }) === null, true);
});
