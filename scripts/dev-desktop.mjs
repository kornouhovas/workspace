import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { getDevelopmentRuntime } from "../electron/developmentRuntime.js";

register(new URL("./disable-fsevents-loader.mjs", import.meta.url), import.meta.url);
const checkout = fileURLToPath(new URL("../", import.meta.url));
const runtime = getDevelopmentRuntime({ env: { ...process.env, WORKSPACE_DEV: "1" }, checkout });
await mkdir(runtime.userData, { recursive: true });
const { createServer } = await import("vite");
const server = await createServer({
  root: checkout,
  server: { host: "127.0.0.1", port: 5173, strictPort: false },
});
await server.listen();
const rendererUrl = server.resolvedUrls.local.find((url) => url.startsWith("http://127.0.0.1:"));
if (!rendererUrl) {
  await server.close();
  throw new Error("No loopback Vite address available.");
}
console.log(
  `Workspace desktop dev: ${rendererUrl}\nIsolated data: ${runtime.dataDirectory}\nRenderer changes use HMR; restart for Electron/backend changes.`,
);
const { default: electron } = await import("electron");
const child = spawn(electron, ["electron/main.js", ...process.argv.slice(2)], {
  cwd: checkout,
  stdio: "inherit",
  env: {
    ...process.env,
    WORKSPACE_DEV: "1",
    WORKSPACE_DEV_DATA: runtime.dataDirectory,
    WORKSPACE_DEV_URL: rendererUrl,
  },
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await server.close();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("error", async (error) => {
  console.error(error);
  await stop();
  process.exitCode = 1;
});
child.once("exit", async (code) => {
  await stop();
  process.exitCode = code || 0;
});
