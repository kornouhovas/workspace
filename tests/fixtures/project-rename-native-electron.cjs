/* global __dirname, __filename, process, setTimeout, clearTimeout */
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync, symlinkSync,
  existsSync, rmSync, copyFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const identity = (path) => {
  const stat = lstatSync(path, { bigint: true });
  return [String(stat.dev), String(stat.ino), String(stat.birthtimeNs)];
};
const rootFor = () => mkdtempSync(join(tmpdir(), "workspace-native-rename-"));

function verifyAdapter(renameNoReplace) {
  const observations = [];
  for (const kind of ["absent", "empty", "nonempty", "file", "link", "late-empty"]) {
    const root = rootFor(), from = join(root, "Исходный 🧪"), to = join(root, "New 日本 🧪");
    try {
      mkdirSync(from); writeFileSync(join(from, "sentinel"), "source bytes\0\n");
      const sourceIdentity = identity(from);
      if (kind === "empty" || kind === "nonempty") mkdirSync(to);
      if (kind === "nonempty") writeFileSync(join(to, "sentinel"), "destination bytes\0\n");
      if (kind === "file") writeFileSync(to, "file bytes\0\n");
      const linkTarget = join(root, "link-target");
      if (kind === "link") {
        mkdirSync(linkTarget); writeFileSync(join(linkTarget, "sentinel"), "link target bytes");
        symlinkSync(linkTarget, to, process.platform === "win32" ? "junction" : "dir");
      }
      // Establish absence first; insert a competing entry immediately before the
      // actual adapter call. There is no injected/mock rename implementation.
      if (kind === "late-empty") { assert.equal(existsSync(to), false); mkdirSync(to); }
      const destinationIdentity = kind === "absent" ? undefined : identity(to);
      const targetIdentity = kind === "link" ? identity(linkTarget) : undefined;
      assert.equal(renameNoReplace(from, to), kind === "absent" ? "renamed" : "occupied", kind);
      if (kind === "absent") {
        assert.equal(existsSync(from), false);
        assert.deepEqual(identity(to), sourceIdentity);
        assert.equal(readFileSync(join(to, "sentinel"), "utf8"), "source bytes\0\n");
        assert.deepEqual(readdirSync(root), ["New 日本 🧪"]);
      } else {
        assert.deepEqual(identity(from), sourceIdentity);
        assert.deepEqual(identity(to), destinationIdentity);
        assert.equal(readFileSync(join(from, "sentinel"), "utf8"), "source bytes\0\n");
        if (kind === "nonempty") assert.equal(readFileSync(join(to, "sentinel"), "utf8"), "destination bytes\0\n");
        if (kind === "file") assert.equal(readFileSync(to, "utf8"), "file bytes\0\n");
        if (kind === "empty" || kind === "late-empty") assert.deepEqual(readdirSync(to), []);
        if (kind === "link") {
          assert.equal(lstatSync(to).isSymbolicLink(), true);
          assert.deepEqual(identity(linkTarget), targetIdentity);
          assert.equal(readFileSync(join(linkTarget, "sentinel"), "utf8"), "link target bytes");
        }
      }
      observations.push({ scenario: kind, outcome: kind === "absent" ? "renamed" : "occupied" });
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const root = rootFor();
  try {
    const from = join(root, "CaseProject"), to = join(root, "caseproject");
    mkdirSync(from); writeFileSync(join(from, "sentinel"), "case bytes");
    const original = identity(from), aliases = existsSync(to);
    const outcome = renameNoReplace(from, to);
    // Actual mounted-filesystem behavior, never inferred from process.platform.
    if (aliases) assert.ok(["occupied", "renamed"].includes(outcome));
    else assert.equal(outcome, "renamed");
    // A self-alias can be a successful no-op or spelling change at the native
    // layer. The future journal/service must choose staging, not infer it here.
    const placement = outcome === "renamed" ? to : from;
    assert.deepEqual(identity(placement), original);
    assert.equal(readFileSync(join(placement, "sentinel"), "utf8"), "case bytes");
    const names = readdirSync(root);
    assert.equal(names.length, 1);
    assert.ok(["CaseProject", "caseproject"].includes(names[0]));
    if (!aliases) assert.deepEqual(names, ["caseproject"]);
    observations.push({ scenario: "case-alias", aliases, outcome });
    if (process.platform !== "win32") {
      const literal = join(root, "colon:back\\slash\n ");
      assert.equal(renameNoReplace(placement, literal), "renamed");
      assert.deepEqual(identity(literal), original);
      assert.equal(readFileSync(join(literal, "sentinel"), "utf8"), "case bytes");
      observations.push({ scenario: "posix-literal", outcome: "renamed" });
    }
    assert.equal(renameNoReplace(join(root, "missing"), join(root, "new")), "source_unavailable");
    for (const args of [[], [from], [from, to, "extra"], [null, to], [42, to], ["", to],
      ["relative", to], [from, "relative"], [from + "\0", to], [from + "\ud800", to], [from, to + "\udc00"]]) {
      assert.equal(renameNoReplace(...args), "invalid_argument");
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
  return observations;
}

function verifyLoadFailures(wrapperFilename, nativeFilename, runtime) {
  const results = [];
  for (const kind of ["missing", "corrupt"]) {
    const root = rootFor();
    try {
      const service = join(root, "service"); mkdirSync(service);
      const copy = join(service, "project-rename-filesystem.cjs"); copyFileSync(wrapperFilename, copy);
      const binaryDirectory = runtime === "electron" ? join(service, "native") : join(root, "service-test-native");
      mkdirSync(binaryDirectory);
      if (kind === "corrupt") writeFileSync(join(binaryDirectory, "project-rename.node"), "not a native module");
      // Unrelated module loading must succeed; only attempted mutation rejects.
      const adapter = require(copy);
      const from = join(root, "from"), to = join(root, "to"); mkdirSync(from);
      writeFileSync(join(from, "sentinel"), "preserved"); const original = identity(from);
      assert.equal(adapter.renameNoReplace(from, to), "native_unavailable");
      assert.deepEqual(identity(from), original); assert.equal(existsSync(to), false);
      assert.equal(readFileSync(join(from, "sentinel"), "utf8"), "preserved");
      results.push({ scenario: kind, outcome: "native_unavailable" });
      delete require.cache[copy];
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  // Verify a valid fixed emitted location works independently of the caller's cwd.
  const root = rootFor();
  try {
    const service = join(root, "service"); mkdirSync(service);
    const copy = join(service, "project-rename-filesystem.cjs"); copyFileSync(wrapperFilename, copy);
    const directory = runtime === "electron" ? join(service, "native") : join(root, "service-test-native");
    mkdirSync(directory); copyFileSync(nativeFilename, join(directory, "project-rename.node"));
    verifyAdapter(require(copy).renameNoReplace); delete require.cache[copy];
    results.push({ scenario: "fixed-location", outcome: "verified" });
  } finally { rmSync(root, { recursive: true, force: true }); }
  return results;
}

module.exports = { verifyAdapter, verifyLoadFailures };

if (process.versions.electron) {
  if (process.type === "utility") {
    process.parentPort.once("message", () => process.exit(process.exitCode ?? 0));
    try {
      const wrapper = join(__dirname, "../../dist/service/project-rename-filesystem.cjs");
      const binary = join(__dirname, "../../dist/service/native/project-rename.node");
      const adapter = require(wrapper);
      const scenarios = verifyAdapter(adapter.renameNoReplace);
      const raw = verifyAdapter(require(binary).renameNoReplace);
      const loading = verifyLoadFailures(wrapper, binary, "electron");
      process.parentPort.postMessage({ ok: true, runtime: "electron", platform: process.platform, arch: process.arch,
        versions: { electron: process.versions.electron, node: process.versions.node, napi: process.versions.napi }, scenarios, raw, loading });
      process.exitCode = 0;
    } catch {
      process.parentPort.postMessage({ ok: false, runtime: "electron", outcome: "fixture_failed" });
      process.exitCode = 1;
    }
  } else {
    const { app, utilityProcess } = require("electron");
    const userData = rootFor(); app.setPath("userData", userData);
    let received = false, child;
    const deadline = setTimeout(() => { if (child) child.kill(); app.exit(1); }, 20000);
    app.whenReady().then(() => {
      child = utilityProcess.fork(__filename, [], { stdio: "pipe", serviceName: "Rename adapter fixture" });
      child.on("message", (result) => { received = result.ok === true; process.stdout.write(JSON.stringify(result) + "\n"); child.postMessage({ received: true }); });
      child.on("exit", (code) => {
        clearTimeout(deadline);
        rmSync(userData, { recursive: true, force: true });
        app.exit(received && code === 0 ? 0 : 1);
      });
    }).catch(() => { clearTimeout(deadline); app.exit(1); });
  }
}
