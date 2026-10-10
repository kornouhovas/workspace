import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Database from "better-sqlite3";
import { openSettingsService } from "../dist/service/settings.mjs";
import { createNativeProjectReveal } from "../src/desktop/project-reveal.ts";
import { isProjectRevealRequest } from "../src/contracts/project-reveal.ts";

async function fixture(mode, run) {
  const directory = fs.realpathSync.native(fs.mkdtempSync(join(tmpdir(), "project-reveal-")));
  const root = join(directory, "root"), other = join(directory, "other"), database = join(directory, "data.sqlite");
  fs.mkdirSync(root); fs.mkdirSync(other);
  if (mode === "grouped") fs.mkdirSync(join(root, "Category"));
  const service = openSettingsService(database);
  const sql = new Database(database);
  try {
    const workspace = service.workspaces.create({ type: "workspace.create", name: "One", rootPath: root }).value;
    const sibling = service.workspaces.create({ type: "workspace.create", name: "Sibling", rootPath: root }).value;
    const foreign = service.workspaces.create({ type: "workspace.create", name: "Foreign", rootPath: other }).value;
    const preview = service.workspaces.previewDiscovery({ type: "workspace.previewDiscovery", workspaceId: workspace.workspaceId, mode }).value;
    const list = service.workspaces.applyDiscovery({ type: "workspace.applyDiscovery", workspaceId: workspace.workspaceId, previewToken: preview.previewToken }).value;
    const name = "  Project Текст 📝";
    const request = { type: "workspace.createProject", workspaceId: workspace.workspaceId,
      operationId: randomUUID(), name, expectedRevision: list.revision, mode,
      ...(mode === "grouped" ? { categoryId: list.categories[0].categoryId } : {}) };
    const response = service.handleCommand(request);
    assert.ok(response.ok, JSON.stringify(response));
    const creation = response.value;
    assert.equal(creation.outcome, "completed");
    const project = creation.project, path = join(root, project.relativePath);
    assert.equal(project.name, request.name);
    assert.equal(creation.operation.name, request.name);
    assert.equal(basename(sql.prepare("SELECT relative_path FROM projects WHERE id = ?").get(project.projectId).relative_path), request.name);
    assert.equal(project.relativePath, mode === "grouped" ? `Category/${name}` : name);
    assert.deepEqual(fs.readdirSync(mode === "grouped" ? join(root, "Category") : root), [name]);
    fs.writeFileSync(join(path, "sentinel"), "untouched bytes");
    await run({ directory, root, other, path, service, sql, workspace, sibling, foreign, project,
      input: { type: "workspace.revealProject", workspaceId: workspace.workspaceId, projectId: project.projectId } });
    assert.equal(fs.readFileSync(join(fs.existsSync(path) ? path : `${path}-moved`, "sentinel"), "utf8"), "untouched bytes");
  } finally { service.close(); sql.close(); fs.rmSync(directory, { recursive: true, force: true }); }
}

test("Reveal accepts exact logical IDs and rejects renderer paths, URLs, commands and malformed IDs", () => {
  const input = { type: "workspace.revealProject", workspaceId: randomUUID(), projectId: randomUUID() };
  assert.equal(isProjectRevealRequest(input), true);
  for (const value of [null, [], { ...input, workspaceId: "bad" }, { ...input, projectId: "bad" },
    ...["path", "url", "command", "nativeIdentity"].map((key) => ({ ...input, [key]: "/unsafe" }))]) {
    assert.equal(isProjectRevealRequest(value), false);
  }
});

