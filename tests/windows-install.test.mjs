import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
test("Windows distribution is an offline x64 per-user installer that retains data", () => {
  assert.deepEqual(manifest.build.win.target, [{ target: "nsis", arch: ["x64"] }]);
  assert.equal(manifest.build.win.requestedExecutionLevel, "asInvoker");
  assert.equal(manifest.build.nsis.perMachine, false);
  assert.equal(manifest.build.nsis.allowElevation, false);
  assert.equal(manifest.build.nsis.packElevateHelper, false);
  assert.equal(manifest.build.nsis.deleteAppDataOnUninstall, false);
  assert.equal(manifest.build.nsis.runAfterFinish, false);
});

test("Windows application keeps version resources while explicitly disabling signing", () => {
  assert.equal(manifest.build.win.signAndEditExecutable, true);
  assert.equal(manifest.build.win.signExecutable, false);
  assert.equal(manifest.build.win.forceCodeSigning, false);
});

test("installed Windows version metadata accepts the builder's canonical three/four-part representation", async () => {
  const { checkWindowsVersion } = await import("../scripts/check-windows-version.mjs");
  checkWindowsVersion({ product: "0.1.0.0", file: "0.1.0", name: "Workspace", signature: "NotSigned" }, "0.1.0");
});


for (const [key, value] of [["product", "0.0.9"], ["file", "0.1.0.1"], ["file", "44.7.0"], ["signature", "Valid"], ["name", "Electron"]]) {
  test(`installed Windows metadata rejects mismatched ${key}: ${value}`, async () => {
    const { checkWindowsVersion } = await import("../scripts/check-windows-version.mjs");
    assert.throws(() => checkWindowsVersion({ product: "0.1.0.0", file: "0.1.0", name: "Workspace", signature: "NotSigned", [key]: value }, "0.1.0"));
  });
}
