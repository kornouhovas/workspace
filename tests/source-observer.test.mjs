import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { createSourceObserver, nativeObserverDependencies } from "../src/service/source-observer.ts";

function harness(probe = nativeObserverDependencies.probe) {
  let now = 0;
  const timers = new Set(), watches = [], probes = [], attempts = [];
  let rejected = new Set();
  const dependencies = {
    probe(path) { probes.push(path); return probe(path); },
    schedule(callback, delay) {
      const timer = { callback, delay, due: now + delay, active: true };
      timers.add(timer);
      return { cancel() { timer.active = false; timers.delete(timer); } };
    },
    watch(path, hint, failed) {
      attempts.push(path);
      if (rejected.has(path)) throw new Error("watch setup failed");
      const handle = { path, hint, failed, closed: false };
      watches.push(handle);
      return { close() { handle.closed = true; } };
    },
  };
  return { dependencies, watches, timers, probes, attempts,
    reject(paths) { rejected = new Set(paths); },
    live() { return watches.filter((watch) => !watch.closed); },
    hint(path, ...args) { this.live().find((watch) => watch.path === path).hint(...args); },
    advance(ms) {
      const until = now + ms;
      let count = 0;
      while (true) {
        const timer = [...timers].filter((timer) => timer.active && timer.due <= until).sort((a, b) => a.due - b.due)[0];
        if (!timer) break;
        assert.ok(++count < 1000, "bounded scheduler");
        now = timer.due; timers.delete(timer); timer.active = false; timer.callback();
      }
      now = until;
    },
  };
}
const identity = { dev: "1", ino: "2", birthtimeNs: "3" };
const target = (path, ino = "2", stamp = "1:1") => ({ path, identity: { ...identity, ino }, stamp });

test("source scheduler coalesces filename hints without postponing, bounds in-pass hints and probes healthy roots only", () => {
  const h = harness((path) => target(path));
  const events = [];
  let passes = 0, during = false;
  const observer = createSourceObserver(() => {
    passes++;
    if (during) { during = false; h.hint("/root", "rename", "../../hostile"); h.hint("/root", "change", null); }
    return { state: "ready", signature: "topology", targets: [target("/root")] };
  }, (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: "/root" }, { sourceId: "one", root: "/root" }]);
  assert.equal(h.live().length, 1); assert.equal(passes, 1);
  h.advance(100); assert.equal(passes, 2); // Installation-window scan.
  h.hint("/root", "rename", null); h.advance(99);
  for (let n = 0; n < 10; n++) h.hint("/root", "change", "../../outside");
  h.advance(1); assert.equal(passes, 3);
  during = true; h.hint("/root"); h.advance(100); assert.equal(passes, 4);
  h.advance(100); assert.equal(passes, 5);
  h.advance(15000); assert.equal(passes, 5); assert.equal(events.length, 1);
  assert.deepEqual(h.probes, Array(h.probes.length).fill("/root"));
  const stale = h.live()[0]; observer.sync([]);
  assert.equal(h.timers.size, 0); assert.equal(h.live().length, 0);
  stale.hint(); stale.failed(); h.advance(20000); assert.equal(passes, 5);
  observer.close(); observer.sync([{ sourceId: "one", root: "/root" }]); assert.equal(h.live().length, 0);
});

test("watch replacement closes old handles, rejects stale callbacks and retries creation/errors without revision noise", () => {
  let root = target("/root"), category = target("/root/C", "4");
  const h = harness((path) => path === "/root" ? root : category);
  const events = [];
  const observer = createSourceObserver(() => ({ state: "ready", signature: category.identity.ino, targets: [root, category] }),
    (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: "/root" }]); h.advance(100);
  const old = h.live().find((watch) => watch.path === category.path);
  category = target("/root/C", "5"); h.hint("/root"); h.advance(200);
  assert.equal(old.closed, true); assert.equal(h.live().length, 2);
  const count = events.length; old.hint(); old.failed(); h.advance(100); assert.equal(events.length, count);
  h.reject([category.path]); h.live().find((watch) => watch.path === category.path).failed();
  assert.equal(events.at(-1)[3], "degraded"); h.advance(100);
  assert.equal(h.live().length, 1); assert.equal(events.length, count + 1);
  h.reject([]); h.advance(5100); assert.equal(h.live().length, 2); assert.equal(events.at(-1)[3], "active");
  root = target("/root", "6"); h.advance(5000); assert.equal(h.live().find((watch) => watch.path === root.path).closed, false);
  observer.close(); assert.equal(h.timers.size, 0); assert.equal(h.live().length, 0);
});

