import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { renameNoReplace } from "../dist/service/project-rename-filesystem.mjs";
import { nativeProjectFilesystem } from "../src/service/project-filesystem.ts";

const identity = (path) => JSON.stringify(nativeProjectFilesystem.inspect(path).identity);
function fixture(mode, run, options = {}) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "project-rename-")));
  const root = join(directory, "root"), databasePath = join(directory, "workspace.sqlite");
  fs.mkdirSync(root); if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
  const relative = (name) => mode === "direct" ? name : `Category/${name}`;
  for (const name of ["Original", "Other"]) {
    fs.mkdirSync(join(root, relative(name))); fs.writeFileSync(join(root, relative(name), "sentinel"), `  ${name} 📝\n`);
  }
  const dependencies = { watch() { return { close() {} }; }, schedule() { return { cancel() {} }; } };
  let service, sql;
  const calls = [];
  const open = () => { service = openSettingsService(databasePath, undefined, undefined, dependencies,
    options.filesystem?.(f) ?? nativeProjectFilesystem, options.defaultNative ? undefined : (from, to) => {
      calls.push([from, to]); return options.native ? options.native(f, from, to) : renameNoReplace(from, to);
    }); };
  const f = { directory, root, relative, calls, get service() { return service; }, get sql() { return sql; },
    restart() { service.close(); open(); } };
  try {
    open(); sql = new Database(databasePath);
    const workspace = service.workspaces.create({ type: "workspace.create", name: "Primary", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const query = (type, extra = {}) => service.handleQuery({ type, workspaceId: workspace.workspaceId, ...extra });
    const command = (type, extra = {}) => service.handleCommand({ type, workspaceId: workspace.workspaceId, ...extra });
    const preview = query("workspace.previewDiscovery", { mode }).value;
    const initial = command("workspace.applyDiscovery", { previewToken: preview.previewToken }).value;
    const project = initial.projects.find((p) => p.name === "Original"), other = initial.projects.find((p) => p.name === "Other");
    const propertyId = command("workspace.createProperty", { name: "Notes", propertyType: "text" }).value.propertyId;
    command("workspace.setTextValue", { projectId: project.projectId, propertyId, value: "  Exact\nТекст  " });
    command("settings.setLanguage", { language: "ru" });
    const events = []; service.workspaces.subscribe((event) => events.push(event));
    const request = (name, extra = {}) => ({ type: "workspace.renameProject", workspaceId: workspace.workspaceId,
      projectId: project.projectId, operationId: randomUUID(), name, expectedRevision: initial.revision, ...extra });
    const rename = (input) => service.renameProject(input);
    const snapshot = () => Object.fromEntries(["categories", "category_properties", "property_definitions", "text_property_values", "views", "settings", "active_workspace", "project_creation_operations"]
      .map((table) => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()]));
    Object.assign(f, { workspace, sibling, query, command, initial, project, other, propertyId, events, request, rename, snapshot });
    return run(f);
  } finally { service?.close(); sql?.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: rename preserves UUID, exact Text, category, independent configuration and committed sibling event`, () => fixture(mode, (f) => {
    const before = f.snapshot(), originalIdentity = identity(join(f.root, f.relative("Original")));
    const sourceBefore = f.sql.prepare("SELECT * FROM sources WHERE id = ?").get(f.workspace.sourceId);
    const request = f.request(process.platform === "win32" ? "  Renamed 📝" : "  Renamed 📝  ");
    const result = f.rename(request); assert.equal(result.ok, true); assert.equal(result.value.outcome, "completed", JSON.stringify(result));
    assert.equal(result.value.project.projectId, f.project.projectId); assert.equal(result.value.project.categoryId, f.project.categoryId);
    assert.equal(identity(join(f.root, f.relative(request.name))), originalIdentity);
    assert.equal(fs.readFileSync(join(f.root, f.relative(request.name), "sentinel"), "utf8"), "  Original 📝\n");
    assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(f.sql.prepare("SELECT * FROM sources WHERE id = ?").get(f.workspace.sourceId), { ...sourceBefore, discovery_revision: sourceBefore.discovery_revision + 1 });
    for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
      const list = f.query("workspace.listProjects", { workspaceId }).value;
      assert.equal(list.projects.find((p) => p.projectId === f.project.projectId).name, request.name);
    }
    const changes = f.events.filter((e) => e.type === "workspace.projectsChanged");
    assert.equal(changes.length, 1); assert.deepEqual(new Set(changes[0].workspaceIds), new Set([f.workspace.workspaceId, f.sibling.workspaceId]));
    assert.deepEqual(f.rename(request), result); assert.equal(f.calls.length, 1);
    assert.equal(f.rename({ ...request, name: "Changed" }).error.code, "invalid_input");
    f.restart(); assert.deepEqual(f.rename(request), result);
  }));
  test(`${mode}: exact-name no-op validates location and retains immutable receipt without native call/revision/event`, () => fixture(mode, (f) => {
    const request = f.request("Original"), before = f.snapshot();
    const result = f.rename(request); assert.equal(result.value.outcome, "unchanged");
    assert.equal(result.value.project.revision, f.initial.revision); assert.equal(f.calls.length, 0);
    assert.deepEqual(f.snapshot(), before); assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
    fs.renameSync(join(f.root, f.relative("Original")), join(f.directory, "away"));
    assert.deepEqual(f.rename(request), result);
    assert.equal(f.rename(f.request("Original")).value.outcome, "rejected");
  }));
}

function assertUnchanged(f, before, original = "Original") {
  assert.deepEqual(f.snapshot(), before);
  assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.workspace.sourceId).discovery_revision, f.initial.revision);
  assert.equal(f.sql.prepare("SELECT relative_path FROM projects WHERE id = ?").get(f.project.projectId).relative_path, f.relative("Original"));
  assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, 0);
  assert.equal(fs.readFileSync(join(f.root, f.relative(original), "sentinel"), "utf8"), "  Original 📝\n");
  assert.equal(fs.readFileSync(join(f.root, f.relative("Other"), "sentinel"), "utf8"), "  Other 📝\n");
}
for (const mode of ["direct", "grouped"]) {
  for (const name of ["", ".", "..", "bad/name", "bad\0name", "\ud800", ".hidden", "$RECYCLE.BIN", "System Volume Information", "Other", "oThEr"])
    test(`${mode}: invalid, excluded or reserved name ${JSON.stringify(name)} preserves all entries`, () => fixture(mode, (f) => {
      const before = f.snapshot(), result = f.rename(f.request(name));
      assert.equal(result.value.outcome, "rejected"); assert.equal(f.calls.length, 0); assertUnchanged(f, before);
    }));
  for (const kind of ["directory", "file", "link"]) test(`${mode}: occupied ${kind} is never adopted or replaced`, () => fixture(mode, (f) => {
    const path = join(f.root, f.relative("Occupied"));
    if (kind === "directory") { fs.mkdirSync(path); fs.writeFileSync(join(path, "third-party"), "Keep"); }
    if (kind === "file") fs.writeFileSync(path, "Keep");
    if (kind === "link") fs.symlinkSync(join(f.root, f.relative("Other")), path, "junction");
    const before = f.snapshot(), occupied = identity(path);
    assert.equal(f.rename(f.request("Occupied")).value.problem, "occupied");
    assert.equal(identity(path), occupied); assert.equal(f.calls.length, 0); assertUnchanged(f, before);
  }));
  for (const state of ["missing", "replaced", "link", "wrong-spelling", "stale-revision", "mode-inactive", "unresolved"]) test(`${mode}: ${state} current location rejects rename and no-op`, () => fixture(mode, (f) => {
    const path = join(f.root, f.relative("Original"));
    if (["missing", "replaced", "link"].includes(state)) fs.renameSync(path, join(f.directory, "away"));
    if (state === "replaced") fs.mkdirSync(path);
    if (state === "link") fs.symlinkSync(join(f.directory, "away"), path, "junction");
    if (state === "wrong-spelling") fs.renameSync(path, join(f.root, f.relative("oRiginal")));
    if (state === "mode-inactive") f.sql.prepare("UPDATE projects SET mode_inactive = 1 WHERE id = ?").run(f.project.projectId);
    if (state === "unresolved") f.sql.prepare("UPDATE projects SET association_state = 'unresolved' WHERE id = ?").run(f.project.projectId);
    const projects = f.sql.prepare("SELECT * FROM projects ORDER BY id").all();
    for (const name of ["Fresh", "Original"]) {
      const result = f.rename(f.request(name, state === "stale-revision" ? { expectedRevision: 0 } : {}));
      assert.equal(result.value.outcome, "rejected");
    }
    assert.equal(f.calls.length, 0); assert.deepEqual(f.sql.prepare("SELECT * FROM projects ORDER BY id").all(), projects);
    assert.equal(fs.readFileSync(join(f.root, f.relative("Other"), "sentinel"), "utf8"), "  Other 📝\n");
  }));
  test(`${mode}: current exclusions and archive policy apply to original and requested names`, () => fixture(mode, (f) => {
    for (const [column, value, name, problem] of [["excluded_relative_paths", JSON.stringify([f.relative("Excluded")]), "Excluded", "excluded"],
      ["archive_relative_path", f.relative("Archive"), "Archive", "archive"],
      ["excluded_relative_paths", JSON.stringify([f.relative("Original")]), "Original", "excluded"],
      ["archive_relative_path", f.relative("Original"), "Original", "archive"]]) {
      f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[]', archive_relative_path = NULL WHERE id = ?").run(f.workspace.sourceId);
      f.sql.prepare(`UPDATE sources SET ${column} = ? WHERE id = ?`).run(value, f.workspace.sourceId);
      assert.equal(f.rename(f.request(name)).value.problem, problem);
    }
    assert.equal(f.calls.length, 0);
  }));
  test(`${mode}: historical paths and reused dev/ino evidence remain reserved`, () => fixture(mode, (f) => {
    f.sql.prepare("UPDATE projects SET association_state = 'missing' WHERE id = ?").run(f.other.projectId);
    assert.equal(f.rename(f.request("Other")).value.problem, "reserved_destination");
    const original = JSON.parse(identity(join(f.root, f.relative("Original"))));
    f.sql.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(JSON.stringify({ ...original, birthtimeNs: "1" }), f.other.projectId);
    assert.equal(f.rename(f.request("Free")).value.problem, "native_conflict");
    assert.equal(f.rename(f.request("Original")).value.problem, "native_conflict");
    assert.equal(f.calls.length, 0);
  }));
  for (const code of ["native_unavailable", "permission_denied", "busy", "unsupported", "cross_device"]) test(`${mode}: definite native ${code} rejection has immutable receipt and no effect`, () => fixture(mode, (f) => {
    const before = f.snapshot(), request = f.request("Fresh"), result = f.rename(request);
    assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, code);
    assert.equal(result.value.operation.stage, "failed"); assertUnchanged(f, before);
    assert.deepEqual(f.rename(request), result); assert.equal(f.calls.length, 1);
    assert.equal(f.rename({ ...request, expectedRevision: request.expectedRevision + 1 }).error.code, "invalid_input");
  }, { native: () => code }));
  test(`${mode}: late occupied destination survives native no-replace rejection`, () => fixture(mode, (f) => {
    const before = f.snapshot(); assert.equal(f.rename(f.request("Late")).value.problem, "occupied");
    assert.equal(fs.readFileSync(join(f.root, f.relative("Late"), "late"), "utf8"), "Third party");
    assertUnchanged(f, before);
  }, { native: (_f, from, to) => { fs.mkdirSync(to); fs.writeFileSync(join(to, "late"), "Third party"); return renameNoReplace(from, to); } }));
  test(`${mode}: native exception after effect retains original evidence and explicit retry never replays`, () => fixture(mode, (f) => {
    const before = f.snapshot(), request = f.request("Fresh"), result = f.rename(request);
    assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.lastVerifiedPlacement, "original");
    assertUnchanged(f, before, "Fresh"); assert.deepEqual(f.rename(request), result); assert.equal(f.calls.length, 1);
    assert.equal(f.rename(f.request("Second", { projectId: f.other.projectId })).value.problem, "reserved_destination");
    f.restart(); assert.deepEqual(f.rename(request), result); assert.equal(f.calls.length, 1);
    assert.equal(f.rename({ ...request, name: "Changed" }).error.code, "invalid_input");
  }, { native: (_f, from, to) => { assert.equal(renameNoReplace(from, to), "renamed"); throw new Error("private native failure"); } }));
  test(`${mode}: actual mounted case rename has exact spelling and commits staging evidence before hop two`, (t) => fixture(mode, (f) => {
    const before = f.snapshot(), original = identity(join(f.root, f.relative("Original")));
    let aliases = false;
    try { aliases = identity(join(f.root, f.relative("original"))) === original; } catch (error) { assert.equal(error.code, "ENOENT"); }
    const result = f.rename(f.request("original")); assert.equal(result.value.outcome, "completed", JSON.stringify(result));
    assert.equal(f.calls.length, aliases ? 2 : 1);
    t.diagnostic(aliases ? "mountedCaseBehavior=self_alias;hopCount=2" : "mountedCaseBehavior=distinct;hopCount=1");
    assert.ok(fs.readdirSync(join(f.root, mode === "grouped" ? "Category" : "")).includes("original"));
    assert.equal(identity(join(f.root, f.relative("original"))), original); assert.deepEqual(f.snapshot(), before);
    assert.equal(f.sql.prepare("SELECT staged_identity FROM project_rename_operations").get().staged_identity, aliases ? original : null);
  }, { native: (f, from, to) => {
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.ok(row, "intent is committed and visible on another SQLite connection before native call");
    if (f.calls.length === 2) { assert.equal(row.stage, "staged"); assert.equal(row.staged_identity, row.native_identity); }
    return renameNoReplace(from, to);
  } }));
  test(`${mode}: final metadata failure rolls back locator/revision and retains destination evidence`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_rename_completion BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'completed' BEGIN SELECT RAISE(ABORT, 'Injected completion failure'); END");
    const before = f.snapshot(), result = f.rename(f.request("Fresh"));
    assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.problem, "storage_error");
    assert.equal(result.value.operation.lastVerifiedPlacement, "destination"); assertUnchanged(f, before, "Fresh");
  }));
}

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: malformed, foreign and path-bearing requests cannot select filesystem targets`, () => fixture(mode, (f) => {
    const request = f.request("Fresh");
    for (const input of [null, [], {}, { ...request, projectId: "invalid" }, { ...request, operationId: randomUUID(), path: f.root },
      { ...request, expectedRevision: -1 }, { ...request, expectedRevision: 1.5 }, { ...request, name: 42 },
      { ...request, workspaceId: randomUUID() }, { ...request, nativeIdentity: identity(f.root) }]) assert.equal(f.rename(input).error.code, "invalid_input");
    assert.equal(f.rename({ ...request, projectId: randomUUID() }).value.problem, "project_unavailable");
    const unrelatedRoot = join(f.directory, "unrelated"); fs.mkdirSync(unrelatedRoot);
    const unrelated = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot }).value;
    assert.equal(f.rename({ ...request, workspaceId: unrelated.workspaceId }).value.outcome, "rejected");
    assert.equal(f.calls.length, 0);
    assert.equal(f.rename(request).value.outcome, "completed");
    assert.equal(f.rename({ ...request, workspaceId: f.sibling.workspaceId }).error.code, "invalid_input");
    assert.equal(f.rename({ ...request, workspaceId: unrelated.workspaceId }).error.code, "invalid_input");
  }));
  test(`${mode}: unfinished creation blocks new rename but completed receipts and later rename retries stay independent`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_creation BEFORE UPDATE ON project_creation_operations WHEN NEW.stage = 'evidence_recorded' BEGIN SELECT RAISE(ABORT, 'Injected evidence failure'); END");
    const creationRequest = { operationId: randomUUID(), name: "Created", mode, expectedRevision: f.initial.revision,
      ...(mode === "grouped" ? { categoryId: f.project.categoryId } : {}) };
    const pending = f.command("workspace.createProject", creationRequest); assert.equal(pending.value.outcome, "recoverable");
    const before = f.snapshot();
    assert.equal(f.rename(f.request("Fresh")).value.problem, "reserved_destination");
    assert.equal(f.rename(f.request("Original")).value.problem, "reserved_destination");
    assertUnchanged(f, before); assert.equal(f.calls.length, 0);
  }));
  test(`${mode}: completed creation receipt keeps its original result through multiple renames and source reuse`, () => fixture(mode, (f) => {
    const creationRequest = { operationId: randomUUID(), name: "Created", mode, expectedRevision: f.initial.revision,
      ...(mode === "grouped" ? { categoryId: f.project.categoryId } : {}) };
    const created = f.command("workspace.createProject", creationRequest); assert.equal(created.value.outcome, "completed");
    const receipts = f.sql.prepare("SELECT * FROM project_creation_operations").all();
    const firstRequest = f.request("Fresh", { projectId: created.value.project.projectId, expectedRevision: created.value.project.revision });
    const first = f.rename(firstRequest); assert.equal(first.value.outcome, "completed");
    const second = f.rename({ ...firstRequest, operationId: randomUUID(), name: "Later", expectedRevision: first.value.project.revision });
    assert.equal(second.value.outcome, "completed"); assert.deepEqual(f.rename(firstRequest), first);
    assert.deepEqual(f.command("workspace.createProject", creationRequest), created);
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_creation_operations").all(), receipts);
    for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId }).ok, true);
    const reused = f.service.workspaces.create({ type: "workspace.create", name: "Reused", rootPath: f.root }).value;
    assert.equal(reused.sourceId, f.workspace.sourceId);
    const third = f.rename({ ...firstRequest, operationId: randomUUID(), workspaceId: reused.workspaceId, name: "Again", expectedRevision: second.value.project.revision });
    assert.equal(third.value.outcome, "completed"); assert.equal(third.value.project.projectId, created.value.project.projectId);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_rename_operations").get().n, 3);
  }));
  for (const target of mode === "grouped" ? ["root", "category"] : ["root"]) for (const when of ["before", "after-effect"]) test(`${mode}: ${target} swap ${when} prevents completion and preserves all folders`, () => fixture(mode, (f) => {
    const path = target === "root" ? f.root : join(f.root, "Category");
    const away = join(f.directory, "displaced");
    if (when === "before") { fs.renameSync(path, away); fs.mkdirSync(path); }
    const result = f.rename(f.request("Fresh"));
    assert.equal(result.value.outcome, when === "before" ? "rejected" : "recoverable");
    assert.equal(f.calls.length, when === "before" ? 0 : 1);
    assert.equal(f.sql.prepare("SELECT discovery_revision FROM sources WHERE id = ?").get(f.workspace.sourceId).discovery_revision, f.initial.revision);
    const displacedParent = target === "root" && mode === "grouped" ? join(away, "Category") : away;
    assert.equal(fs.readFileSync(join(displacedParent, when === "before" ? "Original" : "Fresh", "sentinel"), "utf8"), "  Original 📝\n");
    assert.equal(fs.readFileSync(join(displacedParent, "Other", "sentinel"), "utf8"), "  Other 📝\n");
  }, { native: (f, from, to) => {
    assert.equal(renameNoReplace(from, to), "renamed");
    const path = target === "root" ? f.root : join(f.root, "Category");
    fs.renameSync(path, join(f.directory, "displaced")); fs.mkdirSync(path);
    return "renamed";
  } }));
  test(`${mode}: original link and category/root link substitutions never traverse the target`, () => fixture(mode, (f) => {
    const path = mode === "grouped" ? join(f.root, "Category") : f.root;
    const away = join(f.directory, "away"); fs.renameSync(path, away); fs.symlinkSync(away, path, "junction");
    const result = f.rename(f.request("Fresh")); assert.equal(result.value.outcome, "rejected"); assert.equal(f.calls.length, 0);
    assert.equal(fs.readFileSync(join(away, "Original", "sentinel"), "utf8"), "  Original 📝\n");
    assert.equal(fs.existsSync(join(away, "Fresh")), false);
  }));
  test(`${mode}: observer Refresh during native call cannot enroll destination; committed listener sees final state`, () => fixture(mode, (f) => {
    let seen, listenerRefresh;
    const unrelatedRoot = join(f.directory, "unrelated"); fs.mkdirSync(unrelatedRoot);
    const unrelated = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: unrelatedRoot }).value;
    f.service.workspaces.subscribe((event) => {
      if (event.type === "workspace.projectsChanged") {
        seen = f.sql.prepare("SELECT stage FROM project_rename_operations").get().stage;
        listenerRefresh = f.command("workspace.refreshSource", { workspaceId: f.sibling.workspaceId });
      }
    });
    const result = f.rename(f.request("Fresh")); assert.equal(result.value.outcome, "completed"); assert.equal(seen, "completed");
    assert.equal(listenerRefresh.ok, true);
    const changes = f.events.filter((e) => e.type === "workspace.projectsChanged"); assert.equal(changes.length, 1);
    assert.equal(changes[0].workspaceIds.includes(unrelated.workspaceId), false);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM projects WHERE source_id = ?").get(f.workspace.sourceId).n, 2);
  }, { native: (f, from, to) => {
    assert.equal(renameNoReplace(from, to), "renamed");
    assert.equal(f.command("workspace.refreshSource").ok, true);
    assert.equal(f.sql.prepare("SELECT relative_path FROM projects WHERE id = ?").get(f.project.projectId).relative_path, f.relative("Original"));
    const preview = f.query("workspace.previewDiscovery").value;
    assert.equal(f.command("workspace.applyDiscovery", { previewToken: preview.previewToken }).error.code, "stale_preview");
    return "renamed";
  } }));
  test(`${mode}: failed destination evidence write keeps original last-verified evidence`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_evidence BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'destination_recorded' BEGIN SELECT RAISE(ABORT, 'Injected evidence failure'); END");
    const before = f.snapshot(), result = f.rename(f.request("Fresh"));
    assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.lastVerifiedPlacement, "original");
    assert.equal(f.sql.prepare("SELECT destination_identity FROM project_rename_operations").get().destination_identity, null);
    assertUnchanged(f, before, "Fresh");
  }));
}

