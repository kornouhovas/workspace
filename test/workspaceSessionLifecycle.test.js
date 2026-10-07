import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceSessionLifecycle } from "../src/workspaceSessionLifecycle.js";

const project = id => ({ id, name: id, currentRelativePath: id, status: { id: "active", name: "Active" }, propertyValues: {}, fileTree: [] });
const context = { workspaceId: "one", viewId: "board" };
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const client = { getProject: async () => ({ project: null }), listProjectFileTree: async () => ({ fileTree: [] }) };

test("restart restores expanded presentation, split identity and shared width without persisting closed history", async () => {
  const storage = memoryStorage();
  const session = createWorkspaceSessionLifecycle({ storage, client });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  session.dispatch({ type: "splitProject", workspaceId: "one", project: project("alpha"), newTabId: "tab-a", paneId: "pane-a" });
  session.dispatch({ type: "expandProject", workspaceId: "one", project: project("beta"), tabId: "tab-b" });
  session.dispatch({ type: "closeTabs", workspaceId: "one", tabIds: ["tab-b"] });
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha"), tabId: "tab-a", fullScreen: true });
  session.dispatch({ type: "pane", workspaceId: "one", action: { type: "resizeSidebar", width: 410 } });
  session.syncScreen({ ...context, ready: true });
  const restarted = createWorkspaceSessionLifecycle({ storage, client });
  restarted.acceptWorkspace(await restarted.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  const snapshot = restarted.getSnapshot();
  assert.equal(snapshot.activeProjectTabId, "tab-a");
  assert.equal(snapshot.projectTabSelected, true);
  assert.equal(snapshot.layouts.one.split, true);
  assert.equal(snapshot.sidebarWidth, 410);
  assert.deepEqual(snapshot.closedProjectTabs, {});
});

test("legacy saved preview restores fresh data outside the current projection and unavailable projects close the host", async () => {
  const storage = memoryStorage({ "workspace.project-tabs.v1": JSON.stringify({ version: 2, tabs: {}, screens: { one: { viewId: "board", tabId: null, previewId: "filtered" } } }) });
  const session = createWorkspaceSessionLifecycle({ storage, client: { ...client, getProject: async () => ({ project: project("filtered") }) } });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(session.getSnapshot().selectedProject?.id, "filtered");
  assert.equal(session.getSnapshot().layouts.one.rightVisible, true);
  session.syncScreen({ ...context, ready: true });
  const missing = createWorkspaceSessionLifecycle({ storage, client });
  const result = missing.acceptWorkspace(await missing.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(result.unavailable, true);
  assert.equal(missing.getSnapshot().selectedProject, null);
  assert.equal(missing.getSnapshot().layouts.one.rightVisible, false);
  assert.equal(missing.getScreen("one").previewByView.board, null);
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("delayed Workspace restoration cannot replace a newer Workspace selection", async () => {
  const lookup = deferred();
  const storage = memoryStorage({ "workspace.project-tabs.v1": JSON.stringify({ version: 2, tabs: {}, screens: { one: { viewId: "board", tabId: null, previewId: "alpha" } } }) });
  const session = createWorkspaceSessionLifecycle({ storage, client: { ...client, getProject: () => lookup.promise } });
  const old = session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] });
  session.beginWorkspace("two");
  session.acceptWorkspace(await session.prepareWorkspace({ workspaceId: "two", viewId: "table", viewIds: ["table"], projects: [] }));
  lookup.resolve({ project: project("alpha") });
  assert.equal(session.acceptWorkspace(await old).accepted, false);
  assert.equal(session.getSnapshot().selectedProject, null);
  assert.equal(session.getScreen("two").viewId, "table");
});

test("late view previews cannot reopen a closed host or replace a newer project selection", async () => {
  for (const action of ["close", "select"]) {
    const lookup = deferred();
    const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, getProject: () => lookup.promise } });
    session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board", "table"], projects: [] }));
    session.rememberPreview("alpha", "table", "one");
    session.selectView({ workspaceId: "one", viewId: "table" });
    const pending = session.preparePreview({ workspaceId: "one", viewId: "table" });
    session.dispatch(action === "close" ? { type: "closePreview", workspaceId: "one" } : { type: "openProject", workspaceId: "one", project: project("beta") });
    lookup.resolve({ project: project("alpha") });
    assert.equal(session.acceptPreview(await pending).accepted, false);
    assert.equal(session.getSnapshot().selectedProject?.id || null, action === "close" ? null : "beta");
  }
});

