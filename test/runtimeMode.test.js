import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("workspace runs through Electron only", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.equal(packageJson.name, "workspace");
  assert.equal(packageJson.scripts.dev, undefined);
  assert.equal(packageJson.scripts.electron, "npm run build:sidecar && electron electron/main.js");
  assert.equal(packageJson.scripts["build:sidecar:mac"].includes("GOOS=darwin GOARCH=arm64"), true);
  assert.equal(packageJson.scripts["build:sidecar:win"].includes("GOOS=windows GOARCH=amd64"), true);
  assert.equal(packageJson.scripts["prepare:electron:mac"], "xattr -cr node_modules/electron/dist 2>/dev/null || true");
  assert.equal(
    packageJson.scripts["dist:mac"],
    "npm run build:sidecars && npm run prepare:electron:mac && electron-builder --mac dmg --arm64",
  );
  assert.equal(packageJson.scripts["dist:win"], "npm run build:sidecars && electron-builder --win portable --x64");
  assert.equal(packageJson.build.productName, "Workspace");
  assert.deepEqual(packageJson.build.mac.target, ["dmg"]);
  assert.deepEqual(packageJson.build.win.target, ["portable"]);
  assert.deepEqual(
    packageJson.build.extraResources.map((resource) => resource.to),
    [
      "sidecar/darwin-arm64/workspace-sidecar",
      "sidecar/win32-x64/workspace-sidecar.exe",
    ],
  );
  assert.equal(html.includes("<title>Workspace</title>"), true);
  assert.equal(readme.includes("npm run dev"), false);
  assert.equal(readme.includes("127.0.0.1:4173"), false);
  assert.equal(app.includes("/api/"), false);
  assert.equal(app.includes("fetch("), false);
});

test("legacy browser dev server is not shipped", async () => {
  await assert.rejects(access(new URL("../dev-server.js", import.meta.url)), { code: "ENOENT" });
});
