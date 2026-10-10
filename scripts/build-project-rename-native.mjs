import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "native/project-rename");
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const gypManifest = JSON.parse(await readFile(join(root, "node_modules/node-gyp/package.json"), "utf8"));
const gyp = join(root, "node_modules/node-gyp/bin/node-gyp.js");
if (gypManifest.version !== lock.packages["node_modules/node-gyp"].version) throw new Error("Installed node-gyp differs from lockfile; run npm ci");
if (process.versions.node !== "22.21.1") throw new Error("Native fixture build requires Node 22.21.1");
if (!["darwin", "win32"].includes(process.platform)) throw new Error("Project rename native builds support only macOS and Windows");

// Invalidate both outputs before either compiler runs.
for (const relative of ["dist/service-test-native/project-rename.node", "dist/service/native/project-rename.node"]) {
  await rm(join(root, relative), { force: true });
}
for (const runtime of ["node", "electron"]) {
  const destination = join(root, runtime === "node" ? "dist/service-test-native" : "dist/service/native");
  await mkdir(destination, { recursive: true });
  const args = [gyp, "rebuild", `--arch=${process.arch}`,
    `--target=${runtime === "node" ? "22.21.1" : manifest.devDependencies.electron}`];
  if (runtime === "electron") args.push("--dist-url=https://electronjs.org/headers");
  console.info(`Building project rename adapter: ${runtime} ${args.at(3)} ${process.platform}-${process.arch}; node-gyp ${gypManifest.version}`);
  const built = spawnSync(process.execPath, args, { cwd: source, stdio: "inherit", env: process.env });
  if (built.error || built.status !== 0) throw new Error(`Project rename ${runtime} compilation failed`);
  await copyFile(join(source, "build/Release/project_rename.node"), join(destination, "project-rename.node"));
}