test("rapid saved-view reversal restores the original preview and rejects the intervening response", async () => {
  const table = deferred();
  const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, getProject: ({ projectId }) => projectId === "beta" ? table.promise : Promise.resolve({ project: project(projectId) }) } });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board", "table"], projects: [] }));
  session.rememberPreview("alpha", "board", "one");
  session.rememberPreview("beta", "table", "one");
  session.selectView({ workspaceId: "one", viewId: "table" });
  const pending = session.preparePreview({ workspaceId: "one", viewId: "table" });
  session.selectView({ ...context, expanded: true });
  session.rememberPreview("alpha", "board", "one");
  await session.restoreReadyView(context);
  assert.equal(session.getSnapshot().selectedProject?.id, "alpha");
  table.resolve({ project: project("beta") });
  assert.equal(session.acceptPreview(await pending).accepted, false);
  assert.equal(session.getSnapshot().selectedProject?.id, "alpha");
});

test("late file trees cannot refresh the same project after switching view or report stale errors", async () => {
  for (const fail of [false, true]) {
    const files = deferred();
    const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, listProjectFileTree: () => files.promise } });
    session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board", "table"], projects: [] }));
    session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
    const pending = session.loadProjectFileTree(project("alpha"), "one");
    session.selectView({ workspaceId: "one", viewId: "table" });
    files.resolve(fail ? Promise.reject(new Error("offline")) : { fileTree: [{ name: "stale" }] });
    assert.deepEqual(await pending, { accepted: false });
    assert.deepEqual(session.getSnapshot().selectedProject.fileTree, []);
  }
});

test("malformed, read-failing and write-failing storage leaves session commands usable", async () => {
  for (const storage of [
    memoryStorage({ "workspace.project-tabs.v1": "broken", "workspace.pane-layout.v1": "null" }),
    { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } },
    { getItem: () => null, setItem() { throw Error("quota"); } },
  ]) {
    const session = createWorkspaceSessionLifecycle({ storage, client });
    session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
    session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
    session.syncScreen({ ...context, ready: true });
    assert.equal(session.getSnapshot().selectedProject.id, "alpha");
    session.dispatch({ type: "closePreview", workspaceId: "one" });
    assert.equal(session.getSnapshot().selectedProject, null);
  }
});

test("sidebar width persists before a source or ready projection is available", () => {
  const storage = memoryStorage();
  const session = createWorkspaceSessionLifecycle({ storage, client });
  session.dispatch({ type: "pane", workspaceId: "preview", action: { type: "resizeSidebar", width: 390 } });
  assert.equal(createWorkspaceSessionLifecycle({ storage, client }).getSnapshot().sidebarWidth, 390);
});

test("opaque Workspace screen keys do not discard valid saved tabs when another screen has no tabs", async () => {
  const storage = memoryStorage({ "workspace.project-tabs.v1": JSON.stringify({ version: 2, tabs: { one: [{ ...project("alpha"), tabId: "a" }] }, screens: { one: { viewId: "board", tabId: "a" }, ["__proto__"]: { viewId: "board", tabId: null } } }) });
  const session = createWorkspaceSessionLifecycle({ storage, client });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(session.getSnapshot().activeProjectTabId, "a");
  assert.equal(session.getScreen("__proto__").viewId, "board");
});

