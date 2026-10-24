import {openUnconvertedEngineFixture} from './support/unconverted-command-engines.mjs';
import {projectMetadataRecords} from './support/identity-migration-fixtures.mjs';
import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";
import { createSourceObserver, nativeObserverDependencies } from "../src/service/source-observer.ts";
import { scanDirectSource, scanGroupedSource } from "../src/service/discovery.ts";

function harness(probe = nativeObserverDependencies.probe) {
  let now = 0;
  const timers = new Set(), watches = [], probes = [], attempts = [];
  let rejected = new Set();
  const dependencies = {
    scan(request) { return (request.mode === "grouped" ? scanGroupedSource : scanDirectSource)(request.canonicalRoot, request.archiveRelativePath, request.exclusions); },
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

test("an asynchronous observation leaves commands free and cannot replace an explicitly accepted newer lifetime", async () => {
  const h = harness(path=>target(path)), events=[];
  let resolve; const deferred = new Promise(done=>{resolve=done;});
  const observer=createSourceObserver(()=>deferred,(_,observation)=>events.push(observation.signature),h.dependencies);
  observer.sync([{sourceId:"one",root:"/root"}]);
  assert.deepEqual(events,[],"A pending scan is not an accepted observation");
  observer.accept("one",{state:"ready",signature:"newer",targets:[target("/root")]});
  resolve({state:"ready",signature:"old",targets:[target("/root")]});
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(events,["newer"]);
  observer.close(); assert.equal(h.live().length,0);assert.equal(h.timers.size,0);
});
test("closing during an asynchronous observation rejects late watch installation and events", async()=>{
  const h=harness(path=>target(path)),events=[];
  let resolve;const deferred=new Promise(done=>{resolve=done;});
  const observer=createSourceObserver(()=>deferred,(...event)=>events.push(event),h.dependencies);
  observer.sync([{sourceId:"one",root:"/root"}]);observer.close();
  resolve({state:"ready",signature:"late",targets:[target("/root")]});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(events,[]);assert.equal(h.live().length,0);assert.equal(h.timers.size,0);
});

test("native rename diagnostic compares root-only and root-plus-category directory handles", (t) => {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "watch-rename-diagnostic-")));
  try {
    for (const nested of [false, true]) {
      const root = join(directory, nested ? "nested" : "root-only"), category = join(root, "Category");
      fs.mkdirSync(join(category, "Project"), { recursive: true });
      const handles = [];
      let outcome = "renamed";
      try {
        handles.push(fs.watch(root, { persistent: false, recursive: false }, () => {}));
        if (nested) handles.push(fs.watch(category, { persistent: false, recursive: false }, () => {}));
        try { fs.renameSync(root, `${root}-moved`); }
        catch (error) { outcome = error.code; }
      }
      finally { for (const handle of handles) handle.close(); }
      t.diagnostic(`${process.platform} ${nested ? "root-plus-category" : "root-only"}: ${outcome}`);
      // The comparison documents native platform behavior; production Windows
      // requires the root-only topology to allow the external operation.
      if (!nested) assert.equal(outcome, "renamed");
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

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

test("category polling keeps root notifications, scans unchanged stamps and cleans up without revision noise", () => {
  const root = target("/root"), category = target("/root/C", "4"), h = harness((path) => path === root.path ? root : category);
  h.dependencies.pollCategories = true;
  const events = [];
  let passes = 0, signature = "C/Project";
  const observer = createSourceObserver(() => {
    passes++;
    return { state: "ready", signature, targets: [root, category] };
  }, (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: root.path }, { sourceId: "one", root: root.path }]);
  h.advance(100);
  assert.deepEqual(h.live().map((watch) => watch.path), [root.path]);
  assert.equal(passes, 2); assert.equal(events.at(-1)[3], "active");
  signature = "C/Renamed"; // Root/category timestamps deliberately remain unchanged.
  h.advance(4899); assert.equal(passes, 2);
  h.advance(101); assert.equal(passes, 3); assert.equal(events.length, 2);
  h.advance(5000); assert.equal(passes, 4); assert.equal(events.length, 2);
  signature = "RenamedCategory/Renamed";
  h.hint(root.path, "rename", null); h.advance(100);
  assert.equal(passes, 5); assert.equal(events.length, 3);
  assert.deepEqual(h.attempts, [root.path]);
  assert.ok(h.probes.every((path) => path === root.path));
  const stale = h.live()[0]; observer.sync([]);
  assert.equal(h.live().length, 0); assert.equal(h.timers.size, 0);
  stale.hint(); stale.failed(); h.advance(10000); assert.equal(passes, 5);
  observer.close();
});

test("category polling retains unavailable sources and retries failed root notifications on the bounded health tick", () => {
  const root = target("/root"), category = target("/root/C", "4"), h = harness((path) => path === root.path ? root : category);
  h.dependencies.pollCategories = true; h.reject([root.path]);
  const events = [];
  let unavailable = false, passes = 0;
  const observer = createSourceObserver(() => {
    passes++;
    return { state: unavailable ? "unavailable" : "ready", signature: "saved", targets: unavailable ? [] : [root, category] };
  }, (...args) => events.push(args), h.dependencies);
  observer.sync([{ sourceId: "one", root: root.path }]);
  h.advance(4999); assert.equal(h.attempts.length, 1); assert.equal(passes, 1);
  unavailable = true; h.advance(101); assert.equal(events.at(-1)[1].state, "unavailable");
  assert.equal(events.at(-1)[3], "degraded"); assert.equal(h.live().length, 0);
  unavailable = false; h.reject([]); h.advance(5100);
  assert.equal(events.at(-1)[1].state, "ready"); assert.equal(events.at(-1)[3], "active");
  assert.deepEqual(h.live().map((watch) => watch.path), [root.path]);
  observer.close(); assert.equal(h.timers.size, 0);
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

function fixture(grouped, run, projectFilesystem, pollCategories = false) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "source-observer-")));
  const root = join(directory, "root"), path = grouped ? "Category/Project" : "Project";
  fs.mkdirSync(join(root, path, "contents"), { recursive: true }); fs.writeFileSync(join(root, path, "contents/data"), "exact bytes");
  const h = harness(); h.dependencies.pollCategories = pollCategories;
  const databasePath = join(directory, "workspace.sqlite");
  let service = openSettingsService(databasePath, undefined, undefined, h.dependencies, projectFilesystem);
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
    service = openSettingsService(databasePath, undefined, undefined, h.dependencies, projectFilesystem);
    service.workspaces.subscribe((event) => events.push(event));
  };
  const cleanup=()=>{service.close();sqlite.close();fs.rmSync(directory,{recursive:true,force:true});};
  let asynchronous=false;
  try { const result=run({ h, root, path, directory, sqlite, databasePath, one, two, initial, projectId, propertyId, query, command, records, events, restart,
    legacyCommand(input){
      const quiet={watch(){return{close(){}};},schedule(){return{cancel(){}};}};
      const fixture=openUnconvertedEngineFixture(databasePath,undefined,undefined,quiet,projectFilesystem);
      try{return fixture.engines.handleCommand({workspaceId:one.workspaceId,...input});}finally{fixture.engines.close();}
    },
    subscribe: (listener) => service.workspaces.subscribe(listener), close: () => service.close() });
    if(result instanceof Promise){asynchronous=true;return result.finally(cleanup);}return result;
  } finally {if(!asynchronous)cleanup();}
}

