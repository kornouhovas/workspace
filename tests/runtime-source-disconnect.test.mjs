import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createRuntimeSourceDisconnect, createRuntimeSourceMoveEvidence } from "../scripts/runtime-source-disconnect.mjs";
import { runBoundedProcess } from "../scripts/windows-rename-diagnostics.mjs";

const runtime = await readFile(new URL("../scripts/smoke-runtime.mjs", import.meta.url), "utf8");
const anchor = "await page.evaluate(() => globalThis.stopSmokeChanges());";
const start = runtime.indexOf(anchor) + anchor.length;
assert.ok(start >= anchor.length);
const callSite = runtime.slice(start, runtime.indexOf("await select(page, sibling);", start)).trim();
assert.equal(callSite, 'await moveSelectedSource("disconnect");');
const invokeSecondDisconnect = new (Object.getPrototypeOf(async function () {}).constructor)("moveSelectedSource", callSite);

async function fixture(t, { autoCleanup = true } = {}) {
  const ownedFixture = await mkdtemp(join(tmpdir(), "workspace-runtime-"));
  if (autoCleanup) t.after(() => rm(ownedFixture, { recursive: true, force: true }));
  const source = join(ownedFixture, "SelectedProjectRoot");
  await mkdir(source);
  await writeFile(join(source, "sentinel"), "Exact fixture bytes");
  await mkdir(join(source, "nested"));
  await writeFile(join(source, "nested", "binary"), Buffer.from([0, 255, 1, 0, 128]));
  await mkdir(join(ownedFixture, "unrelated"));
  await writeFile(join(ownedFixture, "unrelated", "sentinel"), "Unrelated bytes");
  return { ownedFixture, sourceName: "SelectedProjectRoot", source, disconnected: join(ownedFixture, "temporarily-disconnected") };
}

function clock() {
  let ms = 0;
  const waits = [];
  return { now: () => ms, sleep: async (delay) => { waits.push(delay); ms += delay; },
    advance: (delay) => { ms += delay; }, waits };
}
const osError = (code = "EPERM") => Object.assign(new Error("private OS error with paths"), { code });
async function unchanged(f) {
  assert.equal(await readFile(join(f.source, "sentinel"), "utf8"), "Exact fixture bytes");
  assert.deepEqual(await readFile(join(f.source, "nested", "binary")), Buffer.from([0, 255, 1, 0, 128]));
  await assert.rejects(lstat(f.disconnected), { code: "ENOENT" });
  assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
}

test("actual second-disconnect seam recovers a captured first EPERM with a real move", async (t) => {
  const f = await fixture(t);
  let attempts = 0;
  const moveSelectedSource = await createRuntimeSourceDisconnect(f, {
    ...clock(),
    platform: "win32",
    rename: async (from, to) => {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error("Captured Windows source-disconnect failure"), { code: "EPERM", syscall: "rename", errno: -4048 });
      await rename(from, to);
    },
  });
  await invokeSecondDisconnect(moveSelectedSource);
  assert.equal(attempts, 2);
  assert.equal(await readFile(join(f.disconnected, "sentinel"), "utf8"), "Exact fixture bytes");
});

test("all four runtime callsites execute the tested helper in both directions", async (t) => {
  assert.match(runtime, /const moveOwnedSource = await createRuntimeSourceDisconnect\(\{ ownedFixture: fixture, sourceName: basename\(projectRoot\) \}\)/u);
  const calls = runtime.match(/await moveSelectedSource\("(?:disconnect|restore)"\);/gu);
  assert.equal(calls.length, 4);
  const invoke = new (Object.getPrototypeOf(async function () {}).constructor)("moveSelectedSource", calls.join("\n"));
  const f = await fixture(t), times = clock();
  let attempts = 0;
  const evidence = createRuntimeSourceMoveEvidence(), persisted = [];
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async (from, to) => {
    attempts++;
    if (attempts % 2) throw osError();
    await rename(from, to);
  } });
  const wiring = runtime.match(/const moveSelectedSource = direction => [^\n]+/u)[0];
  const wired = new Function("sourceMoves", "moveOwnedSource", "recordEvidence", `${wiring}\nreturn moveSelectedSource;`)(
    evidence, helper, async () => persisted.push(evidence.snapshot()));
  await invoke(wired);
  const results = evidence.snapshot();
  assert.deepEqual(results.map(result => result.direction), ["disconnect", "restore", "disconnect", "restore"]);
  assert.equal(attempts, 8);
  for (const result of results) {
    assert.equal(result.status, "passed");
    assert.equal(result.attempts, 2); assert.equal(result.elapsedMs, 100); assert.equal(result.firstErrorCode, "EPERM");
    assert.ok(result.sourceAbsent && result.destinationIdentityMatches && result.contentsMatch && result.verificationComplete);
  }
  assert.equal(persisted.length, 4); assert.deepEqual(persisted[3], results);
  assert.deepEqual(persisted[0].map(result => result.status), ["passed", "unreached", "unreached", "unreached"]);
  evidence.assertComplete();
  await unchanged(f);
});

test("first-attempt real moves preserve full identity, bytes and expected descendant links", async (t) => {
  const f = await fixture(t);
  const target = join(f.ownedFixture, "unrelated");
  await symlink(target, join(f.source, "external-link"), process.platform === "win32" ? "junction" : "dir");
  const linkText = await readlink(join(f.source, "external-link"));
  const before = await lstat(f.source, { bigint: true });
  const helper = await createRuntimeSourceDisconnect(f, clock());
  for (const direction of ["disconnect", "restore"]) {
    const result = await helper(direction);
    assert.equal(result.attempts, 1);
    assert.equal(result.firstErrorCode, null);
    const moved = direction === "disconnect" ? f.disconnected : f.source;
    const after = await lstat(moved, { bigint: true });
    assert.deepEqual([after.dev, after.ino, after.birthtimeNs], [before.dev, before.ino, before.birthtimeNs]);
    assert.equal(await readlink(join(moved, "external-link")), linkText);
  }
  await unchanged(f);
});

