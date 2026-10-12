import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";
import test from "node:test";
import React from "react";
import { EmptyStatePanel, LanguageSelect, StatusMessage } from "../src/renderer/components/bb-foundation";

const browser = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  window: browser,
  document: browser.document,
  HTMLElement: browser.HTMLElement,
  Node: browser.Node,
  MutationObserver: browser.MutationObserver,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: browser.navigator,
});

const { cleanup, render, screen } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");

test("language selector is keyboard reachable and responds to selection", async () => {
  const changes: string[] = [];
  render(
    <LanguageSelect
      id="language"
      label="Interface language"
      value="en"
      onChange={(language) => changes.push(language)}
    />,
  );
  const select = screen.getByRole("combobox", { name: "Interface language" });
  assert.equal(select.getAttribute("id"), "language");
  await userEvent.tab();
  assert.equal(document.activeElement, select);
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.selectOptions(select, "ru");
  assert.deepEqual(changes, ["ru"]);
  cleanup();
});

test("status and empty state use accessible roles and remain renderable", () => {
  render(
    <>
      <StatusMessage kind="info" title="Starting">Please wait.</StatusMessage>
      <StatusMessage kind="error" title="Save failed">Try again.</StatusMessage>
      <EmptyStatePanel>No projects yet.</EmptyStatePanel>
    </>,
  );
  assert.equal(screen.getByRole("status").textContent, "StartingPlease wait.");
  assert.equal(screen.getByRole("alert").textContent, "Save failedTry again.");
  assert.equal(screen.getByText("No projects yet.").className, "bb-empty-state");
  cleanup();
});

test("bb provenance and full MIT notice stay with adapted components", async () => {
  const provenance = await readFile("docs/reuse.md", "utf8");
  const license = await readFile("src/renderer/components/bb/LICENSE", "utf8");
  assert.match(provenance, /src\/renderer\/components\/bb-foundation\.tsx/);
  assert.match(provenance, /packages\/shared-ui\/src\/components\/ui\/label\.tsx/);
  assert.match(license, /Copyright \(c\) 2026 Michael Yong/);
  assert.match(license, /Permission is hereby granted/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});

test("EN/RU retained rows explain exclusion and recovery, display historical categories and save Text by stable IDs", async () => {
  const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
  const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.js");
  const { translate } = await import("../src/renderer/localization.js");
  const { waitFor } = await import("@testing-library/react");
  for (const language of ["en", "ru"] as const) {
    const states = ["excluded", "missing", "unresolved", "replaced"] as const;
    const rows = states.map((state) => ({ projectId: state, name: state, relativePath: `Former category/${state}`,
      categoryId: "retired-category", categoryName: "Former category", associationState: state, resolution: state }));
    let saves = 0;
    let snapshot = { workspaceId: "workspace", sourceId: "source", revision: 1,
      definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }],
      values: rows.map((row) => ({ projectId: row.projectId, propertyId: "notes", value: `Authored ${row.name}` })) };
    const client = new class extends WorkspaceServiceClient {
      override onBackendStatus() { return () => {}; }
      override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
      override async listTextProperties() { return { ok: true as const, value: snapshot }; }
      override onWorkspaceChange() { return () => {}; }
      override async setTextValue(workspaceId: string, projectId: string, propertyId: string, value: string | null) {
        assert.equal(workspaceId, "workspace"); assert.equal(projectId, "missing"); assert.equal(propertyId, "notes");
        saves++;
        snapshot = { ...snapshot, revision: 2, values: snapshot.values.map((row) => row.projectId === projectId ? { ...row, value: value! } : row) };
        return { ok: true as const, value: { projectId, propertyId, snapshot } };
      }
    }();
    render(<TextPropertiesTable client={client} workspaceId="workspace" sourceId="source" projects={[]} retainedProjects={rows}
      categoryProperty={{ propertyId: "category-label", sourceId: "source", name: "Category" }} categories={[]} onMoveCategory={() => assert.fail("Retained category must be read-only")} language={language} disabled={false} />);
    assert.equal(screen.queryByRole("button", { name: new RegExp(`^${translate(language, "moveCategory")}:`) }), null);
    const labels = ["projectExcluded", "projectMissing", "projectUnresolved", "projectReplaced"] as const;
    for (const label of labels) assert.ok(await screen.findByText(translate(language, label)));
    assert.equal(screen.getAllByRole("cell", { name: "Former category" }).length, 4);
    const edit = await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: missing / Notes` });
    await waitFor(() => assert.equal((edit as HTMLButtonElement).disabled, false));
    edit.focus(); await userEvent.keyboard("{Enter}");
    const editor = screen.getByRole("textbox", { name: `${translate(language, "editTextValue")}: missing / Notes` });
    await userEvent.clear(editor); await userEvent.type(editor, "  Edited retained\nТекст  ");
    assert.equal(saves, 0);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    await screen.findByText(translate(language, "textValueSaved"));
    assert.equal(saves, 1);
    assert.equal(screen.getByRole("button", { name: `${translate(language, "editTextValue")}: missing / Notes` }).textContent, "  Edited retained\nТекст  ");
    assert.equal(document.activeElement, edit);
    cleanup();
  }
});


test("EN/RU source-level unavailable observations retain exact authored Text without individual missing explanations", async () => {
  const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
  const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.js");
  const { translate } = await import("../src/renderer/localization.js");
  const value = "  Authored 日本語\n" + "long-text-".repeat(24) + "  ";
  const client = new class extends WorkspaceServiceClient {
    override onBackendStatus() { return () => {}; }
    override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
    override onWorkspaceChange() { return () => {}; }
    override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 4,
      definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }],
      values: [{ projectId: "project", propertyId: "notes", value }] } }; }
  }();
  for (const language of ["en", "ru"] as const) {
    const rows = [{ projectId: "project", name: "Authored project", relativePath: "Authored project", categoryId: null,
        associationState: "active" as const, resolution: null, categoryName: null }];
    render(<TextPropertiesTable client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} projects={rows} />);
    const button = await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: Authored project / Notes` });
    assert.equal(button.textContent, value);
    assert.equal(screen.queryByText(translate(language, "projectMissing")), null);
    assert.equal(screen.queryByText(translate(language, "projectUnresolved")), null);
    cleanup();
  }
});

