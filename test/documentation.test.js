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
  const workflow = await readFile(new URL("../WORKFLOW.md", import.meta.url), "utf8");
  const removedStyleGuidePath = ["style", "guideline.md"].join("");
  const removedStyleGuidePattern = new RegExp(removedStyleGuidePath.replace(".", "\\."));

  assert.match(agents, /spec-first, agent-ready workflow/);
  assert.match(agents, /Feature Intake/);
  assert.match(agents, /Bug Diagnosis/);
  assert.match(agents, /Implementation Slice/);
  assert.match(agents, /Review/);
  assert.match(agents, /Workflow Evidence/);
  assert.match(agents, /infer the request mode/);
  assert.match(agents, /Handoff state/);
  assert.match(agents, /Commit every completed file-changing implementation before handoff/);
  assert.match(workflow, /commit completed file-changing work before handoff/);
  assert.match(workflow, /Mode Detection/);
  assert.match(workflow, /Workflow Evidence/);
  assert.match(agents, /local store: Go sidecar using `any-store` on SQLite/);
  assert.match(agents, /React must stay thin/);
  assert.match(agents, /Electron preload IPC/);
  assert.match(workflow, /Backlog/);
  assert.match(workflow, /Agent Working/);
  assert.match(workflow, /Human Review/);
  assert.match(workflow, /Future Symphony Compatibility/);
  assert.doesNotMatch(agents, removedStyleGuidePattern);
  await assert.rejects(access(new URL(`../${removedStyleGuidePath}`, import.meta.url)), {
    code: "ENOENT",
  });
  await access(new URL("../docs/workflow/codex-chat-workflow.md", import.meta.url));
  await access(new URL("../docs/templates/feature-intake.md", import.meta.url));
  await access(new URL("../docs/templates/bug-intake.md", import.meta.url));
});