for (const platform of ["darwin", "linux"]) test(`${platform} EPERM remains a single-attempt failure`, async (t) => {
  const f = await fixture(t), times = clock();
  let attempts = 0;
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform, rename: async () => { attempts++; throw osError(); } });
  await assert.rejects(helper("disconnect"), (error) => {
    assert.equal(error.code, "rename_failed");
    assert.equal(error.fixtureMove.firstErrorCode, "EPERM");
    return true;
  });
  assert.equal(attempts, 1); assert.deepEqual(times.waits, []);
  await unchanged(f);
});

for (const code of ["EACCES", "ENOENT", "EEXIST", "EBUSY", "EXDEV", "EIO", "UNKNOWN_PRIVATE_CODE"]) {
  test(`Windows ${code} does not retry`, async (t) => {
    const f = await fixture(t), times = clock();
    let attempts = 0;
    const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async () => { attempts++; throw osError(code); } });
    await assert.rejects(helper("disconnect"), (error) => {
      assert.equal(error.code, "rename_failed");
      assert.equal(error.fixtureMove.firstErrorCode, code === "UNKNOWN_PRIVATE_CODE" ? "unknown" : code);
      assert.equal(JSON.stringify(error).includes("private"), false);
      return true;
    });
    assert.equal(attempts, 1); assert.deepEqual(times.waits, []);
    await unchanged(f);
  });
}

test("permanent Windows EPERM/access denial exhausts 20 attempts and never moves", async (t) => {
  const f = await fixture(t), times = clock();
  let attempts = 0;
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async () => { attempts++; throw osError(); } });
  await assert.rejects(helper("disconnect"), (error) => {
    assert.equal(error.code, "attempts_exhausted");
    assert.deepEqual(error.fixtureMove, { attempts: 20, elapsedMs: 1900, firstErrorCode: "EPERM",
      sourceAbsent: false, destinationIdentityMatches: false, contentsMatch: false, verificationComplete: true });
    return true;
  });
  assert.equal(attempts, 20); assert.deepEqual(times.waits, Array(19).fill(100));
  await unchanged(f);
});

test("retry spacing is capped by the remaining deadline and no attempt starts at expiry", async (t) => {
  const f = await fixture(t), times = clock();
  let attempts = 0;
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async () => {
    attempts++; times.advance(1950); throw osError();
  } });
  await assert.rejects(helper("disconnect"), (error) => {
    assert.equal(error.code, "deadline_exhausted"); assert.equal(error.fixtureMove.elapsedMs, 2000);
    assert.equal(error.fixtureMove.firstErrorCode, "EPERM"); return true;
  });
  assert.equal(attempts, 1); assert.deepEqual(times.waits, [50]);
  await unchanged(f);
});

for (const mutation of ["missing", "replaced", "linked", "file", "changed-bytes", "new-entry", "occupied", "dangling-destination", "fixture-link"]) {
  test(`rejects ${mutation} before the first move and after EPERM`, async (t) => {
    for (const duringRetry of [false, true]) await t.test(duringRetry ? "before retry" : "before first attempt", async (t) => {
      const f = await fixture(t), times = clock();
      const held = join(f.ownedFixture, "held-source");
      async function mutate() {
        if (["missing", "replaced", "linked", "file"].includes(mutation)) {
          await rename(f.source, held);
          if (mutation === "replaced") await mkdir(f.source);
          if (mutation === "linked") await symlink(held, f.source, process.platform === "win32" ? "junction" : "dir");
          if (mutation === "file") await writeFile(f.source, "not a directory");
        } else if (mutation === "changed-bytes") await writeFile(join(f.source, "sentinel"), "Changed fixture bytes");
        else if (mutation === "new-entry") await writeFile(join(f.source, "unexpected"), "new");
        else if (mutation === "occupied") await mkdir(f.disconnected);
        else if (mutation === "dangling-destination") await symlink(join(f.ownedFixture, "missing-target"), f.disconnected, process.platform === "win32" ? "junction" : "dir");
        else {
          const heldFixture = f.ownedFixture + "-held";
          await rename(f.ownedFixture, heldFixture);
          t.after(() => rm(heldFixture, { recursive: true, force: true }));
          await symlink(heldFixture, f.ownedFixture, process.platform === "win32" ? "junction" : "dir");
        }
      }
      let attempts = 0;
      const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async () => {
        attempts++; await mutate(); throw osError();
      } });
      if (!duringRetry) await mutate();
      await assert.rejects(helper("disconnect"), (error) => {
        assert.ok(["unsafe_source", "changed_identity", "changed_contents", "occupied_destination", "unexpected_effects"].includes(error.code), error.code);
        if (duringRetry) assert.equal(error.fixtureMove.firstErrorCode, "EPERM");
        return true;
      });
      assert.equal(attempts, duringRetry ? 1 : 0);
      assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
      if (["missing", "replaced", "linked", "file"].includes(mutation)) {
        assert.equal(await readFile(join(held, "sentinel"), "utf8"), "Exact fixture bytes");
      }
    });
  });
}

