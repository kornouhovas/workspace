import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Validate the OS-visible manifest as well as the package inside ASAR.
export function checkMacosBundle(appPath, version) {
  const plist = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", join(appPath, "Contents", "Info.plist")], { encoding: "utf8" }));
  assert.equal(plist.CFBundleIdentifier, "dev.workspace.local");
  assert.equal(plist.CFBundleShortVersionString, version, "macOS display version differs from canonical version");
  assert.equal(plist.CFBundleVersion, version, "macOS bundle version differs from canonical version");
  assert.equal(plist.LSMinimumSystemVersion, "14.0", "macOS minimum must match the selected support policy");
  assert.equal(plist.CFBundleExecutable, "Workspace");
  return plist;
}
