import { mkdir, readFile, writeFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("dist", { recursive: true });
await writeFile("dist/version.json", `${JSON.stringify({ version: packageJson.version }, null, 2)}\n`);
