# Issue #19 Workflow EOL Test Repair


## Overview

Repair LF-only workflow assertions in
tests/windows-observer-diagnostics.test.mjs. Exercise LF
and CRLF versions of the actual checked-in workflow
through the same assertions, preserving the existing
collector validation and upload requirements.
Target plan: docs/plans/issue-19-workflow-eol-repair.md.
One executable task; implementation is outside this
planning session.

## Context

  - GitHub issue:
https://github.com/kornouhovas/workspace/issues/19; linked
Beads step: workspace-31i.12.
  - Checkout: codex/issue-19-category-move.
  - Starting HEAD and lastReviewedSha:
e37625b366640b157d1fb2689b52abf00767bf54.
  - Immutable issueBaseSha:
4f9f11f785c63a65585ea6f33f167fc438272c64.
  - Coordinator snapshot:
work/ralphex/issue-19/current.json.
  - Planning brief and diagnosis:
work/issue-19/workflow-eol-diagnosis/planning-brief.md and
diagnosis.json.
  - Failed Actions:
https://github.com/kornouhovas/workspace/actions/runs/38287377902.
Both dedicated Windows observer jobs recorded 130 passes
and one failure at the workflow assertion.
  - Original CI assertion output explicitly contains CRLF.
The read-only captured-input preload reproduces the same
failure; this establishes the workflow test’s EOL
defect.
  - Modify: tests/windows-observer-diagnostics.test.mjs
and this plan’s completion/evidence record.
  - Read only: .github/workflows/desktop-ci.yml,
scripts/windows-observer-diagnostics.mjs, and the existing
diagnosis/preload/red log.
  - Existing conventions: node:test, assert.match, real
workflow input, bounded pure-Node observer checks.
  - Dependencies: existing Node 22.21.1 and installed
ESLint; no new dependencies or builds.

## Development Approach

  - Testing approach: Matt Pocock TDD at the existing
workflow assertion seam, explicitly selected by the brief.
  - Construct LF and CRLF inputs from the actual workflow
in memory before invoking one shared test-local assertion
routine.
  - Apply the smallest EOL-only repair, preferably
canonicalizing CRLF inside that routine. Preserve
indentation, expressions, commands and paths.
  - Every implementation change includes updated
regression tests. All required focused checks must pass
before completing the task.
  - Preserve historical failures and record actual
red/green commands, exits, input hashes and evidence
pointers.
  - No workflow, production, runtime, dependency,
ownership, privacy, deadline or global configuration
changes.
  - No unrelated full suite, application smoke, native
build, layout replay or percentage-coverage gate for this
bounded test-only repair. Reuse prior evidence only with
explicit relevant-input continuity.
  - Execution model: gpt-6.1-sol:medium; planning and
separate review: high.
  - Executor owns the bounded local changes and commit.
Coordinator owns trackers, separate review, authorized
push and Actions monitoring.

## Implementation Steps


### Task 1: Repair workflow EOL handling and verify the preserved assertions

Files:
  - Modify: tests/windows-observer-diagnostics.test.mjs.
  - Update after execution:
docs/plans/issue-19-workflow-eol-repair.md.
  - Retain ignored evidence under
work/issue-19/workflow-eol-diagnosis/.
  - [ ] Establish red evidence before changing EOL
handling. Run node --import
./work/issue-19/workflow-eol-diagnosis/crlf-preload.mjs
--test --test-name-pattern="full-suite workflow validates"
tests/windows-observer-diagnostics.test.mjs and retain the
actual failing assertion and exit. Preserve crlf-red.log
and the original Actions evidence.
  - [ ] Extract only the existing workflow assertions into
a simple test-local routine. Add named LF and CRLF cases
derived from the real checked-in workflow, keeping the
original test-name prefix so the captured-input command
still selects them. Confirm the CRLF case fails before
repairing handling.
  - [ ] Apply EOL-only handling in the shared routine and
run both formats through all original semantic assertions:
npm test with its observer matrix/evidence environment;
exact validate-call command and matrix environment under
always(); upload guarded by always() and successful
observer-call-validation; exact collector.json path
followed by if-no-files-found: error. Do not replace real
workflow input with a hand-authored fixture or duplicate
the assertion implementation.
  - [ ] Verify assertion sensitivity with small in-memory
mutations of the real workflow for those requirements,
using the same routine and requiring rejection for both
EOL formats. Keep tracked workflow bytes unchanged and
avoid broad whitespace matching.
  - [ ] Rerun the original CRLF-preload command and the
normal focused workflow test, requiring both formats to
pass. Then run node --test tests/ralphex-observe.test.mjs
tests/ralphex-run.test.mjs
tests/windows-observer-diagnostics.test.mjs; require exit
zero and no skipped required regressions. Run npx
--no-install eslint
tests/windows-observer-diagnostics.test.mjs
--max-warnings=0, npm run check:docs and git diff --check.
  - [ ] Record commands, exits, platform/Node version,
starting SHA, test/workflow input hashes and red/green
evidence in ignored files; update diagnosis.json and add a
concise verification record to this plan. Keep
actualWindows pending until coordinator inspection of a
new reviewed-SHA run. Identify any reused
native/layout/type evidence and verify unchanged relevant
inputs; do not infer platform acceptance from local tests.
  - [ ] Inspect the bounded diff, verify
workflow/runtime/product inputs remain unchanged, stage
only tests/windows-observer-diagnostics.test.mjs and this
plan, run git diff --cached --check and commit the
verified task in English. Report the commit, checks and
pending gates in Russian.

## Post-Completion: Coordinator-Owned Gates

Separate review is required before delivery. The
coordinator retains ownership of tracker changes,
authorized task-branch push, exact-SHA Actions monitoring
and artifact inspection.
Preserve both failed observer jobs and all other outcomes
from run 38287377902. Actual Windows verification remains
pending for windows-latest and windows-2022, including the
original full-suite invocation where required. Local CRLF
success does not complete Issue #19 or resolve independent
failures.
No executor push, dispatch, merge, publication or issue
closure is included.
