import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourceDirectory = new URL("../src/desktop/native/", import.meta.url);
const outputDirectory = new URL("../dist/desktop/native/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });
for (const file of ["windows-view.ps1", "windows-binding.ps1", "windows-project-reveal.ps1"]) {
  await copyFile(fileURLToPath(new URL(file, sourceDirectory)), fileURLToPath(new URL(file, outputDirectory)));
}