test("a delayed real scan reconciles identity without overwriting a metadata edit accepted while it was pending",()=>fixture(false,async f=>{
  const scan=f.h.dependencies.scan;let release;
  f.h.dependencies.scan=request=>{const result=scan(request);return new Promise(resolve=>{release=()=>resolve(result);});};
  fs.renameSync(join(f.root,"Project"),join(f.root,"Renamed"));
  f.h.hint(f.root);f.h.advance(100);assert.equal(typeof release,"function");
  const saved=f.command("workspace.setTextValue",{projectId:f.projectId,propertyId:f.propertyId,value:"Accepted during background read"});
  assert.equal(saved.ok,true);
  release();await new Promise(setImmediate);
  const projects=f.query("workspace.listProjects",{observed:true});
  assert.equal(projects.value.projects.find(p=>p.projectId===f.projectId).name,"Renamed");
  assert.equal(f.query("workspace.listTextProperties").value.values.find(v=>v.projectId===f.projectId).value,"Accepted during background read");
}));
test("a real scan from an older mode cannot overwrite newer Apply and close rejects late reconciliation",()=>fixture(false,async f=>{
  const scan=f.h.dependencies.scan;let release;
  f.h.dependencies.scan=request=>{const result=scan(request);return new Promise(resolve=>{release=()=>resolve(result);});};
  f.h.hint(f.root);f.h.advance(100);
  const preview=f.query("workspace.previewDiscovery",{mode:"grouped"}).value;
  const applied=f.command("workspace.applyDiscovery",{previewToken:preview.previewToken});assert.equal(applied.ok,true);
  const after=f.records();release();await new Promise(setImmediate);
  assert.deepEqual(f.records(),after);assert.equal(f.query("workspace.listProjects",{observed:true}).value.mode,"grouped");
  f.h.advance(100);const beforeClose=f.records(),count=f.events.length;
  f.close();release();await new Promise(setImmediate);
  assert.deepEqual(f.records(),beforeClose);assert.equal(f.events.length,count);assert.equal(f.h.live().length,0);assert.equal(f.h.timers.size,0);
}));

