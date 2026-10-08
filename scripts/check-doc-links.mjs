import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["README.md", "CHANGELOG.md", "AGENTS.md", "docs"];

async function markdownFiles(path) {
  const absolutePath = join(repositoryRoot, path);
  if (extname(path).toLowerCase() === ".md") return [absolutePath];
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? markdownFiles(child) : extname(entry.name).toLowerCase() === ".md" ? [join(repositoryRoot, child)] : [];
  }));
  return nested.flat();
}

const files = (await Promise.all(roots.map(markdownFiles))).flat();
const broken = [];

for (const sourcePath of files) {
  const content = await readFile(sourcePath, "utf8");
  for (const match of content.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
    const destination = match[1].trim().replace(/^<|>$/g, "").split(/\s+/, 1)[0];
    if (!destination || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(destination)) continue;
    const pathPart = decodeURIComponent(destination.split(/[?#]/, 1)[0]);
    if (!pathPart) continue;
    const target = resolve(dirname(sourcePath), pathPart);
    try {
      await access(target);
    } catch {
      broken.push(`${sourcePath.slice(repositoryRoot.length + 1)}: ${destination}`);
    }
  }
}

assert.deepEqual(broken, [], `Broken local Markdown links:\n${broken.join("\n")}`);
console.info(`Checked local Markdown links in ${files.length} files.`);
