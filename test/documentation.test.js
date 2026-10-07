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

test("agent instructions define the spec-first Codex workflow", async () => {
  const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  const removedStyleGuidePath = ["style", "guideline.md"].join("");
  const removedStyleGuidePattern = new RegExp(removedStyleGuidePath.replace(".", "\\."));

  assert.match(agents, /spec-first, agent-ready workflow/);
  assert.match(agents, /Feature Intake/);
  assert.match(agents, /Bug Diagnosis/);
  assert.match(agents, /Implementation Slice/);
  assert.match(agents, /Review/);
  assert.match(agents, /Workflow Evidence/);
  assert.match(agents, /Infer the request mode/);
  assert.match(agents, /Handoff state/);
  assert.match(agents, /Commit every completed and verified file-changing task before handoff/);
  assert.match(agents, /target durable local store is the Go sidecar using `any-store` on SQLite/);
  assert.match(agents, /React must stay thin/);
  assert.match(agents, /Electron preload IPC/);
  assert.doesNotMatch(agents, removedStyleGuidePattern);
  await assert.rejects(access(new URL(`../${removedStyleGuidePath}`, import.meta.url)), {
    code: "ENOENT",
  });
  for (const document of [
    "docs/development/README.md",
    "docs/development/rules.md",
    "docs/development/workflow.md",
    "docs/development/quality.md",
    "docs/agents/issue-tracker.md",
  ]) {
    await access(new URL(`../${document}`, import.meta.url));
  }
});
