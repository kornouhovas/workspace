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

The final `npm run test:all` passed on the reviewed implementation/test/runtime candidate,
reusing the unchanged final application build: 2834 tests, 2811 passed, zero failures,
23 platform/conditional skips, 151.5 seconds. Typecheck, lint, documentation links and
whitespace checks also passed after the review repair. No production assertion,
shutdown deadline, platform route or cleanup gate was relaxed.

Implementation and the initial review baseline are committed as `63f2be03`; the follow-up
commit records the reviewer-confirmed smoke assertion correction and these observed
results. Exact-SHA CI and integration receipts must be recorded in GitHub once authorized.

## Delivery gates

Public publication requires specific owner permission under [tracker policy](../issue-tracker.md). The repository is public; the recorded #25 exception applies only to #25. No #26 code, checkpoint or issue closure has been published. Exact-SHA platform CI, artifact inspection and integration acceptance remain open; local macOS evidence cannot establish Windows acceptance.
