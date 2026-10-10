# Issue 17: Controlled Cold Windows Native Selection Experiment

## Overview

Prepare one isolated Windows diagnostic experiment using the documented single-item SHOpenFolderAndSelectItems form. Preserve positive, negative and unavailable results separately from Workspace acceptance. Implementation begins only after coordinator review of this draft.

## Context

- Authority: work/ralphex/issue-17/native-investigation-task.md, task.md and the latest coordinator-findings.md/resume.md entries.
- Tracking: GitHub Issue #17; Beads workspace-31i.10. Issue #18 is excluded.
- Checkout: codex/issue-17-create-reveal at 8c978f9d490fbb47b3e53244c5b1cb6f93ac00d1.
- Fixed implementation/review base: 4ac402620dd8139bdef9ff03625aae64bf60e132 for every phase and resume.
- Existing evidence shows one actual product invocation, truthful acknowledgment and an exact parent containing the target, without observed selection. Its cause remains unknown.
- Reuse scripts/file-manager-evidence.mjs and tests/file-manager-evidence.test.mjs. Their strict selection predicate and ten-second observation deadline remain unchanged.
- Create scripts/windows-native-selection.mjs, scripts/windows-native-selection.ps1 and tests/windows-native-selection.test.mjs.
- Extend .github/workflows/desktop-ci.yml with an independent Windows job; append evidence guidance to docs/verification/issue-17-create-reveal.md.
- Dependencies: Node 22.21.1, system Windows PowerShell, Add-Type/PInvoke and Node built-ins. No npm installation, Electron build or new dependency is needed for the experiment.
- Proposed accepted-plan path: docs/plans/20261010-issue-17-windows-native-selection-experiment.md.

## Native contract and sources

