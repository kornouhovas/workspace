import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node, MutationObserver: browser.MutationObserver, CustomEvent: browser.CustomEvent, NodeFilter: browser.NodeFilter, HTMLInputElement: browser.HTMLInputElement, getComputedStyle: browser.getComputedStyle.bind(browser) });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { ProjectArchivePanel } = await import("../src/renderer/components/ProjectArchivePanel.js");
const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.js");
const { translate } = await import("../src/renderer/localization.js");
import type { WorkspaceDesktopApi } from "../src/contracts/desktop-api.js";
const { render, screen, cleanup, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
test.afterEach(cleanup);
for (const language of ["en", "ru"] as const) for (const originPresent of [true, false]) test(`${language}: contextual Cancel returns to ${originPresent ? "origin" : "visible fallback"} without moving`, async () => {
  const calls: Record<string, unknown>[] = [];
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: "Project" };
  const api = { workspace: async (input: Record<string, unknown>) => {
    calls.push(input);
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    throw new Error("No mutation authorized");
  }, onBackendStatus: () => () => {}, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const origin = document.createElement("button"); origin.textContent = "Origin"; document.body.append(origin);
  const fallback = document.createElement("button"); fallback.textContent = "Visible view"; document.body.append(fallback);
  let closed = false;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  render(<ProjectArchivePanel request={{ project, action: "archive", trigger: origin }} onRequestClosed={() => { closed = true; }} onRestoreFocus={() => fallback.focus()} client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[project]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: t("archiveApply") });
  const review = within(dialog).getByRole("button", { name: t("archiveReview") });
  await waitFor(() => assert.equal((review as HTMLButtonElement).disabled, false));
  await userEvent.click(review);
  await within(dialog).findByText("Project → Archive/Project");
  if (!originPresent) origin.remove();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => assert.equal(closed, true));
  assert.equal(document.activeElement, originPresent ? origin : screen.getByRole("region", { name: t("archiveTitle") }));
  assert.equal(calls.some(c => c.type === "workspace.applyProjectArchive"), false);
  origin.remove(); fallback.remove();
});

for (const mismatch of ["projectId", "action", "originalRelativePath", "requestedRelativePath", "sourceId", "operationId"] as const) test(`a reply with another ${mismatch} remains uncertain and status uses the accepted operation`, async () => {
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: "Project" };
  const calls: Record<string, unknown>[] = [];
  let operationId = "";
  const operation = () => ({ operationId, sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "completed", problem: null, completedRevision: 2 });
  const api = { workspace: async (input: Record<string, unknown>) => {
    calls.push(input);
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", ...operation(), revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    if (input.type === "workspace.applyProjectArchive") { operationId = String(input.operationId); return { ok: true, value: { operation: { ...operation(), [mismatch]: "wrong" } } }; }
    if (input.type === "workspace.getProjectArchiveOperation") return { ok: true, value: { operation: operation() } };
    throw new Error("Unexpected mutation");
  }, onBackendStatus: () => () => {}, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<ProjectArchivePanel request={{ project, action: "archive", trigger: document.createElement("button") }} client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[project]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: "Archive project" });
  const review = within(dialog).getByRole("button", { name: "Review archive" });
  await waitFor(() => assert.equal((review as HTMLButtonElement).disabled, false));
  await userEvent.click(review);
  await userEvent.click(await within(dialog).findByRole("button", { name: "Archive project" }));
  await within(dialog).findByText(translate("en", "archiveUnknown"));
  assert.equal((screen.getByRole("button", { name: "Active" }) as HTMLButtonElement).disabled, true);
  await userEvent.click(within(dialog).getByRole("button", { name: "Check saved outcome" }));
  await within(dialog).findByText(translate("en", "archiveCompleted"));
  assert.equal(calls.filter(c => c.type === "workspace.applyProjectArchive").length, 1);
  assert.equal(calls.find(c => c.type === "workspace.getProjectArchiveOperation")?.operationId, operationId);
});