test("saved-view previews remain independent across same-type views and Workspaces, including explicit close and deletion", async () => {
  const storage = memoryStorage();
  const session = createWorkspaceSessionLifecycle({ storage, client: { ...client, getProject: async ({ projectId }) => ({ project: project(projectId) }) } });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board", "other-board"], projects: [] }));
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
  session.syncScreen({ ...context, ready: true });
  session.selectView({ workspaceId: "one", viewId: "other-board" });
  session.acceptPreview(await session.preparePreview({ workspaceId: "one", viewId: "other-board" }));
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("beta") });
  session.dispatch({ type: "closePreview", workspaceId: "one" });
  session.selectView(context);
  session.acceptPreview(await session.preparePreview(context));
  assert.equal(session.getSnapshot().selectedProject.id, "alpha");
  session.beginWorkspace("two");
  session.acceptWorkspace(await session.prepareWorkspace({ workspaceId: "two", viewId: "board", viewIds: ["board"], projects: [] }));
  session.dispatch({ type: "openProject", workspaceId: "two", project: project("gamma") });
  session.syncScreen({ workspaceId: "two", viewId: "board", ready: true });
  session.removeView("one", "other-board");
  const restarted = createWorkspaceSessionLifecycle({ storage, client: { ...client, getProject: async ({ projectId }) => ({ project: project(projectId) }) } });
  restarted.acceptWorkspace(await restarted.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(restarted.getSnapshot().selectedProject.id, "alpha");
  assert.deepEqual(restarted.getScreen("one").previewByView, { board: "alpha" });
  assert.deepEqual(restarted.getScreen("two").previewByView, { board: "gamma" });
});

test("existing v1 tab identities restore without changing the storage key", async () => {
  const storage = memoryStorage({ "workspace.project-tabs.v1": JSON.stringify({ version: 1, tabs: { one: [project("alpha")] }, screens: { one: { viewId: "board", projectId: "alpha", fullScreen: true } } }) });
  const session = createWorkspaceSessionLifecycle({ storage, client });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(session.getSnapshot().activeProjectTabId, "legacy:alpha");
  session.syncScreen({ ...context, ready: true });
  assert.equal(JSON.parse(storage.getItem("workspace.project-tabs.v1")).version, 2);
});

test("malformed preview responses close the saved host instead of installing invalid project data", async () => {
  const storage = memoryStorage({ "workspace.project-tabs.v1": JSON.stringify({ version: 2, tabs: {}, screens: { one: { viewId: "board", tabId: null, previewId: "alpha" } } }) });
  const session = createWorkspaceSessionLifecycle({ storage, client: { ...client, getProject: async () => ({ project: [] }) } });
  const result = session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  assert.equal(result.unavailable, true);
  assert.equal(session.getSnapshot().selectedProject, null);
});

test("failed Workspace activation preserves the outgoing preview identity for subsequent selection", async () => {
  const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  session.beginWorkspace("two");
  session.cancelWorkspace();
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("beta") });
  assert.equal(session.getScreen("one").previewByView.board, "beta");
  assert.equal(session.getScreen("two"), undefined);
});

test("fresh file trees retain intervening project edits and current errors remain observable", async () => {
  const files = deferred();
  const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, listProjectFileTree: () => files.promise } });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
  const pending = session.loadProjectFileTree(project("alpha"), "one");
  session.dispatch({ type: "selection", workspaceId: "one", selectedProject: { ...project("alpha"), propertyValues: { note: "edited" } } });
  files.resolve({ fileTree: [{ name: "README.md", type: "file" }] });
  assert.equal((await pending).accepted, true);
  assert.equal(session.getSnapshot().selectedProject.propertyValues.note, "edited");
  assert.equal(session.getSnapshot().selectedProject.fileTree[0].name, "README.md");
  const failed = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, listProjectFileTree: async () => { throw Error("offline"); } } });
  failed.acceptWorkspace(await failed.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  failed.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
  assert.equal((await failed.loadProjectFileTree(project("alpha"), "one")).error.message, "offline");
});

test("Settings navigation during Workspace restoration retains the chosen surface and completes destination adoption", async () => {
  const lookup = deferred();
  const session = createWorkspaceSessionLifecycle({ storage: memoryStorage(), client: { ...client, getProject: () => lookup.promise } });
  session.acceptWorkspace(await session.prepareWorkspace({ ...context, viewIds: ["board"], projects: [] }));
  session.dispatch({ type: "openProject", workspaceId: "one", project: project("alpha") });
  session.rememberPreview("beta", "board", "two");
  session.beginWorkspace("two");
  const pending = session.prepareWorkspace({ workspaceId: "two", viewId: "board", viewIds: ["board"], projects: [] });
  session.dispatch({ type: "showSurface", workspaceId: "one", surface: "settings" });
  lookup.resolve({ project: project("beta") });
  assert.equal(session.acceptWorkspace(await pending).accepted, true);
  assert.equal(session.pendingWorkspaceId, null);
  assert.equal(session.getSnapshot().selectedProject.id, "beta");
  assert.equal(session.getSnapshot().activeSurface, "settings");
});