for (const name of ["CON", "com¹.txt", "bad\\name", "bad:name", "trailing ", "trailing.", "bad\nname", "x".repeat(256)]) test(`Windows name policy rejects ${JSON.stringify(name.slice(0, 30))} before native call`, () => fixture("direct", (f) => {
  assert.equal(f.rename(f.request(name)).value.problem, "invalid_name"); assert.equal(f.calls.length, 0);
}, { filesystem: () => ({ ...nativeProjectFilesystem, platform: "win32" }) }));
if (process.platform !== "win32") for (const name of ["CON", "colon:name", "back\\slash", "line\nbreak"]) test(`POSIX name preserves authored ${JSON.stringify(name)}`, () => fixture("direct", (f) => {
  const result = f.rename(f.request(name)); assert.equal(result.value.outcome, "completed");
  assert.ok(fs.readdirSync(f.root).includes(name));
  assert.equal(fs.readFileSync(join(f.root, name, "sentinel"), "utf8"), "  Original 📝\n");
}));

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: production default loads the fixed emitted native adapter`, () => fixture(mode, (f) => {
    const result = f.rename(f.request("Default native")); assert.equal(result.value.outcome, "completed");
    assert.equal(fs.readFileSync(join(f.root, f.relative("Default native"), "sentinel"), "utf8"), "  Original 📝\n");
  }, { defaultNative: true }));
  test(`${mode}: failing second hop retains staged placement and never rolls back or replays`, () => fixture(mode, (f) => {
    let alias = false;
    try { alias = identity(join(f.root, f.relative("original"))) === identity(join(f.root, f.relative("Original"))); } catch (error) { assert.equal(error.code, "ENOENT"); }
    const request = f.request("original"), before = f.snapshot(), result = f.rename(request);
    if (!alias) { assert.equal(result.value.outcome, "completed"); return; }
    assert.equal(result.value.outcome, "recoverable"); assert.equal(result.value.operation.lastVerifiedPlacement, "staged");
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(row.staged_identity, row.native_identity); assert.equal(row.destination_identity, null);
    assertUnchanged(f, before, row.staging_relative_path.split("/").at(-1));
    assert.equal(fs.readFileSync(join(f.root, f.relative("original"), "third-party"), "utf8"), "Keep");
    assert.deepEqual(f.rename(request), result); assert.equal(f.calls.length, 2);
  }, { native: (f, from, to) => {
    if (f.calls.length === 2) { fs.mkdirSync(to); fs.writeFileSync(join(to, "third-party"), "Keep"); }
    return renameNoReplace(from, to);
  } }));
  test(`${mode}: a late project replacement is never adopted as destination evidence`, () => fixture(mode, (f) => {
    const result = f.rename(f.request("Fresh")); assert.equal(result.value.outcome, "recoverable");
    assert.equal(result.value.operation.lastVerifiedPlacement, "original");
    assert.equal(fs.readFileSync(join(f.directory, "owned-away", "sentinel"), "utf8"), "  Original 📝\n");
    assert.equal(fs.readFileSync(join(f.root, f.relative("Fresh"), "replacement"), "utf8"), "Keep");
    assert.equal(f.sql.prepare("SELECT destination_identity FROM project_rename_operations").get().destination_identity, null);
  }, { native: (f, from, to) => {
    assert.equal(renameNoReplace(from, to), "renamed"); fs.renameSync(to, join(f.directory, "owned-away"));
    fs.mkdirSync(to); fs.writeFileSync(join(to, "replacement"), "Keep"); return "renamed";
  } }));
}

test("an exact-name no-op rejects an untracked case alias on a simulated case-sensitive parent", () => fixture("direct", (f) => {
  const result = f.rename(f.request("Original")); assert.equal(result.value.outcome, "rejected");
  assert.equal(result.value.problem, "occupied"); assert.equal(f.calls.length, 0);
}, { filesystem: (f) => ({ ...nativeProjectFilesystem, names(path) {
  const names = nativeProjectFilesystem.names(path);
  return f.project && path === f.root ? [...names, "oRiginal"] : names;
} }) }));

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: staging allocation avoids a late occupied hidden candidate`, () => fixture(mode, (f) => {
    const result = f.rename(f.request("original")); assert.equal(result.value.outcome, "completed");
    if (f.occupiedStage) {
      assert.equal(fs.readFileSync(join(f.occupiedStage, "third-party"), "utf8"), "Keep");
      assert.notEqual(f.sql.prepare("SELECT staging_relative_path FROM project_rename_operations").get().staging_relative_path,
        f.relative(f.occupiedStage.split(/[\\/]/).at(-1)));
    } else assert.equal(f.calls.length, 1, "absent actual destination requires no staging allocation");
  }, { filesystem: (f) => ({ ...nativeProjectFilesystem, inspect(path) {
    if (f.project && !f.occupiedStage && path.includes(".workspace-rename-")) {
      f.occupiedStage = path; fs.mkdirSync(path); fs.writeFileSync(join(path, "third-party"), "Keep");
    }
    return nativeProjectFilesystem.inspect(path);
  } }) }));
  test(`${mode}: an intent commit failure leaves no receipt, native call or filesystem effect`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_intent BEFORE INSERT ON project_rename_operations BEGIN SELECT RAISE(ABORT, 'Injected intent failure'); END");
    const before = f.snapshot(), result = f.rename(f.request("Fresh"));
    assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "storage_error");
    assert.equal(f.calls.length, 0); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM project_rename_operations").get().n, 0);
    assertUnchanged(f, before);
  }));
  test(`${mode}: changed durable intent is rechecked before native mutation`, () => fixture(mode, (f) => {
    const result = f.rename(f.request("Fresh")); assert.equal(result.value.outcome, "rejected");
    assert.equal(result.value.problem, "filesystem_changed"); assert.equal(f.calls.length, 0);
    assert.equal(fs.existsSync(join(f.root, f.relative("Fresh"))), false);
  }, { filesystem: (f) => ({ ...nativeProjectFilesystem, names(path) {
    if (f.project && !f.changed && f.sql.prepare("SELECT count(*) AS n FROM project_rename_operations").get().n && !f.sql.inTransaction) {
      f.changed = true;
      f.sql.prepare("UPDATE project_rename_operations SET stage = 'uncertain', problem = 'filesystem_error'").run();
    }
    return nativeProjectFilesystem.names(path);
  } }) }));
  test(`${mode}: source with an unfinished rename leaves unrelated source rename available`, () => fixture(mode, (f) => {
    const pending = f.rename(f.request("Fresh")); assert.equal(pending.value.outcome, "recoverable");
    const root = join(f.directory, "unrelated"); fs.mkdirSync(root); fs.mkdirSync(join(root, "Project"));
    const workspace = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: root }).value;
    const preview = f.query("workspace.previewDiscovery", { workspaceId: workspace.workspaceId, mode: "direct" }).value;
    const applied = f.command("workspace.applyDiscovery", { workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).value;
    const request = f.request("Renamed", { workspaceId: workspace.workspaceId, projectId: applied.projects[0].projectId, expectedRevision: applied.revision });
    const result = f.rename(request); assert.equal(result.value.outcome, "completed");
    const events = f.events.filter((e) => e.type === "workspace.projectsChanged"); assert.deepEqual(events.map((e) => e.workspaceIds), [[workspace.workspaceId], [workspace.workspaceId]]);
  }, { native: (f, from, to) => {
    const outcome = renameNoReplace(from, to);
    if (from.startsWith(`${f.root}${sep}`)) throw new Error("Uncertain effect");
    return outcome;
  } }));
  test(`${mode}: inaccessible project is rejected without native effects`, () => fixture(mode, (f) => {
    const result = f.rename(f.request("Fresh")); assert.equal(result.value.problem, "permission_denied");
    assert.equal(result.value.outcome, "rejected"); assert.equal(f.calls.length, 0);
  }, { filesystem: (f) => ({ ...nativeProjectFilesystem, assertAccessible(path) {
    if (f.project && path === join(f.root, f.relative("Original"))) throw Object.assign(new Error("Private access failure"), { code: "EACCES" });
    nativeProjectFilesystem.assertAccessible(path);
  } }) }));
}

