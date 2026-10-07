import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceSession } from "../src/workspaceSession.js";
import { listWorkspacePanes } from "../src/workspaceSplitTree.js";

const project = (id) => ({
  id,
  name: id,
  currentRelativePath: `Active/${id}`,
  status: { id: "active", name: "Active" },
  propertyValues: {},
  fileTree: [],
});

test("opening a preview, selecting a tab and closing a preview publish coherent selection", () => {
  const session = createWorkspaceSession();
  const observed = [];
  session.subscribe(() => observed.push(session.getSnapshot()));
  session.dispatch({ type: "openProject", workspaceId: "w", project: project("a") });
  assert.equal(observed[0].selectedProject.id, "a");
  assert.equal(observed[0].activeProjectTabId, null);
  assert.equal(observed[0].layouts.w.rightVisible, true);
  session.dispatch({ type: "expandProject", workspaceId: "w", project: project("a"), tabId: "a" });
  session.dispatch({ type: "openProject", workspaceId: "w", project: project("a"), tabId: "a", fullScreen: false });
  assert.equal(observed.at(-1).activeProjectTabId, "a");
  assert.equal(observed.at(-1).projectTabSelected, false);
  session.dispatch({ type: "closePreview", workspaceId: "w" });
  assert.equal(observed.at(-1).selectedProject, null);
  assert.equal(observed.at(-1).activeProjectTabId, null);
  assert.equal(observed.at(-1).layouts.w.rightVisible, false);
  assert.equal(observed.at(-1).tabs.w.length, 1);
});

test("expanding a project reuses its tab unless a duplicate is explicitly requested", () => {
  const session = createWorkspaceSession();
  session.dispatch({ type: "expandProject", workspaceId: "w1", project: project("Alpha"), tabId: "a" });
  const reused = session.dispatch({ type: "expandProject", workspaceId: "w1", project: project("Alpha"), tabId: "unused" });
  assert.equal(reused.tabId, "a");
  assert.deepEqual(session.getSnapshot().tabs.w1.map(tab => tab.tabId), ["a"]);
  session.dispatch({ type: "expandProject", workspaceId: "w1", project: project("Alpha"), tabId: "duplicate", afterTabId: "a" });
  assert.deepEqual(session.getSnapshot().tabs.w1.map(tab => tab.tabId), ["a", "duplicate"]);
  assert.equal(session.getSnapshot().activeProjectTabId, "duplicate");
  assert.equal(session.getSnapshot().projectTabSelected, true);
});

test("closing multiple tabs publishes only the surviving fallback and can reopen the last closed tab", () => {
  const session = createWorkspaceSession();
  for (const id of ["a", "b", "c"])
    session.dispatch({ type: "expandProject", workspaceId: "w", project: project(id), tabId: id });
  const observed = [];
  session.subscribe(() => observed.push(session.getSnapshot().activeProjectTabId));
  const result = session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["a", "c"] });
  assert.deepEqual(observed, ["b"]);
  assert.deepEqual(result.snapshot.tabs.w.map(tab => tab.tabId), ["b"]);
  assert.equal(result.snapshot.selectedProject.id, "b");
  assert.deepEqual(result.focus, { kind: "projectTab", id: "b" });
  session.dispatch({ type: "reopenProject", workspaceId: "w" });
  assert.deepEqual(session.getSnapshot().tabs.w.map(tab => tab.tabId), ["b", "c"]);
  assert.equal(session.getSnapshot().activeProjectTabId, "c");
});

test("closing a focused split selects its right neighbour while retaining all project tabs", () => {
  const session = createWorkspaceSession();
  let target = "workspace";
  for (const id of ["a", "b", "c"]) {
    session.dispatch({ type: "splitProject", workspaceId: "w", project: project(id), newTabId: id, paneId: `pane:${id}`, target, side: "right" });
    target = `pane:${id}`;
  }
  session.dispatch({ type: "pane", workspaceId: "w", action: { type: "focus", pane: "pane:b" } });
  session.dispatch({ type: "pane", workspaceId: "w", action: { type: "maximize", pane: "pane:b" } });
  const result = session.dispatch({ type: "closePane", workspaceId: "w", paneId: "pane:b" });
  assert.deepEqual(listWorkspacePanes(result.snapshot.layouts.w.tree).map(pane => pane.paneId), ["workspace", "pane:a", "pane:c"]);
  assert.equal(result.snapshot.activeProjectTabId, "c");
  assert.equal(result.snapshot.layouts.w.focused, "pane:c");
  assert.equal(result.snapshot.layouts.w.maximized, null);
  assert.deepEqual(result.snapshot.tabs.w.map(tab => tab.tabId), ["a", "b", "c"]);
  assert.deepEqual(result.focus, { kind: "pane", id: "pane:c" });
});

test("closing an active tab retains unrelated split content and closing an inactive tab preserves selection", () => {
  const session = createWorkspaceSession();
  for (const id of ["a", "b", "c"])
    session.dispatch({ type: "splitProject", workspaceId: "w", project: project(id), newTabId: id, paneId: `pane:${id}`, target: "workspace", side: "right" });
  session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["c"] });
  assert.equal(session.getSnapshot().activeProjectTabId, "b");
  assert.deepEqual(new Set(listWorkspacePanes(session.getSnapshot().layouts.w.tree).map(p => p.tabId)), new Set([null, "a", "b"]));
  session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["a"] });
  assert.equal(session.getSnapshot().selectedProject.id, "b");
  session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["b"] });
  assert.equal(session.getSnapshot().selectedProject, null);
  assert.deepEqual(listWorkspacePanes(session.getSnapshot().layouts.w.tree).map(p => p.tabId), [null]);
});

