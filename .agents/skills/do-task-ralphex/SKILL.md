---
name: do-task-ralphex
description: "Run an existing Beads task through Ralphex when the user chooses Ralphex, with separate execution/review phases and verified continuation."
---

# Do Task Ralphex

Input: an existing Beads task and project. The coordinator owns trackers and delivery; Ralphex executes a bounded reviewed plan. Honor project rules, the chosen executor/models and existing authorization.

## Establish the run

Read the actual checkout, `git status --short --branch`, applicable AGENTS.md, linked primary issue and `bd show <ID>`. Verify ownership before execution; claim when appropriate and maintain supported heartbeat leases. Reuse the dedicated worktree, preserving unrelated changes and the shared Beads store.

Inspect installed CLI help and effective configuration. Preserve global settings, disable unapproved notifications/finalization/publication, and pass the deliberate comparison SHA with `--base-ref`. Keep `issueBaseSha` fixed for the full issue history and `lastReviewedSha` separately for follow-up review. Record actual models rather than assuming them.

If the repository supplies `scripts/ralphex-run.mjs`, read `docs/ralphex.md` and use that runner. Otherwise use the explicit phases below and maintain a compact current snapshot plus a separate event history. The snapshot names the task, worktree, issue/review SHAs, phase/status, plan, evidence pointers and next action. Replace obsolete current state; consult historical notes only for the specific failure under investigation. Keep another executor off the same files.

## Plan the next executable stage

Reuse an applicable reviewed plan. Otherwise let Ralphex create it with the verified config/base and `--plan`; inspect scope, checks and permissions before execution. An already authorized conforming plan needs no repeated generic approval.

Include only work executable before the next external dependency in Task sections. Put CI/manual acceptance in coordinator state or outside executable checkboxes. An unperformed required check stays pending. A skip never establishes acceptance. Resume from actual completion evidence; avoid re-planning finished stages.

## Execute, then review

Launch execution separately:

```sh
ralphex --codex --base-ref "<issue-base-sha>" --config-dir "<run-config>" --skip-finalize --tasks-only "<reviewed-plan>"
```

Capture logs and actual exit status. Run relevant checks while iterating and reuse evidence for unchanged inputs. For filesystem/native work, obtain a focused actual-target-OS result at the first working slice, before expanding implementation and full reviews. Local mocks/skips do not establish OS acceptance.

Launch review as a separate phase:

```sh
ralphex --codex --base-ref "<review-comparison-sha>" --config-dir "<review-config>" --skip-finalize --review "<actual-plan-path>"
```

The first review covers the whole issue from `issueBaseSha`. Follow-ups use the last successful review SHA plus relevant surrounding context; select the required focused reviewers in the run-local profile. Widen the review deliberately for changed shared contracts. Advance `lastReviewedSha` only after the review completes successfully, the worktree is clean and ancestry is preserved. Reuse a valid receipt for an unchanged HEAD. Resolve the actual plan path if Ralphex archived it.

## Wait and continue

External waiting is coordinator state, not a failing task to execute repeatedly. Stop the invocation at the checkpoint, record the concrete dependency and next action, then continue independent authorized work. Resume dependent work only after inspecting the required new evidence or decision. Elapsed time is not evidence or approval.

At meaningful milestones update the linked Beads step with concise commit/evidence references, remaining gate and next step. Keep GitHub's requirements/status authoritative; avoid copying the full execution history into both trackers.

## Verify and deliver

Inspect the full issue diff and accepted criteria, actual test/native results, skips and required delivery. Prose-only trailing commits may reuse exact-code platform evidence when all code/build inputs are verified unchanged and documentation checks pass; identify both revisions truthfully.

Integrate/push/publish only within existing authorization. Close trackers only after their criteria and required delivery are verified, then reread status. Report result, actual checks, limitations and branch/commit in the user's language. Do not automatically claim another task unless authorized.
