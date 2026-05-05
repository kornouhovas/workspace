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
  assert.match(appTsx, /showContextMenu/);
  assert.match(appTsx, /Workspaces/);
  assert.match(appTsx, /isSearchFocused/);
  assert.match(appTsx, /placeholder=\{isSearchFocused\s*\?\s*""\s*:\s*"Search"\}/);
  const addWorkspaceBody = appTsx.match(/function addWorkspace[\s\S]*?\n  function selectWorkspace/)?.[0] || "";
  assert.match(addWorkspaceBody, /name:\s*"Workspace"/);
  assert.doesNotMatch(addWorkspaceBody, /workspaceCounter/);
  const contextMenuBody = appTsx.match(/function openContextMenu[\s\S]*?\n  function renameWorkspace/)?.[0] || "";
  assert.doesNotMatch(contextMenuBody, /selectedWorkspaceId:\s*workspaceId/);
  assert.match(contextMenuBody, /window\.workspace\?\.showContextMenu\?\./);
  assert.doesNotMatch(appTsx, /window\.prompt/);
  assert.doesNotMatch(appTsx, /window\.confirm/);
  assert.match(appTsx, /editingWorkspaceId/);
  assert.match(appTsx, /pendingDeleteWorkspaceId/);
  assert.match(appTsx, /onClick=\{\(\)\s*=>\s*\{[\s\S]*?setPendingDeleteWorkspaceId\(null\)/);
  assert.match(appTsx, /className="workspace-name-input"/);
  assert.match(appTsx, /Confirm/);
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
  assert.match(appTsx, /function\s+cancelWorkspaceRowAnimations\(/);
  const capturePositionsBody = appTsx.match(/function captureWorkspaceRowPositions[\s\S]*?\n  function handleWorkspacePointerDown/)?.[0] || "";
  assert.doesNotMatch(capturePositionsBody, /cancelWorkspaceRowAnimations\(row\)[\s\S]*?getBoundingClientRect/);
  assert.match(capturePositionsBody, /previousWorkspaceRowRectsRef\.current\.set\(workspaceId,\s*row\.getBoundingClientRect\(\)\)/);
  assert.match(appTsx, /cancelWorkspaceRowAnimations\(row\)[\s\S]*?row\.animate\(\[/);
  assert.match(appTsx, /\.animate\(\[/);
  assert.match(appTsx, /type\s+WorkspaceDropPlacement\s*=\s*"before"\s*\|\s*"after"/);
  assert.doesNotMatch(appTsx, /onDragStart/);
  assert.doesNotMatch(appTsx, /onDrop/);
  assert.match(styles, /--codex-sidebar-glass:\s*transparent/);
  assert.doesNotMatch(styles, /--codex-sidebar-glass:\s*rgba\(20,\s*53,\s*31,\s*0\.7\)/);
  assert.doesNotMatch(styles, /--codex-sidebar-glass:\s*rgba\(255,\s*255,\s*255,\s*0\.055\)/);
  assert.doesNotMatch(styles, /--codex-sidebar-glass:\s*rgba\(0,\s*0,\s*0,\s*0\.28\)/);
  assert.match(styles, /--codex-sidebar-text:\s*#f1f6ee/);
  assert.match(styles, /--codex-font:\s*"OpenAI Sans"/);
  assert.match(styles, /--left-panel-width:\s*300px/);
  assert.match(styles, /--codex-sidebar-hover:\s*rgba\(255,\s*255,\s*255,\s*0\.085\)/);
  assert.match(styles, /--codex-sidebar-selected:\s*rgba\(255,\s*255,\s*255,\s*0\.13\)/);
  assert.match(styles, /\.left-panel\s*\{[\s\S]*?padding-top:\s*56px/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?height:\s*52px/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?gap:\s*14px/);
  assert.match(styles, /\.window-strip\s*\{[\s\S]*?padding:\s*0\s+18px\s+0\s+104px/);
  assert.match(styles, /\.app-shell\.sidebar-collapsed\s+\.window-strip\s*\{[\s\S]*?width:\s*var\(--left-panel-width\)/);
  assert.doesNotMatch(styles, /\.app-shell\.sidebar-collapsed\s+\.window-strip\s*\{[\s\S]*?width:\s*176px/);
  assert.doesNotMatch(styles, /\.app-shell\.sidebar-collapsed\s+\.window-icon-button/);
  assert.match(styles, /\.window-icon-button\s*\{[\s\S]*?border-radius:\s*var\(--codex-radius-sm\)/);
  assert.match(styles, /\.window-icon-button\s+svg\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
  assert.match(styles, /\.panel-top\s*\{[\s\S]*?padding:\s*0\s+8px/);
  assert.match(styles, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?min-height:\s*30px/);
  assert.match(styles, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?grid-template-columns:\s*18px\s+minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(styles, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?padding:\s*0\s+10px/);
  assert.match(styles, /\.utility-icon\s+svg\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
  assert.match(styles, /\.utility-label,[\s\S]*?\.settings-label\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400[\s\S]*?line-height:\s*1\.25/);
  assert.match(styles, /\.search-field\s+input\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400[\s\S]*?line-height:\s*1\.25/);
  assert.match(styles, /\.workspace-section\s*\{[\s\S]*?gap:\s*8px[\s\S]*?padding:\s*26px\s+8px\s+0/);
  assert.match(styles, /\.nav-section-title\s*\{[\s\S]*?padding:\s*0\s+10px[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400[\s\S]*?line-height:\s*1\.25/);
  assert.match(styles, /\.workspace-list\s*\{[\s\S]*?gap:\s*2px/);
  assert.match(styles, /\.workspace-row\s*\{[\s\S]*?width:\s*100%/);
  assert.match(styles, /\.workspace-row\s*\{[\s\S]*?min-height:\s*30px/);
  assert.match(styles, /\.workspace-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+30px/);
  assert.match(styles, /\.workspace-row\s*\{[\s\S]*?padding:\s*0\s+10px/);
  assert.match(styles, /\.workspace-select-button\s*\{[\s\S]*?height:\s*30px/);
  assert.match(styles, /\.workspace-select-button\s*\{[\s\S]*?grid-template-columns:\s*18px\s+minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.workspace-select-button\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(styles, /\.project-icon\s+svg\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
  assert.match(styles, /\.workspace-name\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400[\s\S]*?line-height:\s*1\.25/);
  assert.match(styles, /\.workspace-menu-button\s*\{[\s\S]*?width:\s*30px[\s\S]*?height:\s*30px/);
  assert.match(styles, /\.workspace-menu-button\s*\{[\s\S]*?margin-right:\s*-10px/);
  assert.match(styles, /\.workspace-menu-button\s+svg\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
  const workspaceMenuHoverBlock = styles.match(/\.workspace-menu-button:hover\s*\{[^}]*\}/)?.[0] || "";
  assert.doesNotMatch(workspaceMenuHoverBlock, /background:/);
  assert.match(styles, /\.workspace-confirm-delete\b/);
  assert.match(styles, /\.workspace-confirm-delete\s*\{[\s\S]*?right:\s*32px/);
  assert.match(styles, /\.workspace-confirm-delete\s*\{[\s\S]*?background:\s*rgba\(255,\s*70,\s*70,\s*0\.14\)/);
  assert.match(styles, /\.workspace-row\.is-delete-pending\s*\{[\s\S]*?background:\s*var\(--codex-sidebar-hover\)/);
  assert.match(styles, /\.workspace-name-input\b/);
  assert.match(styles, /\.workspace-drag-overlay\s*\{[\s\S]*?height:\s*30px/);
  assert.match(styles, /\.workspace-drag-overlay\s*\{[\s\S]*?grid-template-columns:\s*18px\s+minmax\(0,\s*1fr\)\s+30px/);
  assert.match(styles, /\.workspace-drag-overlay\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(styles, /\.workspace-drag-overlay\s*\{[\s\S]*?padding:\s*0\s+10px/);
  assert.match(styles, /\.panel-footer\s*\{[\s\S]*?padding:\s*0\s+8px\s+12px/);
  assert.match(styles, /\.settings-button\s*\{[\s\S]*?grid-template-columns:\s*18px\s+minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.settings-icon\s*\{[\s\S]*?width:\s*18px[\s\S]*?height:\s*18px/);
  assert.match(styles, /\.settings-icon\s+svg\s*\{[\s\S]*?width:\s*16px[\s\S]*?height:\s*16px/);
  assert.match(styles, /\.settings-label\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400/);
  assert.match(styles, /\.workspace-row\.is-dragging\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(styles, /--codex-surface:\s*#2c2c2c/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /\.left-panel\s*\{[\s\S]*?-webkit-backdrop-filter:\s*none/);
  assert.match(styles, /\.left-panel\s*\{[\s\S]*?backdrop-filter:\s*none/);
  assert.doesNotMatch(styles, /\.left-panel\s*\{[\s\S]*?backdrop-filter:\s*blur\(28px\)\s*saturate\(135%\)/);
  assert.doesNotMatch(styles, /\.context-menu\b/);
  assert.doesNotMatch(styles, /\.workspace-name-input:focus-visible/);
  assert.doesNotMatch(styles, /\.menu-icon\b/);
  assert.doesNotMatch(mainSource, /nativeTheme/);
  assert.doesNotMatch(mainSource, /themeSource/);
  assert.match(mainSource, /vibrancy:\s*"sidebar"/);
  assert.match(mainSource, /visualEffectState:\s*"followWindow"/);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);
});
