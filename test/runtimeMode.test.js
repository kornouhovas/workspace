import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("workspace keeps shadcn dashboard renderer and sidecar runtime without Electron", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.equal(packageJson.name, "workspace");
  assert.equal(packageJson.main, undefined);
  assert.equal(packageJson.scripts.dev, "vite");
  assert.equal(packageJson.scripts.preview, "vite preview");
  assert.equal(packageJson.scripts.electron, undefined);
  assert.equal(packageJson.scripts["build:renderer"], "vite build");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts["build:sidecar"], "go build -o workspace-sidecar ./cmd/workspace-sidecar");
  assert.equal(packageJson.scripts["build:sidecar:mac"].includes("GOOS=darwin GOARCH=arm64"), true);
  assert.equal(packageJson.scripts["build:sidecar:win"].includes("GOOS=windows GOARCH=amd64"), true);
  assert.equal(packageJson.scripts["prepare:electron:mac"], undefined);
  assert.equal(packageJson.scripts["dist:mac"], undefined);
  assert.equal(packageJson.scripts["dist:win"], undefined);
  assert.equal(packageJson.scripts["dist:all"], undefined);
  assert.equal(packageJson.devDependencies?.electron, undefined);
  assert.equal(packageJson.devDependencies?.["electron-builder"], undefined);
  assert.equal(packageJson.devDependencies?.vite.startsWith("^"), true);
  assert.equal(packageJson.devDependencies?.["@vitejs/plugin-react"].startsWith("^"), true);
  assert.equal(packageJson.dependencies?.react.startsWith("^"), true);
  assert.equal(packageJson.dependencies?.["react-dom"].startsWith("^"), true);
  assert.equal(packageJson.dependencies?.shadcn.startsWith("^"), true);
  assert.equal(packageJson.build, undefined);
  assert.equal(readme.includes("npm run electron"), false);
  assert.match(readme, /dashboard-01/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /npm run build:renderer/);
  await access(new URL("../index.html", import.meta.url));
  await access(new URL("../components.json", import.meta.url));
  await access(new URL("../vite.config.ts", import.meta.url));
  await access(new URL("../src/App.tsx", import.meta.url));
  await access(new URL("../src/components/app-sidebar.tsx", import.meta.url));
  await access(new URL("../src/workspaceSidecarClient.js", import.meta.url));
  await assert.rejects(access(new URL("../src/renderer/App.tsx", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../electron/main.js", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../electron/preload.cjs", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../referens/index.html", import.meta.url)), { code: "ENOENT" });
});

test("legacy browser dev server is not shipped", async () => {
  await assert.rejects(access(new URL("../dev-server.js", import.meta.url)), { code: "ENOENT" });
});
