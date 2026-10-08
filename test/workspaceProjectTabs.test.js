import assert from "node:assert/strict";
import test from "node:test";
import { projectTabsReducer as reduce } from "../src/workspaceProjectTabs.js";

test("duplicate is inserted immediately after its source, preserving surrounding tabs", () => {
  const state = { one: [{ tabId: "a", id: "p" }, { tabId: "b", id: "q" }, { tabId: "c", id: "r" }] };
  const result = reduce(state, { type: "expand", workspaceId: "one", tabId: "copy", afterTabId: "a", project: state.one[0] });
  assert.deepEqual(result.one.map(tab => tab.tabId), ["a", "copy", "b", "c"]);
  assert.equal(result.one[1].id, "p");
});

test("duplicates have independent identities while sharing project updates", () => {
  let state = {};
  for (const tabId of ["first", "second", "third"]) {
    state = reduce(state, { type: "expand", workspaceId: "one", tabId, project: { id: "project", propertyValues: {} } });
  }
  state = reduce(state, { type: "reorder", workspaceId: "one", tabIds: ["third", "first", "second"] });
  state = reduce(state, { type: "valueSaved", workspaceId: "one", projectId: "project", propertyId: "text", value: "shared" });
  assert.ok(state.one.every(tab => tab.propertyValues.text === "shared"));
  state = reduce(state, { type: "remove", workspaceId: "one", tabId: "first" });
  assert.deepEqual(state.one.map(tab => tab.tabId), ["third", "second"]);
  state = reduce(state, { type: "update", workspaceId: "one", project: { id: "project", name: "Renamed" } });
  assert.deepEqual(state.one.map(tab => tab.tabId), ["third", "second"]);
  assert.ok(state.one.every(tab => tab.name === "Renamed"));
});

test("reordering keeps every project once and leaves other workspaces unchanged", () => {
  const state = { one: [{ tabId: "a", id: "a" }, { tabId: "b", id: "b" }, { tabId: "c", id: "c" }], two: [{ tabId: "x", id: "x" }] };
  const result = reduce(state, { type: "reorder", workspaceId: "one", tabIds: ["c", "b", "c", "missing"] });
  assert.deepEqual(result.one.map(p => p.id), ["c", "b", "a"]);
  assert.equal(result.two, state.two);
});

test("expanded projects accumulate without duplicates and remain isolated by workspace", () => {
  let state = {};
  const expand = (workspaceId, id) => {
    state = reduce(state, { type: "expand", workspaceId, tabId: id, project: { id, name: id } });
  };
  expand("one", "a");
  expand("one", "b");
  expand("two", "a");
  expand("one", "a");
  assert.deepEqual(state.one.map(p => p.id), ["a", "b"]);
  assert.deepEqual(state.two.map(p => p.id), ["a"]);
  state = reduce(state, { type: "remove", workspaceId: "one", tabId: "a" });
  assert.deepEqual(state.one.map(p => p.id), ["b"]);
  assert.equal(state.two.length, 1);
});

test("refreshing an open tab preserves edits but never recreates a closed or restored tab", () => {
  const project = { tabId: "a", id: "a", name: "A", propertyValues: { text: "before" } };
  let state = reduce({}, { type: "expand", workspaceId: "one", tabId: "a", project });
  const edited = { ...project, propertyValues: { text: "after" } };
  state = reduce(state, { type: "update", workspaceId: "one", project: edited });
  assert.equal(state.one[0].propertyValues.text, "after");
  state = reduce(state, { type: "remove", workspaceId: "one", tabId: "a" });
  assert.equal(reduce(state, { type: "update", workspaceId: "one", project: edited }), state);
});

test("a save completing after switching projects refreshes the original tab only", () => {
  let state = { one: [{ tabId: "a", id: "a", propertyValues: {} }, { tabId: "b", id: "b", propertyValues: {} }], two: [{ tabId: "a", id: "a", propertyValues: {} }] };
  state = reduce(state, { type: "valueSaved", workspaceId: "one", projectId: "a", propertyId: "text", value: "saved" });
  assert.equal(state.one[0].propertyValues.text, "saved");
  assert.deepEqual(state.one[1].propertyValues, {});
  assert.deepEqual(state.two[0].propertyValues, {});
  state = reduce(state, { type: "remove", workspaceId: "one", tabId: "a" });
  state = reduce(state, { type: "valueSaved", workspaceId: "one", projectId: "a", propertyId: "text", value: "late" });
  assert.deepEqual(state.one.map(p => p.id), ["b"]);
});

test("active bulk close returns to the saved view and inactive close preserves selection", async()=>{
 const {projectTabCloseSelection}=await import("../src/workspaceProjectTabs.js");
 const tabs=[{tabId:"a"},{tabId:"b"},{tabId:"c"},{tabId:"d"}];
 assert.equal(projectTabCloseSelection(tabs,"d",["c","d"]),null);
 assert.equal(projectTabCloseSelection(tabs,"b",["a","c","d"]).tabId,"b");
 assert.equal(projectTabCloseSelection(tabs,"a",["a","b"]),null);
 assert.equal(projectTabCloseSelection(tabs,"b",["a","b","c","d"]),null);
});


test("closing the active expanded tab returns to the saved view without discarding other tabs", async () => {
  const { projectTabCloseSelection } = await import("../src/workspaceProjectTabs.js");
  const tabs = [{ tabId: "left", id: "p" }, { tabId: "active", id: "q" }, { tabId: "right", id: "r" }];
  assert.equal(projectTabCloseSelection(tabs, "active", ["active"]), null);
  const remaining = reduce({ workspace: tabs }, { type: "remove", workspaceId: "workspace", tabId: "active" });
  assert.deepEqual(remaining.workspace.map(tab => tab.tabId), ["left", "right"]);
  assert.equal(projectTabCloseSelection(tabs, "active", ["left"]), tabs[1]);
});
