import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { Window } from "happy-dom";
import { DiscoveryWorkspace } from "../src/renderer/components/DiscoveryPanel.js";
import { ProjectRecoveryPanel } from "../src/renderer/components/ProjectRecoveryPanel.js";
import { WorkspaceServiceClient } from "../src/renderer/workspace-service-client.js";
import { translate } from "../src/renderer/localization.js";
import type { ServiceResult } from "../src/contracts/settings.js";
import type { ProjectAssociationSummary, ProjectList } from "../src/contracts/workspaces.js";
import type { ProjectRecoveryPreview } from "../src/contracts/project-recovery.js";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement,
  Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { render, screen, cleanup, waitFor, act } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const retained: ProjectAssociationSummary = { projectId: "project", name: "Original authored name", relativePath: "Original authored name", categoryId: null, categoryName: null,
  associationState: "active", resolution: "missing" };
const preview: ProjectRecoveryPreview = { workspaceId: "workspace", sourceId: "source", projectId: retained.projectId, revision: 1, mode: "direct", state: "ready",
  previewToken: "review", entries: [{ relativePath: "Target authored name", name: "Target authored name", categoryPath: null, status: "selectable" },
    { relativePath: "Occupied", name: "Occupied", categoryPath: null, status: "reserved_path" }] };
const initial: ProjectList = { workspaceId: "workspace", sourceId: "source", revision: 1, configured: true, mode: "direct", state: "ready",
  projects: [], retainedProjects: [retained, { ...retained, projectId: "excluded", name: "Excluded", relativePath: "Excluded", associationState: "excluded", resolution: "excluded" }], retainedCount: 2,
  categories: [], categoryProperty: null, categoryPropertyRevision: 0 };
const committed: ProjectList = { ...initial, revision: 2, projects: [{ ...retained, relativePath: preview.entries[0].relativePath, name: preview.entries[0].name, associationState: "active", resolution: "active" }],
  retainedProjects: [initial.retainedProjects[1]], retainedCount: 1 };
class RecoveryClient extends WorkspaceServiceClient {
  projects = initial;
  previews = 0;
  saves = 0;
  handler: () => Promise<ServiceResult<ProjectList>> = async () => { this.projects = committed; return { ok: true, value: committed }; };
  override onWorkspaceChange() { return () => {}; }
  override async listProjects() { return { ok: true as const, value: this.projects }; }
  override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 1,
    definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }],
    values: [{ projectId: "project", propertyId: "notes", value: "Exact authored Text" }] } }; }
  override async previewProjectRecovery(workspaceId: string, projectId: string) {
    assert.equal(workspaceId, "workspace"); assert.equal(projectId, "project"); this.previews++;
    return { ok: true as const, value: preview };
  }
  override async reassociateProject(workspaceId: string, projectId: string, token: string, path: string) {
    assert.deepEqual([workspaceId, projectId, token, path], ["workspace", "project", "review", "Target authored name"]);
    this.saves++; return this.handler();
  }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

