# Issue 18: Phase1 Native Reveal Receipt Observability

## Overview Capture the original typed Reveal receipt through the existing actual Electron creation test driver. Preserve native dispatch, transport, strict acknowledgment assertions and cleanup behavior while retaining finite, sanitized evidence before acknowledgment can fail. This is a bounded Phase1 observability slice. Historical cause remains unproven; neither instrumentation controls nor another green local run establish reproduction or resolution of the historical CI failure. Target plan file: `docs/plans/issue-18-native-ack-observability.md`.

## Context

- Requirements: [GitHub Issue #18](https://github.com/kornouhovas/workspace/issues/18), with diagnostic scope defined by `work/ralphex/native-ack/task.md` and `work/ralphex/native-ack/diagnosis.json`.

- Inspected source revision: `a352bff0686a6a2736994f7237c570805335ea4c`.

- Historical failure: [Actions run 38152709947](https://github.com/kornouhovas/workspace/actions/runs/38152709947), macOS grouped creation at `after_evidence`. The actual native API returned once and Finder selected the exact disposable target, but the UI showed generic Reveal error. The artifact lacks the original typed service receipt and native dispatch timing.

- Finite diagnosis: the unmodified local command passed; twelve reached acknowledgment samples passed; twelve timing-stressed acknowledgments passed. One separate creation-focus failure occurred before native intent, and one stressed sample failed normal shutdown after acknowledgment. These are distinct failures.

- Source observation revision growth is correlation, not causal evidence.

- Accepted boundaries: `AGENTS.md`, `docs/development.md`, `docs/architecture.md`, `GLOSSARY.md` and `docs/adr/0006-recoverable-project-creation.md`.

- Implementation files: `scripts/smoke-project-creation.mjs`; new `scripts/native-reveal-receipt.mjs` and `tests/native-reveal-receipt.test.mjs`.

- Read-only contracts: `src/contracts/project-reveal.ts`, `src/contracts/service-protocol.ts` and `src/contracts/settings.ts`.

- Related patterns: serializable Playwright callbacks and controlled behavior fixtures in `tests/runtime-readiness.test.mjs`; existing creation evidence, deadlines and owned cleanup in `scripts/runtime-evidence.mjs` and `scripts/runtime-lifecycle.mjs`.

- `work/native-ack-probe/timing-stress-harness.patch` is a throwaway prototype. Its focus synchronization and injected delay are excluded.

- Dependencies: existing Node 22.21.1, Electron and Playwright Core only. No dependency, native binary or lockfile changes.

## Development Approach

- Testing approach: write behavior controls before implementing the capture seam. These test observability correctness, not a proven historical product regression.

- Apply Matt Pocock `diagnosing-bugs` from the installed package. Phase1 remains incomplete until an agent-runnable loop has actually caught the exact historical symptom with usable classification. Do not advance to causal hypotheses or repair from green samples.

- Complete the single task, including its new tests and focused actual macOS evidence, before handoff. All affected tests must pass; any unperformed check remains pending.

- No numeric coverage threshold or unrelated full-suite expansion.

- Planning creates only the requested plan after draft acceptance. No implementation, build, dependency changes, tracker actions, push or automatic continuation occurs during planning. The coordinator may commit the inspected plan after documentation checks.

- Implementation must wait until the coordinator confirms that the owned UI executor has released its checkout. Reconcile against that checkout’s actual contracts before editing.

## Implementation Steps

### Task 1: Capture and verify the original native Reveal receipt

**Files:**

- Create: `scripts/native-reveal-receipt.mjs`

- Create: `tests/native-reveal-receipt.test.mjs`

- Modify: `scripts/smoke-project-creation.mjs`

- [x] Write behavior controls for the same serializable installer used by the actual Electron driver. Verify original receivers, argument and transfer-list identities, return values, thrown exception identities, listener delivery and exactly one forwarding call. Include observer failures and malformed values; capture must never consume an original transport exception or prevent forwarding.

- [x] Implement a small test-driver-only collector at the actual `MessagePortMain` boundary, inspecting public `MessageChannelMain` port methods with feature detection. Observe the original outgoing Reveal request, associated native protocol messages and incoming service response. Preserve existing calls and transport unchanged; use no private Electron handler map, renderer API, production hook or replacement native callback. Install only within the owned disposable macOS app.

- [x] Correlate requests by port and request ID, and native messages by their original request/dispatch binding. Keep IDs and workspace/project bindings only in bounded private memory. Persist finite boundary labels, recognized service `ok` classification, known outcomes/problems/error codes, and workspace/project match booleans with explicit unknown states. Never persist paths, identities, IDs, raw messages, exception text, arbitrary fields or environment values. Reject unrelated, duplicate, foreign-port and stale correlation from a valid receipt classification.

- [x] Bound capture to one armed Reveal intent per owned app, at most 64 records and one private request/dispatch correlation, with a maximum 60-second recording lifetime. Release private bindings on settlement, expiry, disposal and app termination; close inspection-only ports and restore owned wrappers safely. Record explicit unsupported, missing, malformed, unknown, expired and truncated states. Use monotonic relative milliseconds bounded to the recording lifetime; report native-request-to-reply elapsed time as boundary latency, not measured shell-call duration or causal attribution.

- [x] Integrate arming before the existing immediate creation-to-Reveal trigger and retain the sanitized snapshot in the existing creation observations before the strict acknowledgment assertion. Capture also on failure paths before cleanup when available, using a bounded collection attempt. Collection timeout, unavailable app or evidence-write failure must preserve the primary failure, attempt existing strict cleanup and never produce passed acknowledgment evidence. Do not add Refresh, settling waits, retries or synthetic receipts.

- [x] Extend controls for dispatched and rejected receipts, every accepted problem/error classification, `ok: false`, missing/unknown fields, invalid bindings, multiple ports, duplicate responses, bounded timing, record/pending limits, expiry and disposal. Assert that serialized evidence excludes private sentinel values. Exercise bounded snapshot failure and persistence failure with controlled driver fixtures, proving preservation of the primary failure and cleanup attempt. Run `node --test tests/native-reveal-receipt.test.mjs`, `npm run lint` and `npm run typecheck`; all must pass.

- [x] Against matching already-built production inputs in the coordinator’s released implementation checkout, run the original focused actual macOS command once: `WORKSPACE_SMOKE_EVIDENCE_DIR=work/native-ack-observability npm run smoke:runtime -- dev --creation --discovery-mode=grouped --checkpoint=after_evidence`. Retain actual revision/input identity, command, exit status, sanitized receipt, one-native-intent cardinality, exact Finder selection, strict UI acknowledgment, normal shutdown, restart and owned cleanup results in ignored evidence. Do not rebuild or mutate copied/shared dependencies to make this check run. If matching inputs or an actual macOS desktop are unavailable, leave the check pending and return the concrete blocker to the coordinator.

## Task 1 Execution Evidence

- Implemented and checked in the released issue checkout at starting revision `051aaa11db38e20873e0eeb566400d8b6919f7a0`. Production source/build inputs were unchanged; the ignored input manifest records the modified test-driver hashes separately. No production rebuild, dependency mutation or publication was performed.
- Node 22.21.1: `node --test tests/native-reveal-receipt.test.mjs` passed 47 controls without skips. The affected collector/lifecycle command passed 79 tests without skips. `npm run lint`, `npm run typecheck`, documentation links and diff checks passed. Logs are under `work/native-ack-observability/`.
- The required original focused actual macOS command ran once and exited 0. `work/native-ack-observability/inputs.json` records production/build provenance and SHA-256 input identity; `runtime.log`, `runtime.exit`, `dev-creation-observations.json` and `summary.json` retain command and outcome evidence. Input digest: `e2c4f4aae5dc210d8990a77f5de7f29f6b78ef32d9c392cea4cdf0a0c690b0f8`.
- The original correlated receipt was `ok: true`, `dispatched`, with both bindings matched, no truncation or observer failure, and no retained private IDs/paths/identities. One request/native dispatch and the strict exactly-one real API assertions passed. Exact Finder selection, strict Russian UI acknowledgment, two normal shutdowns with stopped backends, restart persistence and owned cleanup passed separately. The observed native request-to-reply boundary latency was approximately 438.54 ms; it is not measured shell-call duration.
- Historical symptom reproduction and cause remain unproven. Local execution completion leaves independent review and exact-SHA actual-platform CI receipt inspection to the coordinator.

## Review Repair Evidence

- Independent Standards and Spec review compared `705cf1c0f35406b26214a64a173cd896e5a3ede6` against `5943df71ec0d2cef0dac5aa41688bf2fbc4d57f0`. Two confirmed Major findings were repaired: stalled receipt persistence could block strict cleanup, and accepted receipts could inherit classifications from earlier ignored malformed envelopes.
- Every correlated service response now starts with unknown classification fields. Receipt persistence and repeated failure-evidence saves have bounded waits while preserving the primary failure. Product deadlines, native forwarding and strict acceptance remain unchanged.
- Both new behavior controls failed before their respective repairs and passed afterward. Node 22.21.1 ran `node --test tests/native-reveal-receipt.test.mjs tests/runtime-lifecycle.test.mjs`: 81 passed without skips. Lint and typecheck passed. Both independent reviewers inspected the repairs and reported no remaining findings.
- One original focused actual macOS command with the repaired driver exited 0, using unchanged matching production/build inputs without rebuilding or mutating dependencies. Evidence is retained separately under `work/native-ack-review-repair/`; `inputs.json` records starting HEAD `705cf1c0` and the repaired working-tree driver hashes. Input digest: `3fcf33213807ef9782783c375383c29dc9de613a8a48296502dee2d9f9b44049`.
- The sanitized receipt was valid, `ok: true`, dispatched, with matched bindings and no truncation or observer failure. One native intent, exact Finder selection, strict UI acknowledgment, two normal shutdowns with stopped backends, restart persistence and owned cleanup passed separately. Historical reproduction/cause remain unproven; exact-SHA actual-platform CI acceptance remains coordinator-owned and pending.

## Acceptance Criteria

- The original correlated typed receipt is retained before the existing strict acknowledgment assertion can discard its diagnostic value.

- Capture uncertainty and incompleteness are explicit; neither unknown evidence nor a native API return implies successful UI acknowledgment.

- Behavioral controls establish unchanged forwarding, finite redaction, correct correlation and bounded lifecycle.

- The original focused macOS scenario has an observed result with the required separate native, UI, file-manager and lifecycle evidence.

- No historical cause or CI resolution is claimed.

## Exclusions No deadline increases, native retries, synthetic dispatched acknowledgment, weakened strict acceptance, removal of post-native safety checks, production rename changes, dependency updates, broad CI rearrangement or Issue #44 repair. No renderer Node exposure, new filesystem action or adoption of prototype timing/focus changes.

## Post-Completion: Coordinator Acceptance External acceptance is outside executable task checkboxes. The coordinator independently reviews this diagnostic slice after the full UI execution/review. Any task-branch push requires existing corresponding authorization and is not initiated by this plan-creation session. Inspect the exact-SHA actual-platform Actions run and existing uploaded grouped creation artifact. Keep original CI verification pending until that run completes and its receipt evidence is inspected. A local green run does not close the historical failure or Issue #18. If the original symptom recurs, use the classified receipt to establish and minimize a red-capable loop, then present ranked falsifiable hypotheses before causal probes or product repair. If it does not recur, retain the finite evidence and explicitly unproven cause without automatic stress expansion, retries or repair.

## Coordinator Draft Review

Ralphex generated this draft at a352bff0; its interactive draft-selection prompt ended at EOF before persistence. The coordinator recovered the exact draft from the retained progress log, inspected its scope, reduced the collector to one private correlation for its single armed intent, and accepted it for execution only after the owned UI checkout is released. This plan is Phase1 diagnostic observability, not a product repair or proof of historical cause.