test("a changed expected descendant link is rejected without following its target", async (t) => {
  const f = await fixture(t), link = join(f.source, "link");
  await symlink(join(f.ownedFixture, "unrelated"), link, process.platform === "win32" ? "junction" : "dir");
  const helper = await createRuntimeSourceDisconnect(f);
  await unlink(link);
  await symlink(join(f.ownedFixture, "nonexistent-target"), link, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(helper("disconnect"), { code: "changed_contents" });
  await unchanged(f);
});

test("factory rejects unsafe caller paths, source links and an occupied destination", async (t) => {
  const f = await fixture(t);
  for (const sourceName of ["", ".", "..", "../unrelated", "nested/child", "nested\\child", "C:alias", "name\0", "name.", "name ", "TEMPORARILY-DISCONNECTED"]) {
    await assert.rejects(createRuntimeSourceDisconnect({ ...f, sourceName }), { code: "unsafe_path" });
  }
  await assert.rejects(createRuntimeSourceDisconnect({ ...f, ownedFixture: "relative" }), { code: "unsafe_path" });
  const held = join(f.ownedFixture, "held");
  await rename(f.source, held);
  await symlink(held, f.source, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createRuntimeSourceDisconnect(f), { code: "unsafe_source" });
  await unlink(f.source); await rename(held, f.source);
  await mkdir(f.disconnected);
  await assert.rejects(createRuntimeSourceDisconnect(f), { code: "occupied_destination" });
});

test("canonical owned root accepts platform temp aliases but rejects a fixture-root link", async (t) => {
  const f = await fixture(t);
  const canonical = await realpath(f.ownedFixture);
  const helper = await createRuntimeSourceDisconnect(f);
  await helper("disconnect"); await helper("restore");
  assert.equal(await realpath(f.source), join(canonical, f.sourceName));
  const alias = f.ownedFixture + "-alias";
  await symlink(f.ownedFixture, alias, process.platform === "win32" ? "junction" : "dir");
  t.after(() => unlink(alias));
  await assert.rejects(createRuntimeSourceDisconnect({ ...f, ownedFixture: alias }), { code: "unsafe_source" });
  await unchanged(f);
});

test("resolving without a move cannot pass or be retried", async (t) => {
  const f = await fixture(t);
  let attempts = 0;
  const helper = await createRuntimeSourceDisconnect(f, { rename: async () => { attempts++; } });
  await assert.rejects(helper("disconnect"), (error) => {
    assert.equal(error.code, "missing_effects"); assert.equal(error.fixtureMove.sourceAbsent, false); return true;
  });
  await assert.rejects(helper("disconnect"), { code: "invalid_state" });
  assert.equal(attempts, 1); await unchanged(f);
});

for (const effect of ["move-then-throw", "copy", "changed-destination-bytes"]) test(`unexpected ${effect} never triggers replay or rollback`, async (t) => {
  const f = await fixture(t);
  let attempts = 0;
  const helper = await createRuntimeSourceDisconnect(f, { ...clock(), platform: "win32", rename: async (from, to) => {
    attempts++;
    if (effect === "copy") { await mkdir(to); await writeFile(join(to, "sentinel"), "Exact fixture bytes"); }
    else await rename(from, to);
    if (effect === "move-then-throw") throw osError();
    if (effect === "changed-destination-bytes") await writeFile(join(to, "sentinel"), "Unexpected bytes");
  } });
  await assert.rejects(helper("disconnect"), { code: effect === "move-then-throw" ? "unexpected_effects" : "missing_effects" });
  assert.equal(attempts, 1);
  assert.ok(await lstat(f.disconnected));
  if (effect !== "copy") await assert.rejects(lstat(f.source), { code: "ENOENT" });
  assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
});

for (const succeeds of [true, false]) test(`late ${succeeds ? "success" : "EPERM"} awaits settlement and remains a deadline failure`, async (t) => {
  const f = await fixture(t), times = clock();
  let entered, release;
  const ready = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let attempts = 0, settled = false;
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async (from, to) => {
    attempts++; entered(); await gate;
    if (succeeds) await rename(from, to); else throw osError();
  } });
  const pending = helper("disconnect");
  pending.then(() => { settled = true; }, () => { settled = true; });
  await ready; times.advance(2100);
  await Promise.resolve();
  assert.equal(settled, false, "In-flight rename must not be abandoned at the deadline");
  await assert.rejects(helper("disconnect"), { code: "invalid_state" });
  release();
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, "deadline_exhausted");
    assert.equal(error.fixtureMove.elapsedMs, 2100);
    assert.equal(error.fixtureMove.firstErrorCode, succeeds ? null : "EPERM");
    assert.equal(error.fixtureMove.sourceAbsent, succeeds);
    assert.equal(error.fixtureMove.destinationIdentityMatches, succeeds);
    assert.equal(error.fixtureMove.contentsMatch, succeeds);
    return true;
  });
  assert.equal(attempts, 1); assert.deepEqual(times.waits, []);
  await assert.rejects(helper(succeeds ? "restore" : "disconnect"), { code: "invalid_state" });
  assert.equal(await readFile(join(succeeds ? f.disconnected : f.source, "sentinel"), "utf8"), "Exact fixture bytes");
  assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
});

test("invalid direction and out-of-order restore cannot mutate the fixture", async (t) => {
  const f = await fixture(t);
  const helper = await createRuntimeSourceDisconnect(f);
  await assert.rejects(helper("other"), { code: "invalid_direction" });
  await assert.rejects(helper("restore"), { code: "invalid_state" });
  await unchanged(f);
  assert.ok((await readdir(f.ownedFixture)).includes(f.sourceName));
});

const verifiedMove = () => ({ attempts: 1, elapsedMs: 1, firstErrorCode: null,
  sourceAbsent: true, destinationIdentityMatches: true, contentsMatch: true, verificationComplete: true });

for (const field of ["sourceAbsent", "destinationIdentityMatches", "contentsMatch", "verificationComplete"]) {
  test(`evidence rejects success with ${field} false or missing`, async () => {
    for (const missing of [false, true]) {
      const evidence = createRuntimeSourceMoveEvidence(), value = verifiedMove(), persisted = [];
      if (missing) delete value[field]; else value[field] = false;
      await assert.rejects(evidence.run("disconnect", async () => value, async () => persisted.push(evidence.snapshot())), { code: "invalid_evidence" });
      assert.equal(persisted[0][0].status, "failed");
      assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
      assert.deepEqual(evidence.snapshot().slice(1).map(item => item.status), Array(3).fill("unreached"));
    }
  });
}

for (const extra of [{ attempts: 0 }, { attempts: 21 }, { attempts: NaN }, { elapsedMs: 2000 }, { elapsedMs: Infinity },
  { elapsedMs: -1 }, { elapsedMs: Number.MAX_VALUE }, { firstErrorCode: "PRIVATE_OS_CODE" },
  { path: "private/name" }, { identity: [1, 2] }, { contents: "private bytes" }, { pid: 123 }, { stack: "private stack" },
  { message: "private exception" }, { status: "skipped" }, { attempts: 1, [Symbol("private")]: "private" }]) {
  test(`invalid/private move evidence is rejected: ${Object.keys(extra).join(",")}`, async () => {
    const evidence = createRuntimeSourceMoveEvidence();
    await assert.rejects(evidence.run("disconnect", async () => ({ ...verifiedMove(), ...extra }), async () => {}), { code: "invalid_evidence" });
    const json = JSON.stringify(evidence.snapshot());
    assert.equal(json.includes("private"), false);
    assert.equal(evidence.snapshot()[0].status, "failed");
    assert.ok(Buffer.byteLength(json) < 2048);
  });
}