for (const language of ["en", "ru"] as const) {
  test(`${language}: production workspace supports keyboard selection/review, read-only cancellation and explicit recovery`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    const locate = await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` });
    assert.equal(screen.queryByRole("button", { name: `${t("recoveryLocate")}: Excluded` }), null);
    locate.focus(); await userEvent.keyboard("{Enter}");
    const title = await screen.findByRole("heading", { name: t("recoveryTitle") });
    assert.equal(document.activeElement, title);
    await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal(client.saves, 0);
    await userEvent.keyboard("{Escape}");
    assert.equal(client.saves, 0); assert.equal(document.activeElement, locate);
    await userEvent.keyboard("{Enter}");
    const target = await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal((screen.getByRole("radio", { name: new RegExp("Occupied") }) as HTMLInputElement).disabled, true);
    const confirm = screen.getByRole("button", { name: t("recoveryConfirm") });
    assert.equal((confirm as HTMLButtonElement).disabled, true);
    target.focus(); await userEvent.keyboard(" ");
    assert.ok(screen.getByText(t("recoveryTargetPath"))); assert.ok(screen.getByText(t("recoveryNoCategory")));
    assert.equal(client.saves, 0);
    confirm.focus(); await userEvent.keyboard("{Enter}");
    await screen.findByText(t("recoverySaved"));
    assert.equal(client.saves, 1);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: Target authored name / Notes` }).textContent?.includes("Exact authored Text"));
    assert.equal(document.activeElement, screen.getByRole("heading", { name: t("tableViewTitle") }));
    cleanup();
  });
  test(`${language}: pending prevents duplicate submission/cancel; stale requires refresh and explicit reselection`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const client = new RecoveryClient();
    const response = deferred<ServiceResult<ProjectList>>(); client.handler = () => response.promise;
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    const confirm = screen.getByRole("button", { name: t("recoveryConfirm") });
    await userEvent.click(confirm); await userEvent.click(confirm);
    assert.equal(client.saves, 1);
    assert.equal((screen.getByRole("button", { name: t("cancelRenameWorkspace") }) as HTMLButtonElement).disabled, true);
    assert.equal((screen.getByRole("button", { name: t("discoveryRefresh") }) as HTMLButtonElement).disabled, true);
    await userEvent.keyboard("{Escape}");
    assert.ok(screen.getByRole("heading", { name: t("recoveryTitle") }));
    await act(async () => response.resolve({ ok: false, error: { code: "stale_preview", message: "changed" } }));
    await screen.findByText(t("recoveryStale"));
    assert.equal(screen.queryByRole("radio"), null);
    await userEvent.click(screen.getByRole("button", { name: t("discoveryRefresh") }));
    const target = await screen.findByRole("radio", { name: "Target authored name" });
    assert.equal((target as HTMLInputElement).checked, false);
    assert.equal((confirm as HTMLButtonElement).disabled, true);
    assert.equal(client.saves, 1); assert.equal(client.previews, 2);
    cleanup();
  });
  test(`${language}: recovery handles empty, loading, source conflict, failure and uncertain states`, async () => {
    const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    const props = { language, project: retained, preview: null, selectedPath: null, loading: false, pending: false, error: false, stale: false, uncertain: false,
      onSelect() {}, onConfirm() {}, onRefresh() {}, onCancel() {} };
    const view = render(<ProjectRecoveryPanel {...props} loading />);
    assert.ok(screen.getByText(t("recoveryLoading")));
    view.rerender(<ProjectRecoveryPanel {...props} preview={{ ...preview, state: "empty", entries: [] }} />);
    assert.ok(screen.getByText(t("recoveryEmpty")));
    view.rerender(<ProjectRecoveryPanel {...props} preview={{ ...preview, state: "root_identity_conflict", entries: [], previewToken: null }} />);
    assert.ok(screen.getByText(t("discoveryRootConflict")));
    view.rerender(<ProjectRecoveryPanel {...props} error uncertain />);
    assert.ok(screen.getByText(t("recoveryError"))); assert.ok(screen.getByText(t("recoveryUncertain")));
    cleanup();
    const client = new RecoveryClient(); client.handler = async () => ({ ok: false, error: { code: "storage", message: "failed" } });
    render(<DiscoveryWorkspace client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} />);
    await userEvent.click(await screen.findByRole("button", { name: `${t("recoveryLocate")}: ${retained.name}` }));
    await userEvent.click(await screen.findByRole("radio", { name: "Target authored name" }));
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await screen.findByText(t("recoveryError"));
    assert.equal(screen.queryByText(t("recoverySaved")), null);
    assert.ok(screen.getByRole("button", { name: `${t("editTextValue")}: ${retained.name} / Notes` }).textContent?.includes("Exact authored Text"));
    client.handler = async () => { throw new Error("lost response"); };
    await userEvent.click(screen.getByRole("button", { name: t("recoveryConfirm") }));
    await screen.findByText(t("recoveryUncertain"));
    await waitFor(() => assert.equal((screen.getByRole("button", { name: t("recoveryConfirm") }) as HTMLButtonElement).disabled, true));
    assert.equal(client.saves, 2); cleanup();
  });
}
