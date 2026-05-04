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
    readRequiredProjectFile("styles.css"),
    readRequiredProjectFile("app.js"),
    readRequiredProjectFile("electron/main.js"),
    readRequiredProjectFile("package.json"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.deepEqual(packageJson.build.files, [
    "app.js",
    "electron/**/*",
    "index.html",
    "src/**/*",
    "styles.css",
    "THIRD_PARTY_NOTICES.md",
  ]);
  assert.match(mainSource, /window\.loadFile\(join\(__dirname,\s*"\.\.\/index\.html"\)\)/);

  assert.match(html, /<aside[^>]+id="leftPanel"[^>]+class="left-panel"/);
  assert.match(html, /id="sidebarToggle"/);
  assert.match(html, /Toggle sidebar \(Command\+B\)/);
  assert.match(html, /id="newWorkspaceButton"/);
  assert.match(html, /id="workspaceSearch"/);
  assert.match(html, /id="workspaceList"/);
  assert.match(html, /id="settingsButton"/);
  assert.match(html, /id="workspaceContextMenu"/);
  assert.match(html, /Rename/);
  assert.match(html, /Pin workspace/);
  assert.match(html, /Delete workspace/);

  assert.match(css, /--codex-sidebar:\s*#eaf1fb/);
  assert.match(css, /\.left-panel\b/);
  assert.match(css, /\.workspace-row\b/);
  assert.match(css, /\.workspace-row\.is-dragging\b/);
  assert.match(css, /\.app-shell\.sidebar-collapsed\b/);
  assert.match(css, /\.context-menu\b/);

  assert.match(appSource, /const\s+defaultWorkspaces\s*=/);
  assert.match(appSource, /function\s+addWorkspace\(/);
  assert.match(appSource, /function\s+renderWorkspaces\(/);
  assert.match(appSource, /function\s+toggleSidebar\(/);
  assert.match(appSource, /function\s+handleWorkspaceDragStart\(/);
  assert.match(appSource, /function\s+handleWorkspaceDragOver\(/);
  assert.match(appSource, /function\s+handleWorkspaceDrop\(/);
  assert.match(appSource, /function\s+renameWorkspace\(/);
  assert.match(appSource, /function\s+pinWorkspace\(/);
  assert.match(appSource, /function\s+deleteWorkspace\(/);
  assert.match(appSource, /contextmenu/);
  assert.match(appSource, /localStorage/);
  assert.match(appSource, /event\.metaKey/);
});