test("installation target races degrade safely and health retries; failed passes never fabricate healthy status", () => {
  let ino = "9", failPass = false;
  const h = harness((path) => target(path, ino));
  const events = [];
  const observer = createSourceObserver(() => {
    if (failPass) throw new Error("transaction rollback");
    return { state: "ready", signature: "same", targets: [target("/root")] };
  }, (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: "/root" }]); assert.equal(h.live().length, 0); assert.equal(events.at(-1)[3], "degraded");
  ino = "2"; h.advance(5200); assert.equal(h.live().length, 1); assert.equal(events.at(-1)[3], "active");
  failPass = true; h.hint("/root"); h.advance(100); assert.equal(events.at(-1)[3], "degraded");
  failPass = false; h.advance(5100); assert.equal(events.at(-1)[3], "active"); observer.close();
});

for (const failure of ["setup", "synchronous", "asynchronous"]) test(`repeated ${failure} watcher failures wait for health retry or explicit Refresh`, () => {
  const h = harness((path) => target(path)), events = [];
  const watch = h.dependencies.watch;
  let failing = true, passes = 0;
  h.dependencies.watch = (path, hint, failed) => {
    if (failure === "setup") h.reject(failing ? [path] : []);
    const handle = watch(path, hint, failed);
    if (failing && failure === "synchronous") failed();
    if (failing && failure === "asynchronous") h.dependencies.schedule(failed, 0);
    return handle;
  };
  const observation = { state: "ready", signature: "same", targets: [target("/root")] };
  const observer = createSourceObserver(() => { passes++; return observation; }, (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: "/root" }]);
  h.advance(4900);
  assert.equal(h.attempts.length, 1, "failed targets must not be reinstalled by notification/window passes");
  assert.ok(passes <= 2, "one immediate observation pass may follow a watch error");
  assert.equal(events.at(-1)[3], "degraded");
  h.advance(300);
  assert.equal(h.attempts.length, 2, "health timer permits one retry");
  assert.ok(passes <= 4); assert.equal(events.at(-1)[3], "degraded");
  failing = false;
  observer.accept("one", observation); // Explicit Refresh can recover before the next health tick.
  h.advance(100);
  assert.equal(h.attempts.length, 3); assert.equal(h.live().length, 1); assert.equal(events.at(-1)[3], "active");
  const count = passes, stale = [...h.watches]; observer.close();
  for (const handle of stale) { handle.hint(); handle.failed(); }
  h.advance(20000);
  assert.equal(passes, count); assert.equal(h.live().length, 0); assert.equal(h.timers.size, 0);
});

