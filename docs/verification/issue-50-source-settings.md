# Issue 50 source settings verification

Origin: [#50](https://github.com/kornouhovas/workspace/issues/50).
Baseline: `e1de3d8e`. Implementation plan: [source settings](../plans/issue-50-source-settings.md).
CI and integration receipts belong to the issue checkpoint; this report records
local observations and does not imply release acceptance.

## Implemented boundaries

- `workspace.listSources` returns distinct persisted sources, current availability,
  mode, saved exclusions, archive designation and referencing workspaces. Reading
  settings does not activate a workspace or mutate source configuration. Retained
  sources remain listed after their last workspace is removed.
- Sources list/detail uses the existing settings foundation. Discovery and archive
  changes retain separate review/confirm operations and current service tokens.
  Settings refresh and source observations invalidate reviews; stale asynchronous
  status replies cannot override newer observations. Pending Apply blocks navigation.
- Existing working-area discovery, source status/refresh and archive controls remain
  reachable. Source settings does not mount another project view or change a saved
  view. No migration, new filesystem operation or upstream module is introduced.

## Local evidence (Node 22.21.1, macOS)

- Build, typecheck, lint, documentation links and whitespace checks passed.
- Initial focused renderer/workspace/discovery-mode/archive run: 209 passed.
- Additional source-list tests cover shared ownership, unchanged selection,
  orphan configuration, root unavailability/restart and retained project identities.
- Renderer tests cover EN/RU ownership details, real SQLite/folder preview cancel
  and grouped Apply across siblings, source-change invalidation and delayed status.
- Archive editor regression reproduces collapse/reopen with an old review. Resetting
  the draft now discards its review token. Both review regressions passed; removing
  their repairs caused failures.
- Full suite: 3170 tests, 3141 passed, 26 platform skips, 3 failures. Renewed affected
  evidence is listed below; the initial full run is not relabelled all-green.
- Original `smoke:shell` passed with the adapted Sources list entry and normal
  shutdown/cleanup.
- `smoke:sources` passed again after review repairs: eight EN/RU × light/dark ×
  1024x720/1440x960 combinations, independent cancellation, shared Apply, independent
  sibling views, reviewed archive designation, refresh/restart and file retention.
  Nine check groups, 16 screenshots, normal shutdown and owned cleanup passed.
  Inspected representative narrow dark/Russian source details and wide light/English
  impact review: controls/path text remain within the scrolling settings surface.

## Failure diagnosis and renewed evidence

1. Ladle bootstrap returned HTTP 403 because the task's initial `node_modules`
   symlink resolved into the integration worktree outside Vite's allowlist. Replaced
   that local-only symlink with a copy of the same dependencies. The unchanged
   `tests/ladle-dev.test.mjs` passed (1/1); no Vite access policy was relaxed.
2. `windows-product-diagnostics.test.mjs` expected the old full CI command list.
   Adapted its expected sequence to include `smoke:sources`; every original command,
   platform and safety assertion remains. The affected routing/archive run passed
   36/36. This is an inherited scenario adaptation to #50's new native coverage.
3. The property-editor readiness fixture completed its own focus scenario but its
   Electron shutdown exceeded the existing 10-second deadline in the concurrent
   full suite. Its timeline recorded ordinary quit then delayed parent exit; forced
   owned cleanup passed, which does not make that original test successful. The
   unchanged complete `property-editor-driver.test.mjs` passed 13/13 in an isolated
   replay, including normal shutdown. The historical delay's cause is unproven;
   no deadline, assertion or ordinary CI route was weakened.

Native-driver development also exposed an early list-readiness check and a locator
matching both hidden working-area and settings archive controls. The driver now
waits for its source entry/detail and scopes archive interactions to the visible
source detail. Final native evidence passes with the original action deadlines.

## Review and acceptance limits

Independent Standards review found source-event invalidation and delayed-response
ownership gaps; Spec review found the archive draft/review mismatch. All three
were repaired with regressions; both follow-up reviews report zero remaining
findings. Platform and installer receipts are recorded below and in GitHub;
the delivered integration SHA belongs to the issue checkpoint. Local macOS
evidence is not Windows or release acceptance.

## CI canonical-path fixture repair

Desktop run `39398466086`, attempt 1, application SHA `068b87c`, Windows 2022:
`test:platform` failed two new source settings tests. Retained job log
`118547502222` shows their expected root uses `C:\Users\RUNNER~1` while the
service/UI correctly expose the native canonical `C:\Users\runneradmin` path.
The renderer failure is the exact-name locator mismatch; the service failure is
the same sole expected-field mismatch. Both tests now use `realpathSync.native`,
matching the accepted native canonicalization contract without changing the
application. No identity, shared-ownership, cancel/Apply or retained-data assertion
was removed. Local affected scenarios pass 5/5.

The manual `checks: source-fixture` route builds the original fixtures and runs
only these source settings scenarios plus related regressions on both Windows
hosts and macOS. It records SHA/run/attempt and original logs. Ordinary full CI
remains unchanged; common/platform jobs are not dispatched by this focused gate.
Passing original source-native and both installer receipts remain at `068b87c`.

The same two path-expectation failures were confirmed in Windows latest job
`118547502274` of the original run. Focused run `39400896137`, attempt 1, at
`18fba931` passed all three hosts: inspected provenance and original logs contain
5 passed scenarios each, zero failures/skips. Both original failures are renewed.

The complete `068b87c..18fba931` delta contains only two test expectations, focused
workflow/route tests and documentation; application, dependencies, build/package
inputs and runtime configuration are unchanged. The Windows runtime/layout/package
suffix skipped by the failed original platform batch remains required. The manual
`source-runtime` continuation supplies that exact suffix on both Windows hosts
with fresh build prerequisites and provenance; its command/env/condition parity
is tested against ordinary acceptance.

## Inspected CI acceptance receipts

All runs below are attempt 1. The original failed run remains failed; its Windows
fixture failures and unreached suffixes are covered by the separate renewal runs.

| Evidence | Actual SHA | Run and result |
| --- | --- | --- |
| Common/static, complete macOS platform/runtime/package checks; source, shell and management native checks on all three hosts; unaffected Windows platform scenarios | `068b87c77f0e58a3dcc062087ab6aeacf13d4fc4` | [39398466086](https://github.com/kornouhovas/workspace/actions/runs/39398466086): common/macOS passed; two Windows fixture failures diagnosed above |
| macOS DMG and Windows NSIS install, reopen/reinstall, data retention and cleanup | `068b87c77f0e58a3dcc062087ab6aeacf13d4fc4` | [39398466004](https://github.com/kornouhovas/workspace/actions/runs/39398466004): both passed |
| Five source settings scenarios, including both corrected path expectations, on all three hosts | `18fba931bccce2a4d1a6554196b9afd51f02fff7` | [39400896137](https://github.com/kornouhovas/workspace/actions/runs/39400896137): all passed |
| Previously unreached Windows latest/2022 layouts, development runtime, package and packaged runtime | `ea66e902ca228850c8945573dfd4be53e1c52304` | [39401273116](https://github.com/kornouhovas/workspace/actions/runs/39401273116): both passed |

Downloaded and inspected original logs, provenance and scenario reports. Each
platform's dev/packaged general runtime completed all 15 stages. Archive,
category-options, properties, Table/Board and data-recovery reports confirm
normal shutdown and owned cleanup. Creation/native reports confirm exact
file-manager selection, restart and shutdown; crash matrices retain their
explicit recovery-only scope. Windows latest's early direct native scenario is
inherited from the original run; the continuation supplies its remaining cases.
Positive category service receipts and observer reports passed on all hosts;
deliberate negative-control fixtures are not counted as production failures.

The complete `068b87c..ea66e902` delta changes only tests, diagnostic CI routes
and documentation. Application, dependencies, migrations, build/package inputs
and runtime configuration are unchanged. The final report update is documentation
only; it does not assign earlier results to a new SHA. Windows hosted-server
receipts do not establish a separate Windows 11 release acceptance. Release and
cross-slice acceptance in #67 remain outside this issue's delivery.
