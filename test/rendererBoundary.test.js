import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("renderer entry graph does not import backend storage, sidecar, or Node runtime modules", async () => {
  const { stdout } = await execFileAsync("rg", ["--files", "src"], {
    cwd: new URL("..", import.meta.url),
  });
  const files = stdout
    .trim()
    .split("\n")
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => {
      if (file.includes("/components/workspace/")) {
        return true;
      }

      return file === "src/App.tsx" || file === "src/main.tsx";
    });

  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from "node:/, file);
    assert.doesNotMatch(source, /from "\.\/workspaceBackend|from "@\/workspaceBackend|workspaceBackend\.js/, file);
    assert.doesNotMatch(source, /workspaceSidecarClient/, file);
  }
});
