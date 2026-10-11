# Issue 18: Windows resolver diagnostic feedback loop

## Overview

Add bounded evidence for the existing resolveSystemExplorer invocation and a separate read-only Windows sampling command. This stage implements diagnostic observability only. It preserves resolver authorization, native behavior and existing failure gates.

Accepted plan destination: docs/plans/issue-18-windows-resolver-diagnosis.md.

## Context

- Requirements: work/issue-18/ci-38143599095/resolver-diagnosis-task.md.

- Diagnosis: work/issue-18/ci-38143599095/diagnosis.json.

- Failed run: https://github.com/kornouhovas/workspace/actions/runs/38143599095.

- Exact failed revision: 4da74907d58391bc56eedcb187dbc5ab4fe067aa.

- Windows2022 failed at resolver/unavailable before fixture creation, Open or Select. The approximately ten-second step duration does not establish timeout, execution-policy or compilation cause.

- Existing resolver: scripts/windows-explorer-selection.mjs.

- Original caller: scripts/windows-ready-selection.mjs.

- Fixed read-only PowerShell resource: scripts/windows-explorer-directory.ps1.

- Existing controls: tests/windows-explorer-selection.test.mjs, tests/windows-ready-selection.test.mjs, tests/windows-ready-selection-com.test.mjs and tests/file-manager-evidence.test.mjs.

- CI integration: windows-ready-selection in .github/workflows/desktop-ci.yml, covering windows-latest and windows-2022 with a five-minute job deadline.

- Dependencies: existing Node 22.21.1 and hosted Windows PowerShell; no new packages or native builds.

## Development Approach

- Testing approach: TDD, one failing behavioral test followed by its minimal implementation.

- Use Matt Pocock diagnosing-bugs Phase 1: establish a classified feedback loop before developing hypotheses or selecting a cause fix.

- Test the requested seams: actual resolveSystemExplorer orchestration through its existing process seam, original ready-selection evidence, and the new loop/CLI boundary.

- Preserve the fixed program, fixed script arguments, ten-second resolver timeout, 1,024-byte output limit, empty-stderr requirement and exact case-insensitive C:\Windows output with LF or CRLF.

- Observe the existing subprocess lifecycle without changing its execution policy, termination policy or deadline. A killed flag or rejection alone never proves direct-child termination.
- If direct-child termination is unknown, stop the series and mark remaining samples unreached. Never start another resolver over an unverified owned child. The aggregate deadline cannot turn a still-pending call into a completed or accepted outcome; preserve its unknown state and existing process deadline.

- Use gpt-6.1-sol/high in run-local configuration; preserve global settings and existing coordinator ownership.

- Complete the single local task, pass all affected checks and commit explicitly before handoff.

- Local injected failures verify instrumentation behavior, not historical Windows causation. Actual-Windows observations remain pending.

## Implementation Steps

### Task 1: Add finite resolver evidence and the independent read-only sampling loop

Files:

- Modify: scripts/windows-explorer-selection.mjs.

- Modify: scripts/windows-ready-selection.mjs.

- Modify: tests/windows-explorer-selection.test.mjs.

- Modify: tests/windows-ready-selection.test.mjs.

- Modify: .github/workflows/desktop-ci.yml.

- Create: scripts/windows-resolver-diagnosis.mjs.

- Create: tests/windows-resolver-diagnosis.test.mjs.

- Evidence only: ignored work/issue-18/windows-resolver-diagnosis/.

- [x] Establish failing behavioral tests for diagnostic evidence through the actual resolver orchestration. Cover valid LF/CRLF output, execution rejection, nonzero exit, malformed/missing/oversized output, nonempty stderr and unknown error fields. Preserve inherited executable, argument, environment-override and output-authorization controls. Use vertical TDD slices rather than testing script spelling alone.

- [x] Add an optional diagnostic observation channel to resolveSystemExplorer while preserving its successful return value and failed resolution behavior. Emit only an explicit finite schema: outcome classification, bounded elapsed milliseconds, bounded numeric exit code, allowlisted error code and signal, boolean-or-unknown killed state, and direct-child termination classification. Retain only stdout/stderr presence, bounded byte counts with overflow indicators, and expected-shape booleans. Drop extra fields; retain no paths, raw output, messages, stacks, PIDs or environment values. Unknown values remain unknown, and elapsed time alone cannot produce a timeout classification.

- [x] Observe direct-child lifecycle through the existing process seam. Confirm termination only from actual lifecycle evidence; record unknown when confirmation is absent and not_started only when established. Test close, rejection without close, missing lifecycle evidence and immutable persisted snapshots. Do not infer descendant/compiler termination or add process-tree cleanup.