function fixture(grouped, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "source-observer-")));
  const root = join(directory, "root"), path = grouped ? "Category/Project" : "Project";
  fs.mkdirSync(join(root, path, "contents"), { recursive: true }); fs.writeFileSync(join(root, path, "contents/data"), "exact bytes");
  const h = harness(), databasePath = join(directory, "workspace.sqlite");
  let service = openSettingsService(databasePath, undefined, undefined, h.dependencies);
  const sqlite = new Database(databasePath);
  const one = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
  const two = service.workspaces.create({ type: "workspace.create", name: "Two", rootPath: root }).value;
  const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: one.workspaceId, ...extra });
  const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: one.workspaceId, ...extra });
  const preview = query("workspace.previewDiscovery", { mode: grouped ? "grouped" : "direct" }).value;
  const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
  const projectId = initial.projects[0].projectId;
  const propertyId = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
  command("workspace.setTextValue", { propertyId, projectId, value: "  Exact\nТекст  " });
  if (grouped) command("workspace.renameCategoryProperty", { propertyId: initial.categoryProperty.propertyId, name: "  Category label  " });
  h.advance(200);
  const events = []; service.workspaces.subscribe((event) => events.push(event));
  const records = () => Object.fromEntries(["sources", "projects", "categories", "category_properties", "property_definitions", "text_property_values", "workspaces", "views"]
    .map((table) => [table, sqlite.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
  const restart = () => {
    service.close(); assert.equal(h.live().length, 0); assert.equal(h.timers.size, 0);
    service = openSettingsService(databasePath, undefined, undefined, h.dependencies);
    service.workspaces.subscribe((event) => events.push(event));
  };
  try { run({ h, root, path, directory, sqlite, databasePath, one, two, initial, projectId, propertyId, query, command, records, events, restart,
    subscribe: (listener) => service.workspaces.subscribe(listener), close: () => service.close() }); }
  finally { service.close(); sqlite.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const grouped of [false, true]) test(`notification reconciliation preserves identities/metadata and only needed categories (${grouped ? "grouped" : "direct"})`, () => fixture(grouped, (f) => {
  const before = f.records();
  const discovery = f.query("workspace.previewDiscovery").value;
  const destination = f.path.includes("/") ? "New/Renamed" : "Renamed";
  if (grouped) {
    fs.mkdirSync(join(f.root, "New/Unrelated"), { recursive: true }); fs.mkdirSync(join(f.root, "Other/Unrelated"), { recursive: true }); fs.mkdirSync(join(f.root, "Empty"));
  }
  fs.renameSync(join(f.root, f.path), join(f.root, destination));
  fs.mkdirSync(join(f.root, f.path));
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.projectId }).value;
  f.h.hint(f.root, "rename", "../../outside"); f.h.hint(f.root, "change", null); f.h.advance(200);
  const after = f.records();
  for (const table of ["category_properties", "property_definitions", "text_property_values", "workspaces", "views"]) assert.deepEqual(after[table], before[table]);
  assert.deepEqual(after.sources, before.sources.map((source) => ({ ...source, discovery_revision: source.discovery_revision + 1 })));
  assert.equal(after.projects.length, 1); assert.equal(after.projects[0].id, f.projectId); assert.equal(after.projects[0].relative_path, destination);
  assert.equal(after.categories.length, grouped ? 2 : 0);
  assert.deepEqual(after.categories.map((row) => row.relative_path).sort(), grouped ? ["Category", "New"] : []);
  assert.equal(fs.readFileSync(join(f.root, destination, "contents/data"), "utf8"), "exact bytes");
  const committed = f.events.filter((event) => event.type === "workspace.projectsChanged"); assert.equal(committed.length, 1);
  assert.deepEqual(committed[0].workspaceIds, [f.one.workspaceId, f.two.workspaceId]);
  assert.equal(f.events.at(-1).type, "workspace.sourceObserved");
  assert.equal(f.query("workspace.listProjects").value.projects[0].relativePath, destination);
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).error.code, "stale_preview");
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.projectId, previewToken: recovery.previewToken, relativePath: destination }).error.code, "stale_preview");
  assert.deepEqual(f.h.live().map((watch) => watch.path).sort(), [f.root, ...(grouped ? ["Category", "New", "Other", "Empty"].map((name) => join(f.root, name)) : [])].sort());
  const count = f.events.length;
  f.h.hint(f.root); f.h.advance(100);
  fs.utimesSync(join(f.root, destination), new Date(), new Date()); f.h.hint(f.root); f.h.advance(100);
  assert.equal(f.events.length, count); assert.deepEqual(f.records(), after);
}));

