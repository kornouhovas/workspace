import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { withDeadline } from "../scripts/runtime-lifecycle.mjs";

test("Ladle serves its bootstrap assets and transforms workspace stories", { timeout: 40000 }, async (t) => {
  const child = spawn(process.execPath, [
    "node_modules/@ladle/react/lib/cli/cli.js", "serve", "--host", "127.0.0.1", "--port", "0",
  ], { env: { ...process.env, BROWSER: "none" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stderr.on("data", (data) => { output += data; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      try { await withDeadline(exited, 5000, "Ladle shutdown"); }
      catch (error) { child.kill("SIGKILL"); await withDeadline(exited, 5000, "Ladle forced shutdown"); throw error; }
    }
  });
  const origin = await withDeadline(new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => reject(new Error(`Ladle exited (${code}): ${output}`)));
    child.stdout.on("data", (data) => {
      output += data;
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (url) resolve(url[0]);
    });
  }), 25000, "Ladle startup");
  const get = async (path) => {
    const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
    return response.text();
  };
  const html = await get("/");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(scripts.length > 0, "Ladle must expose browser entry modules");
  for (const script of scripts) await get(script);
  await get("/@fs" + pathToFileURL(resolve("src/renderer/components/bb-foundation.stories.tsx")).pathname);
});