- [x] Attach the finite observation to the original ready-selection resolver evidence, including failures. Preserve resolver/unavailable, the original invocation count and the existing result.json artifact. Test that resolver failure prevents fixture creation and native commands, and that diagnostic evidence cannot rescue failure, authorize a retry or weaken downstream readiness, observation and cleanup gates.

- [x] Implement a no-argument Windows-only CLI that invokes the same resolver independently at most three times, sequentially. Write separate sample-1.json through sample-3.json records and a finite aggregate result under work/issue-18/windows-resolver-diagnosis/read-only-series/. Preserve each ten-second call deadline and enforce an aggregate execution bound no greater than 60 seconds. Reject arguments; provide no executable, path, environment or sample-count override. Permit only diagnostic artifact writes, with no Explorer launch, navigation, selection or user-folder operations. A failed sample remains failed even if later samples pass; unknown, malformed, oversized, incomplete, deadline-expired or persistence-failed outcomes cannot pass. Test sample limits, independent mixed outcomes, aggregate deadline, privacy, unsupported hosts and persistence failures through the real orchestration.

- [x] Extend the existing windows-ready-selection matrix with the read-only series after the original script, using always() so it runs after original failure. Upload the series directory as a separately named artifact with always() and if-no-files-found: error. Preserve the original node scripts/windows-ready-selection.mjs step, original artifact, controlled checks, matrix and five-minute deadline. Add the affected resolver/loop tests as a separate controlled check; introduce no continue-on-error or exit-status masking.

- [x] Run the affected test suites and scoped ESLint, then documentation and diff checks using the commands below. Record actual commands, results and injected-symptom limitations under the ignored evidence directory; keep actual-Windows verification pending and cause unproven. Review the scoped diff, stage only task paths and commit verified changes with an English message. Do not push, dispatch Actions, modify trackers or begin a cause repair.

## Local Verification

Use Node 22.21.1 and the existing installed dependencies.

- node --test tests/windows-explorer-selection.test.mjs tests/windows-ready-selection.test.mjs tests/windows-resolver-diagnosis.test.mjs tests/windows-ready-selection-com.test.mjs tests/file-manager-evidence.test.mjs

- npx --no-install eslint scripts/windows-explorer-selection.mjs scripts/windows-ready-selection.mjs scripts/windows-resolver-diagnosis.mjs tests/windows-explorer-selection.test.mjs tests/windows-ready-selection.test.mjs tests/windows-resolver-diagnosis.test.mjs --max-warnings=0

- npm run check:docs

- git diff --check

- Inspect staged changes with git diff --cached --check and git diff --cached before committing.

All affected local tests must pass. Explicit platform skips remain skips. No full Electron/native rebuild, graphical runtime repeat or percentage-coverage gate is required for this diagnostic-only stage.

## Task 1 Local Verification Receipt

- Node: 22.21.1 on macOS.
- Affected test command above: 52 tests, 49 passed, 3 explicit platform skips, 0 failures.
- Scoped ESLint, `npm run check:docs` (85 Markdown files) and `git diff --check`: passed.
- Controlled local `execFile` children verified lifecycle observation for success, nonzero exit and output-limit rejection through the existing promise-child seam.
- No-argument CLI on macOS: expected exit 1, `unsupported_host`, three separately persisted `unreached` records; no resolver invocation.
- Evidence and red/green slices: `work/issue-18/windows-resolver-diagnosis/local-checks.json` and adjacent ignored logs.
- Aggregate execution reserves 45 seconds for calls and 15 seconds for persistence; each resolver keeps its existing 10-second timeout. Deadline-expired calls remain incomplete and late completion cannot mutate persisted snapshots.
- Injected symptoms and local children establish instrumentation behavior only. Historical cause remains unproven; original Windows2022 acceptance and series acceptance on both Windows images remain pending with the coordinator.

## Post-Completion: Coordinator-Owned Review and Windows Observations

- Perform separate review of the committed diagnostic changes, checking privacy, unchanged authorization/deadlines, truthful termination evidence and independent failure gates.

- On the next authorized exact-SHA push, inspect both Windows matrix jobs and their original ready-selection and separate read-only-series artifacts.

- Record the original invocation outcome and each sample independently. Missing, malformed or unreached evidence remains pending/failed; subsequent success cannot erase an earlier failure.

- Keep diagnosis hypotheses empty and cause unproven until the actual narrowed Windows loop produces a classified red signal. If the next run does not reproduce it, retain that observation without claiming resolution.

- Keep original-scenario Windows2022 verification and diagnostic-loop verification on both Windows images pending until actual results are inspected.

- Product Reveal, readiness, shutdown failures and whole Issue #18 completion remain separate coordinator work.
