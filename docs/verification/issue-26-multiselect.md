# Issue #26 verification

Contract/scenarios: [implementation plan](../plans/issue-26-multiselect.md).

## Local evidence

- macOS with Node 22.21.1, temporary real SQLite databases and disposable source folders only.
- Initial public service and Table tests failed on unsupported MultiSelect creation and absent creation control, then passed after implementation.
- Focused service/IPC/EN/RU UI tests pass: stable sets, duplicate/foreign/type/extra-field rejection, source isolation, no-op ordering, shared options, local visibility, failure rollback, pending controls, retained drafts and sibling updates. Sparse arrays initially returned storage errors; a red regression now verifies rejection as invalid input before persistence. Existing Single Select scenarios remain passing.
- `npm run test:migrations`: 346 tests, 345 passed, one platform skip, zero failures. The first run found six stale migration-count/schema-inventory expectations; only the new count/table and typed rejection expectations were updated, retaining preservation and rejection assertions.
- Typecheck, lint, documentation links and whitespace checks passed on the local candidate.
- Development Electron smoke passed EN/RU with keyboard, invalid drafts, options/colors/order, hidden usages, multi-membership save, restart, clear, individual removal, source-sibling edits, stable project ID and unchanged folders/files. 1024/1440 captures show no page overflow; the narrow RU capture was visually inspected. Local evidence: `work/issue-26-multiselect-runtime/`.
- macOS package build and artifact check passed. The first packaged smoke completed English acceptance and encountered a 10-second ordinary-quit timeout during the Russian restart. Owned forced termination and cleanup passed, but that is a failed shutdown gate. Retained evidence: `work/issue-26-multiselect-package/`. The bounded event-instrumented run then passed EN/RU and all three normal quits with `before-quit`, `will-quit`, `quit`, parent exit, backend exit and fixture cleanup. This does not establish the cause of the first timeout.
- After the review's hidden-option locator correction, both development and packaged macOS smoke routes passed again at the original deadlines, with complete EN/RU assertions, all three normal quits/backend exits and fixture cleanup. Corrected evidence: `work/issue-26-multiselect-dev-reviewed/` and `work/issue-26-multiselect-package-reviewed/`. The packaged English wide capture was also visually inspected.

## Standards review

The independent reviewer found zero documented-standard violations and one optional possible duplication smell: the MultiSelect and scalar cell editors each retain their small editing-lifetime, revision and focus flow. The distinct controls remain separate; the paired behavioral suites cover both. This is a nonblocking judgment call, with no demonstrated defect.

## Spec review

The independent reviewer found no product-contract violation or scope creep. It found one nonblocking smoke precision issue: filtering checkbox inputs by text cannot prove their absence. The check now uses the exact localized accessible name. The reviewer confirmed the repair, and both original development/package routes passed afterwards. Existing EN/RU interaction tests independently check the hidden-unassigned behavior.

## Final local suite

Before the first CI run, `npm run test:all` passed on the reviewed implementation/test/runtime candidate,
reusing the unchanged final application build: 2834 tests, 2811 passed, zero failures,
23 platform/conditional skips, 151.5 seconds. Typecheck, lint, documentation links and
whitespace checks also passed after the review repair. No production assertion,
shutdown deadline, platform route or cleanup gate was relaxed.