for (const grouped of [false, true]) test(`startup catches shutdown-missed moves before queries and is idempotent (${grouped})`, () => fixture(grouped, (f) => {
  const before = f.records(); f.close();
  const destination = grouped ? "New/Renamed" : "Renamed";
  if (grouped) { fs.mkdirSync(join(f.root, "New/Unrelated"), { recursive: true }); fs.mkdirSync(join(f.root, "Empty")); }
  fs.renameSync(join(f.root, f.path), join(f.root, destination));
  f.restart();
  const list = f.query("workspace.listProjects").value;
  assert.equal(list.projects[0].projectId, f.projectId); assert.equal(list.projects[0].relativePath, destination);
  const after = f.records(); assert.equal(after.sources[0].discovery_revision, before.sources[0].discovery_revision + 1);
  assert.equal(after.projects.length, 1); assert.equal(after.categories.length, grouped ? 2 : 0);
  assert.deepEqual(after.text_property_values, before.text_property_values); assert.deepEqual(after.views, before.views);
  f.restart(); f.h.advance(200); assert.deepEqual(f.records(), after);
}));

test("missing/replaced observation changes no database state, invalidates reviews and handles root loss/reconnection", () => fixture(false, (f) => {
  const before = f.records(), preview = f.query("workspace.previewDiscovery").value;
  fs.renameSync(join(f.root, "Project"), join(f.directory, "away")); f.h.hint(f.root); f.h.advance(100);
  assert.deepEqual(f.records(), before); assert.equal(f.events.at(-1).state, "empty"); assert.equal(f.events.at(-1).automaticUpdates, "active");
  assert.equal(f.query("workspace.listProjects").value.retainedProjects[0].resolution, "missing");
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).error.code, "stale_preview");
  fs.mkdirSync(join(f.root, "Project")); f.h.hint(f.root); f.h.advance(100);
  assert.equal(f.query("workspace.listProjects").value.retainedProjects[0].resolution, "replaced"); assert.deepEqual(f.records(), before);
  const old = f.h.live()[0]; fs.renameSync(f.root, join(f.directory, "lost")); f.h.advance(5100);
  assert.equal(f.events.at(-1).state, "unavailable"); assert.equal(f.events.at(-1).automaticUpdates, "degraded"); assert.equal(old.closed, true);
  fs.renameSync(join(f.directory, "lost"), f.root); f.h.advance(5100);
  assert.equal(f.events.at(-1).automaticUpdates, "active"); assert.equal(f.h.live().length, 1); assert.deepEqual(f.records(), before);
}));

test("watch failures expose degraded observation without persistence and final sibling removal closes all resources", () => fixture(false, (f) => {
  const before = f.records(); f.h.reject([f.root]); const old = f.h.live()[0]; old.failed(); f.h.advance(100);
  assert.equal(f.events.at(-1).automaticUpdates, "degraded"); assert.deepEqual(f.records(), before);
  f.command("workspace.remove"); assert.equal(f.h.timers.size, 1);
  // Source remains referenced by the sibling, despite initiator removal.
  f.command("workspace.remove", { workspaceId: f.two.workspaceId }); assert.equal(f.h.timers.size, 0); assert.equal(f.h.live().length, 0);
  const count = f.events.length; old.hint(); old.failed(); f.h.advance(10000); assert.equal(f.events.length, count);
  assert.equal(f.records().projects.length, 1);
}));

test("observer storage rollback emits no committed event and retries retained state through health", () => fixture(true, (f) => {
  const before = f.records();
  fs.mkdirSync(join(f.root, "New")); fs.renameSync(join(f.root, f.path), join(f.root, "New/Project"));
  f.sqlite.exec("CREATE TRIGGER fail_observed BEFORE UPDATE OF relative_path ON projects BEGIN SELECT RAISE(ABORT, 'injected'); END");
  f.h.hint(f.root); f.h.advance(100);
  assert.deepEqual(f.records(), before); assert.equal(f.events.filter((event) => event.type === "workspace.projectsChanged").length, 0);
  assert.equal(f.events.at(-1).automaticUpdates, "degraded");
  f.sqlite.exec("DROP TRIGGER fail_observed"); f.h.advance(5200);
  assert.equal(f.query("workspace.listProjects").value.projects[0].relativePath, "New/Project");
  assert.equal(f.events.filter((event) => event.type === "workspace.projectsChanged").length, 1);
}));

