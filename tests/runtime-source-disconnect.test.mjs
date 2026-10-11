import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeSourceDisconnect } from "../scripts/runtime-source-disconnect.mjs";

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
  assert.match(runtime, /const moveSelectedSource = await createRuntimeSourceDisconnect\(\{ ownedFixture: fixture, sourceName: basename\(projectRoot\) \}\)/u);
  const calls = runtime.match(/await moveSelectedSource\("(?:disconnect|restore)"\);/gu);
  assert.equal(calls.length, 4);
  const invoke = new (Object.getPrototypeOf(async function () {}).constructor)("moveSelectedSource", calls.join("\n"));
  const f = await fixture(t), times = clock();
  let attempts = 0;
  const results = [];
  const helper = await createRuntimeSourceDisconnect(f, { ...times, platform: "win32", rename: async (from, to) => {
    attempts++;
    if (attempts % 2) throw osError();
    await rename(from, to);
  } });
  await invoke(async (direction) => { results.push([direction, await helper(direction)]); });
  assert.deepEqual(results.map(([direction]) => direction), ["disconnect", "restore", "disconnect", "restore"]);
  assert.equal(attempts, 8);
  for (const [, result] of results) assert.deepEqual(result, { attempts: 2, elapsedMs: 100, firstErrorCode: "EPERM",
    sourceAbsent: true, destinationIdentityMatches: true, contentsMatch: true });
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
      sourceAbsent: false, destinationIdentityMatches: false, contentsMatch: false });
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