Implementation and the initial review baseline are committed as `63f2be03`; the follow-up
commit records the reviewer-confirmed smoke assertion correction and these observed
results. Current exact-SHA CI and integration receipts are tracked in [GitHub #26](https://github.com/kornouhovas/workspace/issues/26).

## Delivery gates

The owner explicitly authorized publishing #26 to the current public repository, its GitHub checkpoint, CI and successful integration into `new-workspace` on 2026-10-15, resolving the issue-specific publication gate under [tracker policy](../issue-tracker.md). Exact-SHA platform CI, artifact inspection and integration acceptance are recorded in the GitHub checkpoint; local macOS evidence alone cannot establish Windows acceptance. This authorization does not publish a release or change the repository-wide default policy.

## First exact-SHA CI and property-creator repair

Full run [38727412661](https://github.com/kornouhovas/workspace/actions/runs/38727412661),
attempt 1 on `e40b0c151818aca444f925d1c26ceec5849d44c2`, passed common checks and
both complete Windows jobs. The sole failure was macOS's original
`npm run smoke:multiselect -- release`: a 15-second `Property name` locator timeout.
The macOS platform tests, development MultiSelect, package build/resource check had
passed. Its retained artifact 11969832549 shows no created property/form and zero
completed language checks; normal quit, backend exit and cleanup passed. This is
separate from the earlier local shutdown timeout.

A controlled real-Electron disabled-button fixture reproduced the same lost Enter
symptom with the original focus/press driver (red: property-name input absent).
The driver now resolves the same accessible button together with native `:enabled`
before focus and a single keyboard activation, under the caller's original timeout.
The initial enabled operand is retained in new runtime evidence. The original CI
artifact lacks that initial operand, so this reproduction establishes a faulty driver
path without proving the exact original scheduler/focus cause.

The new isolated real-Electron driver file verifies delayed enablement, one activation,
property-name entry and rejection without activation when loading never finishes.
It passes with the repair, and the original packaged EN/RU smoke passes locally with
normal quit/backend exit and cleanup. During regression preparation, an invocation
using the existing rename suite stalled after its host-clock cases and was terminated;
it is not counted as passing evidence. The new tests use a separate process/fixture
and existing bounded strict quit helper; the original rename test file is unchanged.

`checks: multiselect` selects only the original failed macOS route with build,
related driver/MultiSelect regressions, package/resource checks and exact-SHA runtime
artifacts. Original product assertions, keyboard editing, timeouts and cleanup gates
are retained. Current repair review, focused CI and renewed full acceptance receipts
belong to the GitHub checkpoint.

### Reviewed repair and renewed local acceptance

The two independent reviewers checked `e40b0c1...aa6a107`. Spec reported no findings;
Standards reported no hard/blocking findings and suggested retaining secondary cleanup
errors in the isolated fixture. Those errors are now logged while the primary failure
remains primary; the Standards reviewer confirmed the change, with no remaining
actionable findings. Existing rename fixture/tests are unchanged.

After this repair, typecheck, lint, documentation links and focused routing/native/UI
checks passed (49 tests, zero failures). The original packaged EN/RU MultiSelect command
passed locally with normal quit/backend exit and owned cleanup. A renewed complete
`npm run test:all` on the final reviewed source/test candidate passed: 2837 tests,
2814 passed, zero failures, 23 conditional/platform skips, 137.7 seconds. It reuses the
unchanged verified application build because the repair affects the acceptance driver,
regressions and CI routing, not application behavior or persistence. Current focused
and full exact-SHA CI receipts remain in the GitHub checkpoint.

## Second full CI: Windows latest ownership gate

Focused macOS run 38731833753 passed on `0335f0f5955a23a15d2ed64738c6693e8d029e0c`;
its exact-SHA/run/attempt artifact 11970566654 was inspected. All 35 regressions and
original packaged EN/RU assertions passed, including three normal quits/backend exits
and owned cleanup. Russian creation entered with an initially disabled button and
passed through the repaired readiness path.

Renewed full run [38732178491](https://github.com/kornouhovas/workspace/actions/runs/38732178491),
attempt 1 on that same SHA, passed common, complete macOS and complete Windows 2022
jobs. MultiSelect development/package passed on all three platforms. The sole failure
was Windows latest's final `npm run smoke:runtime -- release`, in category-move fixture
cleanup: owned-process termination was unverified, so removal was correctly skipped.
Artifact 11974065540 records all 34 normal quits/backend exits passed and no failed
shutdowns, but lacks the final ownership predicate. This does not prove PID reuse,
a live owned process or the exact source of uncertainty.

The category fixture now retains the same sanitized `inspectOwnedProcesses` result
already used by the rename fixture (finite reason/counts, no PIDs/paths/raw errors).
Its `stopped` value is the original boolean gate; no guard, deadline, cleanup restriction
or scenario assertion changes. The existing `checks: windows-release` route matches
the exact failed OS/command and adds the affected category runtime regression file.
The original failed CI command is the red-capable remote reproduction; a new diagnostic
candidate is needed because the historical artifact cannot distinguish the three
ownership hypotheses. Current review/focused/full receipts remain in GitHub #26.

### Reviewed diagnostic candidate

Both independent reviewers checked `0335f0f...118c21e` and reported no findings.
Typecheck, lint, documentation links, whitespace and 101 focused lifecycle, startup,
category and CI-route tests passed. The complete local suite on the reviewed candidate
passed: 2837 tests, 2814 passed, zero failures, 23 conditional/platform skips,
127.8 seconds. The diagnostic does not change application behavior or the existing
process-ownership decision; exact-SHA Windows reproduction and subsequent full
acceptance remain required and are recorded in the GitHub checkpoint.
