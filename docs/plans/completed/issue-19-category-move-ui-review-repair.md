# Issue 19: Resolve local UI review findings

## Overview

Complete the confirmed follow-up findings on the already implemented UI slice. Do not repeat the completed three-task UI plan, service, runner or platform diagnostics.

## Context and scope

- Issue: https://github.com/kornouhovas/workspace/issues/19; Beads workspace-31i.12.
- Reviewed starting HEAD: ae00317656c2c0465a9e51c48a56b4384d89aa81. The immutable issue base remains 4f9f11f785c63a65585ea6f33f167fc438272c64.
- Confirmed requirement finding and red-capable original symptom probe: work/issue-19/follow-up-review-ae00317/result.json and creation-status-probe.tsx. It asserts the defect (disabled read-only status); invert the expected behavior in the tracked regression before fixing.
- The existing accepted UI plan requires conflicting effects to remain blocked while explicit status stays usable. A delayed initial creation list can arrive after an unsubmitted category editor opens; status must remain available without dismissing that editor.
- Matt Standards found stale current-runtime descriptions in docs/architecture.md and docs/development.md, plus unnecessary service implementation wording in the EN/RU physical-move hint.
- Approved seams remain production React interactions through WorkspaceServiceClient and existing production-component Ladle fixtures.
- Read actual AGENTS.md, docs/development.md and installed Matt Pocock implement/tdd. Node 22.21.1 is /Users/aleksandersk/.nvm/versions/node/v22.21.1/bin; explicitly select it inside each shell.
- Preserve service/API/native/runner/CI/dependencies, existing external gates, read-only versus mutation safety, and historical cause limits. No tracker writes, push, merge, Actions, package or graphical production-runtime expansion.
- This is a bounded repair under the existing reviewed requirements, not a new UI feature or replanning of completed work.

## Implementation Steps

### Task 1: Keep creation status usable and align current UI documentation

Files:
- Modify src/renderer/components/DiscoveryPanel.tsx and ProjectCreationPanel.tsx only as needed to separate the newly added category source-effect blocking from read-only creation status/list access.
- Modify tests/project-category-move-ui.test.tsx and directly affected tests/project-creation-ui.test.tsx only as needed.
- Modify src/renderer/localization.ts and scripts/smoke-discovery-layouts.mjs for the same shortened EN/RU hint.
- Modify docs/architecture.md and docs/development.md to describe the implemented local Table category edit/status/recovery UI while explicitly retaining pending actual Windows and graphical development/package/whole-issue acceptance.
- Modify this plan only for completion evidence.

- [x] Add an EN/RU delayed-initial-creation-list regression at the real DiscoveryWorkspace seam. Require enabled explicit creation status and actual read-only status request with the category editor still open; no category/creation/recovery mutation may be sent. Establish red before the fix using the retained symptom, without copying the large ignored probe wholesale.
- [x] Make the smallest change that separates category-effect blocking from creation status/list access. Preserve existing mutation disabled conditions, backend/pending guards, unknown request handling, fresh-preview requirements and source coordination. Do not generalize the entire mutation framework.
- [x] Remove the technical final sentence from moveCategoryHint in both languages; retain the physical move and exact name/Text preservation explanation. Update only the directly corresponding presentation assertion.
- [x] Correct stale current runtime descriptions, distinguishing implemented UI from pending actual-platform/runtime acceptance. Check nearby current capability wording for the same directly contradicted claim.
- [x] With Node 22.21.1, run focused category/creation/rename/recovery/components tests, npm run typecheck, targeted ESLint for changed source/script/tests, npm run check:docs and git diff --check. Full npm test already passed 2451 tests at the starting SHA; do not repeat it for this bounded repair unless a new failure or broader boundary change justifies it.
- [x] Rebuild Ladle once and run node scripts/smoke-discovery-layouts.mjs --category-move with a new ignored evidence directory, sequentially while no other fixture consumes dist. Inspect feature/shutdown results and changed EN/RU screenshots. Preserve any failed/unreached result; normal quit limits remain unchanged.
- [x] Record exact commands/exits and scoped diff in work/issue-19/category-move-ui-review-repair/. Commit only verified task paths, then archive the completed plan with valid links.

## Coordinator-owned gates

Separate Ralphex and Matt Standards/Spec review, authorized branch push and exact-SHA Actions follow. Inspect actual Windows category UI tests before materializing the preserved graphical runtime stage. The independent persistent-sharing test repair remains a separate preserved plan. Do not close Issue19 or merge main.

## Task 1 completion evidence

Implemented the bounded status-access repair, shortened both physical-move hints and corrected current capability descriptions. `ProjectCreationPanel` receives the category effect block separately: status/list access retains the existing general disabled/backend/pending guards, while creation, original retries, recovery review and recovery submission retain all effect blocks. The real `DiscoveryWorkspace` regression preserves the category editor and selected destination during an explicit creation status request and proves no creation/category/recovery mutation was submitted. No service/API/native/runner/CI/dependency changes were made.

All commands selected Node 22.21.1 by prepending `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH. Full commands, actual exits, retained failures, screenshots and scoped diff are recorded in `/Users/aleksandersk/Documents/programming/Projects/project_folder/.worktrees/issue-19-category-move/work/issue-19/category-move-ui-review-repair/result.json`.

- Red regression: exit 1, both EN/RU cases observed disabled status; `regression-red.log`.
- Green regression: exit 0, 2 passed without skips; `regression-green-final.log`. The intervening absolute list-count assertion failure is preserved in `regression-green.log`; it was corrected to compare the explicit reload against its preceding count.
- Focused category/creation/rename/recovery/components: exit 0, 530 passed without skips; `focused-tests.log`. Category-only verification after test type annotation: exit 0, 191 passed without skips; `category-tests-final.log`. The final additional return annotation is erased and does not change tested runtime behavior.
- Typecheck: exit 0, `typecheck-passed.log`; two earlier test-client typing failures (exit 2) remain in `typecheck.log` and `typecheck-final.log`.
- Targeted ESLint: exit 0; final annotation check is recorded in `lint-archival.log`. Documentation links and staged/unstaged whitespace checks after archival: exit 0, `docs-archival.log` and `diff-check-archival.log`.
- Single `npm run build:ladle`: exit 0, `build-ladle.log`. `node scripts/smoke-discovery-layouts.mjs --category-move` with a fresh evidence directory: exit 0, 50 stories, 150 EN/RU screenshots and 50 interactions passed; `ladle-smoke.log` and `ladle-category-move-20261012/ladle-observations.json`. Both `featurePassed` and `shutdownPassed` are true. The changed EN/RU editing screenshots at 420×800 were visually inspected; normal quit limits were unchanged.

The completed plan is archived here and committed with only the explicit task paths. Review, actual Windows/exact-SHA CI, graphical production development/package acceptance and whole-issue completion remain coordinator-owned pending gates.
