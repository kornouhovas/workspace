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
];

export async function checkArtifact(root, { platform = process.platform, arch = process.arch } = {}) {
  const asarPath = await findAsar(resolve(root));
  assert.ok(asarPath, `No app.asar found under ${root}`);

  const files = new Set((await listPackage(asarPath)).map((file) => file.replace(/^\//, "")));
  for (const file of requiredFiles) {
    assert.ok(files.has(file), `Packaged app is missing ${file}`);
  }

  const packaged = JSON.parse((await extractFile(asarPath, "package.json")).toString());
  const buildVersion = JSON.parse((await extractFile(asarPath, "dist/version.json")).toString()).version;
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
