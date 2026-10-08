import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const buildVersion = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], "utf8")).version
  : JSON.parse(await readFile("dist/version.json", "utf8")).version;

if (packageJson.version !== buildVersion) {
  console.error(`Package version ${packageJson.version} does not match build version ${buildVersion}`);
  process.exitCode = 1;
} else {
  console.info(`Package and build versions match: ${packageJson.version}`);
}
