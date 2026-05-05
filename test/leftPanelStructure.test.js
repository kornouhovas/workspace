import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRequiredProjectFile(path) {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      assert.fail(`${path} should exist`);
    }
    throw error;
  }
}

test("renderer exposes the Codex-style left panel shell", async () => {
  const [html, css, appSource, mainSource, packageSource] = await Promise.all([
    readRequiredProjectFile("index.html"),
    readRequiredProjectFile("src/renderer/renderer.css"),
    readRequiredProjectFile("src/renderer/App.tsx"),
    readRequiredProjectFile("electron/main.js"),
    readRequiredProjectFile("package.json"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.deepEqual(packageJson.build.files, [
    "dist/renderer/**/*",
    "electron/**/*",
    "src/**/*",
    "THIRD_PARTY_NOTICES.md",
  ]);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/dist\/renderer\/index\.html"\)\)/);

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/renderer\/main\.tsx"/);
  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset"/);
  assert.match(mainSource, /trafficLightPosition:\s*\{/);
  assert.doesNotMatch(mainSource, /nativeTheme/);
  assert.doesNotMatch(mainSource, /themeSource/);
  assert.match(mainSource, /vibrancy:\s*"sidebar"/);
  assert.match(mainSource, /visualEffectState:\s*"followWindow"/);
  assert.match(appSource, /id="leftPanel"/);
  assert.match(appSource, /className="left-panel"/);
  assert.match(appSource, /className="window-strip"/);
  assert.doesNotMatch(appSource, /traffic-light/);
  assert.match(appSource, /id="sidebarToggle"/);
  assert.match(appSource, /Toggle sidebar \(Command\+B\)/);
  assert.match(appSource, /"panel-left"/);
  assert.match(appSource, /"square-pen"/);
  assert.match(appSource, /id="newWorkspaceButton"/);
  assert.match(appSource, /New Workspace/);
  assert.doesNotMatch(appSource, /New chat/);
  assert.match(appSource, /id="workspaceSearch"/);
  assert.match(appSource, /isSearchFocused/);
  assert.match(appSource, /onFocus=\{\(\)\s*=>\s*setIsSearchFocused\(true\)\}/);
  assert.match(appSource, /onBlur=\{\(\)\s*=>\s*setIsSearchFocused\(false\)\}/);
  assert.match(appSource, /placeholder=\{isSearchFocused\s*\?\s*""\s*:\s*"Search"\}/);
  assert.doesNotMatch(appSource, /Plugins/);
  assert.doesNotMatch(appSource, /Automations/);
  assert.match(appSource, /id="workspaceList"/);
  assert.match(appSource, /leftPanelRef/);
  assert.match(appSource, /workspaceListRef/);
  assert.match(appSource, /Workspace/);
  assert.doesNotMatch(appSource, /Projects/);
  assert.doesNotMatch(appSource, /Chats/);
  assert.doesNotMatch(appSource, /Upgrade/);
  assert.match(appSource, /id="settingsButton"/);
  assert.match(appSource, /id="workspaceContextMenu"/);
  assert.match(appSource, /Rename/);
  assert.doesNotMatch(appSource, /Pin workspace/);
  assert.doesNotMatch(appSource, /function\s+pinWorkspace\(/);
  assert.match(appSource, /Delete workspace/);
  assert.match(appSource, /handleWorkspacePointerDown/);
  assert.match(appSource, /handleWorkspacePointerMove/);
  assert.match(appSource, /type\s+WorkspaceDropPlacement\s*=\s*"before"\s*\|\s*"after"/);
  assert.match(appSource, /setPointerCapture/);
  assert.match(appSource, /releasePointerCapture/);
  const pointerDownBody = appSource.match(/function handleWorkspacePointerDown[\s\S]*?\n  function handleWorkspacePointerMove/)?.[0] || "";
  const pointerMoveBody = appSource.match(/function handleWorkspacePointerMove[\s\S]*?\n  function handleWorkspacePointerEnd/)?.[0] || "";
  assert.doesNotMatch(pointerDownBody, /setPointerCapture/);
  assert.match(
    pointerMoveBody,
    /if\s*\(!workspaceListRef\.current\?\.hasPointerCapture\(event\.pointerId\)\)\s*\{[\s\S]*?workspaceListRef\.current\?\.setPointerCapture\(event\.pointerId\)/,
  );
  assert.match(appSource, /getWorkspaceDropIntentAtPoint/);
  assert.match(appSource, /workspaceListRef\.current\?\.releasePointerCapture\(event\.pointerId\)/);
  assert.equal(appSource.includes('document.querySelectorAll<HTMLElement>("[data-workspace-id]")'), true);
  assert.match(appSource, /row\.dataset\.workspaceId\s*!==\s*sourceId/);
  assert.match(appSource, /placement:\s*y\s*>\s*rowRect\.top\s*\+\s*rowRect\.height\s*\/\s*2\s*\?\s*"after"\s*:\s*"before"/);
  assert.match(appSource, /getWorkspaceDropIntentAtPoint\([^)]*currentDragState\.workspaceId[^)]*\)/);
  assert.match(
    appSource,
    /reorderWorkspaces\([\s\S]*?current\.workspaces,[\s\S]*?currentDragState\.workspaceId,[\s\S]*?dropIntent\.workspaceId,[\s\S]*?dropIntent\.placement,[\s\S]*?\)/,
  );
  assert.match(appSource, /useLayoutEffect/);
  assert.match(appSource, /workspaceRowRefs/);
  assert.match(appSource, /captureWorkspaceRowPositions/);
  assert.match(appSource, /registerWorkspaceRow/);
  assert.match(appSource, /\.animate\(\[/);
  assert.match(appSource, /panelRect\.right\s*-\s*contextMenuWidth\s*-\s*screenPadding/);
  assert.match(appSource, /clamp\(/);
  assert.doesNotMatch(appSource, /\sdraggable\b/);
  assert.doesNotMatch(appSource, /onDragStart/);
  assert.doesNotMatch(appSource, /onDrop/);

  assert.match(css, /--codex-sidebar-glass:\s*transparent/);
  assert.doesNotMatch(css, /--codex-sidebar-glass:\s*rgba\(20,\s*53,\s*31,\s*0\.7\)/);
  assert.doesNotMatch(css, /--codex-sidebar-glass:\s*rgba\(255,\s*255,\s*255,\s*0\.055\)/);
  assert.doesNotMatch(css, /--codex-sidebar-glass:\s*rgba\(0,\s*0,\s*0,\s*0\.28\)/);
  assert.match(css, /--codex-sidebar-text:\s*#f1f6ee/);
  assert.match(css, /--codex-font:\s*"OpenAI Sans"/);
  assert.match(css, /\.left-panel\s*\{[\s\S]*?-webkit-backdrop-filter:\s*none/);
  assert.match(css, /\.left-panel\s*\{[\s\S]*?backdrop-filter:\s*none/);
  assert.doesNotMatch(css, /\.left-panel\s*\{[\s\S]*?backdrop-filter:\s*blur\(28px\)\s*saturate\(135%\)/);
  assert.match(css, /\.left-panel\b/);
  assert.match(css, /--left-panel-width:\s*300px/);
  assert.match(css, /--codex-sidebar-hover:\s*rgba\(255,\s*255,\s*255,\s*0\.095\)/);
  assert.match(css, /--codex-sidebar-selected:\s*rgba\(255,\s*255,\s*255,\s*0\.14\)/);
  assert.match(css, /\.left-panel\s*\{[\s\S]*?padding-top:\s*52px/);
  assert.match(css, /\.window-strip\b/);
  assert.match(css, /\.window-strip\s*\{[\s\S]*?height:\s*52px/);
  assert.match(css, /\.window-strip\s*\{[\s\S]*?gap:\s*14px/);
  assert.match(css, /\.window-strip\s*\{[\s\S]*?padding:\s*0\s+18px\s+0\s+104px/);
  assert.match(css, /\.window-icon-button\s*\{[\s\S]*?border-radius:\s*var\(--codex-radius-sm\)/);
  assert.match(css, /\.window-icon-button\s+svg\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.doesNotMatch(css, /\.traffic-light\b/);
  assert.match(css, /\.panel-top\s*\{[\s\S]*?padding:\s*0\s+4px/);
  assert.match(css, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?min-height:\s*24px/);
  assert.match(css, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?grid-template-columns:\s*14px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?gap:\s*2px/);
  assert.match(css, /\.utility-row,[\s\S]*?\.settings-button\s*\{[\s\S]*?padding:\s*0\s+8px/);
  assert.match(css, /\.utility-row\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*8px\)[\s\S]*?margin:\s*0\s+4px/);
  assert.match(css, /\.utility-icon,[\s\S]*?\.project-icon,[\s\S]*?\.settings-icon\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.match(css, /\.utility-icon\s+svg\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.match(css, /\.utility-label,[\s\S]*?\.settings-label\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400/);
  assert.match(css, /\.search-field\s+input\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400/);
  assert.match(css, /\.nav-section-title\b/);
  assert.match(css, /\.workspace-section\s*\{[\s\S]*?gap:\s*6px[\s\S]*?padding:\s*24px\s+4px\s+0/);
  assert.match(css, /\.nav-section-title\s*\{[\s\S]*?padding:\s*0\s+4px[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400/);
  assert.match(css, /\.workspace-row\b/);
  assert.match(css, /\.workspace-list\s*\{[\s\S]*?gap:\s*1px/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?width:\s*calc\(100%\s*-\s*8px\)/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?margin:\s*0\s+4px/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?min-height:\s*24px/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+24px/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?padding:\s*0\s+8px/);
  assert.match(css, /\.workspace-select-button\s*\{[\s\S]*?height:\s*24px/);
  assert.match(css, /\.workspace-select-button\s*\{[\s\S]*?grid-template-columns:\s*14px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.workspace-select-button\s*\{[\s\S]*?gap:\s*2px/);
  assert.match(css, /\.project-icon\s+svg\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.match(css, /\.workspace-name\s*\{[\s\S]*?font-size:\s*14px[\s\S]*?font-weight:\s*400/);
  assert.match(css, /\.workspace-menu-button\b/);
  assert.match(css, /\.workspace-menu-button\s*\{[\s\S]*?width:\s*24px[\s\S]*?height:\s*24px/);
  assert.match(css, /\.workspace-menu-button\s+svg\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /\.workspace-drag-overlay\b/);
  assert.match(css, /\.workspace-drag-overlay\s*\{[\s\S]*?height:\s*24px/);
  assert.match(css, /\.workspace-drag-overlay\s*\{[\s\S]*?grid-template-columns:\s*14px\s+minmax\(0,\s*1fr\)\s+24px/);
  assert.match(css, /\.workspace-drag-overlay\s*\{[\s\S]*?gap:\s*2px/);
  assert.match(css, /\.workspace-drag-overlay\s*\{[\s\S]*?padding:\s*0\s+8px/);
  assert.match(css, /left:\s*var\(--drag-left\)/);
  assert.match(css, /top:\s*var\(--drag-top\)/);
  assert.match(css, /\.panel-footer\s*\{[\s\S]*?padding:\s*0\s+16px\s+12px/);
  assert.match(css, /\.settings-icon\s+svg\s*\{[\s\S]*?width:\s*14px[\s\S]*?height:\s*14px/);
  assert.match(css, /\.workspace-row\s*\{[\s\S]*?transition:[\s\S]*?transform\s+150ms\s+ease/);
  assert.match(css, /\.workspace-row\.is-dragging\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /--codex-surface:\s*#2c2c2c/);
  assert.match(css, /grid-template-columns:\s*0px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.workspace-row\.is-dragging\b/);
  assert.match(css, /\.app-shell\.sidebar-collapsed\b/);
  assert.match(css, /\.context-menu\b/);
  assert.match(css, /--context-menu-width:\s*224px/);
  assert.match(css, /font-weight:\s*400/);

  assert.match(appSource, /const\s+defaultWorkspaces/);
  assert.match(appSource, /function\s+addWorkspace\(/);
  assert.match(appSource, /function\s+toggleSidebar\(/);
  assert.match(appSource, /function\s+renameWorkspace\(/);
  assert.match(appSource, /function\s+deleteWorkspace\(/);
  assert.match(appSource, /onContextMenu/);
  assert.match(appSource, /localStorage/);
  assert.match(appSource, /event\.metaKey/);
});
