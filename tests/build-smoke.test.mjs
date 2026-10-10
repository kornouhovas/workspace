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
    "dist/service/db/migrations/0003_source_discovery.sql",
    "dist/service/db/migrations/0004_direct_projects.sql",
    "dist/service/db/migrations/0005_text_properties.sql",
    "dist/service/db/migrations/0006_grouped_discovery.sql",
    "dist/service/db/migrations/0007_discovery_mode_changes.sql",
    "dist/service/db/migrations/0008_project_creation.sql",
    "dist/service/db/migrations/meta/_journal.json",
  ]) {
    await assert.doesNotReject(readFile(artifact));
  }

  const journal = JSON.parse(await readFile("dist/service/db/migrations/meta/_journal.json", "utf8"));
  assert.deepEqual(journal, JSON.parse(await readFile("src/service/db/migrations/meta/_journal.json", "utf8")));
  assert.equal(journal.entries.at(-1).idx, 8);
  assert.equal(journal.entries.at(-1).tag, "0008_project_creation");
  assert.equal(await readFile("dist/service/db/migrations/0007_discovery_mode_changes.sql", "utf8"),
    await readFile("src/service/db/migrations/0007_discovery_mode_changes.sql", "utf8"));

  assert.equal(await readFile("dist/service/db/migrations/0008_project_creation.sql", "utf8"),
    await readFile("src/service/db/migrations/0008_project_creation.sql", "utf8"));

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