const recoveryQuery = (f, type, workspaceId = f.workspace.workspaceId, operationId = f.pending.operationId) =>
  ({ type: `workspace.${type}`, workspaceId, operationId });
function reviewRename(f, workspaceId) {
  const result = f.service.previewProjectRenameRecovery(recoveryQuery(f, "previewProjectRenameRecovery", workspaceId));
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value;
}
function recoverRename(f, action, preview = reviewRename(f), workspaceId = preview.workspaceId) {
  return f.service.recoverProjectRename({ ...recoveryQuery(f, "recoverProjectRename", workspaceId), action, previewToken: preview.previewToken });
}
function pendingRename(f, name = "Fresh") {
  f.pending = f.request(name);
  const result = f.rename(f.pending); assert.equal(result.value.outcome, "recoverable", JSON.stringify(result));
  return result;
}
const interruptBeforeEffect = (f, from, to) => {
  if (f.calls.length === 1) throw new Error("Interrupted native call");
  return renameNoReplace(from, to);
};
for (const mode of ["direct", "grouped"]) {
  for (const action of ["retry_original", "keep_original"]) test(`${mode}: explicit ${action} preserves UUID/Text and consumes recovery review`, () => fixture(mode, (f) => {
    const before = f.snapshot(); pendingRename(f);
    const preview = reviewRename(f); assert.deepEqual(preview.actions, ["retry_original", "keep_original"]);
    assert.equal(preview.originalState, "matching"); assert.equal(preview.destinationState, "missing");
    const result = recoverRename(f, action, preview); assert.equal(result.ok, true);
    assert.equal(result.value.outcome, action === "keep_original" ? "rejected" : "completed");
    if (action === "keep_original") assert.equal(result.value.problem, "kept_original");
    assert.deepEqual(f.snapshot(), before);
    assert.equal(fs.readFileSync(join(f.root, f.relative(action === "keep_original" ? "Original" : "Fresh"), "sentinel"), "utf8"), "  Original 📝\n");
    assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length, action === "keep_original" ? 0 : 1);
    assert.equal(recoverRename(f, action, preview).error.code, "stale_preview");
    assert.deepEqual(f.rename(f.pending), result);
  }, { native: interruptBeforeEffect }));
  test(`${mode}: destination after uncertain native effect is completed explicitly without another native call`, () => fixture(mode, (f) => {
    const before = f.snapshot(); pendingRename(f);
    const preview = reviewRename(f); assert.deepEqual(preview.actions, ["complete_destination"]);
    assert.equal(preview.originalState, "missing"); assert.equal(preview.destinationState, "matching");
    const result = recoverRename(f, "complete_destination", preview); assert.equal(result.value.outcome, "completed");
    assert.equal(f.calls.length, 1); assert.deepEqual(f.snapshot(), before);
    assert.equal(result.value.project.projectId, f.project.projectId);
  }, { native: (f, from, to) => { renameNoReplace(from, to); throw new Error("Lost native response"); } }));
}

