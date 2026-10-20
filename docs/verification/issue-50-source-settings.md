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
findings. Final platform CI, installer acceptance and integration remain gates until
recorded in GitHub. Local macOS evidence is not Windows or release acceptance.
