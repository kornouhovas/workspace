# Issue 22 code review

Two independent Matt Pocock code-review axes reviewed `git diff 5ad279e9...a4b14191`. Initial commit: `a4b14191 feat: archive and restore source projects with durable recovery (#22)`. Standards sources: AGENTS.md, development, architecture, reuse, ADR 0007 and glossary. Spec source: GitHub #22, T15 ticket and owner-confirmed scenario plan.

## Standards

One P2 correctness finding, no confirmed hard standards breach or actionable baseline smell: a slash-containing alternative restore name was interpreted as a relative path during preview, while Apply reconstructed only its basename and rejected the approved review. A real temporary service reproduction showed the folder stayed archived without incorrect effects. Repair validates every non-null name with the platform basename validator before path construction; direct/grouped red/green regressions cover nested, traversal, absolute and empty names.

## Spec

Two P2 findings:

- The shared archive validation required every unrelated archived record's full parent chain. With grouped projects A/First and B/Second archived, moving Archive/A away blocked restoration of healthy B/Second. Repair validates shared designation ancestors for unrelated archives and retains complete checks on the selected project's chain. A real service regression restores the healthy sibling while retaining unavailable metadata.
- Required UI failure/recovery routes lacked focused coverage. Added EN/RU tests for unavailable sources, interrupted operations and explicit token-bound keyboard recovery, collision/alternative basename, missing-parent consent and incompatible-mode blockers. These verify service-client payloads, lack of mutation before a fresh accepted preview and localized feedback. Existing runtime checks cover the production happy path, Text and restart; pending platform gates remain explicit.

Initial totals: Standards 1 finding (worst P2), Spec 2 findings (worst P2). All were reproduced or acknowledged against concrete missing coverage before repair. Follow-up review and final verification are recorded in GitHub; neither initial report established platform acceptance.

## Follow-up

Both reviewers accepted the source repairs in `b73da90`. The Standards reviewer identified a test-readiness race: the initial project select existed before loading finished. Tests now wait for that control to become enabled; the previously failing EN test passed five consecutive focused runs. This changes the readiness assertion, not a production deadline.

A further UI regression reproduced a recovery `service_unavailable` response clearing unknown-outcome protection. The component now retains the operation and offers only an ID-bound read-only status check unless the service definitively rejects a stale/invalid request. The recovery error regression and all 14 archive UI tests pass. CI artifact retention includes the new archive runtime evidence directories.

The first full local run found three additional fixture mismatches (2706 passed, 3 failed, 21 expected skips): creation tests assumed one global combobox and CI's exact command/evidence inventory omitted the added archive routes. Repairs scope creation selection to its named region and extend the exact CI sequence and artifact expectations without removing platform/failure-policy assertions. Independent review and focused reproduction pass 3/3; both affected full test files pass 110/110. Product source is unchanged from `4e9de5a`; the final full suite is renewed after these test-only repairs.

## Windows runtime diagnostic follow-up

Both independent reviewers accepted `a2949e1` with no findings. Each independently ran the affected lifecycle/startup/CI-route checks (63/63). Review confirmed unchanged conservative ownership/deletion gates and deadlines, finite diagnostics without process identifiers, prerequisites before the original focused command, and preserved ordinary full routes. Neither review establishes a cause for the historical Windows cleanup rejection. The subsequent renewed local full suite passes 2711 tests, zero failures and 21 expected skips.

## Subsequent failure-map follow-up

Both axes reviewed the current diff against `a2949e1` and report no findings: deterministic observer/commit fixture separation, bounded submission capture and its regressions, original two-OS focused route and retained failure reports. Each independently passes 14 receipt/routing tests and the targeted fanout test. Full affected files pass 73/73. Original runtime assertions, deadlines, transport forwarding and deletion gates remain unchanged. Historical macOS submission cause is not established; focused original-scenario/artifact and full-platform gates are still required.
