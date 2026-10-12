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

- [ ] Record starting HEAD, platform, Node version and input hashes under ignored work/issue-19/observer-budget-test-repair/. Inspect and retain existing controlled red command/exit/log/probe identity from the diagnosis. Distinguish original red, controlled clock mechanism and unproven historical attribution.
- [ ] Minimally extend withSnapshotPublication to control Date.now before observe establishes its deadline. Keep ordinary publication assertions inside budget; allow an explicit 1000ms advance after the first retained running snapshot for expiration. Preserve real filesystem operations and the public observe API without private hooks.
- [ ] Restore Date.now, fsPromises.readFile and synchronized builtin exports in finally before invariant assertions, including failure paths. Preserve process.kill restoration and sequential global-mock use.
- [ ] Apply controlled time coherently to the affected publication family. Preserve exact two-read assertions for permitted rereads and exact one-read assertions for identified ownership/cursor mismatch; retain all eleven rejection variants, denied/dead/invalid PID controls, alias continuity and bound cursor checks.
- [ ] Add an independent expired-budget case with a valid same-execution terminal publication and fixture lock removal. After the controlled advance require exactly one snapshot read, ownership_unknown, running status, unknown ownership, unchanged selected source identity, acceptance not_established and zero heartbeat transport calls. Verify published runner input bytes are unchanged and only the observer-owned cursor lock is released. Do not make this case pass by changing production policy.
- [ ] Run node --test tests/ralphex-observe.test.mjs, then the existing focused integration command node --test tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs tests/windows-observer-diagnostics.test.mjs. Record actual totals/failures/skips; require all applicable controls to pass and confirm real-time tests run after clock restoration.
- [ ] Run npx --no-install eslint tests/ralphex-observe.test.mjs --max-warnings=0, npm run check:docs and git diff --check. Check the complete comparison diff, including plan content, for whitespace and scope. No full product suite, build or coverage target.
- [ ] Inspect the allowlisted diff, unchanged budgets/strict assertions, complete restoration and unchanged production/readiness inputs. Record commands/exits/input identities, test results and limits below.
- [ ] Commit only completed verified changes in English. Finish bounded execution without executor review, push, tracker writes, Actions or UI work.

## Execution Evidence

Pending execution.

## Coordinator Gates

The coordinator performs separate Ralphex and Matt reviews, authorized push and exact-SHA Windows artifact inspection. Original historical causation remains unproven. Readiness delivery at 1ac86583 has independent Actions 38225050450 pending; do not replay that stage. Preserve remaining category-move UI local and runtime plans. Whole Issue #19 acceptance and main integration are outside this bounded execution.