// Force alias policy only on case-sensitive hosts so the durable staged path is
// covered everywhere. Actual mounted behavior is separately reported by crash tests.
const aliasFilesystem = (f) => ({ ...nativeProjectFilesystem, inspect(path) {
  const original = join(f.root, f.relative("Original"));
  if (path === join(f.root, f.relative("original")) && fs.existsSync(original)) return nativeProjectFilesystem.inspect(original);
  return nativeProjectFilesystem.inspect(path);
} });
for (const mode of ["direct", "grouped"]) {
  test(`${mode}: staged effect without evidence is freshly inspected and finished with retained identity`, () => fixture(mode, (f) => {
    const before = f.snapshot(); pendingRename(f, "original");
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(row.staged_identity, null); assert.equal(row.last_verified_placement, "original");
    const preview = reviewRename(f); assert.equal(preview.stagedState, "matching"); assert.deepEqual(preview.actions, ["finish_staged"]);
    const result = recoverRename(f, "finish_staged", preview); assert.equal(result.value.outcome, "completed");
    assert.equal(result.value.project.name, "original"); assert.equal(f.calls.length, 2);
    assert.deepEqual(f.snapshot(), before); assert.equal(fs.existsSync(join(f.root, row.staging_relative_path)), false);
  }, { filesystem: aliasFilesystem, native: (f, from, to) => {
    const result = renameNoReplace(from, to); if (f.calls.length === 1) throw new Error("Interrupted after staging effect"); return result;
  } }));
  for (const placement of ["original", "staged", "destination"]) for (const state of ["missing", "replaced", "link", "inaccessible"]) {
    test(`${mode}: ${placement} ${state} recovery remains unresolved and never adopts replacement`, () => fixture(mode, (f) => {
      pendingRename(f, "original");
      const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
      const path = join(f.root, placement === "original" ? row.original_relative_path : placement === "staged" ? row.staging_relative_path : row.requested_relative_path);
      if (state === "inaccessible") f.deny = path;
      else {
        fs.renameSync(path, join(f.directory, "owned-away"));
        if (state === "replaced") fs.mkdirSync(path);
        if (state === "link") fs.symlinkSync(join(f.directory, "owned-away"), path, "junction");
      }
      const reviewed = reviewRename(f); assert.deepEqual(reviewed.actions, []); assert.equal(reviewed.previewToken, null);
      if (state !== "inaccessible") assert.equal(reviewed[placement === "staged" ? "stagedState" : placement === "original" ? "originalState" : "destinationState"], state === "replaced" ? "replaced" : state === "link" ? "link" : "missing");
      assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations").get(), row);
      assert.equal(f.service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: f.sibling.workspaceId }).value.operations.length, 1);
      assert.equal(f.service.getProjectRename(recoveryQuery(f, "getProjectRename")).value.outcome, "recoverable");
    }, { filesystem: (f) => ({ ...aliasFilesystem(f), assertAccessible(path) {
      if (f.deny === path) throw Object.assign(new Error("Private access failure"), { code: "EACCES" });
      nativeProjectFilesystem.assertAccessible(path);
    } }), native: (f, from, to) => {
      if (placement === "original") throw new Error("Before effect");
      const result = renameNoReplace(from, to);
      if (placement === "staged" || f.calls.length === 2) throw new Error("After effect");
      return result;
    } }));
  }
  for (const change of ["preview", "restart", "revision", "configuration", "reservation", "operation", "placement", "workspace"]) {
    test(`${mode}: ${change} invalidates recovery token before effects`, () => fixture(mode, (f) => {
      pendingRename(f); const preview = reviewRename(f), calls = f.calls.length;
      if (change === "preview") reviewRename(f);
      if (change === "restart") f.restart();
      if (change === "revision") f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1 WHERE id = ?").run(f.workspace.sourceId);
      if (change === "configuration") f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[\"Fresh\"]' WHERE id = ?").run(f.workspace.sourceId);
      if (change === "reservation") f.sql.prepare("UPDATE projects SET relative_path = ? WHERE id = ?").run(f.relative("fresh"), f.other.projectId);
      if (change === "operation") f.sql.prepare("UPDATE project_rename_operations SET problem = 'busy'").run();
      if (change === "placement") { fs.renameSync(join(f.root, f.relative("Original")), join(f.directory, "away")); fs.mkdirSync(join(f.root, f.relative("Original"))); }
      if (change === "workspace") f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId });
      const result = recoverRename(f, "retry_original", preview); assert.equal(result.ok, false);
      assert.equal(f.calls.length, calls); assert.equal(fs.existsSync(join(f.root, f.relative("Fresh"))), false);
    }, { native: interruptBeforeEffect }));
  }
  test(`${mode}: malformed, foreign, altered action and caller-mutated previews cannot authorize recovery`, () => fixture(mode, (f) => {
    pendingRename(f); const preview = reviewRename(f);
    const request = { ...recoveryQuery(f, "recoverProjectRename"), previewToken: preview.previewToken, action: "retry_original" };
    assert.equal(f.service.recoverProjectRename({ ...request, path: f.root }).error.code, "invalid_input");
    assert.equal(f.service.recoverProjectRename({ ...request, action: "overwrite" }).error.code, "invalid_input");
    assert.equal(f.service.recoverProjectRename({ ...request, workspaceId: f.sibling.workspaceId }).error.code, "stale_preview");
    assert.equal(f.service.recoverProjectRename({ ...request, action: "complete_destination" }).error.code, "stale_preview");
    assert.equal(f.service.recoverProjectRename({ ...request, operationId: randomUUID() }).error.code, "stale_preview");
    preview.actions.push("complete_destination");
    assert.equal(f.service.recoverProjectRename({ ...request, action: "complete_destination" }).error.code, "stale_preview");
    const result = f.service.recoverProjectRename(request); assert.equal(result.value.outcome, "completed");
    assert.equal(f.service.recoverProjectRename(request).error.code, "stale_preview");
  }, { native: interruptBeforeEffect }));
  test(`${mode}: unique full identity required when two exact placements appear to match`, () => fixture(mode, (f) => {
    pendingRename(f); fs.mkdirSync(join(f.root, f.relative("Fresh"))); f.duplicate = true;
    const preview = reviewRename(f); assert.deepEqual(preview.actions, []); assert.equal(preview.problem, "native_conflict");
    assert.equal(preview.originalState, "conflicting"); assert.equal(preview.destinationState, "conflicting");
  }, { native: interruptBeforeEffect, filesystem: (f) => ({ ...nativeProjectFilesystem, inspect(path) {
    if (f.duplicate && path === join(f.root, f.relative("Fresh"))) return nativeProjectFilesystem.inspect(join(f.root, f.relative("Original")));
    return nativeProjectFilesystem.inspect(path);
  } }) }));
  test(`${mode}: a late folded-name collision prevents completion without enrolling another identity`, () => fixture(mode, (f) => {
    pendingRename(f); fs.mkdirSync(join(f.root, f.relative("FRESH")));
    const preview = reviewRename(f); assert.deepEqual(preview.actions, []); assert.ok(["occupied", "destination_replaced"].includes(preview.problem));
    assert.equal(f.calls.length, 1);
  }, { native: interruptBeforeEffect }));
  test(`${mode}: Text edits preserve independent revisions and an otherwise fresh recovery review`, () => fixture(mode, (f) => {
    pendingRename(f); const preview = reviewRename(f);
    assert.equal(f.command("workspace.setTextValue", { projectId: f.project.projectId, propertyId: f.propertyId, value: "  Edited while pending  " }).ok, true);
    assert.equal(recoverRename(f, "retry_original", preview).value.outcome, "completed");
    assert.equal(f.sql.prepare("SELECT value FROM text_property_values WHERE project_id = ?").get(f.project.projectId).value, "  Edited while pending  ");
  }, { native: interruptBeforeEffect }));
}

