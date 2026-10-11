# Issue 18: Repair resolver workflow test coverage

## Overview

Repair the stale workflow expectation in `tests/windows-product-diagnostics.test.mjs` after the two intentional resolver diagnostic commands were added. Preserve strict command membership, failure conditions, separate artifacts and existing acceptance gates.

Plan destination: `docs/plans/issue-18-resolver-workflow-test-repair.md`.

## Context

- Requirements: `work/issue-18/ci-38146187798/workflow-repair-task.md`.
- Evidence: `diagnosis.json`, `workflow-red.log` and `workflow-probe.json` in the same directory.
- GitHub issue: https://github.com/kornouhovas/workspace/issues/18.
- Failed Actions run: https://github.com/kornouhovas/workspace/actions/runs/38146187798.
- Failed revision: `574dc61e920222a3cfa92753c75cf4977b6506df`.
- Proven cause: the ready-parent workflow test expects only the original command and controlled checks, rejecting the two intentional resolver additions.
- Existing test seam: parse `.github/workflows/desktop-ci.yml` with `js-yaml` and assert the `windows-ready-selection` job contract.
- Dependencies: existing installed packages and Node 22.21.1; no new dependencies.

## Development Approach

- **Testing approach**: TDD using the existing failing workflow regression, followed by the minimal test repair.
- The requested workflow seam and scope are already accepted. Reuse the settled diagnosis.
- Own only `tests/windows-product-diagnostics.test.mjs` and this plan.
- Update tests within the single task; all required local checks must pass before committing and handing off.
- Preserve run-local gpt-6.1-sol/high configuration, global settings and coordinator ownership.
- Save execution logs only under ignored `work/issue-18/ci-38146187798/`.
- Exclude production code, workflow changes, CI scripts, timeouts, retries, shutdown fixes and UI changes.
- Do not push, dispatch Actions, alter trackers or coordinator state, or trigger notifications/finalization.
- No additional documentation files or percentage-coverage gate are required for this bounded test repair.

## Implementation Steps

### Task 1: Repair the exact workflow regression and verify its integrated consumers

**Files:**
- Modify: `tests/windows-product-diagnostics.test.mjs`.
- Create: `docs/plans/issue-18-resolver-workflow-test-repair.md` after draft acceptance.
- Read only: `.github/workflows/desktop-ci.yml`.
- Evidence only: ignored `work/issue-18/ci-38146187798/`.

- [ ] Select Node 22.21.1, confirm its version, and rerun the original focused command before editing. Capture the expected exact-command mismatch under the ignored evidence directory.
- [ ] Update the existing ordered command expectation to exactly the four commands listed below. Preserve the original command and existing controlled checks; reject arbitrary extra commands rather than filtering them out.
- [ ] Assert the original command has no explicit condition and each of the three subsequent run steps uses `always()`. Preserve the matched `windows-latest`/`windows-2022` matrix, `fail-fast: false`, independent job, five-minute timeout, pinned Node version and absence of job/step `continue-on-error`.
- [ ] Assert exactly two uploads, validating each separately against its literal name and path listed below. Require `always()` and `if-no-files-found: error` for both. Preserve historical manual opt-in gates and the existing full `verify` job and `npm test` assertions.
- [ ] Run the focused regression, full affected test file, neighboring resolver controls, scoped ESLint, documentation links and diff checks using the commands below. Run `npm test` once against the final test code to catch integrated consumers. Capture exit statuses and actual pass/fail/skip counts; do not treat platform skips as Windows acceptance.
- [ ] Review the scoped and staged diff, verify only the owned plan/test changes are staged, and commit verified changes explicitly with an English message identifying the stale workflow expectation. Report the commit and local results, leaving external acceptance to the coordinator.

Exact ordered run commands:

```text
node scripts/windows-ready-selection.mjs
node scripts/windows-resolver-diagnosis.mjs
node --test tests/windows-explorer-selection.test.mjs tests/windows-resolver-diagnosis.test.mjs
node --test tests/windows-ready-selection.test.mjs tests/windows-ready-selection-com.test.mjs tests/file-manager-evidence.test.mjs
```

Separate upload contracts:

- Original name: `issue-17-windows-ready-select-${{ matrix.os }}`
- Original path: `work/windows-ready-selection-evidence/result.json`
- Read-only series name: `issue-18-windows-resolver-read-only-series-${{ matrix.os }}`
- Read-only series path: `work/issue-18/windows-resolver-diagnosis/read-only-series/`
- Both uploads: `always()` and `if-no-files-found: error`.

## Local Verification

Export PATH inside every verification shell because a login shell can reset it:

```sh
export PATH="/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH"
```

Confirm `node --version` reports `v22.21.1`.

Run these checks in order, retaining logs under the ignored evidence directory:

- Before and after repair: `node --test --test-name-pattern='ready-parent command uses matched fresh jobs' tests/windows-product-diagnostics.test.mjs`
- Full affected file: `node --test tests/windows-product-diagnostics.test.mjs`
- Neighboring controls: `node --test tests/windows-explorer-selection.test.mjs tests/windows-resolver-diagnosis.test.mjs tests/windows-ready-selection.test.mjs tests/windows-ready-selection-com.test.mjs tests/file-manager-evidence.test.mjs`
- Scoped lint: `npx --no-install eslint tests/windows-product-diagnostics.test.mjs --max-warnings=0`
- Documentation: `npm run check:docs`
- Integrated suite, once on final code: `npm test`
- Working diff: `git diff --check`
- Before commit: `git diff --cached --check` and `git diff --cached`

The initial focused reproduction must show the known failure. All post-repair required checks must pass before committing. Preserve and report any unexpected failure without expanding this task into an unrelated repair.

## Post-Completion: Coordinator-Owned Acceptance

- Separate review and actual-platform Actions acceptance remain coordinator-owned.
- Local macOS success does not establish acceptance on either Windows image.
- The unrelated Windows Electron shutdown failure remains outside this repair.
- Historical resolver causation and whole Issue 18 completion remain separate from the proven workflow-test cause.
