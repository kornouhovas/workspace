# Desktop UX verification

This policy applies to subsequent desktop UX work under #47 after the accepted
#52 integration. The owner approved impact-based checks and milestone acceptance
on 2026-10-20. It does not change the independently owned #52 run's gates or waive
any observed failure.

## Evidence and order

A UI issue has three distinct acceptance records: appearance, affected behavior,
and retained product guarantees. Green behavior tests cannot accept appearance.
Screenshot comparison cannot establish persistence or filesystem safety.

Start each slice with its target screen/flow and observable acceptance criteria.
Use the [visual contract](specs/workspace-desktop-ux.md#visual-acceptance). Build
and inspect the changed screen early, with ordinary realistic data; correct its
composition and styling before spending a broad acceptance run on that candidate.
Run focused regression checks during implementation whenever needed. Complete
the required appearance and behavior evidence before closing the issue.

An implementation handoff includes the reference revision and screen, authored
content, component/token mapping, interactions and important states, plus the
deliberate deviations from main. The implemented screen is reviewed against that
handoff, with concrete differences and their resolution recorded in the issue.
Do not treat an isolated component preview as a whole-screen acceptance.
Use the spec's [control and return inventory](specs/workspace-desktop-ux.md#controls-and-return-paths):
panel collapse/restore, view lifecycle, icons/tooltips, Cancel/Escape and
Back/return need observable interaction evidence as well as screenshots.

## Selection matrix

Choose by the complete diff from the last accepted integration, including shared
consumers, dependencies and test drivers. Record the commands, scenarios,
platforms and reason for each selected or retained result before final acceptance.

| Changed boundary | Per-issue evidence | Wider verification trigger |
| --- | --- | --- |
| Documentation/specification | Links/anchors, requirements/dependency consistency, `git diff --check` | No build, native, performance or installer run solely for prose |
| Bounded typography, color, spacing or icons | Actual rendered before/after comparison; both themes/languages/sizes; font loading, wrapping, focus/contrast as affected; type/lint/build if relevant | Expand to all consumers of a shared token/control; native/font differences on affected supported hosts |
| Renderer layout, menus, editors or navigation | Above plus focused interaction/error/draft/focus/keyboard tests; real Electron changed-flow smoke; relevant persistence/ownership checks through existing service | Native behavior across affected hosts; targeted scale scenarios if render/layout/scroll/event cost can change |
| Service, query, persistence or migration | Public-boundary service/SQLite/migration/reopen/error tests and affected UI/native consumer | Broad acceptance for cross-cutting or uncertain impact; migration/recovery and packaged consumers on affected platforms |
| Filesystem, preload/IPC, desktop lifecycle or native adapter | Affected containment, identity, non-overwrite, recovery, isolation and native platform scenarios | Full affected platform/runtime routes; installation if packaging, resources or startup/update behavior changes |
| Runtime dependency, build, packaging or installer | Affected build/artifact/license checks and native/package evidence | Broad platform and installer acceptance according to the actual runtime/resource impact; uncertain impact uses full matrix |
| Early coherent-interface milestone | All principal screens/flows on one candidate, visual review and broad regression/platform evidence | Full supported desktop matrix, packaged smoke and relevant strict scale scenarios; installer evidence current or explicitly reusable for unchanged installer inputs |
| Final #67 / release #42 | Every UX row, final visual review, full supported platform/package/installer and agreed performance/recovery matrix | Release-specific OS/manual gates remain mandatory |

“UI-only” is not an exemption. Shared CSS can affect all screens; font/icon
dependencies change assets and packaging; virtualization or event handling can
affect performance. Conversely, changing a contextual menu does not automatically
require repeating an unchanged installer or immutable performance baseline.
When impact cannot be bounded, broaden verification.

## Coverage and execution frequency

Keep current requirement coverage under
[test retention](development.md#inherited-test-coverage). Retain, adapt, replace or
retire affected scenarios with their reason and replacement. An assertion about
an old class name or raw button count is not a visual quality test; preserve its
underlying user guarantee, if any, through a suitable replacement.

Keep service/data-safety/platform suites available. This policy changes when
they run, not which accepted guarantees exist. Tests using real SQLite, folders
or processes remain platform tests even when their filenames include `ui`.

At each issue, run focused checks for the actual changes and inspect changed
UI in Electron. At the early visual milestone and #67, run broad integrated
acceptance. Run a broader route earlier when the selection matrix calls for it.
Do not repeat a complete suite solely because the conversation resumed or a
report changed. Reuse successful receipts only with exact provenance and a
reviewed unchanged-input argument.

The existing [test-only evidence reuse rules](ci.md#evidence-reuse-after-test-only-repairs)
continue to govern repairs of tests, fixtures, drivers and diagnostics. A bounded
UI application change uses the matrix above for its new acceptance scope; it
does not relabel an old screenshot, platform run or failure as a current pass.

Known failures remain explicit. Diagnose required affected failures under the
[failed Actions loop](ci.md#failed-actions-loop). An established unchanged
harness failure is reported separately from product appearance, with evidence
and an explicit owner; it is not silently deleted, repeatedly retried to green,
or declared repaired by unrelated passing screenshots. A milestone requiring
that scenario cannot pass without the corresponding evidence.

## CI execution contract

Current ordinary push/PR workflows still dispatch broad desktop/installer jobs.
This document is a scheduling contract, not a claim that workflow routing has
already changed. The corrective foundation issue must establish and verify a
bounded desktop-UX route before relying on scoped acceptance. It may extend an
existing route only if its actual commands match the required scenarios.

Until that route exists, use supported explicit commands/routes and the existing
`[skip ci]` suppression for intentionally scoped pushes, with the selected
acceptance run recorded in the issue. If no route provides required evidence,
add it or use the broader existing route; never interpret suppressed/skipped
CI as successful acceptance. Preserve ordinary full and release routes.

Every receipt records candidate SHA, command/profile, host, result and artifact.
At milestones, reconcile all intermediate changes since the last broad candidate.
Partial checks close only the scoped issue; they do not close #47, #67 or a release.