test("EN/RU source Refresh is keyboard accessible and reports pending, errors and degraded guidance", async () => {
  const { SourceRefresh } = await import("../src/renderer/components/SourceRefresh.js");
  const { translate } = await import("../src/renderer/localization.js");
  for (const language of ["en", "ru"] as const) {
    let calls = 0;
    const props = { language, pending: false, error: false, degraded: true, unavailable: false, disabled: false, onRefresh: () => { calls++; } };
    const view = render(<SourceRefresh {...props} />);
    const button = screen.getByRole("button", { name: translate(language, "refreshSourceAction") });
    await userEvent.tab(); assert.equal(document.activeElement, button); await userEvent.keyboard("{Enter}"); assert.equal(calls, 1);
    assert.ok(screen.getByText(translate(language, "automaticUpdatesDegradedDescription")));
    view.rerender(<SourceRefresh {...props} pending />);
    await userEvent.keyboard("{Enter}"); assert.equal(calls, 1);
    assert.equal(document.querySelector(".source-refresh")?.getAttribute("aria-busy"), "true");
    assert.ok(screen.getByRole("heading", { name: translate(language, "refreshingSource") }));
    view.rerender(<SourceRefresh {...props} error unavailable />);
    assert.ok(screen.getByRole("button", { name: translate(language, "retrySourceAction") }));
    assert.ok(screen.getByRole("alert"));
    cleanup();
  }
});

test("EN/RU configured-mode effects disclose inactive exclusions and category return with keyboard focus", async () => {
  const { DiscoveryPanel } = await import("../src/renderer/components/DiscoveryPanel.js");
  const { translate } = await import("../src/renderer/localization.js");
  const { waitFor } = await import("@testing-library/react");
  for (const language of ["en", "ru"] as const) {
    const preview = {
      workspaceId: "workspace", sourceId: "source", configured: true, mode: "direct" as const, currentMode: "grouped" as const,
      revision: 4, canonicalRoot: "/Projects", state: "ready" as const, previewToken: "review", entries: [],
      excludedRelativePaths: ["Category/Excluded", "Literal"], effectiveExcludedRelativePaths: ["Literal"], inactiveExcludedRelativePaths: ["Category/Excluded"],
      categoryAvailability: { current: true, target: false, propertyId: "label", name: "  Authored 日本語  " },
      projectEffects: { added: [{ name: "Fresh role", relativePath: "Fresh role", categoryPath: null }], retained: [],
        noLongerRecognized: [{ projectId: "old", categoryId: "category", name: "Old child", relativePath: "Category/Old child" }],
        alreadyRetained: [{ projectId: "missing", categoryId: null, name: "Missing", relativePath: "Missing" }] },
    };
    let mode: string | null = null, cancelled = 0, applied = 0;
    const props = { language, preview, pending: false, error: false, onMode: (value: string) => { mode = value; },
      onExclude: () => {}, onRetry: () => {}, onCancel: () => { cancelled++; }, onApply: () => { applied++; } };
    const view = render(<DiscoveryPanel {...props} />);
    assert.ok(screen.getByText(translate(language, "discoveryCategoryHidden")));
    assert.ok(screen.getByText("Category/Excluded"));
    assert.ok(screen.getByText("Category/Old child"));
    assert.ok(screen.getByRole("heading", { name: `${translate(language, "discoveryNoLongerRecognized")} (1)` }));
    const select = screen.getByRole("combobox", { name: translate(language, "discoveryMode") });
    select.focus(); await userEvent.selectOptions(select, "grouped"); assert.equal(mode, "grouped");
    view.rerender(<DiscoveryPanel {...props} pending />);
    assert.equal((select as HTMLSelectElement).disabled, true);
    const apply = screen.getByRole("button", { name: translate(language, "discoveryApply") });
    assert.equal((apply as HTMLButtonElement).disabled, true);
    await userEvent.click(apply); assert.equal(applied, 0);
    view.rerender(<DiscoveryPanel {...props} preview={{ ...preview, mode: "grouped", categoryAvailability: { ...preview.categoryAvailability, target: true }, inactiveExcludedRelativePaths: [] }} />);
    await waitFor(() => assert.equal(document.activeElement, select));
    assert.ok(screen.getByText(translate(language, "discoveryCategoryAvailable")));
    assert.equal(screen.queryByText("Category/Excluded"), null);
    await userEvent.keyboard("{Escape}"); assert.equal(cancelled, 1);
    cleanup();
  }
});

