import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as ts from "typescript";

async function importCompatibilityModule() {
  const source = await readFile(new URL("../src/workspaceCompatibility.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("loadWorkspaceList falls back when workspace list API is unsupported", async () => {
  const { loadWorkspaceList } = await importCompatibilityModule();
  const root = { workspaceId: "workspace:root", name: "Обьекты", path: "/tmp/projects" };
  const client = {
    async listWorkspaces() {
      throw new Error("Unsupported workspace method: workspace.listWorkspaces");
    },
  };

  assert.deepEqual(await loadWorkspaceList(client, root), {
    activeWorkspaceId: "workspace:root",
    workspaces: [{ id: "workspace:root", name: "Operations", order: 10 }],
  });
});

test("loadWorkspaceList rethrows non-compatibility workspace list errors", async () => {
  const { loadWorkspaceList } = await importCompatibilityModule();
  const root = { workspaceId: "workspace:root", name: "Projects", path: "/tmp/projects" };
  const client = {
    async listWorkspaces() {
      throw new Error("Database is unavailable.");
    },
  };

  await assert.rejects(
    () => loadWorkspaceList(client, root),
    /Database is unavailable/,
  );
});

test("addWorkspaceListFallback appends and activates a local workspace", async () => {
  const { addWorkspaceListFallback } = await importCompatibilityModule();

  assert.deepEqual(
    addWorkspaceListFallback({
      activeWorkspaceId: "workspace:root",
      workspaces: [{ id: "workspace:root", name: "Operations", order: 10 }],
    }, "Workspace 2"),
    {
      activeWorkspaceId: "workspace:local:workspace-2",
      workspaces: [
        { id: "workspace:root", name: "Operations", order: 10 },
        { id: "workspace:local:workspace-2", name: "Workspace 2", order: 20 },
      ],
    },
  );
});

test("addWorkspaceListFallback uses plain Workspace as the default local name", async () => {
  const { addWorkspaceListFallback } = await importCompatibilityModule();

  assert.deepEqual(
    addWorkspaceListFallback({
      activeWorkspaceId: "workspace:root",
      workspaces: [{ id: "workspace:root", name: "Operations", order: 10 }],
    }, ""),
    {
      activeWorkspaceId: "workspace:local:workspace",
      workspaces: [
        { id: "workspace:root", name: "Operations", order: 10 },
        { id: "workspace:local:workspace", name: "Workspace", order: 20 },
      ],
    },
  );
});