for (const mode of ["direct", "grouped"]) {
  test(`${mode} Reveal verifies the real folder, allows source siblings, exposes only dispatch acknowledgment and preserves data`, async () => fixture(mode, async (f) => {
    const before = f.sql.prepare("SELECT * FROM sources").all(), calls = [];
    const native = createNativeProjectReveal(async (path) => { calls.push(path); });
    for (const workspaceId of [f.workspace.workspaceId, f.sibling.workspaceId]) {
      const result = await f.service.revealProject({ ...f.input, workspaceId }, (target) => native(target, () => true));
      assert.deepEqual(result, { ok: true, value: { outcome: "dispatched", workspaceId, projectId: f.project.projectId } });
      assert.doesNotMatch(JSON.stringify(result), /canonicalRoot|nativeIdentity|sentinel|file:/);
    }
    assert.deepEqual(calls, [f.path, f.path]);
    assert.deepEqual(f.sql.prepare("SELECT * FROM sources").all(), before);
  }));

  test(`${mode} Reveal rejects malformed/foreign identities before native dispatch`, async () => fixture(mode, async (f) => {
    const calls = [];
    for (const input of [{ ...f.input, path: f.path }, { ...f.input, workspaceId: randomUUID() },
      { ...f.input, projectId: randomUUID() }, { ...f.input, workspaceId: f.foreign.workspaceId }, { ...f.input, projectId: "invalid" }]) {
      const result = await f.service.revealProject(input, async () => { calls.push(input); return { outcome: "dispatched" }; });
      assert.equal(result.ok, false); assert.equal(result.error.code, "invalid_input");
    }
    assert.deepEqual(calls, []);
  }));

  for (const scenario of ["missing", "replaced", "link", "root_unavailable", "root_replaced", "excluded", "mode_retained", "category_unavailable"]) {
    if (mode === "direct" && scenario === "category_unavailable") continue;
    test(`${mode} Reveal reports ${scenario} without invoking native integration`, async () => fixture(mode, async (f) => {
      const calls = [];
      if (["missing", "replaced", "link"].includes(scenario)) {
        fs.renameSync(f.path, `${f.path}-moved`);
        if (scenario === "replaced") fs.mkdirSync(f.path);
        if (scenario === "link") fs.symlinkSync(`${f.path}-moved`, f.path, "dir");
      } else if (scenario === "root_unavailable" || scenario === "root_replaced") {
        fs.renameSync(f.root, `${f.root}-moved`);
        if (scenario === "root_replaced") fs.mkdirSync(f.root);
      } else if (scenario === "excluded") {
        f.sql.prepare("UPDATE sources SET excluded_relative_paths = ? WHERE id = ?").run(JSON.stringify([f.project.relativePath]), f.workspace.sourceId);
      } else if (scenario === "mode_retained") {
        f.sql.prepare("UPDATE projects SET mode_inactive = 1 WHERE id = ?").run(f.project.projectId);
      } else {
        fs.renameSync(join(f.root, "Category"), join(f.root, "Category-moved"));
        fs.mkdirSync(join(f.root, "Category"));
      }
      const result = await f.service.revealProject(f.input, async () => { calls.push(true); return { outcome: "dispatched" }; });
      assert.equal(result.ok, true); assert.equal(result.value.outcome, "rejected");
      assert.equal(result.value.problem, scenario === "link" ? "replaced" : scenario);
      assert.deepEqual(calls, []);
      if (["missing", "replaced", "link"].includes(scenario)) {
        if (scenario !== "missing") fs.rmSync(f.path, { recursive: true });
        fs.renameSync(`${f.path}-moved`, f.path);
      }
      if (scenario === "category_unavailable") { fs.rmSync(join(f.root, "Category"), { recursive: true }); fs.renameSync(join(f.root, "Category-moved"), join(f.root, "Category")); }
      if (scenario.startsWith("root_")) { fs.rmSync(f.root, { recursive: true, force: true }); fs.renameSync(`${f.root}-moved`, f.root); }
    }));
  }

  test(`${mode} delayed native dispatch rejects removed/replaced destination and changed parent evidence`, async () => fixture(mode, async (f) => {
    let target;
    const calls = [], native = createNativeProjectReveal(async (path) => { calls.push(path); });
    const pending = f.service.revealProject(f.input, async (value) => { target = value; await Promise.resolve();
      fs.renameSync(f.path, `${f.path}-moved`); fs.mkdirSync(f.path);
      return native(value, () => true);
    });
    const result = await pending;
    assert.equal(result.value.problem, "replaced"); assert.deepEqual(calls, []);
    fs.rmSync(f.path, { recursive: true }); fs.renameSync(`${f.path}-moved`, f.path);
    assert.equal((await native(target, () => false)).problem, "request_expired"); assert.deepEqual(calls, []);
  }));

  test(`${mode} post-dispatch evidence checks report a folder changed during the native API call`, async () => fixture(mode, async (f) => {
    const native = createNativeProjectReveal(async () => { fs.renameSync(f.path, `${f.path}-moved`); });
    const result = await f.service.revealProject(f.input, (target) => native(target, () => true));
    assert.equal(result.value.outcome, "rejected"); assert.equal(result.value.problem, "missing");
    fs.renameSync(`${f.path}-moved`, f.path);
  }));

  test(`${mode} native errors and unavailable adapters give bounded useful failures without leaking paths`, async () => fixture(mode, async (f) => {
    for (const open of [() => { throw new Error(f.path); }, async () => { throw new Error(f.path); }]) {
      const result = await f.service.revealProject(f.input, (target) => createNativeProjectReveal(open)(target, () => true));
      assert.equal(result.value.problem, "native_error"); assert.doesNotMatch(JSON.stringify(result), /private path|root/);
    }
    assert.equal((await f.service.revealProject(f.input)).value.problem, "native_unavailable");
  }));
}

