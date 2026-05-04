import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("renderer is built with React and TypeScript through Vite", async () => {
  const [packageSource, viteConfig, tsconfig, indexHtml, mainTsx, appTsx, styles, mainSource] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("vite.config.ts"),
    readProjectFile("tsconfig.json"),
    readProjectFile("index.html"),
    readProjectFile("src/renderer/main.tsx"),
    readProjectFile("src/renderer/App.tsx"),
    readProjectFile("src/renderer/renderer.css"),
    readProjectFile("electron/main.js"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(packageJson.scripts["build:renderer"], "vite build");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts.electron, "npm run build:sidecar && npm run build:renderer && electron electron/main.js");
  assert.equal(packageJson.dependencies.react.startsWith("^"), true);
  assert.equal(packageJson.dependencies["react-dom"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies.typescript.startsWith("^"), true);
  assert.equal(packageJson.devDependencies.vite.startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@vitejs/plugin-react"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@types/react"].startsWith("^"), true);
  assert.equal(packageJson.devDependencies["@types/react-dom"].startsWith("^"), true);
  assert.deepEqual(packageJson.build.files, [
    "dist/renderer/**/*",
    "electron/**/*",
    "src/**/*",
    "THIRD_PARTY_NOTICES.md",
  ]);

  assert.match(viteConfig, /@vitejs\/plugin-react/);
  assert.match(viteConfig, /outDir:\s*"dist\/renderer"/);
  assert.match(viteConfig, /base:\s*"\.\/"/);
  assert.match(tsconfig, /"jsx":\s*"react-jsx"/);
  assert.match(tsconfig, /"strict":\s*true/);
  assert.match(indexHtml, /<div id="root"><\/div>/);
  assert.match(indexHtml, /src="\/src\/renderer\/main\.tsx"/);
  assert.match(mainTsx, /createRoot/);
  assert.match(mainTsx, /<App \/>/);
  assert.match(appTsx, /type Workspace/);
  assert.match(appTsx, /function App\(\)/);
  assert.match(appTsx, /onContextMenu/);
  assert.match(appTsx, /onDragStart/);
  assert.match(appTsx, /onDrop/);
  assert.match(styles, /--codex-sidebar:\s*#eaf1fb/);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
});
