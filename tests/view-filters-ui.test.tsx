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
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Node: browser.Node, MutationObserver: browser.MutationObserver });
Object.defineProperty(globalThis, "navigator", { configurable: true, value: browser.navigator });
const { act, cleanup, render, screen, waitFor, within } = await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
// @ts-expect-error Built service module intentionally has no declarations.
const { openSettingsService } = await import("../dist/service/settings.mjs");
for (const language of ["en", "ru"] as const) for (const layout of ["table", "board"] as const) {
  test(`${language} ${layout} keyboard search, typed filter, empty guidance, value edits and query errors`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "filters-ui-")), root = join(directory, "root"); mkdirSync(root);
    for (const name of ["Alpha", "Beta"]) mkdirSync(join(root, name));
    const service = openSettingsService(join(directory, "app.sqlite"));
    const workspace = service.handleCommand({ type: "workspace.create", rootPath: root, name: "One" }).value;
    const { workspaceId, viewId, sourceId } = workspace;
    const command = (type: string, fields = {}) => service.handleCommand({ type: `workspace.${type}`, workspaceId, ...fields });
    const query = (type: string, fields = {}) => service.handleQuery({ type: `workspace.${type}`, workspaceId, ...fields });
    const projects = command("applyDiscovery", { previewToken: query("previewDiscovery").value.previewToken }).value.projects;
    const text = command("createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
    const number = command("createProperty", { name: "Score", propertyType: "number" }).value.propertyId;
    const alpha = projects.find((p: {name:string}) => p.name === "Alpha").projectId;
    command("setNumberValue", { projectId: alpha, propertyId: number, expression: "5" });
    command("setTextValue", { projectId: alpha, propertyId: text, value: "Retained draft" });
    let failQuery = false;
    const api = { getBackendStatus: async () => ({ state: "ready" }), onBackendStatus: () => () => {}, workspace: async (input: {type:string}) => failQuery && input.type === "workspace.queryView" ? { ok: false, error: { code: "storage", message: "failure" } } : /workspace\.(list|get|query)/.test(input.type) ? service.handleQuery(input) : service.handleCommand(input), onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi;
    const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document }), t = (key: Parameters<typeof translate>[1]) => translate(language, key);
    try {
      render(<TextPropertiesTable viewId={viewId} layout={layout} client={client} workspaceId={workspaceId} sourceId={sourceId} projects={projects} discoveryRevision={query("listProjects").value.revision} language={language} disabled={false} />);
      const rowCount = () => layout === "table" ? screen.getByRole("table").querySelectorAll("tbody tr").length : within(screen.getByRole("list", { name: t("boardProjects") })).queryAllByRole("listitem").length;
      await waitFor(() => assert.equal(rowCount(), 2));
      await user.click(screen.getByRole("button", { name: `${t("editTextValue")}: Alpha / Notes` }));
      const editor = screen.getByRole("textbox", { name: `${t("editTextValue")}: Alpha / Notes` });
      await act(async () => { command("setNumberValue", { projectId: alpha, propertyId: number, expression: "4" }); });
      // Result refresh must preserve an editor whose project still matches.
      assert.equal(document.activeElement === editor, true);
      await user.keyboard("{Escape}");
      await act(async () => { command("setNumberValue", { projectId: alpha, propertyId: number, expression: "5" }); });
      const search = screen.getByLabelText(t("filterSearch")); search.focus(); await user.keyboard("ALP{Enter}");
      await waitFor(() => assert.equal(rowCount(), 1));
      await user.clear(search); await user.type(search, "missing{Enter}");
      await screen.findByText(t("filterEmpty")); assert.equal(rowCount(), 0);
      await user.click(screen.getByRole("button", { name: t("filterClear") }));
      await waitFor(() => assert.equal(rowCount(), 2));
      screen.getByRole("button", { name: t("filterAdd") }).focus(); await user.keyboard("{Enter}");
      await user.selectOptions(screen.getByLabelText(t("filterProperty")), number);
      await user.clear(screen.getByLabelText(t("filterOperand"))); await user.type(screen.getByLabelText(t("filterOperand")), "5{Enter}");
      await waitFor(() => assert.equal(rowCount(), 1));
      // A real service event updates the filtered membership without an explicit Refresh.
      command("setNumberValue", { projectId: alpha, propertyId: number, expression: "6" });
      await screen.findByText(t("filterEmpty")); assert.equal(rowCount(), 0);
      failQuery = true;
      await user.click(screen.getByRole("button", { name: t("filterClear") }));
      await screen.findByText(t("filterQueryError")); assert.equal(rowCount(), 0);
      failQuery = false; await user.click(screen.getByRole("button", { name: t("viewsRetry") }));
      await waitFor(() => assert.equal(rowCount(), 2));
      await user.type(search, "draft"); await user.keyboard("{Escape}");
      await waitFor(() => assert.equal((screen.getByLabelText(t("filterSearch")) as HTMLInputElement).value, ""));
    } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
  });
}

