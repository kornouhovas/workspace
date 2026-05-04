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
  assert.match(mainSource, /vibrancy:\s*"sidebar"/);
  assert.match(appSource, /id="leftPanel"/);
  assert.match(appSource, /className="left-panel"/);
  assert.match(appSource, /className="window-strip"/);
  assert.doesNotMatch(appSource, /traffic-light/);
  assert.match(appSource, /id="sidebarToggle"/);
  assert.match(appSource, /Toggle sidebar \(Command\+B\)/);
  assert.match(appSource, /id="newWorkspaceButton"/);
  assert.match(appSource, /New Workspace/);
  assert.doesNotMatch(appSource, /New chat/);
  assert.match(appSource, /id="workspaceSearch"/);
  assert.doesNotMatch(appSource, /Plugins/);
  assert.doesNotMatch(appSource, /Automations/);
  assert.match(appSource, /id="workspaceList"/);
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

  assert.match(css, /--codex-sidebar-glass:\s*rgba\(20,\s*53,\s*31,\s*0\.7\)/);
  assert.match(css, /--codex-sidebar-text:\s*#f1f6ee/);
  assert.match(css, /backdrop-filter:\s*blur\(28px\)\s*saturate\(135%\)/);
  assert.match(css, /\.left-panel\b/);
  assert.match(css, /\.window-strip\b/);
  assert.doesNotMatch(css, /\.traffic-light\b/);
  assert.match(css, /\.nav-section-title\b/);
  assert.match(css, /\.workspace-row\b/);
  assert.match(css, /\.workspace-menu-button\b/);
  assert.match(css, /grid-template-columns:\s*0px\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.workspace-row\.is-dragging\b/);
  assert.match(css, /\.app-shell\.sidebar-collapsed\b/);
  assert.match(css, /\.context-menu\b/);

  assert.match(appSource, /const\s+defaultWorkspaces/);
  assert.match(appSource, /function\s+addWorkspace\(/);
  assert.match(appSource, /function\s+toggleSidebar\(/);
  assert.match(appSource, /function\s+handleWorkspaceDragStart\(/);
  assert.match(appSource, /function\s+handleWorkspaceDragOver\(/);
  assert.match(appSource, /function\s+handleWorkspaceDrop\(/);
  assert.match(appSource, /function\s+renameWorkspace\(/);
  assert.match(appSource, /function\s+deleteWorkspace\(/);
  assert.match(appSource, /onContextMenu/);
  assert.match(appSource, /localStorage/);
  assert.match(appSource, /event\.metaKey/);
});