test("reentrant Refresh cannot publish an older observation after a newer committed mapping", () => fixture(false, (f) => {
  let movedAgain = false;
  const listener = (event) => {
    if (event.type !== "workspace.projectsChanged" || movedAgain) return;
    movedAgain = true;
    fs.renameSync(join(f.root, "Renamed"), join(f.root, "Newest"));
    assert.equal(f.command("workspace.refreshSource").ok, true);
  };
  f.subscribe(listener);
  fs.renameSync(join(f.root, f.path), join(f.root, "Renamed"));
  assert.equal(f.command("workspace.refreshSource").ok, true);
  assert.equal(f.query("workspace.listProjects").value.projects[0].relativePath, "Newest");
  assert.equal(f.events.filter((event) => event.type === "workspace.projectsChanged").length, 2);
  assert.equal(f.events.filter((event) => event.type === "workspace.sourceObserved").length, 1);
  f.h.hint(f.root); f.h.advance(100);
  assert.equal(f.events.filter((event) => event.type === "workspace.sourceObserved").length, 1);
}));

test("production watcher uses bounded nonpersistent options and production retry/coalescing timers are unreferenced", () => {
  const originalWatch = fs.watch, originalTimer = globalThis.setTimeout;
  const watched = [], timers = [];
  fs.watch = (path, options, callback) => {
    const handle = { on(name, listener) { assert.equal(name, "error"); this.failed = listener; return this; }, close() {} };
    watched.push({ path, options, callback, handle }); return handle;
  };
  globalThis.setTimeout = (...args) => { const timer = originalTimer(...args); timers.push(timer); return timer; };
  syncBuiltinESMExports();
  try {
    const watcher = nativeObserverDependencies.watch("/selected/root", () => {}, () => {});
    assert.deepEqual(watched[0].options, { recursive: false, persistent: false }); watcher.close();
    const scheduled = [nativeObserverDependencies.schedule(() => {}, 100), nativeObserverDependencies.schedule(() => {}, 5000)];
    assert.ok(timers.every((timer) => !timer.hasRef())); scheduled.forEach((timer) => timer.cancel());
  } finally { fs.watch = originalWatch; globalThis.setTimeout = originalTimer; timers.forEach(clearTimeout); syncBuiltinESMExports(); }
});

test("a production service with configured sources does not keep a standalone Node process alive", () => fixture(true, (f) => {
  f.close();
  const code = `import { openSettingsService } from ${JSON.stringify(new URL("../dist/service/settings.mjs", import.meta.url).href)};
    const service = openSettingsService(process.argv[1]);
    const result = service.workspaces.load();
    if (!result.ok || !result.value.activeWorkspace) throw new Error('Startup failed');
    process.stdout.write('ready');`;
  const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", code, f.databasePath], {
    timeout: 3000, encoding: "utf8", env: { ...process.env, PATH: `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:${process.env.PATH}` },
  });
  assert.equal(stdout, "ready");
}));

test("watch scope excludes saved/automatic/archive/link targets and never opens project contents", () => fixture(true, (f) => {
  for (const path of [".hidden/Project", "Suppressed/Project", "Archive/Project", "Other/Project", "Other/.hidden"]) fs.mkdirSync(join(f.root, path), { recursive: true });
  const outside = join(f.directory, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, join(f.root, "Link"), process.platform === "win32" ? "junction" : "dir");
  // Persist the designation only in this disposable fixture; the product has no archive-selection command yet.
  f.sqlite.prepare("UPDATE sources SET archive_relative_path = 'Archive' WHERE id = ?").run(f.one.sourceId);
  const preview = f.query("workspace.previewDiscovery", { excludedRelativePaths: ["Suppressed"] }).value;
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).ok, true);
  const forbidden = [outside, join(f.root, ".hidden"), join(f.root, "Suppressed"), join(f.root, "Archive"),
    join(f.root, f.path), join(f.root, "Other/Project"), join(f.root, "Other/.hidden")];
  const original = fs.opendirSync;
  fs.opendirSync = (path, ...args) => { assert.ok(!forbidden.includes(path), `forbidden enumeration: ${path}`); return original(path, ...args); };
  syncBuiltinESMExports();
  try { f.h.hint(f.root); f.h.advance(200); }
  finally { fs.opendirSync = original; syncBuiltinESMExports(); }
  assert.deepEqual(f.h.live().map((watch) => watch.path).sort(), [f.root, join(f.root, "Category"), join(f.root, "Other")].sort());
  assert.ok(f.h.probes.every((path) => !forbidden.includes(path)));
}));