for (const grouped of [false, true]) test(`notification reconciliation preserves identities/metadata and only needed categories (${grouped ? "grouped" : "direct"})`, () => fixture(grouped, (f) => {
  const before = f.records();
  const discovery = f.query("workspace.previewDiscovery").value;
  const destination = f.path.includes("/") ? "New/Renamed" : "Renamed";
  if (grouped) {
    fs.mkdirSync(join(f.root, "New/Unrelated"), { recursive: true }); fs.mkdirSync(join(f.root, "Other/Unrelated"), { recursive: true }); fs.mkdirSync(join(f.root, "Empty"));
  }
  fs.renameSync(join(f.root, f.path), join(f.root, destination));
  fs.mkdirSync(join(f.root, f.path));
  const recovery = f.query("workspace.previewProjectRecovery", { projectId: f.projectId });assert.equal(recovery.error.code,"identity_update_required");
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
  assert.equal(f.command("workspace.reassociateProject", { projectId: f.projectId, previewToken: randomUUID(), relativePath: destination }).error.code,"identity_update_required");
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


for (const polling of [false, true]) test(`mode Apply immediately retargets shared observation and rejects obsolete category callbacks (polling=${polling})`, () => fixture(true, (f) => {
  f.h.dependencies.pollCategories = polling;
  const otherRoot = join(f.directory, "other"); fs.mkdirSync(join(otherRoot, "Project"), { recursive: true });
  const other = f.command("workspace.create", { name: "Unrelated", rootPath: otherRoot }).value;
  const configure = (workspaceId, mode) => {
    const preview = f.query("workspace.previewDiscovery", { workspaceId, mode }); assert.equal(preview.ok, true);
    const result = f.command("workspace.applyDiscovery", { workspaceId, previewToken: preview.value.previewToken });
    assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
  };
  configure(other.workspaceId, "direct"); f.h.advance(200);
  // Reinstall under the platform strategy before observing mode transitions.
  f.restart(); f.h.advance(200); f.events.length = 0;
  const obsolete = f.h.live().find((watch) => watch.path === join(f.root, "Category"));
  const siblingPreview = f.query("workspace.previewDiscovery", { workspaceId: f.two.workspaceId }).value;
  const direct = configure(f.one.workspaceId, "direct");
  assert.equal(direct.retainedProjects.find((row) => row.projectId === f.projectId).retentionReason, "mode_change");
  assert.deepEqual(f.h.live().map((watch) => watch.path).sort(), [f.root, otherRoot].sort());
  assert.equal(f.command("workspace.applyDiscovery", { workspaceId: f.two.workspaceId, previewToken: siblingPreview.previewToken }).error.code, "stale_preview");
  f.h.advance(200);
  const count = f.events.length;
  if (obsolete) { assert.equal(obsolete.closed, true); obsolete.hint(); obsolete.failed(); }
  f.h.advance(100); assert.equal(f.events.length, count);
  const recovery = f.query("workspace.previewProjectRecovery", { workspaceId: f.two.workspaceId, projectId: f.projectId });
  assert.equal(recovery.error.code,"identity_update_required");
  const grouped = configure(f.two.workspaceId, "grouped");
  assert.equal(grouped.categories[0].categoryId, f.initial.categories[0].categoryId);
  assert.deepEqual(f.h.live().map((watch) => watch.path).sort(), [f.root, otherRoot, ...(polling ? [] : [join(f.root, "Category")])].sort());
  assert.equal(f.command("workspace.reassociateProject", { workspaceId: f.two.workspaceId, projectId: f.projectId,
    previewToken: randomUUID(), relativePath: "Category" }).error.code,"identity_update_required");
  f.h.advance(200);
  const before = f.records();
  fs.mkdirSync(join(f.root, "Category/Unrelated")); fs.renameSync(join(f.root, f.path), join(f.root, "Category/Renamed"));
  if (polling) f.h.advance(5100); else { f.h.hint(join(f.root, "Category")); f.h.advance(200); }
  assert.deepEqual(f.records(), before);
  assert.equal(f.query("workspace.listProjects").value.retainedProjects.find((row) => row.projectId === f.projectId).relativePath, f.path);
  assert.ok(f.events.some((event) => event.type === "workspace.sourceObserved"));
  for (const event of f.events.filter((event) => event.type === "workspace.projectsChanged" || event.type === "workspace.sourceObserved")) {
    assert.equal(event.sourceId, f.one.sourceId); assert.deepEqual(event.workspaceIds, [f.one.workspaceId, f.two.workspaceId]);
  }
  assert.equal(new Set(f.h.live().map((watch) => watch.path)).size, f.h.live().length);
  f.command("workspace.remove"); f.command("workspace.remove", { workspaceId: f.two.workspaceId });
  assert.deepEqual(f.h.live().map((watch) => watch.path), [otherRoot]);
  const old = f.h.live()[0]; f.close(); const finalEvents = f.events.length;
  old.hint(); old.failed(); f.h.advance(10000);
  assert.equal(f.h.live().length, 0); assert.equal(f.h.timers.size, 0); assert.equal(f.events.length, finalEvents);
}));


test("a reentrant sibling mode Apply cannot install obsolete observation targets", () => fixture(true, (f) => {
  let switched = false;
  const unsubscribe = f.subscribe((event) => {
    if (event.type !== "workspace.projectsChanged" || switched) return;
    switched = true;
    const preview = f.query("workspace.previewDiscovery", { workspaceId: f.two.workspaceId, mode: "grouped" }).value;
    const result = f.command("workspace.applyDiscovery", { workspaceId: f.two.workspaceId, previewToken: preview.previewToken });
    assert.equal(result.ok, true, JSON.stringify(result));
  });
  const preview = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
  const result = f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }); unsubscribe();
  assert.equal(result.ok, true); assert.equal(result.value.mode, "direct"); assert.equal(switched, true);
  assert.equal(f.query("workspace.listProjects").value.mode, "grouped");
  assert.deepEqual(f.h.live().map((watch) => watch.path).sort(), [f.root, join(f.root, "Category")].sort());
  const latest = f.records(); f.h.advance(200);
  assert.deepEqual(f.records(), latest);
  assert.equal(f.query("workspace.listProjects").value.projects.length, 0);
  assert.deepEqual(f.events.filter((event) => event.type === "workspace.projectsChanged").map((event) => event.revision), [result.value.revision, result.value.revision + 1]);
}));


test("mode observation belongs to the source when a subscriber removes the initiating workspace", () => fixture(true, (f) => {
  const unsubscribe = f.subscribe((event) => {
    if (event.type === "workspace.projectsChanged") f.command("workspace.remove");
  });
  const preview = f.query("workspace.previewDiscovery", { mode: "direct" }).value;
  const result = f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }); unsubscribe();
  assert.equal(result.ok, true);
  assert.deepEqual(f.h.live().map((watch) => watch.path), [f.root]);
  assert.equal(f.query("workspace.listProjects", { workspaceId: f.two.workspaceId }).value.mode, "direct");
  f.h.advance(200);
  assert.deepEqual(f.events.filter((event) => event.type === "workspace.sourceObserved").at(-1).workspaceIds, [f.two.workspaceId]);
}));