for (const mode of ["direct", "grouped"]) {
  for (const failure of ["before_native", "before_second_native", "after_effect", "after_second_effect", "staged_evidence", "destination_evidence", "metadata", "uncertainty_write", "response"]) {
    test(`${mode}: recovery failure at ${failure} keeps durable evidence and can be reviewed again`, () => fixture(mode, (f) => {
      pendingRename(f, "original");
      const before = f.snapshot(), review = reviewRename(f);
      if (["staged_evidence", "destination_evidence", "uncertainty_write"].includes(failure)) {
        const stage = failure === "staged_evidence" ? "staged" : "destination_recorded";
        f.sql.exec(`CREATE TRIGGER inject_recovery BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = '${stage}' BEGIN SELECT RAISE(ABORT, 'Injected evidence failure'); END`);
      }
      if (failure === "metadata") f.sql.exec("CREATE TRIGGER inject_recovery BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Injected metadata failure'); END");
      if (failure === "uncertainty_write") f.sql.exec("CREATE TRIGGER inject_uncertainty BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'uncertain' BEGIN SELECT RAISE(ABORT, 'Injected uncertainty failure'); END");
      if (failure === "response") f.service.workspaces.subscribe((e) => { if (e.type === "workspace.projectsChanged") throw new Error("Lost subscriber response"); });
      const result = recoverRename(f, "retry_original", review);
      assert.equal(result.value.outcome, failure === "response" ? "completed" : "recoverable", JSON.stringify(result));
      assert.deepEqual(f.snapshot(), before);
      const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
      assert.equal(row.last_verified_identity, row.native_identity);
      if (["staged_evidence", "after_effect", "before_native"].includes(failure)) assert.equal(row.last_verified_placement, "original");
      if (["before_second_native", "after_second_effect", "destination_evidence", "uncertainty_write"].includes(failure)) assert.equal(row.last_verified_placement, "staged");
      if (failure === "metadata") assert.equal(row.last_verified_placement, "destination");
      if (failure === "uncertainty_write") assert.equal(row.stage, "staged", "failed uncertainty write retains prior durable evidence");
      f.sql.exec("DROP TRIGGER IF EXISTS inject_recovery; DROP TRIGGER IF EXISTS inject_uncertainty");
      f.restart();
      const retried = f.rename(f.pending); assert.equal(retried.value.outcome, result.value.outcome);
      if (failure !== "response") {
        const next = reviewRename(f); assert.equal(next.actions.length > 0, true, JSON.stringify(next));
        const completed = recoverRename(f, next.actions[0], next); assert.equal(completed.value.outcome, "completed", JSON.stringify(completed));
      }
      assert.equal(f.sql.prepare("SELECT discovery_revision AS revision FROM sources WHERE id = ?").get(f.workspace.sourceId).revision, f.initial.revision + 1);
      assert.equal(fs.readFileSync(join(f.root, f.relative("original"), "sentinel"), "utf8"), "  Original 📝\n");
      assert.equal(f.events.filter((e) => e.type === "workspace.projectsChanged").length <= 1, true);
    }, { filesystem: aliasFilesystem, native: (f, from, to) => {
      if (f.calls.length === 1 || failure === "before_native" && f.calls.length === 2 || failure === "before_second_native" && f.calls.length === 3) throw new Error("Before native effect");
      const result = renameNoReplace(from, to);
      if (failure === "after_effect" && f.calls.length === 2 || failure === "after_second_effect" && f.calls.length === 3) throw new Error("After native effect");
      return result;
    } }));
  }
  test(`${mode}: keep_original retains prior destination evidence after a verified external return`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_completion BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Injected completion failure'); END");
    pendingRename(f);
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get(); assert.equal(row.last_verified_placement, "destination");
    fs.renameSync(join(f.root, row.requested_relative_path), join(f.root, row.original_relative_path));
    const result = recoverRename(f, "keep_original"); assert.equal(result.value.problem, "kept_original");
    const kept = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    assert.equal(kept.destination_identity, row.destination_identity); assert.equal(kept.last_verified_placement, "original");
    assert.equal(kept.stage, "failed"); assert.equal(f.calls.length, 1);
  }));
  test(`${mode}: final commit retry returns durable result even after response and source changes`, () => fixture(mode, (f) => {
    pendingRename(f); const result = recoverRename(f, "retry_original"); assert.equal(result.value.outcome, "completed");
    const calls = f.calls.length;
    f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1 WHERE id = ?").run(f.workspace.sourceId);
    fs.renameSync(join(f.root, f.relative("Fresh")), join(f.directory, "external"));
    assert.deepEqual(f.rename(f.pending), result); assert.equal(f.calls.length, calls);
    assert.equal(f.rename({ ...f.pending, expectedRevision: f.pending.expectedRevision + 1 }).error.code, "invalid_input");
  }, { native: interruptBeforeEffect }));
}