for (const conflict of ["root replacement", "root link"]) test(`root health declines ${conflict} and preserves all metadata`, () => fixture(false, (f) => {
  const before = f.records(); fs.renameSync(f.root, join(f.directory, "previous"));
  if (conflict === "root replacement") fs.mkdirSync(join(f.root, "Project"), { recursive: true });
  else fs.symlinkSync(join(f.directory, "previous"), f.root, process.platform === "win32" ? "junction" : "dir");
  f.h.advance(5200);
  assert.deepEqual(f.records(), before); assert.equal(f.events.at(-1).state, conflict === "root link" ? "unavailable" : "root_identity_conflict");
  assert.equal(f.events.at(-1).automaticUpdates, "degraded"); assert.equal(f.h.live().length, 0);
}));

test("category replacement reattaches watch targets without transferring known metadata", () => fixture(true, (f) => {
  const before = f.records(), category = join(f.root, "Category"), old = f.h.live().find((watch) => watch.path === category);
  fs.renameSync(category, join(f.directory, "previous")); fs.mkdirSync(join(category, "Project"), { recursive: true });
  f.h.hint(f.root); f.h.advance(200);
  assert.equal(old.closed, true); assert.deepEqual(f.records(), before);
  assert.equal(f.query("workspace.listProjects").value.retainedProjects[0].resolution, "replaced");
  const live = f.h.live().find((watch) => watch.path === category); assert.notEqual(live, old);
  const count = f.events.length; old.failed(); old.hint(); f.h.advance(100); assert.equal(f.events.length, count);
}));

for (const trigger of [
  "AFTER INSERT ON categories BEGIN SELECT RAISE(ABORT, 'inserted category rollback'); END",
  "AFTER UPDATE OF relative_path ON projects BEGIN UPDATE sources SET excluded_relative_paths = '[\"New\"]'; END",
]) test(`observer rolls back grouped writes/configuration races: ${trigger}`, () => fixture(true, (f) => {
  const before = f.records(); fs.mkdirSync(join(f.root, "New")); fs.renameSync(join(f.root, f.path), join(f.root, "New/Project"));
  f.sqlite.exec(`CREATE TRIGGER race_observed ${trigger}`);
  f.h.hint(f.root); f.h.advance(100);
  assert.deepEqual(f.records(), before); assert.equal(f.events.filter((event) => event.type === "workspace.projectsChanged").length, 0);
  assert.equal(f.events.at(-1).automaticUpdates, "degraded");
}));

test("startup degraded status reaches a newly connected subscriber without revision churn or stale replay", () => fixture(false, (f) => {
  f.close(); f.h.reject([f.root]); f.events.length = 0;
  const attempts = f.h.attempts.length;
  f.restart(); assert.equal(f.h.attempts.length, attempts + 1); f.h.advance(0);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].automaticUpdates, "degraded"); assert.equal(f.events[0].observationRevision, 1);
  const events = []; const off = f.subscribe((event) => events.push(event));
  f.h.reject([]); assert.equal(f.command("workspace.refreshSource").ok, true); f.h.advance(0);
  assert.deepEqual(events.map((event) => [event.type, event.observationRevision, event.automaticUpdates]), [["workspace.sourceObserved", 2, "active"]]);
  off(); const count = events.length; f.h.advance(200); assert.equal(events.length, count);
}));
