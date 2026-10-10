import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mkdir, writeFile, copyFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";

import { tmpdir } from "node:os";
import { createPackageWithOptions } from "@electron/asar";

const require = createRequire(import.meta.url);
const { verifyAdapter, verifyLoadFailures } = require("./fixtures/project-rename-native-electron.cjs");
const supported = process.platform === "darwin" || process.platform === "win32";
const evidence = { platform: process.platform, arch: process.arch, node: process.versions.node, results: {} };

async function record(name, action) {
  try { const result = await action(); evidence.results[name] = { ok: true, observations: result }; return result; }
  catch (error) { evidence.results[name] = { ok: false }; throw error; }
  finally {
    if (process.env.WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR) {
      const directory = resolve(process.env.WORKSPACE_RENAME_NATIVE_EVIDENCE_DIR);
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, "native-adapter.json"), JSON.stringify(evidence, null, 2) + "\n");
    }
  }
}

test("real Node no-replace adapter preserves identities, bytes, occupied entries and late collisions", { skip: !supported }, async () => {
  await record("node", async () => {
    const adapter = await import("../dist/service/project-rename-filesystem.mjs");
    const observations = verifyAdapter(adapter.renameNoReplace);
    verifyAdapter(require("../dist/service-test-native/project-rename.node").renameNoReplace);
    return observations;
  });
});

test("native adapter fails closed on missing/corrupt binaries and uses only fixed emitted locations", { skip: !supported }, async () => {
  await record("loading", () => verifyLoadFailures(
    fileURLToPath(new URL("../dist/service/project-rename-filesystem.cjs", import.meta.url)),
    fileURLToPath(new URL("../dist/service-test-native/project-rename.node", import.meta.url)), "node"));
});

for (const packaged of [false, true]) test(`actual Electron utilityProcess loads ${packaged ? "ASAR unpacked" : "development"} adapter and verifies disposable no-replace renames`, { skip: !supported, timeout: 30000 }, async () => {
  await record(packaged ? "electron-asar" : "electron", async () => {
    let fixtureRoot;
    let entry = fileURLToPath(new URL("./fixtures/project-rename-native-electron.cjs", import.meta.url));
    if (packaged) {
      fixtureRoot = await mkdtemp(join(tmpdir(), "workspace-native-rename-asar-"));
      const app = join(fixtureRoot, "app");
      for (const file of ["tests/fixtures/project-rename-native-electron.cjs", "dist/service/project-rename-filesystem.cjs", "dist/service/native/project-rename.node"]) {
        const target = join(app, file); await mkdir(dirname(target), { recursive: true });
        await copyFile(fileURLToPath(new URL(`../${file}`, import.meta.url)), target);
      }
      await writeFile(join(app, "package.json"), JSON.stringify({ name: "rename-native-fixture", main: "tests/fixtures/project-rename-native-electron.cjs" }));
      entry = join(fixtureRoot, "app.asar");
      await createPackageWithOptions(app, entry, { unpack: "project-rename.node" });
    }
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_TEST_CONTEXT;
    const child = spawn(require("electron"), [entry],
      { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    const timer = setTimeout(() => child.kill(), 25000);
    try {
      const code = await new Promise((accept, reject) => { child.once("error", reject); child.once("close", accept); });
      const result = stdout.split("\n").filter((line) => line.startsWith("{ ") || line.startsWith("{\"")).map((line) => JSON.parse(line)).at(-1);
      assert.equal(code, 0, `Electron fixture failed (${stderr.slice(-1000)}; ${stdout.slice(-1000)})`);
      assert.equal(result?.ok, true, stdout.slice(-1000));
      assert.equal(result.runtime, "electron"); assert.equal(result.versions.electron, "44.7.0");
      assert.equal(result.scenarios.length, process.platform === "win32" ? 7 : 8);
      return result;
    } finally {
      clearTimeout(timer);
      if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