for (const grouped of [false, true]) test(`active observation and startup reserve interrupted creations before Apply (${grouped ? "grouped" : "direct"})`, () => fixture(grouped, (f) => {
  const initial = f.records(), operationId = randomUUID(), projectId = randomUUID();
  const name = "Interrupted", path = grouped ? `Category/${name}` : name, parent = grouped ? "Category" : "";
  const source = initial.sources[0];
  const evidence = (path) => {
    const stat = fs.lstatSync(path, { bigint: true });
    return JSON.stringify({ dev: String(stat.dev), ino: String(stat.ino), birthtimeNs: String(stat.birthtimeNs) });
  };
  const old = f.query("workspace.previewDiscovery").value;
  f.sqlite.prepare(`INSERT INTO project_creation_operations (operation_id, source_id, initiating_workspace_id, project_id, name, mode,
    expected_revision, category_id, canonical_root, parent_relative_path, relative_path, root_identity, parent_identity,
    excluded_relative_paths, archive_relative_path, stage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'intent')`)
    .run(operationId, source.id, f.one.workspaceId, projectId, name, source.discovery_mode, source.discovery_revision,
      grouped ? initial.categories[0].id : null, f.root, parent, path, source.applied_root_identity, evidence(join(f.root, parent)),
      source.excluded_relative_paths, source.archive_relative_path);
  fs.mkdirSync(join(f.root, path)); fs.writeFileSync(join(f.root, path, "sentinel"), "third-party");
  f.h.hint(grouped ? join(f.root, "Category") : f.root); f.h.advance(200);
  assert.equal(f.events.at(-1).type, "workspace.sourceObserved");
  assert.equal(f.events.at(-1).automaticUpdates, "active");
  assert.deepEqual(f.records(), initial);
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: old.previewToken }).error.code, "stale_preview");
  const outstanding = f.query("workspace.listProjectCreations").value.operations;
  assert.equal(outstanding.length, 1); assert.equal(outstanding[0].projectId, projectId);
  const reviewed=f.query("workspace.previewProjectCreationRecovery",{operationId});
  assert.equal(reviewed.error.code,"identity_update_required");
  f.restart(); f.h.advance(200);
  assert.deepEqual(f.records(), initial);
  assert.equal(f.query("workspace.listProjectCreations").value.operations[0].projectId, projectId);
  assert.equal(f.command("workspace.recoverProjectCreation", { operationId, action: "associate_reviewed", previewToken:randomUUID() }).error.code,"identity_update_required");
  const discovery = f.query("workspace.previewDiscovery").value;
  assert.equal(discovery.entries.find((row) => row.relativePath === path).reason, "unresolved");
  assert.equal(f.command("workspace.applyDiscovery", { previewToken: discovery.previewToken }).ok, true);
  assert.deepEqual(f.records(), initial);
  const review=f.query("workspace.previewProjectCreationRecovery",{operationId});
  assert.equal(review.error.code,"identity_update_required");
  const journal=f.sqlite.prepare('SELECT * FROM project_creation_operations WHERE operation_id=?').get(operationId);
  const recovered=f.command("workspace.recoverProjectCreation",{operationId,action:"associate_reviewed",previewToken:randomUUID()});
  assert.equal(recovered.error.code,"identity_update_required");
  f.h.advance(200);
  assert.equal(f.query("workspace.listProjects").value.projects.length,1);
  assert.deepEqual(f.sqlite.prepare('SELECT * FROM project_creation_operations WHERE operation_id=?').get(operationId),journal);
  assert.deepEqual(f.records(),initial);
  assert.equal(fs.readFileSync(join(f.root,path,"sentinel"),"utf8"),"third-party");
  const stale = f.h.live()[0], count = f.events.length; f.close();
  stale.hint(); stale.failed(); f.h.advance(10000); assert.equal(f.events.length, count);
}));

