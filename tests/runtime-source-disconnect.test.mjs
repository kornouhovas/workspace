import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeSourceDisconnect, createRuntimeSourceMoveEvidence } from "../scripts/runtime-source-disconnect.mjs";

const runtime = await readFile(new URL("../scripts/smoke-runtime.mjs", import.meta.url), "utf8");
const anchor = "await page.evaluate(() => globalThis.stopSmokeChanges());";
const start = runtime.indexOf(anchor) + anchor.length;
assert.ok(start >= anchor.length);
const callSite = runtime.slice(start, runtime.indexOf("await select(page, sibling);", start)).trim();
assert.equal(callSite, 'await moveSelectedSource("disconnect");');
const invokeSecondDisconnect = new (Object.getPrototypeOf(async function () {}).constructor)("moveSelectedSource", callSite);

async function fixture(t) {
  const ownedFixture = await mkdtemp(join(tmpdir(), "workspace-runtime-"));
  t.after(() => rm(ownedFixture, { recursive: true, force: true }));
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
