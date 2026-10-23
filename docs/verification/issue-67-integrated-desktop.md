# Issue 67: Integrated desktop verification

Status: **in progress; not accepted**. Issue and live checkpoints:
https://github.com/kornouhovas/workspace/issues/67.
[Scenario/retention map](../plans/issue-67-integrated-desktop.md).

## Candidate and execution

Base `5799532c4966e026b96b6b18718f5a8e8171bf6b` includes accepted #66.
Task branch `codex/issue-67-integrated-desktop`. This change adds acceptance
infrastructure; application, schema, native resources, runtime dependencies and
installer inputs remain unchanged. Existing principal UI journeys now explicitly
select development or the packaged executable. Development remains the default.
No assertion, deadline, identity/data-preservation or cleanup gate is relaxed.

The final integrated runner executes all principal/late journeys, original native,
crash/recovery consumers and strict scale sequentially against the package. Its
manifest retains actual SHA/run/attempt/host, each command/log digest, all script
digests, app.asar and full package file/symlink inventories. Package changes cause
failure. Failed commands stop the runner, retain their nonzero exit and mark
remaining rows unreached. Bounded tail renewal explicitly records excluded rows
and cannot return complete acceptance. Diagnostic failure probes also cannot pass.

Scale keeps the original #41 inventory and numerical limits. The final runner
also selects `--project-flows`: event-to-committed-paint preview, expand, expanded
Text commit and return at 1000 projects/20 properties/10 views per direct/grouped
source, actual public-query value assertions, cancelled draft, unique tab and
additional conservative process-memory sample. The immutable earlier #41 baseline
does not support these newer flows and retains its original default inventory.

## Preparatory local evidence

Host: Darwin27.0.0 arm64, Node22.21.1. These receipts precede the reviewed final
candidate and are not final integrated acceptance.

- Fresh build and package/resource verification pass. Explicit packaged Board
  passes 32 populated/long/empty/unavailable variants, keyboard widths, group/layout
  persistence, source-outage recovery, normal shutdown and owned cleanup.
- Launcher selection was red for missing package-mode support and then green.
  CLI failure-propagation was red before the integrated runner and then green.
  Focused launcher/integration/existing desktop-route command:38/38, zero skips.
- Preliminary complete runner: foundation, shell, workspace management, sources,
  Board and navigation pass against one package. File-tree/native scenario reaches
  every functional assertion, including exact Finder Reveal and TextEdit document,
  then **fails original 10000ms normal shutdown**. Forced process-group cleanup
  reports stopped; the caller's owned-process/fixture cleanup receipt remains
  unverified/skipped. Later journeys in this attempt are unreached. Original
  `work/issue-67-integrated/report.json` and per-journey logs are retained locally.
- Diagnosis: original standalone deferred-cleanup test passes; eight sequential
  controls pass at approximately1.1–1.2s each. Original packaged files command with
  Playwright browser logging also passes including native target, normal quit and
  owned cleanup. This does not reproduce a deterministic causal mechanism, repair
  the original failure or relabel the first attempt green. Controls and original
  diagnostic live under `work/issue-67-diagnosis/`.
- Preliminary independent tail begins with scalars, selections, properties and
  ordinary assignment passing. Its actual subsequent rows and final-candidate
  results belong to the next checkpoint, not an inferred passing full run.

No inherited requirement/scenario is retired. Package-mode adaptation supplements
the original public service/real-SQLite/filesystem/isolation/native/platform suite.

## Appearance and outstanding gates

Final appearance evidence must compare principal and late captures with pinned
main `080b416c`, bb `f135a001` and accepted #69 Workspace captures. The rejected
#69 `before-table-1024.png` is historical failure evidence, not an accepted target.
System media emulation proves renderer reaction but does not alone prove actual
OS setting changes. Keep this distinction in final reports.

Required pending gates: final-candidate full local/hosted regression inventory,
all packaged journeys and inspected captures, actual installer/reopen evidence,
strict performance including new project flows, complete UX01–UX20/preservation
ledger and independent review. Earlier scoped receipts do not satisfy these gates.

The owner reports no available actual Windows11 host/VM/runner. Windows Server
CI cannot satisfy that supported-desktop acceptance requirement. Keep #67 open;
do not integrate as accepted, publish a release or close #47/#7/#42 while required
gates remain unresolved.

## Review repairs and retained runtime draft scenario

Initial independent Standards review found two implementation issues: ambient
`WORKSPACE_PERFORMANCE_ROOT` could redirect strict scale to another package, and
the development launcher lookup had made a common test perform Electron's lazy
native installation. The runner now pins the task performance root and disables
diagnostic native tracing. An actual child failure probe observes these values;
it fails against the original forwarding and passes after the repair. The actual
development lookup is moved to a platform test; common path/validation tests stay
pure. Initial Spec review identified actual OS System switching as an open gate,
without other implementation findings.

The dispatch-only new workflow was also replaced before use: GitHub requires a
manually triggered workflow to exist on its default branch. The final job lives in
registered `desktop-ci.yml` under `checks: integrated-desktop`; routing controls
fail before this repair and pass afterwards, preserving ordinary full defaults.
See [GitHub manual-workflow requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
Focused launcher/integration/route checks after repair:40/40, zero skips.

The preliminary tail passes scalars, selection/property editors, ordinary and
filesystem assignment, contextual projects/categories/archive, retained recovery,
sessions, data recovery and all seven original feature consumers. It then fails
the original base runtime while Escape targets a vanished Text editor after
its 420px screenshot. This is separate from the unresolved native-quit failure.

Minimal actual-App reproduction: original viewport helper presses Collapse
sidebar while the draft is active, causing the accepted #56 valid-draft blur
commit. It observes zero editor and persisted `Unsubmitted screenshot draft`.
Control changing only viewport without the sidebar press retains one editor and
the original persisted value. Both controls have normal exit/owned cleanup. This
distinguishes focus-driven commit from viewport remount or source refresh.

The adapted original driver prepares each viewport first, opens and fills the
real draft, captures, Escape-cancels and verifies the original value independently
at each size. It preserves all screenshot/overflow/deadline/value assertions;
product blur behavior is unchanged. The ordinary base command already includes
separate rename/category native fixtures, so the integrated runner does not replay
those successful consumers a second time. Original-command renewal and final
candidate evidence remain separately recorded in GitHub.

Preparatory appearance inspection reviewed all40 principal variants (five surfaces
by both sizes/languages/themes) plus24 restoration/property-review/missing-preview
variants, using contact sheets and selected full-resolution captures. Table1440
matches the accepted #69 composition. Preview/expanded retain its boundaries/tree,
with the intentional #58 property-creation/editor controls. Settings and late
reviews retain the accepted bb foundation and scoped #66 dialog stacking. No
material mismatch was observed in these inspected variants. The full remaining
state/control inventory and final hosted candidate still require their receipts.