for (const grouped of [false, true]) test(`observation, explicit Refresh and Apply during mkdir preserve the pending creation UUID (${grouped ? "grouped" : "direct"})`, () => {
  let f, reserved;
  fixture(grouped, (value) => {
    f = value;
    const before = f.records();
    const operationId = randomUUID();
    const result = f.legacyCommand({type:"workspace.createProject",operationId,name:"During",
      mode: grouped ? "grouped" : "direct", expectedRevision: before.sources[0].discovery_revision,
      ...(grouped ? { categoryId: before.categories[0].id } : {}) });
    assert.equal(result.ok, true); assert.equal(result.value.outcome, "completed"); assert.equal(result.value.project.projectId, reserved);
    f.h.advance(200);
    assert.equal(projectMetadataRecords(f.query("workspace.listProjects")).length,2);
    assert.deepEqual(f.records().text_property_values, before.text_property_values);
    assert.deepEqual(f.records().views, before.views);
    assert.equal(f.records().sources[0].discovery_revision, before.sources[0].discovery_revision + 1);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM projects WHERE id = ?").get(reserved).n, 1);
  }, { ...nativeProjectFilesystem, mkdir(path) {
    nativeProjectFilesystem.mkdir(path);
    const pending = f.sqlite.prepare("SELECT * FROM project_creation_operations").get();
    reserved = pending.project_id; assert.equal(pending.stage, "intent");
    f.h.hint(grouped ? join(f.root, "Category") : f.root); f.h.advance(200);
    assert.equal(f.command("workspace.refreshSource").ok, true);
    const preview = f.query("workspace.previewDiscovery").value;
    assert.equal(preview.entries.find((entry) => entry.relativePath === pending.relative_path).reason, "unresolved");
    assert.equal(preview.projectEffects.added.length, 0);
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).ok, true);
    assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM projects").get().n, 1);
  } });
});