test("unreached, out-of-order, repeated and concurrent operations cannot complete the ledger", async () => {
  const evidence = createRuntimeSourceMoveEvidence();
  const initial = evidence.snapshot();
  initial[0].status = "passed";
  assert.equal(evidence.snapshot()[0].status, "unreached", "Snapshots must not allow forged success");
  assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
  const never = async () => assert.fail("Unordered operation must not execute");
  await assert.rejects(evidence.run("restore", never, never), { code: "invalid_state" });
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const pending = evidence.run("disconnect", async () => { entered(); await gate; return verifiedMove(); }, async () => {});
  await ready;
  assert.equal(evidence.snapshot()[0].status, "running");
  assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
  await assert.rejects(evidence.run("disconnect", never, never), { code: "invalid_state" });
  release(); await pending;
  await assert.rejects(evidence.run("disconnect", never, never), { code: "invalid_state" });
  assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
  for (const direction of ["restore", "disconnect", "restore"]) await evidence.run(direction, async () => verifiedMove(), async () => {});
  evidence.assertComplete();
  await assert.rejects(evidence.run("disconnect", never, never), { code: "invalid_state" });
  assert.equal(evidence.snapshot().length, 4);
});

for (const failure of ["missing_effects", "attempts_exhausted", "deadline_exhausted", "incomplete_verification", "unsafe_destination"]) {
  test(`actual ${failure} is saved before propagation without promotion`, async (t) => {
    const f = await fixture(t), times = clock(), evidence = createRuntimeSourceMoveEvidence();
    const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async (from, to) => {
      if (failure === "attempts_exhausted") throw osError();
      if (failure === "missing_effects") return;
      if (failure === "deadline_exhausted") { await rename(from, to); times.advance(2100); return; }
      await rename(from, to);
      // The destination becomes unsafe before effect inventory completes.
      const held = join(f.ownedFixture, "held");
      await rename(to, held); await symlink(held, to, process.platform === "win32" ? "junction" : "dir");
    } });
    if (failure === "incomplete_verification") await writeFile(join(f.source, "sentinel"), "Changed before verification");
    const persisted = [];
    await assert.rejects(evidence.run("disconnect", helper, async () => persisted.push(evidence.snapshot())), error => {
      assert.equal(persisted.length, 1);
      assert.equal(persisted[0][0].status, "failed");
      assert.equal(persisted[0][0].finalCode, error.code);
      assert.deepEqual(persisted[0][0].attempts, error.fixtureMove.attempts);
      return true;
    });
    if (failure === "deadline_exhausted") {
      assert.equal(persisted[0][0].sourceAbsent, true);
      assert.equal(persisted[0][0].contentsMatch, true);
      assert.equal(persisted[0][0].elapsedMs, 2100);
    }
    if (failure === "attempts_exhausted") {
      assert.equal(persisted[0][0].attempts, 20); assert.equal(persisted[0][0].firstErrorCode, "EPERM");
    }
    if (failure === "incomplete_verification") {
      assert.equal(persisted[0][0].verificationComplete, false); assert.equal(persisted[0][0].attempts, 0);
    }
    assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
    await assert.rejects(evidence.run("restore", helper, async () => {}), { code: "invalid_state" });
    assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
    assert.ok(Buffer.byteLength(JSON.stringify(persisted)) < 2048);
  });
}

test("evidence write failure is awaited, cannot mask a move failure, and cannot pass a successful move", async (t) => {
  for (const moveFails of [true, false]) {
    const f = await fixture(t), evidence = createRuntimeSourceMoveEvidence();
    const helper = await createRuntimeSourceDisconnect(f, { ...clock(), rename: moveFails ? async () => {} : rename });
    let primary, recorded = false;
    const move = async direction => { try { return await helper(direction); } catch (error) { primary = error; throw error; } };
    const writeFailure = new Error("Evidence unavailable");
    await assert.rejects(evidence.run("disconnect", move, async () => { await Promise.resolve(); recorded = true; throw writeFailure; }), error => {
      assert.equal(recorded, true);
      if (primary) return error === primary;
      assert.equal(error.code, "evidence_failed"); assert.equal(error.message.includes(writeFailure.message), false); return true;
    });
    assert.equal(evidence.snapshot()[0].status, "failed");
    assert.equal(evidence.snapshot()[0].finalCode, moveFails ? "missing_effects" : "evidence_failed");
    assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
  }
});

