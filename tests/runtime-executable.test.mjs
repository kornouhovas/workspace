import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { packagedExecutablePath, runtimeSmokeLaunch } from "../scripts/runtime-executable.mjs";

test("packaged runtime smoke finds electron-builder's default x64 and arm64 output directories", () => {
  const root = join("fixture", "workspace");
  assert.equal(
    packagedExecutablePath(root, "darwin", "x64"),
    join(root, "release", "mac", "Workspace.app", "Contents", "MacOS", "Workspace"),
  );
  assert.equal(
    packagedExecutablePath(root, "darwin", "arm64"),
    join(root, "release", "mac-arm64", "Workspace.app", "Contents", "MacOS", "Workspace"),
  );
  assert.equal(packagedExecutablePath(root, "win32", "x64"), join(root, "release", "win-unpacked", "Workspace.exe"));
});

test("principal UI journeys select the actual package without development arguments", () => {
  const root = join("fixture", "workspace");
  if (["darwin", "win32"].includes(process.platform)) {
    assert.deepEqual(runtimeSmokeLaunch(root, "release"), {
      executablePath: packagedExecutablePath(root, process.platform, process.arch), args: [],
    });
  } else assert.throws(() => runtimeSmokeLaunch(root, "release"), /Unsupported desktop platform/);
  const development = runtimeSmokeLaunch(root, "dev");
  assert.deepEqual(development.args, [root]);
  assert.ok(development.executablePath.includes("Electron") || development.executablePath.includes("electron"));
  assert.throws(() => runtimeSmokeLaunch(root, "relese"), /Unsupported smoke mode/);
});
