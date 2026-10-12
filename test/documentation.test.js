import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

test("third party notices document any-store MIT license", async () => {
  const notices = await readFile(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");

  assert.match(notices, /any-store/);
  assert.match(notices, /MIT License/);
  assert.match(notices, /Copyright \(c\) 2023 Any Association/);
  assert.match(notices, /https:\/\/github\.com\/anyproto\/any-store/);
  assert.match(notices, /https:\/\/raw\.githubusercontent\.com\/anyproto\/any-store\/main\/LICENSE\.md/);
});

test("agent entry point reaches development policies through existing local links", async () => {
  const documents = new Set([
    "AGENTS.md",
    "docs/development/README.md",
    "docs/development/rules.md",
    "docs/development/workflow.md",
    "docs/development/quality.md",
    "docs/agents/issue-tracker.md",
    "docs/agents/domain.md",
    "docs/agents/triage-labels.md",
  ]);
  const root = new URL("../", import.meta.url);
  const pending = [new URL("AGENTS.md", root)];
  const visited = new Set();

  while (pending.length > 0) {
    const document = pending.pop();
    if (visited.has(document.href)) continue;
    visited.add(document.href);
    const contents = await readFile(document, "utf8");
    for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("#")) continue;
      const linkedDocument = new URL(target, document);
      linkedDocument.hash = "";
      await access(linkedDocument);
      if ([...documents].some((path) => new URL(path, root).href === linkedDocument.href)) {
        pending.push(linkedDocument);
      }
    }
  }

  for (const document of documents) {
    assert.ok(visited.has(new URL(document, root).href), `${document} must be reachable from AGENTS.md`);
  }
});