test("actual runtime state assertions verify SQLite/Text, identities, bytes and isolation in both cycles", async (t) => {
  const { openSettingsService } = await import("../dist/service/settings.mjs");
  const f = await fixture(t), projectRoot = f.source, otherRoot = join(f.ownedFixture, "unrelated");
  const externalRoot = join(f.ownedFixture, "external");
  await mkdir(externalRoot); await writeFile(join(externalRoot, "keep"), "External target bytes");
  await mkdir(join(projectRoot, "Retained")); await writeFile(join(projectRoot, "Retained", "keep"), "Excluded project bytes");
  await symlink(externalRoot, join(projectRoot, "link"), process.platform === "win32" ? "junction" : "dir");
  const service = openSettingsService(join(f.ownedFixture, "workspace.sqlite"));
  t.after(() => service.close());
  const command = input => { const result = service.handleCommand(input); assert.equal(result.ok, true); return result.value; };
  const query = input => { const result = service.handleQuery(input); assert.equal(result.ok, true); return result.value; };
  const create = (rootPath, name) => command({ type: "workspace.create", rootPath, name });
  const first = create(projectRoot, "First"), sibling = create(projectRoot, "Sibling"), other = create(otherRoot, "Other");
  command({ type: "workspace.reorder", workspaceIds: [other, first, sibling].map(item => item.workspaceId) });
  const preview = query({ type: "workspace.previewDiscovery", workspaceId: first.workspaceId });
  command({ type: "workspace.applyDiscovery", workspaceId: first.workspaceId, previewToken: preview.previewToken });
  const excludedPreview = query({ type: "workspace.previewDiscovery", workspaceId: first.workspaceId, excludedRelativePaths: ["Retained"] });
  command({ type: "workspace.applyDiscovery", workspaceId: first.workspaceId, previewToken: excludedPreview.previewToken });
  const property = command({ type: "workspace.createProperty", workspaceId: first.workspaceId, propertyType: "text", name: "Notes" });
  const savedProjects = query({ type: "workspace.listProjects", workspaceId: first.workspaceId });
  assert.equal(savedProjects.retainedProjects.length, 1);
  command({ type: "workspace.setTextValue", workspaceId: first.workspaceId, projectId: savedProjects.projects[0].projectId,
    propertyId: property.propertyId, value: "  日本語\nRetained Text\t  " });
  command({ type: "workspace.setTextValue", workspaceId: first.workspaceId, projectId: savedProjects.retainedProjects[0].projectId,
    propertyId: property.propertyId, value: "  Excluded project Text\n  " });
  const savedProperties = query({ type: "workspace.listTextProperties", workspaceId: first.workspaceId });
  const otherProperties = query({ type: "workspace.listTextProperties", workspaceId: other.workspaceId });
  const otherProjectsBeforeDisconnect = query({ type: "workspace.listProjects", workspaceId: other.workspaceId });
  const folderSource = runtime.slice(runtime.indexOf("async function folderBytes("), runtime.indexOf("const discoveryLabels ="));
  const folderBytes = new Function("join", "lstat", "readdir", "readlink", "readFile", `${folderSource}\nreturn folderBytes;`)(join, lstat, readdir, readlink, readFile);
  const originalBytes = await folderBytes(projectRoot), otherBytes = await folderBytes(otherRoot), externalBytes = await folderBytes(externalRoot);
  const stateSource = runtime.slice(runtime.indexOf("  async function assertSourceState("), runtime.indexOf('  await moveSelectedSource("disconnect");'));
  const projectionSource = runtime.slice(runtime.indexOf("function assertProjection("), runtime.indexOf("async function properties("));
  const assertProjection = new Function("assert", `${projectionSource}\nreturn assertProjection;`)(assert);
  const identity = ({ workspaceId, sourceId, viewId }) => ({ workspaceId, sourceId, viewId });
  let mutate = () => {};
  const load = async () => { const snapshot = query({ type: "workspace.load" }); mutate(snapshot); return snapshot; };
  const projects = async (_page, workspaceId) => query({ type: "workspace.listProjects", workspaceId });
  const properties = async (_page, workspaceId) => query({ type: "workspace.listTextProperties", workspaceId });
  const select = async (_page, workspace) => command({ type: "workspace.activate", workspaceId: workspace.workspaceId });
  const dependencies = { load, select, page: {}, assert, assertProjection, identity, other, first, sibling, projects, savedProjects, properties,
    savedProperties, otherProjectsBeforeDisconnect, otherProperties, folderBytes, join, fixture: f.ownedFixture, projectRoot,
    originalBytes, otherRoot, otherBytes, externalRoot, externalBytes };
  const verify = new Function("dependencies", `const { ${Object.keys(dependencies).join(", ")} } = dependencies;\n${stateSource}\nreturn assertSourceState;`)(dependencies);
  const evidence = createRuntimeSourceMoveEvidence(), helper = await createRuntimeSourceDisconnect(f, clock());
  const events = [], stop = service.workspaces.subscribe(event => { if (event.type === "workspace.sourceChanged") events.push(event); });
  for (const cycle of [0, 1]) {
    if (cycle === 1) stop();
    for (const direction of ["disconnect", "restore"]) {
      await evidence.run(direction, helper, async () => {});
      command({ type: "workspace.refreshSource", workspaceId: first.workspaceId });
      await verify(direction === "disconnect");
      assert.equal(events.length, cycle === 0 ? (direction === "disconnect" ? 1 : 2) : 2);
    }
  }
  evidence.assertComplete();
  assert.deepEqual(events.map(event => event.source.sourceAvailable), [false, true]);
  assert.ok(events.every(event => event.source.sourceId === first.sourceId &&
    JSON.stringify(event.source.workspaceIds) === JSON.stringify([first.workspaceId, sibling.workspaceId])));
  mutate = snapshot => { snapshot.activeWorkspace.viewId = "substituted-view"; };
  await assert.rejects(verify(false), { name: "AssertionError" });
  mutate = () => {};
  await writeFile(join(externalRoot, "keep"), "Changed external bytes");
  await assert.rejects(verify(false), { name: "AssertionError" });
});

test("private accessor fields and non-observation values cannot enter evidence", async () => {
  const accessor = verifiedMove();
  Object.defineProperty(accessor, "firstErrorCode", { get: () => assert.fail("Private accessor must never execute") });
  for (const value of [undefined, null, false, 42, "skipped", { status: "unreached" }, accessor]) {
    const evidence = createRuntimeSourceMoveEvidence();
    await assert.rejects(evidence.run("disconnect", async () => value, async () => {}), { code: "invalid_evidence" });
    assert.equal(evidence.snapshot()[0].status, "failed");
  }
  const evidence = createRuntimeSourceMoveEvidence();
  const primary = Object.assign(new Error("private exception"), { fixtureMove: { ...verifiedMove(), path: "private path" } });
  await assert.rejects(evidence.run("disconnect", async () => { throw primary; }, async () => {}), error => error === primary);
  assert.equal(evidence.snapshot()[0].finalCode, "invalid_evidence");
  assert.equal(JSON.stringify(evidence.snapshot()).includes("private"), false);
});

test("a final move cannot complete the scenario while evidence persistence is pending", async () => {
  const evidence = createRuntimeSourceMoveEvidence();
  for (const direction of ["disconnect", "restore", "disconnect"]) await evidence.run(direction, async () => verifiedMove(), async () => {});
  let release, entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const pending = evidence.run("restore", async () => verifiedMove(), async () => { entered(); await gate; throw new Error("Write failed"); });
  await ready;
  assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
  release(); await assert.rejects(pending, { code: "evidence_failed" });
  assert.equal(evidence.snapshot()[3].status, "failed");
  assert.throws(() => evidence.assertComplete(), { code: "incomplete_moves" });
});

