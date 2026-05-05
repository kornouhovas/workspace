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
  assert.match(appTsx, /"square-pen"/);
  assert.match(appTsx, /"panel-left"/);
  assert.match(appTsx, /strokeWidth=\{1\.7\}/);
  assert.match(appTsx, /function App\(\)/);
  assert.match(appTsx, /onContextMenu/);
  assert.match(appTsx, /isSearchFocused/);
  assert.match(appTsx, /placeholder=\{isSearchFocused\s*\?\s*""\s*:\s*"Search"\}/);
  assert.match(appTsx, /onPointerDown/);
  assert.match(appTsx, /onPointerMove/);
  assert.match(appTsx, /getWorkspaceDropIntentAtPoint/);
  const pointerDownBody = appTsx.match(/function handleWorkspacePointerDown[\s\S]*?\n  function handleWorkspacePointerMove/)?.[0] || "";
  const pointerMoveBody = appTsx.match(/function handleWorkspacePointerMove[\s\S]*?\n  function handleWorkspacePointerEnd/)?.[0] || "";
  assert.doesNotMatch(pointerDownBody, /setPointerCapture/);
  assert.match(
    pointerMoveBody,
    /if\s*\(!workspaceListRef\.current\?\.hasPointerCapture\(event\.pointerId\)\)\s*\{[\s\S]*?workspaceListRef\.current\?\.setPointerCapture\(event\.pointerId\)/,
  );
  assert.match(appTsx, /workspaceListRef\.current\?\.releasePointerCapture\(event\.pointerId\)/);
  assert.equal(appTsx.includes('document.querySelectorAll<HTMLElement>("[data-workspace-id]")'), true);
  assert.match(appTsx, /workspaceRowRefs/);
  assert.match(appTsx, /useLayoutEffect/);
  assert.match(appTsx, /\.animate\(\[/);
  assert.match(appTsx, /type\s+WorkspaceDropPlacement\s*=\s*"before"\s*\|\s*"after"/);
  assert.doesNotMatch(appTsx, /onDragStart/);
  assert.doesNotMatch(appTsx, /onDrop/);
  assert.match(styles, /--codex-sidebar-glass:\s*rgba\(20,\s*53,\s*31,\s*0\.7\)/);
  assert.match(styles, /--codex-sidebar-text:\s*#f1f6ee/);
  assert.match(styles, /--codex-font:\s*"OpenAI Sans"/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?height:\s*52px/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?gap:\s*14px/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?padding:\s*0\s+18px\s+0\s+104px/);
  assert.match(styles, /\.window-icon-button\s*\{[\s\S]*?border-radius:\s*var\(--codex-radius-sm\)/);
  assert.match(styles, /\.workspace-row\.is-dragging\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /--codex-surface:\s*#2c2c2c/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /backdrop-filter:\s*blur\(28px\)\s*saturate\(135%\)/);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
});