const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
for (const layout of ["table", "board"] as const) for (const archived of [false, true]) test(`${layout}: ${archived ? "Restore" : "Archive"} opens for the selected project from its menu`, async () => {
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: archived ? "Archive/Project" : "Project", ...(archived ? { originalRelativePath: "Project" } : {}) };
  const api = { workspace: async () => ({ ok: true, value: { workspaceId: "w", sourceId: "s", revision: 0, definitions: [], values: [] } }), onBackendStatus: () => () => {}, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  let selected: unknown[] = [];
  render(<TextPropertiesTable layout={layout} hideReveal={archived} projects={[project]} client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" language="en" disabled={false} onArchive={(...args) => { selected = args; }} />);
  const menu = await screen.findByRole("button", { name: "Project actions: Project" });
  if (layout === "table") assert.ok(screen.getByRole("columnheader", { name: "Project actions" }));
  await userEvent.click(menu);
  await userEvent.click(await screen.findByRole("button", { name: `${archived ? "Restore" : "Archive"} project: Project` }));
  assert.deepEqual(selected.slice(0, 2), [project, archived ? "restore" : "archive"]);
  assert.equal(selected[2], menu);
});

test("recovery cannot accept a preview for a different project under the same operation ID", async () => {
  const operation = { operationId: "interrupted", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "intent", problem: null, completedRevision: null };
  const api = { workspace: async (input: Record<string, unknown>) => {
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [operation] } };
    if (input.type === "workspace.previewProjectArchiveRecovery") return { ok: true, value: { workspaceId: "w", sourceId: "s", operation: { ...operation, projectId: "another-project" }, actions: ["retry_original"], problem: null, previewToken: "wrong-token" } };
    throw new Error("No mutation authorized");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const { findAction } = await import("./context-tools-driver.js");
  await userEvent.click(await findAction("button", { name: "Review interrupted operation" }));
  await screen.findByText(translate("en", "archiveError"));
  assert.equal(screen.queryByRole("button", { name: "Retry original move" }), null);
});

test("pending archive admits one operation; an independent editor owns Escape", async () => {
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: "Project" };
  let finish!: () => void, applies = 0, cancelled = 0;
  const api = { workspace: async (input: Record<string, unknown>) => {
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    if (input.type === "workspace.applyProjectArchive") {
      applies++; await new Promise<void>(resolve => { finish = resolve; });
      return { ok: true, value: { operation: { operationId: input.operationId, sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "completed", problem: null, completedRevision: 2 } } };
    }
    throw new Error("Unexpected request");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  render(<><ProjectArchivePanel request={{ project, action: "archive", trigger: document.createElement("button") }} client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[project]} language="en" disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />
    <input aria-label="Independent draft" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelled++; } }} /></>);
  const dialog = await screen.findByRole("dialog", { name: "Archive project" });
  const review = within(dialog).getByRole("button", { name: "Review archive" });
  await waitFor(() => assert.equal((review as HTMLButtonElement).disabled, false));
  await userEvent.click(review);
  const draft = screen.getByRole("textbox", { name: "Independent draft" });
  draft.focus(); await userEvent.keyboard("{Escape}");
  assert.equal(cancelled, 1); assert.ok(screen.getByRole("dialog", { name: "Archive project" }));
  const apply = within(dialog).getByRole("button", { name: "Archive project" });
  await userEvent.dblClick(apply);
  assert.equal(applies, 1);
  assert.equal((within(dialog).getByRole("button", { name: "Cancel archive review" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "Active" }) as HTMLButtonElement).disabled, true);
  draft.focus();
  const { act } = await import("@testing-library/react");
  await act(async () => { finish(); });
  await within(dialog).findByText(translate("en", "archiveCompleted"));
  assert.equal(document.activeElement, draft, "Late success preserves the independent editor's focus");
});

for (const language of ["en", "ru"] as const) test(`${language}: contextual recovery-Cancel returns to the originating menu`, async () => {
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: "Project" };
  const operation = { operationId: "interrupted", sourceId: "s", projectId: "p", action: "archive", originalRelativePath: "Project", requestedRelativePath: "Archive/Project", stage: "intent", problem: null, completedRevision: null };
  const api = { workspace: async (input: Record<string, unknown>) => {
    if (input.type === "workspace.listArchivedProjects") return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: 1, projects: [] } };
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [operation] } };
    if (input.type === "workspace.previewProjectArchiveRecovery") return { ok: true, value: { workspaceId: "w", sourceId: "s", operation, actions: ["retry_original"], problem: null, previewToken: "token" } };
    throw new Error("No mutation authorized");
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const origin = document.createElement("button"); origin.textContent = "Origin"; document.body.append(origin);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  render(<ProjectArchivePanel request={{ project, action: "archive", trigger: origin }} client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[project]} language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  const dialog = await screen.findByRole("dialog", { name: t("archiveApply") });
  const review = await within(dialog).findByRole("button", { name: t("archiveRecovery") });
  await waitFor(() => assert.equal((review as HTMLButtonElement).disabled, false));
  await userEvent.click(review);
  const retry = await within(dialog).findByRole("button", { name: t("archiveRetryOriginal") });
  retry.focus(); await userEvent.keyboard("{Escape}");
  await waitFor(() => assert.equal(document.activeElement, origin));
  origin.remove();
});

