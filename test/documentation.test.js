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

test("agent instructions are backend and local any-store focused", async () => {
  const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  const removedStyleGuidePath = ["style", "guideline.md"].join("");
  const removedStyleGuidePattern = new RegExp(removedStyleGuidePath.replace(".", "\\."));

  assert.match(agents, /backend and local storage work/);
  assert.match(agents, /local `any-store` sidecar/);
  assert.match(agents, /SQLite-backed workspace storage/);
  assert.match(agents, /Preload IPC contracts/);
  assert.doesNotMatch(agents, removedStyleGuidePattern);
  assert.doesNotMatch(agents, /frontend/i);
  assert.doesNotMatch(agents, /shadcn/i);
  assert.doesNotMatch(agents, /UI and UX rules/);
  assert.doesNotMatch(agents, /Visual style/);
  assert.doesNotMatch(agents, /Component reuse/);
  await assert.rejects(access(new URL(`../${removedStyleGuidePath}`, import.meta.url)), {
    code: "ENOENT",
  });
});
