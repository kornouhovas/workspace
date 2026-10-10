import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFile, listPackage } from "@electron/asar";

const requiredFiles = [
  "package.json",
  "dist/version.json",
  "dist/desktop/main.cjs",
  "dist/desktop/preload.cjs",
  "dist/service/entry.cjs",
  "dist/renderer/index.html",
  "dist/service/db/migrations/0000_settings.sql",
  "dist/service/db/migrations/0001_workspaces.sql",
  "dist/service/db/migrations/0002_workspace_order.sql",
  "dist/service/db/migrations/0003_source_discovery.sql",
  "dist/service/db/migrations/0004_direct_projects.sql",
  "dist/service/db/migrations/0005_text_properties.sql",
  "dist/service/db/migrations/0006_grouped_discovery.sql",
  "dist/service/db/migrations/0007_discovery_mode_changes.sql",
  "dist/service/db/migrations/0008_project_creation.sql",
  "dist/service/db/migrations/meta/_journal.json",
];

export function normalizeAsarEntry(file) {
  return file.replaceAll("\\", "/").replace(/^\/+/, "");
}

export async function checkArtifact(root, { platform = process.platform, arch = process.arch } = {}) {
  const asarPath = await findAsar(resolve(root));
  assert.ok(asarPath, `No app.asar found under ${root}`);

  const files = new Set((await listPackage(asarPath)).map(normalizeAsarEntry));
  for (const file of requiredFiles) {
    assert.ok(files.has(file), `Packaged app is missing ${file}`);
  }

  const html = (await extractFile(asarPath, join("dist", "renderer", "index.html"))).toString();
  const resources = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)].map((match) => match[1].slice(2));
  assert.ok(resources.some((file) => file.endsWith(".js")), "Packaged renderer has no local JavaScript entry");
  for (const resource of resources) {
    assert.ok(files.has(`dist/renderer/${resource}`), `Packaged app is missing renderer resource ${resource}`);
  }

  const journal = JSON.parse((await extractFile(asarPath, join("dist", "service", "db", "migrations", "meta", "_journal.json"))).toString());
  assert.ok(journal.entries?.some((entry) => entry.idx === 7 && entry.tag === "0007_discovery_mode_changes"),
    "Packaged migration journal is missing 0007_discovery_mode_changes");

  assert.ok(journal.entries?.some((entry) => entry.idx === 8 && entry.tag === "0008_project_creation"),
    "Packaged migration journal is missing 0008_project_creation");
  const sourceMigrations = fileURLToPath(new URL("../src/service/db/migrations/", import.meta.url));
  assert.deepEqual(journal, JSON.parse(await readFile(join(sourceMigrations, "meta", "_journal.json"), "utf8")),
    "Packaged migration journal differs from source");
  for (const entry of journal.entries) {
    const sql = (await extractFile(asarPath, join("dist", "service", "db", "migrations", `${entry.tag}.sql`))).toString();
    assert.equal(sql, await readFile(join(sourceMigrations, `${entry.tag}.sql`), "utf8"),
      `Packaged migration differs from source: ${entry.tag}`);
  }
  const main = (await extractFile(asarPath, join("dist", "desktop", "main.cjs"))).toString();
  assert.match(main, /shell\.openPath/, "Packaged desktop is missing native openPath integration");
  assert.match(main, /project\.reveal\.native/, "Packaged desktop is missing private Reveal routing");
  assert.match((await extractFile(asarPath, join("dist", "service", "entry.cjs"))).toString(),
    /project\.reveal\.native/, "Packaged backend is missing private Reveal routing");

  const packaged = JSON.parse((await extractFile(asarPath, "package.json")).toString());
  const buildVersion = JSON.parse((await extractFile(asarPath, join("dist", "version.json"))).toString()).version;
  assert.equal(buildVersion, packaged.version, "Packaged build and package versions differ");

  const resourcesDirectory = dirname(asarPath);
  const licensePath = join(resourcesDirectory, "licenses/bb-MIT.txt");
  const license = await readFile(licensePath, "utf8");
  assert.match(license, /Copyright \(c\) 2026 Michael Yong/);
  assert.match(license, /MIT License/);

  const unpackedModules = `${asarPath}.unpacked/node_modules/better-sqlite3`;
  const nativeCandidates = [
    join(unpackedModules, `prebuilds/${platform}-${arch}.node`),
    join(unpackedModules, "build/Release/better_sqlite3.node"),
  ];
  let nativeFound = false;
  for (const candidate of nativeCandidates) {
    try {
      await stat(candidate);
      nativeFound = true;
      break;
    } catch {
      // Check the alternate prebuild/source-build location.
    }
  }
  assert.ok(nativeFound, `Unpacked better-sqlite3 native module is missing for ${platform}-${arch}`);

  console.info(`Artifact resources verified (${packaged.version}): ${asarPath}`);
  return { asarPath, version: packaged.version };
}

async function findAsar(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isFile() && entry.name === "app.asar") return path;
    if (entry.isDirectory()) {
      const nested = await findAsar(path);
      if (nested) return nested;
    }
  }
  return undefined;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? "release";
  await checkArtifact(root);
}
