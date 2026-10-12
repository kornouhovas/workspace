# Issue #19: Bounded observer publication test timing repair

## Overview

Make publication-interleaving assertions deterministic through test-scoped host time at the public observe seam. Separately verify that expiration prevents the consistency reread and retains ownership uncertainty. Production behavior remains unchanged.

## Context

- Issue: https://github.com/kornouhovas/workspace/issues/19; Beads workspace-31i.12.
- Reviewed baseline: 1ac86583ed7cf059cc538ac41e3f8ff3ab0e177a; immutable issue base: 4f9f11f785c63a65585ea6f33f167fc438272c64.
- Ralphex draft: work/issue-19/observer-budget-diagnosis/plan-draft.md, from work/ralphex/issue-19/observer-budget-planning.log.
- Diagnosis: work/issue-19/observer-budget-diagnosis/diagnosis.json, control.log and expired-budget.log.
- Original Actions 38222572956 attempt 1 at 1ee8788a0cd05405276f9aa053d1bade9035dc5a: windows-2022 observer job 114722136350 reported 102 passes, one failure, zero skips. Foreign/invalid publication rejection observed one snapshot read instead of two; strict ownership/no-heartbeat assertions passed.
- The neutral control passes all eleven rejection variants. Advancing only Date.now by 1000ms after the retained running read reproduces the exact count failure under the existing 90ms budget.
- This proves a controlled mechanism; historical Windows timing attribution remains unproven. The original Windows scenario remains a coordinator CI gate.
- Existing Node 22.21.1 and node:test; no dependencies added.

## Development Approach

Use the existing public observe seam and real filesystem publication helper. Reuse the already retained controlled red rather than rerunning unchanged probes for green. Complete one bounded test repair with its focused verification. Only tests/ralphex-observe.test.mjs and this plan (including its completed archive) may change.

Read scripts/ralphex-observe.mjs and docs/ralphex.md without modifying them. Preserve finite budgets, canonical identities, cursor continuity, PID checks, heartbeat restrictions and cleanup. Keep clock control local to sequential publication tests; real-time polling, lease, cancellation and process controls must retain real time. No production/readiness/CI/service/UI edits, budget increases, sleeps, retries or assertions accepting either one or two reads.

## Implementation Steps

### Task 1: Control publication time and verify the expiration boundary

- [x] Record starting HEAD, platform, Node version and input hashes under ignored work/issue-19/observer-budget-test-repair/. Inspect and retain existing controlled red command/exit/log/probe identity from the diagnosis. Distinguish original red, controlled clock mechanism and unproven historical attribution.
- [x] Minimally extend withSnapshotPublication to control Date.now before observe establishes its deadline. Keep ordinary publication assertions inside budget; allow an explicit 1000ms advance after the first retained running snapshot for expiration. Preserve real filesystem operations and the public observe API without private hooks.
- [x] Restore Date.now, fsPromises.readFile and synchronized builtin exports in finally before invariant assertions, including failure paths. Preserve process.kill restoration and sequential global-mock use.
- [x] Apply controlled time coherently to the affected publication family. Preserve exact two-read assertions for permitted rereads and exact one-read assertions for identified ownership/cursor mismatch; retain all eleven rejection variants, denied/dead/invalid PID controls, alias continuity and bound cursor checks.
- [x] Add an independent expired-budget case with a valid same-execution terminal publication and fixture lock removal. After the controlled advance require exactly one snapshot read, ownership_unknown, running status, unknown ownership, unchanged selected source identity, acceptance not_established and zero heartbeat transport calls. Verify published runner input bytes are unchanged and only the observer-owned cursor lock is released. Do not make this case pass by changing production policy.
- [x] Run node --test tests/ralphex-observe.test.mjs, then the existing focused integration command node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs. Record actual totals/failures/skips; require all applicable controls to pass and confirm real-time tests run after clock restoration.
- [x] Run npx --no-install eslint tests/ralphex-observe.test.mjs --max-warnings=0, npm run check:docs and git diff --check. Check the complete comparison diff, including plan content, for whitespace and scope. No full product suite, build or coverage target.
- [x] Inspect the allowlisted diff, unchanged budgets/strict assertions, complete restoration and unchanged production/readiness inputs. Record commands/exits/input identities, test results and limits below.
- [x] Commit only completed verified changes in English. Finish bounded execution without executor review, push, tracker writes, Actions or UI work.

