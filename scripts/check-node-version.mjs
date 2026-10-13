import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkNodeVersion(actual, required) {
  if (!/^\d+\.\d+\.\d+$/.test(required) || actual !== `v${required}`) {
    throw new Error(`Node ${required} required; running ${actual}. Run nvm install && nvm use.`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const required = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
    if (manifest.engines.node !== required) throw new Error(".nvmrc and package.json Node versions differ");
    checkNodeVersion(process.version, required);
    console.info(`Node version verified: ${process.version}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
