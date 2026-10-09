import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("build emits desktop, renderer, backend, and matching version artifacts", async () => {
  for (const artifact of [
    "dist/desktop/main.cjs",
    "dist/desktop/preload.cjs",
    "dist/service/entry.cjs",
    "dist/renderer/index.html",
    "dist/version.json",
    "dist/service/db/migrations/0002_workspace_order.sql",
  ]) {
    await assert.doesNotReject(readFile(artifact));
  }

  const rendererHtml = await readFile("dist/renderer/index.html", "utf8");
  assert.match(rendererHtml, /(?:src|href)="\.\/assets\//);
  assert.doesNotMatch(rendererHtml, /(?:src|href)="\/assets\//);

  assert.equal(spawnSync("node", ["scripts/check-version.mjs"]).status, 0);

  const tempDirectory = await mkdtemp(join(tmpdir(), "workspace-version-smoke-"));
  const mismatchPath = join(tempDirectory, "version.json");
  try {
    await writeFile(mismatchPath, JSON.stringify({ version: "9.9.9" }));
    const mismatch = spawnSync("node", ["scripts/check-version.mjs", mismatchPath], {
      encoding: "utf8",
    });
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /does not match/);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