for (const mode of ["direct", "grouped"]) {
  for (const state of ["excluded", "missing", "unresolved", "replaced"]) {
    test(`${mode} retained ${state} metadata never opens a folder even with unchanged evidence`, async () => fixture(mode, async (f) => {
      f.sql.prepare("UPDATE projects SET association_state = ? WHERE id = ?").run(state, f.project.projectId);
      let calls = 0;
      const result = await f.service.revealProject(f.input, async () => { calls++; return { outcome: "dispatched" }; });
      assert.equal(result.value.problem, state); assert.equal(calls, 0);
    }));
  }

  test(`${mode} archive designation and exact full native identity block native dispatch`, async () => fixture(mode, async (f) => {
    let calls = 0;
    const dispatch = async () => { calls++; return { outcome: "dispatched" }; };
    f.sql.prepare("UPDATE sources SET archive_relative_path = ? WHERE id = ?").run(f.project.relativePath, f.workspace.sourceId);
    assert.equal((await f.service.revealProject(f.input, dispatch)).value.problem, "excluded");
    f.sql.prepare("UPDATE sources SET archive_relative_path = NULL WHERE id = ?").run(f.workspace.sourceId);
    const identity = JSON.parse(f.sql.prepare("SELECT native_identity FROM projects WHERE id = ?").get(f.project.projectId).native_identity);
    identity.birthtimeNs = String(BigInt(identity.birthtimeNs) + 1n);
    f.sql.prepare("UPDATE projects SET native_identity = ? WHERE id = ?").run(JSON.stringify(identity), f.project.projectId);
    assert.equal((await f.service.revealProject(f.input, dispatch)).value.problem, "replaced"); assert.equal(calls, 0);
  }));

  test(`${mode} policy changes and service closure during native completion cannot produce stale success`, async () => fixture(mode, async (f) => {
    const result = await f.service.revealProject(f.input, async () => {
      f.sql.prepare("UPDATE sources SET excluded_relative_paths = ? WHERE id = ?").run(JSON.stringify([f.project.relativePath]), f.workspace.sourceId);
      return { outcome: "dispatched" };
    });
    assert.equal(result.value.problem, "excluded");
    f.sql.prepare("UPDATE sources SET excluded_relative_paths = '[]' WHERE id = ?").run(f.workspace.sourceId);
    const closed = await f.service.revealProject(f.input, async () => { f.service.workspaces.close(); return { outcome: "dispatched" }; });
    assert.equal(closed.value.problem, "request_expired");
  }));

  test(`${mode} desktop revalidates delayed root/category/link changes before dispatch`, async () => fixture(mode, async (f) => {
    const calls = [], native = createNativeProjectReveal(async (path) => { calls.push(path); });
    for (const scenario of ["root", "destination_link", ...(mode === "grouped" ? ["category_link"] : [])]) {
      const original = scenario === "root" ? f.root : scenario === "category_link" ? join(f.root, "Category") : f.path;
      const moved = `${original}-moved`;
      const result = await f.service.revealProject(f.input, async (target) => {
        fs.renameSync(original, moved);
        if (scenario === "root") fs.mkdirSync(original); else fs.symlinkSync(moved, original, "dir");
        return native(target, () => true);
      });
      assert.equal(result.value.problem, scenario === "root" ? "root_replaced" : scenario === "category_link" ? "category_unavailable" : "replaced");
      fs.rmSync(original, { recursive: true }); fs.renameSync(moved, original);
    }
    assert.deepEqual(calls, []);
  }));

  test(`${mode} inaccessible selected directories fail before native dispatch (simulated ACL denial)`, async () => fixture(mode, async (f) => {
    const { nativeProjectFilesystem } = await import("../src/service/project-filesystem.ts");
    const calls = [], native = createNativeProjectReveal(async (path) => { calls.push(path); }, {
      ...nativeProjectFilesystem,
      assertAccessible(path) { if (path === f.path) throw Object.assign(new Error("ACL denied"), { code: "EACCES" }); nativeProjectFilesystem.assertAccessible(path); },
    });
    const result = await f.service.revealProject(f.input, (target) => native(target, () => true));
    assert.equal(result.value.problem, "unavailable"); assert.deepEqual(calls, []);
  }));
}

test("private desktop targets reject traversal, unsupported depth, links and identity tampering", async () => fixture("direct", async (f) => {
  let target;
  await f.service.revealProject(f.input, async (value) => { target = value; return { outcome: "dispatched" }; });
  const calls = [], native = createNativeProjectReveal(async (path) => { calls.push(path); });
  for (const changed of [
    { ...target, relativePath: "../other" }, { ...target, relativePath: "/outside" },
    { ...target, relativePath: "Category/Nested/Project" }, { ...target, parentRelativePath: "../other" },
    { ...target, nativeIdentity: '{}' }, { ...target, url: "file:///outside" },
    { ...target, canonicalRoot: "file:///outside" },
  ]) assert.equal((await native(changed, () => true)).outcome, "rejected");
  assert.deepEqual(calls, []);
}));

if (process.platform !== "win32") test("Reveal preserves valid POSIX colon/backslash names instead of interpreting them as paths or URLs", async () => fixture("direct", async (f) => {
  const name = "scheme:project\\..\\name", created = f.service.workspaces.createProject({ type: "workspace.createProject", mode: "direct",
    workspaceId: f.workspace.workspaceId, operationId: randomUUID(), name, expectedRevision: f.project.revision }).value;
  assert.equal(created.outcome, "completed");
  const calls = [], native = createNativeProjectReveal(async (path) => { calls.push(path); });
  const result = await f.service.revealProject({ ...f.input, projectId: created.project.projectId }, (target) => native(target, () => true));
  assert.equal(result.value.outcome, "dispatched"); assert.deepEqual(calls, [join(f.root, name)]);
}));
