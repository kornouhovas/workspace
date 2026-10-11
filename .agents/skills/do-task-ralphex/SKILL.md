---
name: do-task-ralphex
description: "Run an existing Beads task through Ralphex when the user chooses Ralphex, with separate execution/review phases and verified continuation."
---

# Do Task Ralphex

For a new issue or continuation after context reset, first read [the continuous issue flow](references/issue-flow.md). It defines the Matt Pocock route, coordinator ownership, progress and diagnostic evidence.

Input: an existing Beads task and project. The coordinator owns trackers and delivery; Ralphex executes a bounded reviewed plan. Honor project rules, the chosen executor/models and existing authorization.

## Establish the run

Read the actual checkout, `git status --short --branch`, applicable AGENTS.md, linked primary issue and `bd show <ID>`. Verify ownership before execution; claim when appropriate and maintain supported heartbeat leases. Reuse the dedicated worktree, preserving unrelated changes and the shared Beads store.

Inspect installed CLI help and effective configuration. Preserve global settings and the caller-authorized model/effort, disable unapproved notifications/finalization/publication, and pass the deliberate comparison SHA with `--base-ref`. Keep `issueBaseSha` fixed for the full issue history and `lastReviewedSha` separately for follow-up review. Record actual models rather than assuming them.

If the repository supplies `scripts/ralphex-run.mjs`, read `docs/ralphex.md` and use that runner. Otherwise use the explicit phases below and maintain a compact current snapshot plus a separate event history. The snapshot names the task, worktree, issue/review SHAs, phase/status, plan, evidence pointers and next action. Replace obsolete current state; consult historical notes only for the specific failure under investigation. Keep another executor off the same files.

## Plan the next executable stage

Reuse an applicable reviewed plan. Otherwise let Ralphex create it with the verified config/base and `--plan`; inspect scope, checks and permissions before execution. An already authorized conforming plan needs no repeated generic approval.

Include only work executable before the next external dependency in Task sections. Put CI/manual acceptance in coordinator state or outside executable checkboxes. An unperformed required check stays pending. A skip never establishes acceptance. Resume from actual completion evidence; avoid re-planning finished stages.

## Execute, then review

With a repository runner, use its verified commands: `node scripts/ralphex-run.mjs execute --dir <run-dir> --plan <reviewed-plan>`, then on success and verified current ownership `node scripts/ralphex-run.mjs review --dir <run-dir>`. This version keeps that transition explicit; observer lease failure must block the next phase. Do not bypass an older repository runner. Only when no repository runner exists, use the raw CLI fallback:

```sh
ralphex --codex --base-ref "<issue-base-sha>" --config-dir "<run-config>" --skip-finalize --tasks-only "<reviewed-plan>"
```

Capture full logs and actual exit status outside the model context; return a compact result with evidence pointers and retrieve relevant ranges, including during diagnosis. Run relevant checks while iterating and reuse evidence for unchanged inputs. For filesystem/native work, obtain a focused actual-target-OS result at the first working slice, before expanding implementation and full reviews. Local mocks/skips do not establish OS acceptance.

For the no-runner fallback, launch review separately:

```sh
ralphex --codex --base-ref "<review-comparison-sha>" --config-dir "<review-config>" --skip-finalize --review "<actual-plan-path>"
```

The first review covers the whole issue from `issueBaseSha`. Follow-ups use the last successful review SHA plus relevant surrounding context; select the required focused reviewers in the run-local profile. Widen the review deliberately for changed shared contracts. Advance `lastReviewedSha` only after the review completes successfully, the worktree is clean and ancestry is preserved. Reuse a valid receipt for an unchanged HEAD. Resolve the actual plan path if Ralphex archived it.

## Wait and continue

External waiting is coordinator state, not a failing task to execute repeatedly. A runner's `wait` checkpoint is not an event subscription. At an external checkpoint, record the dependency and next action; retain active monitoring and continue independent authorized work. Use supported waits and the progress/lease fallback in the continuous flow. Resume dependent work only after inspecting the required new evidence or decision. Elapsed time is not evidence or approval.

When this checkout supplies `scripts/ralphex-observe.mjs`, follow its actual `docs/ralphex.md` observer CLI and tool-wrapper example. Its internal polls need no LLM; progress/lease deadlines and meaningful events return control. Observe only the selected run or exact CI attempt/SHA with a source-bound cursor. A deadline, advisory progress line or candidate CI result never establishes acceptance. On lease/access/ownership loss, retain evidence and resolve ownership before launching another phase; do not kill or reclaim the existing executor automatically. Older checkouts retain the supported exec-wait fallback.

At meaningful milestones update the linked Beads step with concise commit/evidence references, remaining gate and next step. Keep GitHub's requirements/status authoritative; avoid copying the full execution history into both trackers.

## Verify and deliver

Inspect the full issue diff and accepted criteria, actual test/native results, skips and required delivery. Prose-only trailing commits may reuse exact-code platform evidence when all code/build inputs are verified unchanged and documentation checks pass; identify both revisions truthfully.

Integrate/push/publish only within existing authorization. Close trackers only after their criteria and required delivery are verified, then reread status. Report result, actual checks, limitations and branch/commit in the user's language. Do not automatically claim another task unless authorized.
