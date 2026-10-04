import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

// The superseded Compact64/256 geometry is covered by reference-matrix runtime evidence.
// Keep these product composition regressions independent from CSS pixels/JSX formatting.
test("Board owns both scroll axes, columns follow content, and visible counts are rendered", async () => {
  const boardSource = await readProjectFile("src/components/workspace/board-view.tsx");

  assert.match(boardSource, /workspace-board-scroll[^"\n]*overflow-auto/);
  assert.doesNotMatch(boardSource, /overflow-y-auto/);
  assert.doesNotMatch(boardSource, /grid h-full/);
  assert.match(boardSource, /workspace-board-column[^"\n]*self-start/);
  assert.match(boardSource, /data-workspace-column-count/);
  assert.match(boardSource, /aria-label=\{t\("board\.visibleCount"/);
  assert.match(boardSource, /\{column\.count \?\? column\.projects\.length\}/);
});

test("expanded project uses common compact headings and exposes a numeric file count accessibly", async () => {
  const detailSource = await readProjectFile("src/components/workspace/project-detail-panel.tsx");

  assert.match(detailSource, /top-\[var\(--workspace-header-height\)\]/);
  assert.match(detailSource, /left-\[var\(--workspace-sidebar-width\)\]/);
  assert.match(detailSource, /workspace-project-detail-heading[^"\n]*text-sm[^"\n]*font-medium/);
  assert.match(detailSource, /workspace-project-detail-content-inset/);
  assert.match(detailSource, /aria-label=\{t\("detail\.items"/);
  assert.match(detailSource, /\{displayedProject\.fileTree\.length\}/);
});
