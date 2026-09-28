import test from "node:test";
import assert from "node:assert/strict";
import { readProjectSession, writeProjectSession } from "../src/workspaceProjectSession.js";

test("legacy saved tabs migrate and duplicate project tabs survive restart", () => {
  const project = { id: "p", name: "Project", currentRelativePath: "p", status: { id: "s", name: "Status" }, propertyValues: {} };
  let data = JSON.stringify({ version: 1, tabs: { one: [project] }, screens: { one: { viewId: "board", projectId: "p" } } });
  const storage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  const migrated = readProjectSession(storage);
  assert.equal(migrated.screens.one.tabId, "legacy:p");
  writeProjectSession(storage, { one: [{ ...project, tabId: "a" }, { ...project, tabId: "b" }] }, { one: { viewId: "board", tabId: "b" } });
  const restored = readProjectSession(storage);
  assert.deepEqual(restored.tabs.one.map(tab => tab.tabId), ["a", "b"]);
  assert.equal(restored.screens.one.tabId, "b");
});

test("project tabs, order and workspace screens survive a storage round trip", () => {
  let value;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const project = id => ({ tabId: id, id, name: id, currentRelativePath: id, status: { id: "s", name: "Status" }, propertyValues: { text: "saved" }, fileTree: [{ name: "not persisted" }] });
  writeProjectSession(storage, { one: [project("b"), project("a")], two: [project("a")] }, { one: { viewId: "board", tabId: "b" }, two: { viewId: "table", tabId: null } });
  const restored = readProjectSession(storage);
  assert.deepEqual(restored.tabs.one.map(p => p.id), ["b", "a"]);
  assert.equal(restored.screens.one.tabId, "b");
  assert.equal(restored.screens.two.viewId, "table");
  assert.deepEqual(restored.tabs.one[0].fileTree, []);
  writeProjectSession(storage, { ...restored.tabs, one: [] }, restored.screens);
  assert.equal(readProjectSession(storage).screens.one.tabId, null);
});

test("damaged or inaccessible storage does not prevent startup", () => {
  for (const value of ["bad json", "null", '{"version":1,"tabs":{"one":[null,{}]}}']) {
    assert.deepEqual(Object.values(readProjectSession({ getItem: () => value }).tabs).flat(), []);
  }
  assert.deepEqual(readProjectSession({ getItem: () => { throw Error(); } }), { tabs: {}, screens: {} });
  assert.equal(writeProjectSession({ setItem: () => { throw Error(); } }, {}, {}), false);
});

test("expanded presentation survives restart independently of a tab's saved split membership", () => {
  let value;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const project = { id: "alpha", tabId: "alpha-instance", name: "Alpha", currentRelativePath: "alpha", status: { id: "s", name: "Active" }, propertyValues: {} };
  writeProjectSession(storage, { one: [project] }, { one: { viewId: "table", tabId: project.tabId, fullScreen: true } });
  assert.equal(readProjectSession(storage).screens.one.fullScreen, true);
  writeProjectSession(storage, { one: [project] }, { one: { viewId: "table", tabId: project.tabId, fullScreen: false } });
  assert.equal(readProjectSession(storage).screens.one.fullScreen, false);
});

test('preview identity survives independently of expanded tabs and is scoped to workspace', () => {
  let value;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  writeProjectSession(storage, {}, { a: { viewId: 'board', tabId: null, previewId: 'alpha' }, b: { viewId: 'table', tabId: null, previewId: 'beta' } });
  const restored = readProjectSession(storage);
  assert.equal(restored.screens.a.previewId, 'alpha');
  assert.equal(restored.screens.b.previewId, 'beta');
});
