import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as ts from "typescript";

async function importTransportModule() {
  const source = await readFile(new URL("../src/workspaceRendererTransport.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });

  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

test("renderer workspace transport delegates to window.workspace.request", async () => {
  const { createWorkspaceRendererTransport } = await importTransportModule();
  const calls = [];
  const transport = createWorkspaceRendererTransport({
    workspace: {
      async request(method, payload) {
        calls.push({ method, payload });
        return { ok: true, method, payload };
      },
    },
  });

  assert.deepEqual(await transport.request("workspace.listViews", { workspaceId: "workspace:ops" }), {
    ok: true,
    method: "workspace.listViews",
    payload: { workspaceId: "workspace:ops" },
  });
  assert.deepEqual(calls, [{ method: "workspace.listViews", payload: { workspaceId: "workspace:ops" } }]);
});

test("renderer workspace transport rejects missing preload bridge", async () => {
  const { createWorkspaceRendererTransport } = await importTransportModule();
  const transport = createWorkspaceRendererTransport({});

  await assert.rejects(
    () => transport.request("workspace.listViews", { workspaceId: "workspace:ops" }),
    /Workspace IPC bridge is unavailable/,
  );
});
