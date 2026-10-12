# Issue 19: Bounded residual acceptance diagnosis

## Overview

Diagnose the three residual failures from Actions run
38278860195 at reviewed SHA
1ab9270062cec490c928ab7d50420aaa8bd05532. Make only
evidence-backed fixture or diagnostic changes. Where
historical attribution remains unavailable, retain finite
sanitized evidence and an explicit pending platform gate.
The coordinator materialized and reviewed this Ralphex draft after the planning-only CLI ended at its expected EOF review prompt. Arbitrary coverage targets were removed; only relevant checks apply. Later execution remains a separate repository-runner phase.

## Context

  - Issue:
https://github.com/kornouhovas/workspace/issues/19.
  - Worktree: issue-19-category-move; branch:
codex/issue-19-category-move.
  - Immutable issue base:
4f9f11f785c63a65585ea6f33f167fc438272c64.
  - Current HEAD and last reviewed SHA:
1ab9270062cec490c928ab7d50420aaa8bd05532.
  - Saved run metadata confirms completed failure. The
coordinator snapshot’s earlier in-progress status is
historical.
  - Category implementation is completed. Early service
checks, dedicated observer artifacts, both Windows
cursor-ownership suites and Windows-2022 verification
already passed; do not replay them.
  - Original evidence:
work/issue-19/actions-38278860195-failures/diagnosis.json,
saved macOS and Windows-latest job logs,
actions-38278860195-current.json and available JSONs under
actions-38278860195-selected/.
  - macOS layout failed at
scripts/smoke-discovery-layouts.mjs:273 after
Escape/reopen: destination remained selected instead of
the original category. The built local original run passed
150 captures. Earlier missing Ladle metadata was setup
failure.
  - Windows-latest collector failed at
tests/windows-observer-diagnostics.test.mjs:75 with
collection failed instead of complete. Its original
per-call document was not retained; duration alone
establishes no cause.
  - Windows-latest direct development creation failed at
scripts/smoke-project-creation.mjs:333 with zero reported
native calls. Selected observations retain one
started/stopped bridge and one matched cleanup window,
which do not establish successful invocation.
  - Related patterns: disposable fixtures, public
Electron/Ladle interaction,
collectObserverDiagnostics/validateEvidence, strict
product diagnostic snapshots, independent native selection
evidence and owned cleanup.
  - Dependencies: installed locked dependencies, Node
22.21.1 and existing built inputs. No new dependencies or
public domain APIs.

## Development Approach

  - Testing approach: Matt Pocock diagnosing-bugs with TDD
at the existing public fixture and diagnostic seams
identified below.
  - Before probes, announce ranked falsifiable hypotheses
in progress. Change one variable per probe; bound and
record repetitions.
  - Capture full command output, exit status, source/build
identities and diagnosis records under ignored
work/issue-19/residual-acceptance/.
  - Separate original, captured-input and injected-symptom
reproduction from historical cause. Keep cause unproven
unless evidence establishes attribution.
  - Every code-changing task must include meaningful new
or updated tests and observed red/green evidence at the
changed seam.
  - All affected tests must pass before starting the next
task. A remaining external failure may be handed off only
with passing diagnostic regressions and an explicit
pending gate.
  - Preserve keyboard controls, assertion meaning,
production observer ownership, native deadlines, schemas,
renderer isolation and normal shutdown requirements.
  - No arbitrary sleeps, timeout increases, reduced
concurrency, native retries, production policy fixes or
broad refactoring.
  - Run graphical checks sequentially. Verify relevant
input continuity before reuse; never build or clean while
fixtures consume dist.
  - Later execution must use scripts/ralphex-run.mjs with
gpt-6.1-sol:medium, followed by separate high-effort
review. Coordinator owns trackers, push and external
Actions.

## Implementation Steps

### Task 1: Diagnose category editor reopen readiness
Files:
  - Modify only if justified:
scripts/smoke-discovery-layouts.mjs.
  - Existing focused runtime layout helper/tests may be extended if required to test the actual fixture readiness seam: scripts/runtime-layout.mjs and tests/runtime-layout.test.mjs.
  - Modify only if fixture preparation is implicated:
