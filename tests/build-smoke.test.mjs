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
    "dist/service/project-rename-filesystem.mjs",
    "dist/service/project-rename-filesystem.cjs",
    "dist/service/native/project-rename.node",
    "dist/service-test-native/project-rename.node",
    "dist/renderer/index.html",
    "dist/version.json",
    "dist/service/db/migrations/0000_settings.sql",
    "dist/service/db/migrations/0001_workspaces.sql",
    "dist/service/db/migrations/0002_workspace_order.sql",
    "dist/service/db/migrations/0003_source_discovery.sql",
    "dist/service/db/migrations/0004_direct_projects.sql",
    "dist/service/db/migrations/0005_text_properties.sql",
    "dist/service/db/migrations/0006_grouped_discovery.sql",
    "dist/service/db/migrations/0007_discovery_mode_changes.sql",
    "dist/service/db/migrations/0008_project_creation.sql",
    "dist/service/db/migrations/0009_project_rename.sql",
    "dist/service/db/migrations/0010_project_category_move.sql",
    "dist/service/db/migrations/0011_category_options.sql",
    "dist/service/db/migrations/0012_category_removal.sql",
    "dist/service/db/migrations/0013_project_archive.sql",
    "dist/service/db/migrations/0014_number_properties.sql",
    "dist/service/db/migrations/0015_date_properties.sql",
    "dist/service/db/migrations/meta/_journal.json",
  ]) {
    await assert.doesNotReject(readFile(artifact));
  }

  const journal = JSON.parse(await readFile("dist/service/db/migrations/meta/_journal.json", "utf8"));
  assert.deepEqual(journal, JSON.parse(await readFile("src/service/db/migrations/meta/_journal.json", "utf8")));
  assert.equal(journal.entries.at(-1).idx, 15);
  assert.equal(journal.entries.at(-1).tag, "0015_date_properties");
  assert.equal(await readFile("dist/service/db/migrations/0007_discovery_mode_changes.sql", "utf8"),
    await readFile("src/service/db/migrations/0007_discovery_mode_changes.sql", "utf8"));

  assert.equal(await readFile("dist/service/db/migrations/0008_project_creation.sql", "utf8"),
    await readFile("src/service/db/migrations/0008_project_creation.sql", "utf8"));

  for (const entry of journal.entries) {
    const relativePath = `service/db/migrations/${entry.tag}.sql`;
    assert.equal(await readFile(`dist/${relativePath}`, "utf8"), await readFile(`src/${relativePath}`, "utf8"));
  }
  const main = await readFile("dist/desktop/main.cjs", "utf8");
  assert.match(main, /shell\.showItemInFolder/);
  assert.match(main, /windows-project-reveal\.ps1/);
  assert.doesNotMatch(main, /shell\.openPath/);
  assert.match(main, /project\.reveal\.native/);
  assert.match(await readFile("dist/service/entry.cjs", "utf8"), /project\.reveal\.native/);

  for (const file of ["windows-view.ps1", "windows-binding.ps1", "windows-project-reveal.ps1"]) {
    assert.deepEqual(await readFile(`dist/desktop/native/${file}`), await readFile(`src/desktop/native/${file}`));
  }
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  assert.ok(manifest.build.extraResources.some((entry) => entry.from === "dist/desktop/native" && entry.to === "native" &&
    ["windows-view.ps1", "windows-binding.ps1", "windows-project-reveal.ps1"].every((file) => entry.filter.includes(file))));

  assert.ok(manifest.build.asarUnpack.includes("dist/service/native/project-rename.node"));
  assert.ok(manifest.build.files.includes("!dist/service-test-native/**"));

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
