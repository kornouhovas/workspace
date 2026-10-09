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
      categoryProperty={{ propertyId: "category-label", sourceId: "source", name: "Category" }} categories={[]} language={language} disabled={false} />);
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