for (const language of ["en", "ru"] as const) test(`${language}: completed restore retains visible focus when the archived row refresh arrives after Done`, async () => {
  const { act } = await import("@testing-library/react");
  const project = { projectId: "p", categoryId: null, name: "Project", relativePath: "Archive/Project", originalRelativePath: "Project" };
  let applied = false, publish!: () => void;
  const refreshed = new Promise<void>(resolve => { publish = resolve; });
  const api = { workspace: async (input: Record<string, unknown>) => {
    if (input.type === "workspace.listArchivedProjects") {
      if (applied) await refreshed;
      return { ok: true, value: { workspaceId: "w", sourceId: "s", relativePath: "Archive", revision: applied ? 2 : 1, projects: applied ? [] : [project] } };
    }
    if (input.type === "workspace.listProjectArchiveOperations") return { ok: true, value: { workspaceId: "w", sourceId: "s", operations: [] } };
    if (input.type === "workspace.getTableLayout") return { ok: true, value: { workspaceId: "w", viewId: "v", config: { columns: [], rowOrder: [] } } };
    if (input.type === "workspace.getViewFilter") return { ok: true, value: { workspaceId: "w", viewId: "v", config: { search: "", rules: [] } } };
    if (input.type === "workspace.getViewGrouping") return { ok: true, value: { workspaceId: "w", viewId: "v", config: { propertyId: null, settings: [] } } };
    if (input.type === "workspace.queryView") return { ok: true, value: { workspaceId: "w", viewId: "v", archived: true, projectIds: ["p"] } };
    if (input.type === "workspace.listTextProperties") return { ok: true, value: { workspaceId: "w", sourceId: "s", revision: 1, definitions: [], values: [] } };
    if (input.type === "workspace.previewProjectArchive") return { ok: true, value: { workspaceId: "w", sourceId: "s", projectId: "p", action: "restore", originalRelativePath: "Archive/Project", requestedRelativePath: "Project", revision: 1, missingParents: [], blockers: [], previewToken: "token" } };
    if (input.type === "workspace.applyProjectArchive") {
      applied = true;
      return { ok: true, value: { operation: { operationId: input.operationId, sourceId: "s", projectId: "p", action: "restore", originalRelativePath: "Archive/Project", requestedRelativePath: "Project", stage: "completed", problem: null, completedRevision: 2 } } };
    }
    throw new Error(`Unexpected request: ${input.type}`);
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  render(<ProjectArchivePanel client={new WorkspaceServiceClient(api)} workspaceId="w" sourceId="s" projects={[]} viewId="v" language={language} disabled={false} revision={1} invalidation={0} onCommitted={() => {}} onViewChange={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: t("archiveArchived") }));
  const menu = await screen.findByRole("button", { name: `${t("projectActions")}: Project` });
  await userEvent.click(menu);
  await userEvent.click(await screen.findByRole("button", { name: `${t("archiveRestoreApply")}: Project` }));
  const dialog = await screen.findByRole("dialog", { name: t("archiveRestoreApply") });
  await userEvent.click(within(dialog).getByRole("button", { name: t("archiveRestoreReview") }));
  await userEvent.click(await within(dialog).findByRole("button", { name: t("archiveRestoreApply") }));
  await within(dialog).findByText(t("archiveCompleted"));
  await userEvent.click(within(dialog).getByRole("button", { name: t("archiveDone") }));
  await act(async () => { publish(); });
  await screen.findByText(t("archiveEmpty"));
  assert.notEqual(document.activeElement, document.body, "Completed restore must keep focus after its row disappears");
  assert.equal(document.activeElement?.closest('[hidden]'), null);
});