test("EN/RU mode-retained rows keep exact Text editable without a direct-mode category column", async () => {
  const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
  const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.js");
  const { translate } = await import("../src/renderer/localization.js");
  const { waitFor } = await import("@testing-library/react");
  for (const language of ["en", "ru"] as const) {
    let value = "  Exact retained 日本語\n  ", saves = 0;
    const client = new class extends WorkspaceServiceClient {
      override onBackendStatus() { return () => {}; }
      override async listProjectCreations(workspaceId: string) { return { ok: true as const, value: { workspaceId, sourceId: "source", operations: [] } }; }
      override onWorkspaceChange() { return () => {}; }
      override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: saves,
        definitions: [{ propertyId: "notes", sourceId: "source", name: "Notes", propertyType: "text" as const }], values: [{ projectId: "historical", propertyId: "notes", value }] } }; }
      override async setTextValue(_workspace: string, projectId: string, propertyId: string, next: string | null) {
        value = next!; saves++;
        return { ok: true as const, value: { projectId, propertyId, snapshot: (await this.listTextProperties()).value } };
      }
    }();
    let locates = 0;
    render(<TextPropertiesTable client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false} projects={[]}
      categoryProperty={null} categories={[]} retainedProjects={[{ projectId: "historical", categoryId: "old-category", categoryName: "Historical category",
        name: "Historical", relativePath: "Historical category/Historical", associationState: "active", resolution: "active", retentionReason: "mode_change" }]}
      onLocate={() => { locates++; }} />);
    assert.ok(await screen.findByText(translate(language, "projectModeRetained")));
    assert.equal(document.querySelector(".category-property-header"), null);
    const edit = await screen.findByRole("button", { name: `${translate(language, "editTextValue")}: Historical / Notes` });
    await waitFor(() => assert.equal((edit as HTMLButtonElement).disabled, false));
    assert.equal(edit.textContent, value);
    await userEvent.click(edit);
    const editor = screen.getByRole("textbox");
    await userEvent.clear(editor); await userEvent.type(editor, "  Edited 日本語\n  ");
    assert.equal(saves, 0);
    await userEvent.click(screen.getByRole("button", { name: translate(language, "saveTextValue") }));
    await waitFor(() => assert.equal(saves, 1));
    await waitFor(() => assert.equal(document.activeElement, edit));
    assert.equal(edit.textContent, "  Edited 日本語\n  ");
    await userEvent.click(screen.getByRole("button", { name: `${translate(language, "recoveryLocate")}: Historical` }));
    assert.equal(locates, 1);
    cleanup();
  }
});

test("EN/RU Table without Text definitions retains the authored Name and only Name/Reveal columns", async () => {
  const { TextPropertiesTable } = await import("../src/renderer/components/TextPropertiesTable.js");
  const { WorkspaceServiceClient } = await import("../src/renderer/workspace-service-client.js");
  const { translate } = await import("../src/renderer/localization.js");
  const { waitFor } = await import("@testing-library/react");
  const name = "  Authored-日本語-" + "long-name-".repeat(18) + "  ";
  const client = new class extends WorkspaceServiceClient {
    override onBackendStatus() { return () => {}; }
    override onWorkspaceChange() { return () => {}; }
    override async listTextProperties() { return { ok: true as const, value: { workspaceId: "workspace", sourceId: "source", revision: 0, definitions: [], values: [] } }; }
  }();
  for (const language of ["en", "ru"] as const) {
    render(<TextPropertiesTable client={client} workspaceId="workspace" sourceId="source" language={language} disabled={false}
      projects={[{ projectId: "project", categoryId: null, name, relativePath: name }]} />);
    await waitFor(() => assert.equal(document.querySelector(".text-properties")?.getAttribute("aria-busy"), "false"));
    assert.deepEqual(screen.getAllByRole("columnheader").map((node) => node.textContent), [translate(language, "projectName"), translate(language, "revealProject")]);
    assert.equal(screen.getByText(name, { selector: "td span", normalizer: (text) => text }).textContent, name);
    assert.equal(screen.queryByRole("button", { name: new RegExp(`^${translate(language, "editTextValue")}:`) }), null);
    assert.ok(screen.getByRole("button", { name: translate(language, "createTextProperty") }));
    cleanup();
  }
});