test('clearing during a delayed initial read establishes live result refresh and rejects the late configuration', async () => {
  const { ViewFilters } = await import('../src/renderer/components/ViewFilters.js');
  const workspaceId = '00000000-0000-4000-8000-000000000001', viewId = '00000000-0000-4000-8000-000000000002';
  let resolveRead!: (value: unknown) => void;
  const read = new Promise(resolve => { resolveRead = resolve; });
  let ids = ['first']; let latest: string[] | null = null;
  const api = { workspace: async (input: {type:string; config?:object}) => {
    if (input.type === 'workspace.getViewFilter') return read;
    if (input.type === 'workspace.setViewFilter') return { ok: true, value: { workspaceId, viewId, config: input.config } };
    return { ok: true, value: { workspaceId, viewId, archived: false, projectIds: ids } };
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  const props = { client, workspaceId, viewId, archived: false, language: 'en' as const, snapshot: { workspaceId, sourceId: workspaceId, revision: 0, definitions: [], values: [] }, categories: [], disabled: false, onResults: (value: string[] | null) => { latest = value; } };
  try {
    const rendered = render(<ViewFilters {...props} refreshKey="one" />);
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    await waitFor(() => assert.deepEqual(latest, ['first']));
    ids = ['first','second']; rendered.rerender(<ViewFilters {...props} refreshKey="two" />);
    await waitFor(() => assert.deepEqual(latest, ['first','second']));
    resolveRead({ ok: true, value: { workspaceId, viewId, config: { search: 'stale', rules: [] } } });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal((screen.getByLabelText('Search project names') as HTMLInputElement).value, '');
  } finally { resolveRead({ ok: false }); cleanup(); }
});

test('failed Clear during the initial read leaves Retry usable', async () => {
  const { ViewFilters } = await import('../src/renderer/components/ViewFilters.js');
  const workspaceId = '00000000-0000-4000-8000-000000000001', viewId = '00000000-0000-4000-8000-000000000002';
  let resolveRead!: (value: unknown) => void;
  const initialRead = new Promise(resolve => { resolveRead = resolve; }); let reads = 0;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === 'workspace.getViewFilter') return ++reads === 1 ? initialRead : { ok: true, value: { workspaceId, viewId, config: { search: '', rules: [] } } };
    if (input.type === 'workspace.setViewFilter') return { ok: false, error: { code: 'storage', message: 'failed' } };
    return { ok: true, value: { workspaceId, viewId, archived: false, projectIds: [] } };
  }, onWorkspaceChange: () => () => {} } as unknown as WorkspaceDesktopApi;
  const client = new WorkspaceServiceClient(api), user = userEvent.setup({ document });
  try {
    render(<ViewFilters client={client} workspaceId={workspaceId} viewId={viewId} archived={false} language="en" snapshot={null} categories={[]} refreshKey="one" disabled={false} onResults={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }));
    await screen.findByText(translate('en', 'filterSaveError'));
    const retry = screen.getByRole('button', { name: translate('en', 'viewsRetry') }) as HTMLButtonElement;
    assert.equal(retry.disabled, false);
    await user.click(retry); await screen.findByText(translate('en', 'filterEmpty'));
  } finally { resolveRead({ ok: false }); cleanup(); }
});

test('a failed configuration reload rejects results from an older pending query', async () => {
  const { ViewFilters } = await import('../src/renderer/components/ViewFilters.js');
  const workspaceId = '00000000-0000-4000-8000-000000000001', viewId = '00000000-0000-4000-8000-000000000002';
  let resolveQuery!: (value: unknown) => void; const query = new Promise(resolve => { resolveQuery = resolve; });
  let reads = 0, queryStarted = false, latest: string[] | null = null;
  let emit!: (value: unknown) => void;
  const api = { workspace: async (input: {type:string}) => {
    if (input.type === 'workspace.getViewFilter') return ++reads === 1 ? { ok: true, value: { workspaceId, viewId, config: { search: '', rules: [] } } } : { ok: false, error: { code: 'storage', message: 'failed' } };
    queryStarted = true; return query;
  }, onWorkspaceChange: (listener: (value: unknown) => void) => { emit = listener; return () => {}; } } as unknown as WorkspaceDesktopApi;
  try {
    render(<ViewFilters client={new WorkspaceServiceClient(api)} workspaceId={workspaceId} viewId={viewId} archived={false} language="en" snapshot={null} categories={[]} refreshKey="one" disabled={false} onResults={ids => { latest = ids; }} />);
    await waitFor(() => assert.equal(queryStarted, true));
    await act(async () => { emit({ type: 'workspace.listChanged', snapshot: { workspaces: [], activeWorkspace: null } }); });
    await screen.findByText(translate('en', 'filterLoadError'));
    await act(async () => { resolveQuery({ ok: true, value: { workspaceId, viewId, archived: false, projectIds: ['stale'] } }); });
    assert.equal(latest === null, true);
  } finally { resolveQuery({ ok: false }); cleanup(); }
});

