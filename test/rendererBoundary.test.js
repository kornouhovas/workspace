import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const rendererEntry = resolve(projectRoot, "src/main.tsx");
const localExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const localExtensionSet = new Set(localExtensions);
const nodeBuiltins = new Set(
  builtinModules.flatMap((specifier) => [specifier, specifier.replace(/^node:/, "")]),
);

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if ([".js", ".mjs", ".cjs"].includes(extname(file))) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function collectModuleSpecifiers(source, file) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file),
  );
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && (
        node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === "require")
      )
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...new Set(specifiers)];
}

function isForbiddenRendererSpecifier(specifier) {
  const normalized = specifier.replace(/^node:/, "");
  return specifier === "electron"
    || specifier.startsWith("node:")
    || nodeBuiltins.has(normalized)
    || /(?:^|\/)(?:workspaceBackend|workspaceSidecarClient|localOpen)(?:\.js)?$/.test(specifier);
}

function assertRendererSourceBoundary(source, file) {
  const forbidden = collectModuleSpecifiers(source, file).filter(isForbiddenRendererSpecifier);
  assert.deepEqual(forbidden, [], `forbidden renderer import: ${forbidden.join(", ")}`);
}

function assertPureSessionSourceBoundary(source, file) {
  assertRendererSourceBoundary(source, file);
  const external = collectModuleSpecifiers(source, file).filter(specifier =>
    !specifier.startsWith(".") && !specifier.startsWith("@/"));
  assert.deepEqual(external, [], `platform/package import in session model: ${external.join(", ")}`);
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const browserGlobals = new Set(["window", "document", "navigator", "localStorage", "sessionStorage", "HTMLElement"]);
  const references = [];
  function visit(node) {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && browserGlobals.has(node.text))
      references.push(node.text);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.deepEqual(references, [], `browser reference in session model: ${references.join(", ")}`);
}

async function resolveRendererImport(fromFile, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    return null;
  }

  const unresolved = specifier.startsWith("@/")
    ? resolve(projectRoot, "src", specifier.slice(2))
    : resolve(dirname(fromFile), specifier);
  const explicitExtension = extname(unresolved);
  if (explicitExtension && !localExtensionSet.has(explicitExtension)) {
    return null;
  }
  const candidates = explicitExtension
    ? [unresolved]
    : localExtensions.flatMap((extension) => [
      `${unresolved}${extension}`,
      resolve(unresolved, `index${extension}`),
    ]);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }

  throw new Error(`Unable to resolve renderer script import ${specifier} from ${fromFile}`);
}

async function collectRendererGraph(entry = rendererEntry) {
  const pending = [entry];
  const visited = new Set();

  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    const source = await readFile(file, "utf8");
    const imports = collectModuleSpecifiers(source, file);
    for (const specifier of imports) {
      const resolvedImport = await resolveRendererImport(file, specifier);
      if (resolvedImport && !visited.has(resolvedImport)) {
        pending.push(resolvedImport);
      }
    }
  }

  return visited;
}

test("renderer boundary rejects every supported Node and Electron import form", () => {
  const forbiddenSources = [
    ['import fs from "fs";', "fs"],
    ['export { readFile } from "node:fs/promises";', "node:fs/promises"],
    ['await import("electron");', "electron"],
    ['const path = require("path");', "path"],
  ];

  for (const [source, specifier] of forbiddenSources) {
    assert.throws(
      () => assertRendererSourceBoundary(source, "fixture.ts"),
      new RegExp(`forbidden renderer import.*${specifier.replace("/", "\\/")}`),
    );
  }
});

test("renderer graph follows mjs and cjs intermediaries", async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "renderer-boundary-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const entry = join(fixtureRoot, "entry.mjs");
  const intermediary = join(fixtureRoot, "intermediary.cjs");
  await writeFile(entry, 'import "./intermediary.cjs";');
  await writeFile(intermediary, "module.exports = {};");

  const files = await collectRendererGraph(entry);

  assert.deepEqual(new Set(files), new Set([entry, intermediary]));
});

test("renderer entry graph does not import backend storage, sidecar, or Node runtime modules", async () => {
  const files = await collectRendererGraph();
  const relativeFiles = [...files].map((file) => file.slice(projectRoot.length + 1));

  assert.ok(relativeFiles.includes("src/App.tsx"));
  assert.ok(relativeFiles.includes("src/workspaceRendererTransport.ts"));
  assert.ok(relativeFiles.includes("src/workspaceServiceClient.js"));

  for (const file of files) {
    const relativeFile = file.slice(projectRoot.length + 1);
    const source = await readFile(file, "utf8");
    assertRendererSourceBoundary(source, relativeFile);
  }
});

test("pure session boundary detects React, browser globals and backend imports", () => {
  for (const source of [
    'import { useState } from "react";',
    'document.querySelector("button");',
    'globalThis["window"].localStorage;',
    'import { createWorkspaceBackend } from "../electron/workspaceBackend.js";',
  ]) assert.throws(() => assertPureSessionSourceBoundary(source, "fixture.js"));
});

test("session owner, lifecycle and their transitive modules remain independent of React, DOM and platform runtimes", async () => {
  const files = await collectRendererGraph(resolve(projectRoot, "src/workspaceSessionLifecycle.js"));
  for (const file of files) {
    assert.ok(file.startsWith(resolve(projectRoot, "src") + "/"), `session imports a platform implementation: ${file}`);
    assertPureSessionSourceBoundary(await readFile(file, "utf8"), file);
  }
});
