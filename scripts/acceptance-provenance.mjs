import assert from "node:assert/strict";

// Only the full platform job sets this marker. Local/focused reports remain
// usable diagnostics, but cannot be mistaken for full CI acceptance evidence.
export function acceptanceProvenance(env = process.env) {
  if (!env.WORKSPACE_CI_PLATFORM) return null;
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/);
  assert.match(env.GITHUB_RUN_ID ?? "", /^[1-9]\d*$/);
  assert.match(env.GITHUB_RUN_ATTEMPT ?? "", /^[1-9]\d*$/);
  assert.ok(["macos", "windows", "windows-2022"].includes(env.WORKSPACE_CI_PLATFORM));
  return { sha: env.GITHUB_SHA, runId: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, platform: env.WORKSPACE_CI_PLATFORM };
}