## Execution Evidence

- Starting HEAD: `33148c6a889cbc79705c36f53ee1bfcbe0ebd06a`; macOS arm64, Node `v22.21.1` selected through command-local PATH.
- Full ignored evidence directory: `/Users/aleksandersk/Documents/programming/Projects/project_folder/.worktrees/issue-19-category-move/work/issue-19/observer-budget-test-repair/`. `initial.json` records platform, starting input SHA-256 hashes and retained diagnosis/probe identities; `verification.json` records commands, actual exits, test totals and unchanged-input hashes.
- Retained diagnosis: original Windows Actions 38222572956 attempt 1 at `1ee8788a0cd05405276f9aa053d1bade9035dc5a` failed the exact two-read assertion. The separate injected clock probe (`node --test --test-name-pattern="terminal consistency reread rejects foreign and invalid publications" work/issue-19/observer-budget-diagnosis/expired-budget.test.mjs`) exited 1 with actual 1 versus expected 2; its clock-neutral control exited 0, one pass, zero failures/skips, covering all eleven variants. Copies of diagnosis, both probes and full logs are retained under the evidence directory as `retained-*`. These demonstrate a controlled expiration mechanism; historical Windows attribution remains unproven.
- Helper time is frozen before the public observer establishes its deadline; the independent expiration case advances it by exactly 1000 ms after the retained running read. Existing 90 ms budgets, exact one/two-read assertions, eleven invalid/foreign publications, PID restrictions, cursor identity and alias continuity remain intact.
- Expiration returns one read, `ownership_unknown`, running status, unknown ownership, the selected source identity, `acceptance: not_established` and zero heartbeat calls despite a valid terminal publication and fixture executor-lock removal. Published runner bytes and an unrelated observer lock are preserved; only the selected observer cursor lock is released.
- Date.now, filesystem reads and synchronized builtin exports are restored in finally before invariant assertions. A throwing-check regression confirms restoration through a fresh public observation; the existing denied-PID restoration remains intact. Later real-time polling, lease, cancellation and process controls passed with the clock restored.

| Command | Actual exit and result | Full log in evidence directory |
| --- | --- | --- |
| `node --test tests/ralphex-observe.test.mjs` (initial) | 1; 82/83 passed, one new restoration-test assertion failed, zero skips | `observer-tests.log` |
| `node --test tests/ralphex-observe.test.mjs` (final) | 0; 83/83 passed, zero failures/skips/cancellations | `observer-tests-final.log` |
| `node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs` | 0; 105/105 passed, zero failures/skips/cancellations | `focused-integration.log` |
| `npx --no-install eslint tests/ralphex-observe.test.mjs --max-warnings=0` | 0; no warnings/errors | `eslint.log` |
| `npm run check:docs` | 0; local Markdown links checked in 103 files | `docs.log` |
| `git diff --check` | 0; no whitespace errors | `diff-check.log` |

The initial new-test failure expected a repeated terminal cursor to report failure; unchanged terminal state correctly returns deadline. The corrected restoration check uses a fresh observer-owned cursor and passed. The original failed log is retained.

Final test SHA-256: `33edd0d1f31dde372100ec525ad2688e9143fef0ca0b0a288eee341c8ef41f50`. Production observer, source adapter, runner, diagnostics, readiness tests/helper, dependency resolution and `docs/ralphex.md` hashes remain unchanged. Only the test and this plan are modified. The complete comparison diff is retained as `comparison.diff`; documentation and whitespace checks passed. The commit stages only `tests/ralphex-observe.test.mjs` and this plan; its actual SHA and exit are retained in `commit.json` and `commit.log` in the evidence directory. No product build/full suite, executor review, tracker writes, push, Actions or UI work was performed. Local evidence does not establish Windows acceptance or resolve the historical cause.

## Coordinator Gates

The coordinator performs separate Ralphex and Matt reviews, authorized push and exact-SHA Windows artifact inspection. Original historical causation remains unproven. Readiness delivery at 1ac86583 has independent Actions 38225050450 pending; do not replay that stage. Preserve remaining category-move UI local and runtime plans. Whole Issue #19 acceptance and main integration are outside this bounded execution.