test("actual runtime evidence writer saves bounded failure outcomes and rejects unreached success", async (t) => {
  const f = await fixture(t), sourceMoves = createRuntimeSourceMoveEvidence();
  const writerSource = runtime.slice(runtime.indexOf("async function recordEvidence("), runtime.indexOf("async function projects("));
  const dependencies = { sourceMoves, evidenceDirectory: f.ownedFixture, writeFile, join, mode: "dev", process,
    executablePath: "test", stages: {}, shutdowns: [], fixtureCleanup: undefined, observations: [] };
  const recordEvidence = new Function("dependencies", `const { ${Object.keys(dependencies).join(", ")} } = dependencies;\n${writerSource}\nreturn recordEvidence;`)(dependencies);
  await assert.rejects(recordEvidence("passed"), { code: "incomplete_moves" });
  await assert.rejects(lstat(join(f.ownedFixture, "dev-observations.json")), { code: "ENOENT" });
  const helper = await createRuntimeSourceDisconnect(f, { rename: async () => {} });
  await assert.rejects(sourceMoves.run("disconnect", helper, () => recordEvidence("failed")), { code: "missing_effects" });
  const persisted = JSON.parse(await readFile(join(f.ownedFixture, "dev-observations.json"), "utf8"));
  assert.equal(persisted.status, "failed");
  assert.deepEqual(persisted.sourceMoves, sourceMoves.snapshot());
  assert.deepEqual(persisted.sourceMoves.map(outcome => outcome.status), ["failed", "unreached", "unreached", "unreached"]);
  assert.equal(persisted.sourceMoves[0].verificationComplete, true);
  assert.equal(persisted.sourceMoves[0].sourceAbsent, false);
  assert.ok(Buffer.byteLength(JSON.stringify(persisted.sourceMoves, null, 2)) < 4096);
  assert.equal(JSON.stringify(persisted.sourceMoves).includes(f.ownedFixture), false);
  await unchanged(f);
});

const holderScript = fileURLToPath(new URL("./fixtures/runtime-source-disconnect-holder.ps1", import.meta.url));
const holderReady = "WORKSPACE_RUNTIME_SOURCE_LOCKED";
const holderCompleted = { version: 1, stage: "completed", opened: true, released: true };

function assertHolderExit(result) {
  assert.equal(result.status, "completed", "holder must exit normally within its bounds");
  assert.equal(result.termination, "confirmed", "holder exit must be independently observed");
  assert.equal(result.exitCode, 0);
  assert.ok(Buffer.byteLength(result.stdout) <= 4096);
  assert.deepEqual(JSON.parse(result.stdout), holderCompleted, "readiness alone cannot prove release");
}

async function removeSharingFixture(f, state, remove = rm) {
  assert.equal(state.processesStopped, true, "unverified holder exit forbids fixture removal");
  assert.equal(state.movePending, false, "an in-flight move forbids fixture removal");
  await remove(f.ownedFixture, { recursive: true, force: true });
  await assert.rejects(lstat(f.ownedFixture), { code: "ENOENT" }, "cleanup must actually remove the fixture");
}

async function sharingFixture(t) {
  const f = await fixture(t, { autoCleanup: false });
  // Match the holder's canonical immediate-child-of-temp boundary. OS temp
  // aliases outside this generated tree are not caller-selected fixture aliases.
  f.ownedFixture = await realpath(f.ownedFixture);
  f.source = join(f.ownedFixture, f.sourceName);
  f.disconnected = join(f.ownedFixture, "temporarily-disconnected");
  const state = { processesStopped: true, movePending: false };
  t.after(() => removeSharingFixture(f, state));
  return { f, state };
}

// Reuse the historical bounded runner, not its single-attempt worker/holder:
// that holder targets a category under another fixture layout. This handshake
// holds the runtime's fixed descendant until real Node rename has rejected.
async function heldSourceControl(f, state, mode, { runProcess = runBoundedProcess, dependencies = {} } = {}) {
  let ready = false, blocked = 0, movePending, holderPending, blockedSignal;
  const firstBlocked = new Promise(resolve => { blockedSignal = resolve; });
  const move = dependencies.rename ?? rename;
  const helper = await createRuntimeSourceDisconnect(f, { ...dependencies, rename: async (from, to) => {
    try { await move(from, to); }
    catch (error) {
      assert.equal(error.code, "EPERM", "the real blocked Node operation must report EPERM");
      assert.equal(error.syscall, "rename");
      blocked++;
      blockedSignal();
      if (mode === "release") {
        // Await the explicit release response and process exit before allowing
        // retry. No sleep is used to infer handle readiness or release.
        assertHolderExit(await holderPending);
      }
      throw error;
    }
  } });
  state.processesStopped = false;
  holderPending = runProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", holderScript], {
    timeoutMs: 10000, maxBytes: 4096, readyMarker: holderReady, readyInput: "release\n", waitForReadyCallback: true,
    env: { ...process.env, WORKSPACE_RUNTIME_HOLDER_FIXTURE: f.ownedFixture },
    onReady: async () => {
      assert.equal(ready, false); ready = true; state.movePending = true;
      movePending = helper("disconnect").then(result => ({ result }), error => ({ error }))
        .finally(() => { state.movePending = false; });
      if (mode === "persistent") await movePending;
      else await Promise.race([firstBlocked, movePending.then(() => { throw new Error("No blocked rename was observed"); })]);
    },
  });
  const holder = await holderPending;
  state.processesStopped = ["confirmed", "not_started"].includes(holder.termination);
  // Even timeout/early-exit cases await any started Node move to settlement.
  // No race against cleanup, cancellation claim, replay or rollback.
  const outcome = await movePending;
  assert.equal(ready, true, "holder must establish actual readiness");
  assertHolderExit(holder);
  assert.ok(blocked >= 1, "at least one actual Node rename must be blocked");
  if (mode === "release") {
    assert.equal(outcome.error, undefined, "release must permit a subsequent actual move");
    assert.ok(outcome.result.attempts >= 2 && outcome.result.attempts <= 20);
    assert.equal(outcome.result.firstErrorCode, "EPERM");
    for (const key of ["sourceAbsent", "destinationIdentityMatches", "contentsMatch", "verificationComplete"]) assert.equal(outcome.result[key], true);
    assert.ok(outcome.result.elapsedMs < 2000);
  } else {
    assert.ok(["attempts_exhausted", "deadline_exhausted"].includes(outcome.error?.code));
    const observation = outcome.error.fixtureMove;
    assert.equal(observation.firstErrorCode, "EPERM");
    assert.equal(observation.attempts, blocked);
    assert.ok(observation.attempts >= 1 && observation.attempts <= 20);
    if (outcome.error.code === "attempts_exhausted") assert.equal(observation.attempts, 20);
    else assert.ok(observation.elapsedMs >= 2000);
    assert.equal(observation.sourceAbsent, false);
    assert.equal(observation.destinationIdentityMatches, false);
    assert.equal(observation.contentsMatch, false);
    assert.equal(observation.verificationComplete, true);
    await unchanged(f);
  }
  return { helper, outcome, blocked };
}

