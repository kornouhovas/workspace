import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("workspace keeps backend and sidecar runtime without interface layer", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(packageJson.name, "workspace");
  assert.equal(packageJson.main, undefined);
  assert.equal(packageJson.scripts.dev, undefined);
  assert.equal(packageJson.scripts.preview, undefined);
  assert.equal(packageJson.scripts.electron, undefined);
  assert.equal(packageJson.scripts["build:renderer"], undefined);
  assert.equal(packageJson.scripts.typecheck, undefined);
  assert.equal(packageJson.scripts["build:sidecar"], "go build -o workspace-sidecar ./cmd/workspace-sidecar");
  assert.equal(packageJson.scripts["build:sidecar:mac"].includes("GOOS=darwin GOARCH=arm64"), true);
  assert.equal(packageJson.scripts["build:sidecar:win"].includes("GOOS=windows GOARCH=amd64"), true);
  assert.equal(packageJson.scripts["prepare:electron:mac"], undefined);
  assert.equal(packageJson.scripts["dist:mac"], undefined);
  assert.equal(packageJson.scripts["dist:win"], undefined);
  assert.equal(packageJson.scripts["dist:all"], undefined);
  assert.equal(packageJson.devDependencies?.electron, undefined);
  assert.equal(packageJson.devDependencies?.["electron-builder"], undefined);
  assert.equal(packageJson.devDependencies?.vite, undefined);
  assert.equal(packageJson.devDependencies?.["@vitejs/plugin-react"], undefined);
  assert.equal(packageJson.dependencies?.react, undefined);
  assert.equal(packageJson.dependencies?.["react-dom"], undefined);
  assert.equal(packageJson.dependencies?.shadcn, undefined);
  assert.equal(packageJson.build, undefined);
  assert.equal(readme.includes("npm run electron"), false);
  assert.equal(readme.includes("npm run dev"), false);
  assert.equal(readme.includes("npm run build:renderer"), false);
  assert.match(readme, /Interface layer, Electron shell и web renderer удалены/);
  await access(new URL("../src/workspaceSidecarClient.js", import.meta.url));
  await assert.rejects(access(new URL("../index.html", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../components.json", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../vite.config.ts", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../src/renderer/App.tsx", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../electron/main.js", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../electron/preload.cjs", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../referens/index.html", import.meta.url)), { code: "ENOENT" });
});

test("legacy browser dev server is not shipped", async () => {
  await assert.rejects(access(new URL("../dev-server.js", import.meta.url)), { code: "ENOENT" });
});