test("Windows root-only topology retains five-second grouped polling during pending creation (simulated scheduler)", () => {
  fixture(true, (f) => {
    f.h.advance(0); // Deliver the already subscribed startup observation first.
    assert.deepEqual(f.h.live().map((watch) => watch.path), [f.root]);
    const source = f.records().sources[0], category = f.records().categories[0], operationId = randomUUID(), projectId = randomUUID();
    f.sqlite.prepare(`INSERT INTO project_creation_operations (operation_id, source_id, initiating_workspace_id, project_id, name, mode,
      expected_revision, category_id, canonical_root, parent_relative_path, relative_path, root_identity, parent_identity,
      excluded_relative_paths, archive_relative_path, stage) VALUES (?, ?, ?, ?, 'Pending', 'grouped', ?, ?, ?, 'Category', 'Category/Pending', ?, ?, ?, ?, 'intent')`)
      .run(operationId, source.id, f.one.workspaceId, projectId, source.discovery_revision, category.id, f.root,
        source.applied_root_identity, category.native_identity, source.excluded_relative_paths, source.archive_relative_path);
    const review=f.query("workspace.previewProjectCreationRecovery",{operationId});assert.equal(review.error.code,"identity_update_required");
    fs.mkdirSync(join(f.root, "Category/Pending"));
    const count = f.events.length;
    f.h.advance(4700); assert.equal(f.events.length, count);
    f.h.advance(200); assert.equal(f.events.at(-1).type, "workspace.sourceObserved");
    assert.equal(f.events.at(-1).automaticUpdates, "active"); assert.deepEqual(f.h.live().map((watch) => watch.path), [f.root]);
    assert.equal(f.command("workspace.recoverProjectCreation", { operationId, action: "retry_missing", previewToken:randomUUID() }).error.code,"identity_update_required");
    assert.equal(f.query("workspace.previewDiscovery").value.projectEffects.added.length, 0);
    assert.equal(f.query("workspace.listProjectCreations").value.operations[0].projectId, projectId);
    assert.equal(f.records().projects.length, 1);
  }, undefined, true);
});