- Use SHOpenFolderAndSelectItems with the absolute target PIDL, cidl=0, null child array and flags=0. Microsoft documents this form as opening the parent and selecting the item. [Microsoft selection API](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shopenfolderandselectitems)
- Obtain the PIDL through SHParseDisplayName using the UTF-16 target, null bind context, zero requested attributes and a correctly sized attributes output. [Microsoft parsing API](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shparsedisplayname)
- Initialize COM on the calling worker thread. Balance successful initialization, including S_FALSE, with CoUninitialize; stop on RPC_E_CHANGED_MODE. [Microsoft COM initialization](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-coinitializeex)
- Free the returned PIDL exactly once with CoTaskMemFree. Microsoft specifies the COM task allocator for Shell ITEMIDLIST structures on supported Windows versions. [Microsoft PIDL ownership](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-ilfree), [Microsoft allocator cleanup](https://learn.microsoft.com/en-us/windows/win32/api/combaseapi/nf-combaseapi-cotaskmemfree)

## Development Approach

- Testing approach: TDD at the command, protocol and fixture boundaries.
- Complete and verify each task before the next; commit each verified milestone with explicit staging.
- Every task adds or updates meaningful tests. All applicable tests must pass before proceeding; platform skips remain explicitly unverified.
- Every local Node/npm/npx/tsx invocation explicitly prepends PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH.
- Keep product dispatch, renderer/preload security, existing acceptance assertions and evidence unchanged.
- No native retries, alternative dispatch, selection manipulation, fallback opening, dependency upgrades, global changes or unrelated cleanup.
- Fresh-job isolation prevents warming by Workspace acceptance scenarios. It does not prove that Windows itself starts without Explorer state.

## Implementation Steps

### Task 1: Implement the single-call native bridge and sanitized protocol

Files:
- Create: scripts/windows-native-selection.ps1
- Create: scripts/windows-native-selection.mjs
- Create: tests/windows-native-selection.test.mjs

- [x] Add failing tests for environment-only Unicode/path transport, malformed responses, signed 32-bit HRESULT validation and exclusion of paths, exception text and raw subprocess output.
- [x] Implement the fixed PowerShell/Add-Type bridge on a dedicated STA worker thread. Preserve HRESULTs as signed integers; use pointer-sized PIDL values and the documented native signatures.
- [x] Implement COM initialization, target parsing, exactly one selection call after successful prerequisites, and finally-based PIDL/COM cleanup. Initialization or parsing failure performs zero selection calls.
- [x] Bound the owned PowerShell process to 30 seconds, including compilation. A timeout or missing protocol reports invocation count as unknown; it cannot establish success or trigger another invocation.
- [x] Add controlled bridge tests for S_OK/S_FALSE, changed apartment, parsing failure, selection failure and exceptions: verify call ordering, at-most-one selection, one PIDL free and correctly balanced uninitialization. Windows-only compiled-bridge checks must use controlled native delegates.
- [x] Run PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH node --test tests/windows-native-selection.test.mjs and lint. Record platform skips separately; commit only verified task files.

Task 1 local verification (macOS, 2026-10-10): Node 22.21.1 focused suite: 11 passed, 0 failed, 1 Windows-only compiled-bridge test skipped. Repository lint passed. The production C# bridge and controlled delegate fixture also compiled together with the already installed .NET 6 compiler in a disposable temporary directory. This compile check does not verify Windows PowerShell Add-Type, STA runtime behavior or real native selection. Windows execution remains an unverified external coordinator gate; the skip is not a pass. No real selection call or product acceptance scenario was run.

### Task 2: Add the owned fixture, strict observation and failure-safe evidence

Files:
- Modify: scripts/windows-native-selection.mjs
- Modify: tests/windows-native-selection.test.mjs
- Reuse unchanged: scripts/file-manager-evidence.mjs

- [x] Add failing orchestration tests for one fresh fixture, one dispatch, prerequisite failure, timeout, unselected target, observation unavailability and cleanup failure.
- [x] Create one mkdtemp root and a fixed Unicode child directory internally. Accept no caller-supplied target; override target environment data with this generated path and never interpolate it into executable script text.
- [x] Invoke the bridge once. After dispatch, reuse waitForFileManagerTarget with its unchanged ten-second monotonic deadline and strict full-parent/full-selected-target comparison. Observation must never dispatch or select anything.
- [x] Record fixture setup, native stages/HRESULTs, invocation count, observer attempts, process termination, window-cleanup attempt and fixture removal independently. Success requires a valid single invocation, S_OK and exact observed selection.
- [x] Reuse closeDisposableFileManagerTarget without broadening its matching rules. Explicitly report that an unselected parent window may remain; its completed return does not prove window closure. Remove only the owned root after confirmed subprocess termination, using bounded filesystem cleanup.
- [x] Persist sanitized evidence before returning failure, including negative/unavailable outcomes and cleanup errors. Preserve the original failure when cleanup also fails; unknown termination leaves fixture removal unverified.
- [x] Run the new suite together with tests/file-manager-evidence.test.mjs using the required PATH prefix. Verify controlled-clock deadline exhaustion, unrelated-window preservation, privacy and evidence-before-failure behavior; lint and commit the verified milestone.

Task 2 local verification (macOS, 2026-10-10): The initial new-suite run failed because the orchestration export did not yet exist. After implementation, the combined native-selection/file-manager suites passed 30 tests with 0 failures; 3 Windows-only checks were skipped (compiled STA bridge, controlled COM observer and controlled exact-window cleanup). Repository lint passed. Working-tree and fixed-base diff whitespace checks passed. The unchanged observer retains its ten-second monotonic deadline and exact parent/selected-target comparisons. Controlled clocks verified deadline exhaustion and bounded removal; real temporary fixtures verified generated Unicode paths, inherited-target override, evidence-before-rejection, original-failure preservation, unknown-termination retention and preservation of unexpected contents. Window cleanup reports only an attempt: an unselected parent may remain, and closure is explicitly unverified. Filesystem cleanup uses nonrecursive rmdir with a five-second caller wait; an in-flight syscall cannot be cancelled and may finish later after a timeout. No real native selection or Workspace acceptance scenario was run. Windows execution of all three controlled checks, including unrelated-window preservation, remains an external coordinator gate; these skips are not passes.

### Task 3: Wire the independent CI experiment and document the handoff

Files:
- Modify: .github/workflows/desktop-ci.yml
- Modify: tests/windows-native-selection.test.mjs
- Modify: docs/verification/issue-17-create-reveal.md
- Update accepted plan progress only

- [ ] Add CLI boundary tests for unsupported hosts, sanitized failure output and persisted negative evidence. Test execution must not perform additional real native selection.
- [ ] Add one independent windows-latest job with checkout, setup-node 22.21.1 and one invocation of scripts/windows-native-selection.mjs. Do not depend on the product job or run npm installation, Electron, Explorer preflight or native warmup.
- [ ] Run the focused built-in test suites after the experiment, including controlled Windows bridge checks. Preserve experiment artifacts with if: always(); negative or unavailable selection must remain a failed experiment.
- [ ] Include exact code SHA, runner/OS/Node metadata and separate native, observation and cleanup outcomes in the artifact. Keep output under a distinct ignored evidence directory and exclude arbitrary paths or command output.
- [ ] Append English documentation covering purpose, verified signatures, invocation and cleanup limits, artifact interpretation and still-unmet coordinator gates. Record local checks truthfully; do not predict a Windows result.
- [ ] Run focused tests, npm run lint, npm run check:docs, local link/anchor inspection and working/fixed-base git diff --check with the required PATH prefix for Node/npm. Inspect job isolation and always-upload behavior; no repeated full Electron build is required for this diagnostic-only change.
- [ ] Inspect and explicitly stage task paths; commit the verified CI/documentation milestone and prepare a Russian handoff identifying the commit, actual checks, skips and limitations.

## Review Protocol

- Use gpt-6.1-sol high for execution and review.
- Collect all five first-review perspectives before repairs: quality, implementation, testing, simplification and documentation. Batches of three and two are permitted.
- Review against the fixed original base, focusing on this experiment and connected boundaries while retaining earlier proofs with their original revisions.
- Repair confirmed scoped findings, rerun affected checks and commit.
- Follow-up reviews use only the quality/implementation critical-major pair until clean.

## Post-Completion: Coordinator Gates

- Coordinator reviews and pushes diagnostic inputs, obtains the separate exact-code Windows CI result and interprets the evidence.
- A negative or unavailable result remains preserved. Any further experiment requires a newly justified change; no unchanged native rerun follows automatically.
- An experimental success does not establish the product defect, authorize native replacement or satisfy Workspace UI/IPC/native, normal-quit or restart acceptance.
- Product Windows selection, historical shutdown/startup causes and issue #44 remain separate gates.
- Coordinator retains trackers, independent platform acceptance and integration. Executor performs no push, merge, release, signing, tags or publication.
- No unmet external criterion is checked complete. Stop within Issue #17; do not start Issue #18.