test("subscriptions expose stable immutable snapshots and can be released", () => {
  const session = createWorkspaceSession();
  const initial = session.getSnapshot();
  assert.equal(initial, session.getSnapshot());
  let calls = 0;
  const unsubscribe = session.subscribe(() => calls++);
  session.dispatch({ type: "expandProject", workspaceId: "w", project: project("a"), tabId: "a" });
  assert.equal(calls, 1);
  assert.deepEqual(initial.tabs, {});
  unsubscribe();
  session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["a"] });
  assert.equal(calls, 1);
  const closed = session.getSnapshot();
  session.dispatch({ type: "closeTabs", workspaceId: "w", tabIds: ["missing"] });
  assert.equal(closed, session.getSnapshot());
});

test("Workspace and Settings navigation retain other panes and do not mix workspace layouts", () => {
  const session = createWorkspaceSession();
  session.dispatch({ type: "splitProject", workspaceId: "w1", project: project("a"), newTabId: "a", paneId: "pane:a", target: "workspace", side: "right" });
  session.dispatch({ type: "splitProject", workspaceId: "w1", project: project("c"), newTabId: "c", paneId: "pane:c", target: "pane:a", side: "bottom" });
  session.dispatch({ type: "pane", workspaceId: "w1", action: { type: "closePane", paneId: "workspace" } });
  session.dispatch({ type: "expandProject", workspaceId: "w2", project: project("b"), tabId: "b" });
  session.dispatch({ type: "pane", workspaceId: "w2", action: { type: "resizeSidebar", width: 410 } });
  session.dispatch({ type: "showSurface", workspaceId: "w1", surface: "settings" });
  assert.equal(session.getSnapshot().activeSurface, "settings");
  assert.deepEqual(listWorkspacePanes(session.getSnapshot().layouts.w1.tree).map(pane => pane.tabId), ["a", null]);
  assert.deepEqual(session.getSnapshot().tabs.w1.map(tab => tab.tabId), ["a", "c"]);
  assert.deepEqual(session.getSnapshot().tabs.w2.map(tab => tab.tabId), ["b"]);
  assert.equal(session.getSnapshot().sidebarWidth, 410);
  session.dispatch({ type: "showSurface", workspaceId: "w1", surface: "workspace" });
  assert.equal(session.getSnapshot().activeSurface, "workspace");
});

test("initial session reconciliation removes pane references to missing tabs", () => {
  const original = createWorkspaceSession();
  original.dispatch({ type: "splitProject", workspaceId: "w", project: project("a"), newTabId: "a", paneId: "pane:a", target: "workspace", side: "right" });
  const restored = createWorkspaceSession({ tabs: {}, layouts: original.getSnapshot().layouts });
  assert.deepEqual(listWorkspacePanes(restored.getSnapshot().layouts.w.tree).map(pane => pane.tabId), [null]);
});

test("Workspace IDs are opaque including inherited object key names", () => {
  const session = createWorkspaceSession();
  for (const workspaceId of ["__proto__", "constructor", "toString"])
    session.dispatch({ type: "splitProject", workspaceId, project: project(workspaceId), newTabId: workspaceId, paneId: "project", target: "workspace", side: "right" });
  for (const workspaceId of ["__proto__", "constructor", "toString"]) {
    assert.equal(session.getSnapshot().tabs[workspaceId][0].id, workspaceId);
    session.dispatch({ type: "closeTabs", workspaceId, tabIds: [workspaceId] });
    session.dispatch({ type: "reopenProject", workspaceId });
    assert.equal(session.getSnapshot().tabs[workspaceId][0].id, workspaceId);
  }
});

test("restoring an expanded tab to preview removes its split without creating closed-tab history", () => {
  const session = createWorkspaceSession();
  session.dispatch({ type: "expandProject", workspaceId: "w", project: project("a"), tabId: "a" });
  session.dispatch({ type: "splitProject", workspaceId: "w", project: project("a"), tabId: "a", paneId: "pane:a", target: "workspace", side: "right" });
  session.dispatch({ type: "restoreProject", workspaceId: "w", tabId: "a" });
  const snapshot = session.getSnapshot();
  assert.equal(snapshot.selectedProject.id, "a");
  assert.equal(snapshot.activeProjectTabId, null);
  assert.equal(snapshot.layouts.w.rightVisible, true);
  assert.deepEqual(listWorkspacePanes(snapshot.layouts.w.tree).map(pane => pane.tabId), [null]);
  assert.deepEqual(snapshot.tabs.w, []);
  assert.deepEqual(snapshot.closedProjectTabs, {});
});

test("existing restoration and project updates can use the owner without replacing tab identities", () => {
  const session = createWorkspaceSession();
  session.dispatch({ type: "expandProject", workspaceId: "w", project: project("a"), tabId: "first" });
  session.dispatch({ type: "expandProject", workspaceId: "w", project: project("a"), tabId: "copy", afterTabId: "first" });
  session.dispatch({ type: "selection", workspaceId: "w", selectedProject: current => ({ ...current, name: "Renamed" }) });
  session.dispatch({ type: "tabs", workspaceId: "w", action: { type: "update", workspaceId: "w", project: session.getSnapshot().selectedProject } });
  assert.deepEqual(session.getSnapshot().tabs.w.map(tab => [tab.tabId, tab.name]), [["first", "Renamed"], ["copy", "Renamed"]]);
  session.dispatch({ type: "surface", workspaceId: "w", surface: "workspace-settings" });
  assert.equal(session.getSnapshot().activeSurface, "workspace-settings");
  session.dispatch({ type: "selection", workspaceId: "w", selectedProject: null, activeProjectTabId: null, projectTabSelected: false });
  assert.equal(session.getSnapshot().activeProjectTabId, null);
});
