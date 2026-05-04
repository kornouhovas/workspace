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
  assert.match(appSource, /id="leftPanel"/);
  assert.match(appSource, /className="left-panel"/);
  assert.match(appSource, /className="window-strip"/);
  assert.match(appSource, /traffic-light traffic-red/);
  assert.match(appSource, /traffic-light traffic-yellow/);
  assert.match(appSource, /traffic-light traffic-green/);
  assert.match(appSource, /id="sidebarToggle"/);
  assert.match(appSource, /Toggle sidebar \(Command\+B\)/);
  assert.match(appSource, /id="newWorkspaceButton"/);
  assert.match(appSource, /New chat/);
  assert.match(appSource, /id="workspaceSearch"/);
  assert.match(appSource, /Plugins/);
  assert.match(appSource, /Automations/);
  assert.match(appSource, /id="workspaceList"/);
  assert.match(appSource, /Projects/);
  assert.match(appSource, /Chats/);
  assert.match(appSource, /Upgrade/);
  assert.match(appSource, /id="settingsButton"/);
  assert.match(appSource, /id="workspaceContextMenu"/);
  assert.match(appSource, /Rename/);
  assert.match(appSource, /Pin workspace/);
  assert.match(appSource, /Delete workspace/);

  assert.match(css, /--codex-sidebar:\s*#14351f/);
  assert.match(css, /--codex-sidebar-text:\s*#f1f6ee/);
  assert.match(css, /\.left-panel\b/);
  assert.match(css, /\.window-strip\b/);
  assert.match(css, /\.traffic-light\b/);
  assert.match(css, /\.nav-section-title\b/);
  assert.match(css, /\.workspace-row\b/);
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
  assert.match(appSource, /function\s+pinWorkspace\(/);
  assert.match(appSource, /function\s+deleteWorkspace\(/);
  assert.match(appSource, /onContextMenu/);
  assert.match(appSource, /localStorage/);
  assert.match(appSource, /event\.metaKey/);
});
