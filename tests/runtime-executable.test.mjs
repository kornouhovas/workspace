import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { packagedExecutablePath } from "../scripts/runtime-executable.mjs";

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