src/renderer/components/bb-foundation.stories.tsx.
  - Update relevant interaction tests:
tests/project-category-move-ui.test.tsx.
  - Read only:
src/renderer/components/ProjectCategoryMovePanel.tsx.
  - Create ignored probe/evidence files:
work/issue-19/residual-acceptance/layout/.
  - [ ] Retain the original failure, selected Ladle
observations and local 150-capture success with exact
provenance; record failed, passed and unreached stages
separately.
  - [ ] Rank and announce hypotheses: focus precedes
committed reset; native select keyboard state affects
reopening; fixture preparation reruns or restores
destination. Specify the observable prediction for each.
  - [ ] Construct a finite actual Electron/Ladle loop
using the original editing fixture and public
Escape/reopen/typeahead/Enter controls in EN/RU. Observe
selection, focus and mutation counts without setting the
reopened selection; record single-variable probe outcomes.
  - [ ] If readiness is demonstrated, add a bounded
condition-based fixture wait for the original category and
usable focused editor. Preserve the original equality
assertion and zero preparation mutations. If a product
defect is demonstrated, retain its evidence and report it
for coordinator scope review without changing production
semantics.
  - [ ] Add or update regression coverage for the
demonstrated seam before repair; retain red/green results.
Run node --import tsx --test
tests/project-category-move-ui.test.tsx and targeted
ESLint.
  - [ ] Refresh Ladle only when affected inputs require
it, then run
WORKSPACE_SMOKE_EVIDENCE_DIR=work/issue-19/residual-acceptance/layout/original
node scripts/smoke-discovery-layouts.mjs --category-move.
Require all 150 captures, EN/RU interactions and normal
Electron quit; retain any failure without an unchanged
retry.
### Task 2: Distinguish observer collection failure
boundaries
Files:
  - Modify only as required:
scripts/windows-observer-diagnostics.mjs.
  - Update: tests/windows-observer-diagnostics.test.mjs.
  - Modify only for necessary sanitized transport:
.github/workflows/desktop-ci.yml.
  - Read only: scripts/ralphex-observe.mjs.
  - Create ignored probe/evidence files:
work/issue-19/residual-acceptance/observer/.
  - [ ] Record the original strict full-suite failure and
missing per-call document. Rank and announce predictions
for child readiness failure, case collection failure and
child/file cleanup failure; do not infer cause from 2677
ms.
  - [ ] Exercise collectObserverDiagnostics through
bounded controlled probes, changing one lifecycle boundary
at a time. Retain strict validated documents, actual exits
and unrelated-fixture preservation; label injected
controls explicitly.
  - [ ] Add bounded per-call evidence retention before
assertions so a subsequent real full-suite failure
preserves its collector document with actual checkout SHA,
platform, matrix, run and attempt. Use strict allowlists
and size/count limits; exclude PIDs, tokens, raw paths,
errors, logs and environment contents.
  - [ ] Extend existing always-upload transport minimally
if needed, validating only sanitized per-call files and
exact provenance. Preserve npm test semantics,
matrix/concurrency, observer ownership, deadlines and
failed-result status.
  - [ ] Add red/green regressions for the changed
retention/validation seam, including failed collection,
absent/malformed evidence, privacy rejection and owned
cleanup. Apply a diagnostic repair only if probes justify
it; otherwise retain cause unproven.
  - [ ] Run node --test
tests/windows-observer-diagnostics.test.mjs
tests/ralphex-observe.test.mjs tests/ralphex-run.test.mjs,
relevant workflow tests if transport changed, and targeted
ESLint. Do not replay local npm test to imitate the
unavailable historical Windows load.
### Task 3: Preserve native invocation outcomes without
changing intent
Files:
  - Modify: scripts/smoke-project-creation.mjs.
  - Modify existing evidence helpers only where needed:
scripts/native-bridge-evidence.mjs,
scripts/windows-product-diagnostics.mjs,
scripts/runtime-evidence.mjs.
  - Update affected tests:
