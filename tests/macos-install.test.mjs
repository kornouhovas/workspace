import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkMacosBundle } from "../scripts/check-macos-bundle.mjs";

const manifest = { CFBundleIdentifier: "dev.workspace.local", CFBundleShortVersionString: "0.1.0", CFBundleVersion: "0.1.0", CFBundleExecutable: "Workspace", LSMinimumSystemVersion: "14.0" };
for (const [key, value] of [[null, null], ["CFBundleShortVersionString", "0.0.9"], ["CFBundleVersion", "0.0.9"], ["LSMinimumSystemVersion", "12.0"], ["CFBundleIdentifier", "dev.other"], ["CFBundleExecutable", "Other"]]) {
  test(`installed macOS manifest ${key ? `rejects incorrect ${key}` : "accepts the selected version and support policy"}`, { skip: process.platform !== "darwin" }, async () => {
    const root = await mkdtemp(join(tmpdir(), "workspace-macos-manifest-"));
    try {
      await mkdir(join(root, "Contents"));
      const path = join(root, "Contents", "Info.plist");
      await writeFile(path, JSON.stringify(key ? { ...manifest, [key]: value } : manifest));
      execFileSync("/usr/bin/plutil", ["-convert", "xml1", path]);
      if (key) assert.throws(() => checkMacosBundle(root, "0.1.0"));
      else assert.equal(checkMacosBundle(root, "0.1.0").CFBundleVersion, "0.1.0");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