for (const language of ['en', 'ru'] as const) test(`${language} committed metadata removal refreshes saved filters without reloading configuration for value edits`, async () => {
  const { ViewFilters } = await import('../src/renderer/components/ViewFilters.js');
  const directory = mkdtempSync(join(tmpdir(), 'filter-removal-ui-')), root = join(directory, 'root'); mkdirSync(root);
  const service = openSettingsService(join(directory, 'app.sqlite'));
  const { workspaceId, viewId } = service.handleCommand({ type: 'workspace.create', rootPath: root, name: 'One' }).value;
  const command = (type: string, fields = {}) => {
    const result = service.handleCommand({ type: `workspace.${type}`, workspaceId, ...fields });
    assert.equal(result.ok, true); return result.value;
  };
  const query = (type: string, fields = {}) => {
    const result = service.handleQuery({ type: `workspace.${type}`, workspaceId, ...fields });
    assert.equal(result.ok, true); return result.value;
  };
  const propertyId = command('createProperty', { name: 'Status', propertyType: 'single_select' }).propertyId;
  for (const name of ['Old', 'Next']) command('createSelectOption', { propertyId, name, color: 'blue' });
  const options = query('listTextProperties').selectOptions;
  const old = options.find((o: {name:string}) => o.name === 'Old').optionId;
  const next = options.find((o: {name:string}) => o.name === 'Next').optionId;
  command('setViewFilter', { viewId, config: { search: '', rules: [{ propertyId, operator: 'any', operand: [old] }] } });
  let reads = 0, queries = 0;
  const client = new WorkspaceServiceClient({ workspace: async (input: {type:string}) => {
    if (input.type === 'workspace.getViewFilter') reads++;
    if (input.type === 'workspace.queryView') queries++;
    return service.handleQuery(input);
  }, onWorkspaceChange: service.workspaces.subscribe } as unknown as WorkspaceDesktopApi);
  const props = { client, workspaceId, viewId, archived: false, language, categories: [], disabled: false, onResults: () => {} };
  const user = userEvent.setup({ document });
  try {
    const snapshot = query('listTextProperties');
    const view = render(<ViewFilters {...props} snapshot={snapshot} refreshKey={String(snapshot.revision)} />);
    const operand = () => screen.getByLabelText(translate(language, 'filterOperand')) as HTMLSelectElement;
    await waitFor(() => assert.deepEqual(Array.from(operand().selectedOptions, o => o.value), [old]));
    const preview = query('previewMetadataRemoval', { propertyId, optionId: old, replacementOptionId: next });
    command('applyMetadataRemoval', { previewToken: preview.previewToken });
    const remaining = query('listTextProperties');
    assert.deepEqual(query('getViewFilter', { viewId }).config.rules[0].operand, [next]);
    view.rerender(<ViewFilters {...props} snapshot={remaining} refreshKey={String(remaining.revision)} />);
    await waitFor(() => assert.deepEqual(Array.from(operand().selectedOptions, o => o.value), [next]));
    assert.equal(reads, 2);
    const queryCount = queries;
    view.rerender(<ViewFilters {...props} snapshot={{ ...remaining, revision: remaining.revision + 1 }} refreshKey="value-edit" />);
    await waitFor(() => assert.equal(queries, queryCount + 1));
    assert.equal(reads, 2, 'ordinary value revisions retain the query-only refresh path');
    const removal = query('previewMetadataRemoval', { propertyId, optionId: null, replacementOptionId: null });
    command('applyMetadataRemoval', { previewToken: removal.previewToken });
    const deleted = query('listTextProperties');
    view.rerender(<ViewFilters {...props} snapshot={deleted} refreshKey="property-deleted" />);
    await waitFor(() => assert.equal(screen.queryByLabelText(translate(language, 'filterProperty')) === null, true));
    assert.equal(reads, 3);
    await user.type(screen.getByLabelText(translate(language, 'filterSearch')), 'authored draft');
    const other = command('createProperty', { name: 'Other', propertyType: 'text' }).propertyId;
    const added = query('listTextProperties');
    view.rerender(<ViewFilters {...props} snapshot={added} refreshKey="property-added" />);
    command('applyMetadataRemoval', { previewToken: query('previewMetadataRemoval', { propertyId: other, optionId: null, replacementOptionId: null }).previewToken });
    view.rerender(<ViewFilters {...props} snapshot={query('listTextProperties')} refreshKey="other-deleted" />);
    await waitFor(() => assert.equal(reads, 4));
    assert.equal((screen.getByLabelText(translate(language, 'filterSearch')) as HTMLInputElement).value, 'authored draft');
  } finally { cleanup(); service.close(); rmSync(directory, { recursive: true, force: true }); }
});
