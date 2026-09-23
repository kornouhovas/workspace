import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rendererEntry = resolve(projectRoot, "src/main.tsx");
const localExtensions = ["", ".ts", ".tsx", ".js", ".jsx"];

async function resolveRendererImport(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return null;
  }

  const unresolved = specifier.startsWith("@/")
    ? resolve(projectRoot, "src", specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  const candidates = localExtensions.flatMap((extension) => [
    `${unresolved}${extension}`,
    resolve(unresolved, `index${extension}`),
  ]);

  for (const candidate of candidates) {
    if (![".ts", ".tsx", ".js", ".jsx"].includes(extname(candidate))) {
      continue;
    }
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }

  return null;
}

async function collectRendererGraph() {
  const pending = [rendererEntry];
  const visited = new Set();

  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    const source = await readFile(file, "utf8");
    const imports = ts.preProcessFile(source, true, true).importedFiles;
    for (const importedFile of imports) {
      const resolvedImport = await resolveRendererImport(file, importedFile.fileName);
      if (resolvedImport && !visited.has(resolvedImport)) {
        pending.push(resolvedImport);
      }
    }
  }

  return visited;
}

test("renderer entry graph does not import backend storage, sidecar, or Node runtime modules", async () => {
  const files = await collectRendererGraph();
  const relativeFiles = [...files].map((file) => file.slice(projectRoot.length + 1));

  assert.ok(relativeFiles.includes("src/App.tsx"));
  assert.ok(relativeFiles.includes("src/workspaceRendererTransport.ts"));
  assert.ok(relativeFiles.includes("src/workspaceServiceClient.js"));

  for (const file of files) {
    const relativeFile = file.slice(projectRoot.length + 1);
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /(?:from\s*|import\s*)["']node:/, relativeFile);
    assert.doesNotMatch(source, /(?:from\s*|import\s*)["']electron["']/, relativeFile);
    assert.doesNotMatch(source, /workspaceBackend\.js/, relativeFile);
    assert.doesNotMatch(source, /workspaceSidecarClient\.js/, relativeFile);
    assert.doesNotMatch(source, /localOpen\.js/, relativeFile);
  }
});