for (const mode of ["direct", "grouped"]) for (const returned of ["original", "staged"]) {
  test(`${mode}: destination_recorded receipt can recover a uniquely verified external return to ${returned}`, () => fixture(mode, (f) => {
    f.sql.exec("CREATE TRIGGER fail_completion BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'Injected completion failure'); END; CREATE TRIGGER fail_uncertainty BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'uncertain' BEGIN SELECT RAISE(ABORT, 'Injected uncertainty failure'); END");
    pendingRename(f, "original");
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get(); assert.equal(row.stage, "destination_recorded");
    const target = returned === "original" ? row.original_relative_path : row.staging_relative_path;
    fs.renameSync(join(f.root, row.requested_relative_path), join(f.root, target));
    f.sql.exec("DROP TRIGGER fail_completion; DROP TRIGGER fail_uncertainty");
    const preview = reviewRename(f), action = returned === "original" ? "retry_original" : "finish_staged";
    assert.ok(preview.actions.includes(action), JSON.stringify(preview));
    const result = recoverRename(f, action, preview); assert.equal(result.value.outcome, "completed", JSON.stringify(result));
    assert.equal(f.sql.prepare("SELECT destination_identity FROM project_rename_operations").get().destination_identity, row.destination_identity);
  }, { filesystem: aliasFilesystem }));
}

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: read/review methods authorize current source and reject extra keys without journal changes`, () => fixture(mode, (f) => {
    pendingRename(f);
    const row = f.sql.prepare("SELECT * FROM project_rename_operations").get();
    const otherRoot = join(f.directory, "unrelated"); fs.mkdirSync(otherRoot);
    const other = f.service.workspaces.create({ type: "workspace.create", name: "Unrelated", rootPath: otherRoot }).value;
    assert.equal(f.service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: other.workspaceId }).value.operations.length, 0);
    assert.equal(f.service.listProjectRenames({ type: "workspace.listProjectRenames", workspaceId: f.workspace.workspaceId, path: f.root }).error.code, "invalid_input");
    for (const method of ["getProjectRename", "previewProjectRenameRecovery"]) {
      assert.equal(f.service[method](recoveryQuery(f, method, other.workspaceId)).error.code, "invalid_input");
      assert.equal(f.service[method]({ ...recoveryQuery(f, method), nativeIdentity: row.native_identity }).error.code, "invalid_input");
      assert.equal(f.service[method](recoveryQuery(f, method, f.sibling.workspaceId, randomUUID())).error.code, "invalid_input");
    }
    assert.deepEqual(f.sql.prepare("SELECT * FROM project_rename_operations").get(), row);
    assert.equal(f.calls.length, 1);
  }, { native: interruptBeforeEffect }));
  test(`${mode}: new preview uses current revision while immutable original retry stays bound`, () => fixture(mode, (f) => {
    pendingRename(f);
    f.sql.prepare("UPDATE sources SET discovery_revision = discovery_revision + 1 WHERE id = ?").run(f.workspace.sourceId);
    const preview = reviewRename(f); assert.equal(preview.revision, f.initial.revision + 1);
    const result = recoverRename(f, "retry_original", preview); assert.equal(result.value.outcome, "completed");
    assert.equal(result.value.project.revision, f.initial.revision + 2);
    assert.deepEqual(f.rename(f.pending), result);
    assert.equal(f.rename({ ...f.pending, expectedRevision: preview.revision }).ok, false);
  }, { native: interruptBeforeEffect }));
  for (const parent of mode === "grouped" ? ["root", "category"] : ["root"]) {
    test(`${mode}: ${parent} substitution invalidates reviewed recovery without traversing replacement`, () => fixture(mode, (f) => {
      pendingRename(f); const preview = reviewRename(f);
      const path = parent === "root" ? f.root : join(f.root, "Category"), moved = join(f.directory, "moved");
      fs.renameSync(path, moved); fs.mkdirSync(path);
      assert.equal(recoverRename(f, "retry_original", preview).error.code, "stale_preview");
      assert.equal(f.calls.length, 1); assert.deepEqual(fs.readdirSync(path), []);
      assert.deepEqual(reviewRename(f).actions, []);
      assert.equal(fs.readFileSync(join(moved, parent === "root" && mode === "grouped" ? "Category/Original/sentinel" : "Original/sentinel"), "utf8"), "  Original 📝\n");
    }, { native: interruptBeforeEffect }));
  }
  test(`${mode}: late original reappearance rolls back final completion and leaves both folders intact`, () => fixture(mode, (f) => {
    pendingRename(f); const preview = reviewRename(f); f.injectFinal = true;
    const result = recoverRename(f, "complete_destination", preview);
    assert.equal(result.value.outcome, "recoverable");
    assert.equal(f.sql.prepare("SELECT discovery_revision AS revision FROM sources WHERE id = ?").get(f.workspace.sourceId).revision, f.initial.revision);
    assert.equal(fs.readFileSync(join(f.root, f.relative("Original"), "replacement"), "utf8"), "Keep");
    assert.equal(fs.readFileSync(join(f.root, f.relative("Fresh"), "sentinel"), "utf8"), "  Original 📝\n");
    assert.deepEqual(reviewRename(f).actions, []);
  }, { native: (f, from, to) => { renameNoReplace(from, to); throw new Error("After effect"); }, filesystem: (f) => ({ ...nativeProjectFilesystem, names(path) {
    if (f.injectFinal && f.sql.prepare("SELECT stage FROM project_rename_operations").get()?.stage === "destination_recorded") {
      f.injectFinal = false; fs.mkdirSync(join(f.root, f.relative("Original"))); fs.writeFileSync(join(f.root, f.relative("Original"), "replacement"), "Keep");
    }
    return nativeProjectFilesystem.names(path);
  } }) }));
}

for (const mode of ["direct", "grouped"]) test(`${mode}: sibling explicitly recovers after initiating workspace removal`, () => fixture(mode, (f) => {
  pendingRename(f);
  assert.equal(f.service.workspaces.remove({ type: "workspace.remove", workspaceId: f.workspace.workspaceId }).ok, true);
  const before = f.snapshot(), preview = reviewRename(f, f.sibling.workspaceId);
  const result = recoverRename(f, "complete_destination", preview);
  assert.equal(result.value.outcome, "completed"); assert.equal(result.value.project.projectId, f.project.projectId);
  assert.deepEqual(f.snapshot(), before);
  assert.equal(result.value.operation.initiatingWorkspaceId, f.workspace.workspaceId);
  const changes = f.events.filter((e) => e.type === "workspace.projectsChanged");
  assert.equal(changes.length, 1); assert.deepEqual(changes[0].workspaceIds, [f.sibling.workspaceId]);
}, { native: (f, from, to) => { renameNoReplace(from, to); throw new Error("After effect"); } }));

for (const mode of ["direct", "grouped"]) {
  test(`${mode}: default native completion interruption survives restart and explicit sibling recovery`, () => fixture(mode, (f) => {
    const before = f.snapshot(), original = identity(join(f.root, f.relative("Original")));
    f.sql.exec("CREATE TRIGGER fixture_interrupt BEFORE UPDATE ON project_rename_operations WHEN NEW.stage = 'completed' BEGIN SELECT RAISE(ABORT, 'Fixture interruption'); END");
    const request = f.request("Recovered"), unfinished = f.rename(request);
    assert.equal(unfinished.value.outcome, "recoverable");
    assert.equal(unfinished.value.operation.lastVerifiedPlacement, "destination");
    assert.equal(identity(join(f.root, f.relative("Recovered"))), original);
    const row = () => f.sql.prepare("SELECT * FROM project_rename_operations WHERE operation_id = ?").get(request.operationId);
    const saved = row(); f.restart(); f.sql.exec("DROP TRIGGER fixture_interrupt");
    assert.deepEqual(f.rename(request), unfinished);
    assert.deepEqual(f.query("workspace.getProjectRename", { workspaceId: f.sibling.workspaceId, operationId: request.operationId }), unfinished);
    assert.equal(f.query("workspace.listProjectRenames", { workspaceId: f.sibling.workspaceId }).value.operations.length, 1);
    assert.deepEqual(row(), saved);
    assert.equal(f.events.filter(event => event.type === "workspace.projectsChanged").length, 0);
    const preview = f.query("workspace.previewProjectRenameRecovery", { workspaceId: f.sibling.workspaceId, operationId: request.operationId }).value;
    assert.deepEqual(preview.actions, ["complete_destination"]);
    const completed = f.command("workspace.recoverProjectRename", { workspaceId: f.sibling.workspaceId,
      operationId: request.operationId, previewToken: preview.previewToken, action: "complete_destination" });
    assert.equal(completed.value.outcome, "completed");
    assert.equal(completed.value.project.projectId, f.project.projectId);
    assert.equal(completed.value.project.categoryId, f.project.categoryId);
    assert.equal(completed.value.project.revision, f.initial.revision + 1);
    assert.deepEqual(f.snapshot(), before); assert.deepEqual(f.rename(request), completed);
    assert.equal(fs.readFileSync(join(f.root, f.relative("Recovered"), "sentinel"), "utf8"), "  Original 📝\n");
  }, { defaultNative: true }));
}