tests/native-bridge-evidence.test.mjs,
tests/windows-product-diagnostics.test.mjs and
tests/runtime-readiness.test.mjs.
  - Read only: production Reveal routing and
tests/windows-project-reveal.test.mjs.
  - Create ignored probe/evidence files:
work/issue-19/residual-acceptance/native/.
  - [ ] Retain the original direct after_evidence
observations. Rank and announce predictions for absent
invocation, recorded-but-unreturned selection,
renderer/status failure and native bridge response
failure.
  - [ ] Construct bounded controls through the actual
fixture polling/evidence seam, including a recorded select
without done. Demonstrate whether polling exhaustion
discards incomplete calls as an empty array; distinguish
this controlled mechanism from the historical Windows
cause.
  - [ ] Capture finite terminal polling outcomes before
assertions: bounded navigation/selection/returned counts,
exact-target comparison, allowlisted renderer/response
status and bridge cleanup. Retain incomplete observations
truthfully while keeping them failed; observation must
never invoke Reveal again.
  - [ ] Preserve immediate Reveal on the newly available
row, active production observation, no Refresh/sibling
switch/settling wait, one real parent navigation and
completed selection, truthful acknowledgment, exact
file-manager observation and existing cleanup deadlines.
  - [ ] Add meaningful red/green tests for changed
evidence/polling behavior, covering absence, incomplete
and completed calls, duplicates, unavailable reads and
privacy. Extend strict existing snapshots/validators
instead of introducing a general tracing system.
  - [ ] Run node --test
tests/native-bridge-evidence.test.mjs
tests/windows-product-diagnostics.test.mjs
tests/runtime-readiness.test.mjs
tests/windows-project-reveal.test.mjs and targeted ESLint.
Where local prerequisites permit, run only the focused
original development direct after_evidence smoke in a
fresh evidence directory; label its actual OS and retain
Windows acceptance pending.
### Task 4: Verify the bounded delta and document pending
gates
Files:
  - Update as applicable: docs/ralphex.md.
  - Update verification limits:
docs/verification/issue-19-category-move-ui.md and
docs/verification/issue-17-create-reveal.md.
  - Update docs/development.md only if diagnostic usage
changed.
  - Update plan completion/evidence references.
  - Create ignored handoff:
work/issue-19/residual-acceptance/handoff.json.
  - [ ] Inspect every changed file against the plan and
original contracts. Remove temporary instrumentation from
tracked files; retain labeled probes and full evidence
under the ignored directory.
  - [ ] Run the union of affected tests not already
verified against unchanged inputs, targeted ESLint, npm
run typecheck when TypeScript/UI changed, npm run
check:docs and git diff --check. Reuse checks only with
recorded input continuity; do not replay unrelated suites
or platform runs.
  - [ ] Document observed behavior, commands/exits,
regression results and reproduction-versus-cause limits.
Extend tests if final evidence/schema changes require
them; rerun the affected tests before completion.
  - [ ] Produce a finite handoff for all three failures,
including justified changes, unresolved causes, missing
artifacts, exact input identities and required coordinator
checks. Diagnostic completion must not imply
original-scenario or Issue 19 completion.
  - [ ] Commit coherent verified task changes with
explicit paths and English messages. Leave tracker writes,
push, Actions, merge and publication to the coordinator.

## Post-Completion

  - Coordinator performs separate Ralphex and Matt
Standards/Spec review of the bounded delta and original
contracts.
  - After review, coordinator handles the authorized
branch push and new exact-SHA Actions.
  - Actual Windows-latest original full-suite collector
and direct development after_evidence native scenarios
remain required gates. Dedicated diagnostics, injected
controls, grouped/package success and local macOS success
cannot substitute for them.
  - Inspect actual macOS category layouts and both Windows
verification results at the reviewed SHA, including
sanitized failure artifacts, native selection, shutdown
and cleanup.
  - If attribution remains unavailable, request the
precise retained per-call evidence through coordinator
state. No guessed production fix, unchanged retry or
whole-issue completion claim.