const completedHolderProcess = (extra = {}) => ({ status: "completed", termination: "confirmed", exitCode: 0,
  stdout: JSON.stringify(holderCompleted), ...extra });
const blockedRename = () => Object.assign(osError(), { syscall: "rename" });

for (const mode of ["release", "persistent"]) test(`portable ${mode} holder orchestration exercises the real shared helper`, async (t) => {
  const { f, state } = await sharingFixture(t);
  const times = clock(); let held = true, calls = 0;
  const control = await heldSourceControl(f, state, mode, {
    dependencies: { ...times, platform: "win32", rename: async (from, to) => {
      calls++;
      if (held) throw blockedRename();
      await rename(from, to);
    } },
    runProcess: async (program, args, options) => {
      assert.equal(program, "powershell.exe"); assert.equal(args.at(-1), holderScript);
      assert.equal(options.timeoutMs, 10000); assert.equal(options.maxBytes, 4096);
      assert.equal(options.readyMarker, holderReady); assert.equal(options.readyInput, "release\n");
      assert.equal(options.waitForReadyCallback, true);
      await options.onReady();
      assert.ok(calls >= 1, "release cannot precede blocking");
      if (mode === "persistent") assert.equal(calls, 20, "persistent holder survives helper exhaustion");
      held = false;
      return completedHolderProcess();
    },
  });
  assert.equal(state.movePending, false); assert.equal(state.processesStopped, true);
  if (mode === "release") { assert.equal(control.blocked, 1); await control.helper("restore"); }
  await unchanged(f);
});

for (const fault of ["readiness", "release", "timeout", "termination", "no-block", "wrong-code"]) {
  test(`holder control fails closed for missing ${fault} evidence`, async (t) => {
    const { f, state } = await sharingFixture(t);
    let held = true;
    await assert.rejects(heldSourceControl(f, state, "release", {
      dependencies: { ...clock(), platform: "win32", rename: async (from, to) => {
        if (fault === "no-block" || !held) { await rename(from, to); return; }
        if (fault === "wrong-code") throw Object.assign(osError("EACCES"), { syscall: "rename" });
        throw blockedRename();
      } },
      runProcess: async (_program, _args, options) => {
        if (fault === "readiness") return completedHolderProcess();
        try { await options.onReady(); } catch { return completedHolderProcess({ status: "process_error" }); }
        held = false;
        if (fault === "release") return completedHolderProcess({ stdout: JSON.stringify({ ...holderCompleted, released: false }) });
        if (fault === "timeout") return completedHolderProcess({ status: "timeout", exitCode: null });
        if (fault === "termination") return completedHolderProcess({ termination: "unknown" });
        return completedHolderProcess();
      },
    }));
    assert.equal(state.movePending, false);
    if (fault === "termination") {
      assert.equal(state.processesStopped, false);
      let removes = 0;
      await assert.rejects(removeSharingFixture(f, state, async () => { removes++; }));
      assert.equal(removes, 0);
      // This portable test never spawned a holder. Reset only that simulated
      // unknown state so its exclusively owned fixture can be removed.
      state.processesStopped = true;
    }
    assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
  });
}

test("sharing teardown rejects missing cleanup effects and unsettled moves", async (t) => {
  const { f, state } = await sharingFixture(t);
  await assert.rejects(removeSharingFixture(f, state, async () => {}));
  state.movePending = true;
  let removes = 0;
  await assert.rejects(removeSharingFixture(f, state, async () => { removes++; }));
  assert.equal(removes, 0); state.movePending = false;
  await unchanged(f);
});

test("holder timeout awaits a late actual move before allowing fixture cleanup", async (t) => {
  const { f, state } = await sharingFixture(t), times = clock();
  let enterMove, finishMove, readiness;
  const entered = new Promise(resolve => { enterMove = resolve; });
  const finish = new Promise(resolve => { finishMove = resolve; });
  let settled = false;
  const pending = heldSourceControl(f, state, "release", {
    dependencies: { ...times, platform: "win32", rename: async (from, to) => {
      enterMove(); await finish; times.advance(2100); await rename(from, to);
    } },
    runProcess: async (_program, _args, options) => {
      readiness = options.onReady().catch(() => undefined);
      await entered;
      return completedHolderProcess({ status: "timeout", exitCode: null });
    },
  }).finally(() => { settled = true; });
  // Attach the rejection observer before releasing the controlled operation.
  const rejected = assert.rejects(pending);
  await entered; await nextTurn();
  assert.equal(state.processesStopped, true); assert.equal(state.movePending, true); assert.equal(settled, false);
  await assert.rejects(removeSharingFixture(f, state));
  finishMove(); await rejected; await readiness;
  assert.equal(state.movePending, false); assert.equal(settled, true);
  await assert.rejects(lstat(f.source), { code: "ENOENT" });
  assert.equal(await readFile(join(f.disconnected, "sentinel"), "utf8"), "Exact fixture bytes");
  assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
});

test("actual bounded subprocess handshake confirms readiness, release and exit without sleeps", async () => {
  let ready = 0, child;
  const program = `process.stdout.write(${JSON.stringify(holderReady + "\n")});
    process.stdin.once('data', data => {
      if (data.toString() !== 'release\\n') process.exit(1);
      process.stdout.write(${JSON.stringify(JSON.stringify(holderCompleted))});
      process.stdin.destroy();
    });`;
  const result = await runBoundedProcess(process.execPath, ["-e", program], {
    timeoutMs: 5000, maxBytes: 4096, readyMarker: holderReady, readyInput: "release\n", waitForReadyCallback: true,
    spawnProcess: (...args) => { child = spawn(...args); return child; },
    onReady: async () => { ready++; assert.equal(child.exitCode, null); },
  });
  assert.equal(ready, 1); assertHolderExit(result);
  assert.equal(child.exitCode, 0);
  assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
});

for (const fault of ["no-ready", "no-release", "output-limit"]) test(`actual holder subprocess ${fault} cannot pass or outlive cleanup`, async (t) => {
  const { f, state } = await sharingFixture(t);
  let child, ready = 0;
  const program = fault === "output-limit" ? "process.stdout.write('x'.repeat(8192)); setInterval(() => {}, 1000);" :
    `${fault === "no-release" ? `process.stdout.write(${JSON.stringify(holderReady + "\n")});` : ""} setInterval(() => {}, 1000);`;
  state.processesStopped = false;
  const result = await runBoundedProcess(process.execPath, ["-e", program], {
    timeoutMs: 5000, maxBytes: 4096, readyMarker: holderReady, readyInput: "release\n", waitForReadyCallback: true,
    spawnProcess: (...args) => { child = spawn(...args); return child; },
    onReady: async () => { ready++; await new Promise(() => {}); },
  });
  state.processesStopped = result.termination === "confirmed";
  assert.equal(result.status, fault === "output-limit" ? "output_limit" : "timeout");
  assert.equal(ready, fault === "no-release" ? 1 : 0);
  assert.throws(() => assertHolderExit(result));
  assert.equal(result.stdout, ""); assert.equal(result.termination, "confirmed");
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
  await unchanged(f);
});

for (const mode of ["release", "persistent"]) test(`actual Windows selected-root ${mode} sharing control`, {
  skip: process.platform !== "win32", timeout: 20000,
}, async (t) => {
  const { f, state } = await sharingFixture(t);
  const before = await lstat(f.source, { bigint: true });
  const control = await heldSourceControl(f, state, mode);
  const location = mode === "release" ? f.disconnected : f.source;
  const after = await lstat(location, { bigint: true });
  assert.deepEqual([after.dev, after.ino, after.birthtimeNs], [before.dev, before.ino, before.birthtimeNs]);
  assert.equal(await readFile(join(location, "sentinel"), "utf8"), "Exact fixture bytes");
  assert.deepEqual(await readFile(join(location, "nested", "binary")), Buffer.from([0, 255, 1, 0, 128]));
  if (mode === "release") await control.helper("restore");
  await unchanged(f);
});

test("actual Windows no-holder selected-root positive control", { skip: process.platform !== "win32" }, async (t) => {
  const { f } = await sharingFixture(t);
  const helper = await createRuntimeSourceDisconnect(f);
  for (const direction of ["disconnect", "restore"]) {
    const result = await helper(direction);
    assert.equal(result.attempts, 1); assert.equal(result.firstErrorCode, null);
    assert.ok(result.sourceAbsent && result.destinationIdentityMatches && result.contentsMatch && result.verificationComplete);
  }
  await unchanged(f);
});

test("actual Windows runtime holder rejects foreign paths, aliases, reparses, file kinds and occupied destinations", {
  skip: process.platform !== "win32",
}, async (t) => {
  for (const fault of ["foreign", "argument", "dot-alias", "ancestor-alias", "source-link", "child-link", "child-file", "occupied", "dangling-destination"]) {
    await t.test(fault, async (t) => {
      const { f, state } = await sharingFixture(t);
      let root = f.ownedFixture;
      if (fault === "foreign") root = join(f.ownedFixture, "unrelated");
      if (fault === "dot-alias") root += "\\.";
      if (fault === "ancestor-alias") {
        await symlink(dirname(f.ownedFixture), join(f.ownedFixture, "alias"), "junction");
        root = join(f.ownedFixture, "alias", basename(f.ownedFixture));
      }
      if (fault === "source-link") {
        await rename(f.source, join(f.ownedFixture, "held-source"));
        await symlink(join(f.ownedFixture, "held-source"), f.source, "junction");
      }
      if (fault === "child-link" || fault === "child-file") {
        await rename(join(f.source, "nested"), join(f.source, "held-nested"));
        if (fault === "child-link") await symlink(join(f.source, "held-nested"), join(f.source, "nested"), "junction");
        else await writeFile(join(f.source, "nested"), "File must not be held as a directory");
      }
      if (fault === "occupied") {
        await mkdir(f.disconnected); await writeFile(join(f.disconnected, "sentinel"), "Occupied bytes");
      }
      if (fault === "dangling-destination") await symlink(join(f.ownedFixture, "absent"), f.disconnected, "junction");
      let ready = 0;
      state.processesStopped = false;
      const result = await runBoundedProcess("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", holderScript,
        ...(fault === "argument" ? [f.source] : [])], {
        timeoutMs: 10000, maxBytes: 4096, readyMarker: holderReady, readyInput: "release\n", waitForReadyCallback: true,
        env: { ...process.env, WORKSPACE_RUNTIME_HOLDER_FIXTURE: root }, onReady: async () => { ready++; },
      });
      state.processesStopped = result.termination === "confirmed";
      assert.equal(result.termination, "confirmed"); assert.equal(result.status, "process_error"); assert.equal(result.exitCode, 1);
      assert.equal(ready, 0);
      assert.deepEqual(JSON.parse(result.stdout), { version: 1, stage: "input", opened: false, released: false });
      const retained = fault === "source-link" ? join(f.ownedFixture, "held-source") : f.source;
      assert.equal(await readFile(join(retained, "sentinel"), "utf8"), "Exact fixture bytes");
      const nested = ["child-link", "child-file"].includes(fault) ? "held-nested" : "nested";
      assert.deepEqual(await readFile(join(retained, nested, "binary")), Buffer.from([0, 255, 1, 0, 128]));
      assert.equal(await readFile(join(f.ownedFixture, "unrelated", "sentinel"), "utf8"), "Unrelated bytes");
      if (fault === "occupied") assert.equal(await readFile(join(f.disconnected, "sentinel"), "utf8"), "Occupied bytes");
      else if (fault === "dangling-destination") assert.equal((await lstat(f.disconnected)).isSymbolicLink(), true);
      else await assert.rejects(lstat(f.disconnected), { code: "ENOENT" });
    });
  }
});
