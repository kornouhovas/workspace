# Issue 31 verification

Tracker and CI/integration checkpoint: [GitHub #31](https://github.com/kornouhovas/workspace/issues/31).
Base: `75c8aa07`. Contract/scenarios: [plan](../plans/issue-31-table-layout.md).

## Candidate evidence

Typed-service tests use disposable real SQLite databases and project folders. They
cover restart, exact value preservation, duplicate/sibling independence, missing
identities and new discoveries, filtered/MultiSelect grouping order, archive/restore,
foreign/malformed requests, transaction rejection without committed events, corrupt
configuration repair and populated upgrade with views/filters/grouping intact.
EN/RU UI tests exercise keyboard visibility, column order, Text wrapping and row
order through the real service. Built IPC checks validate requests and responses.

The existing `smoke:views` development/packaged route now also exercises actual
Table controls, keyboard resize/wrap/reorder, dedicated drag, persisted reload,
independent duplicates/workspaces and 360/1024/1440 layouts in both languages. It
retains ordinary Electron/backend shutdown and owned-fixture cleanup assertions.
No additional bb module or dependency was copied.

Observed local checks and review results are recorded below.
CI acceptance and delivered SHA remain in the GitHub checkpoint; local macOS
verification does not establish Windows or packaged acceptance.

## Observed local results

- Fresh application build/version checks, typecheck, lint, documentation links,
  Ladle production build and staged diff checks passed.
- Focused service/UI/IPC checks passed. EN/RU UI additionally covers consecutive
  keyboard width saves without remount/focus loss, pending disablement, read retry,
  failed-save rollback to committed settings and explicit reset.
- Populated migration inventory completed; its sole stale expected latest-index
  failure was repaired and the original build-smoke check passed. The later full
  inventory passed all migration/data-preservation assertions.
- Both independent Matt Pocock review axes have zero remaining findings. The Board
  corruption isolation and keyboard slider focus findings were repaired with
  regressions and re-reviewed. Fixture repairs were separately inspected without
  weakening mutation, cancellation or focus assertions.
- Actual macOS development `smoke:views` passed both languages, including the new
  Table controls and repeated End/ArrowLeft width changes with retained focus.
  EN 360px and RU 1440px screenshots were visually inspected; all six Table layout
  screenshots and the existing views evidence retain normal app/backend shutdown
  and owned fixture cleanup.
- App/Ladle focused reconciliation: **93 tests passed**. The initial full inventory
  exposed an unsupported new read in the App mock and ambiguous discovery checkbox
  queries; those fixtures now answer the default read and identify the existing
  EN/RU Exclude controls. A Ladle 403 came from a dependency symlink outside Vite's
  served root; replacing that local setup with actual local dependencies repaired
  its original test without changing product serving policy.
- Full local inventory for initial software candidate `3109b1ca`: **2923 passed, 4 failed, 25 conditional skips**.
  All four failures concern the unchanged real-Electron normal-shutdown boundary:
  three property-editor driver cases and the deferred normal-quit control. Product
  assertions complete, then the strict 10s normal close deadline fails. These
  fixtures do not load the Table implementation. The property failure reproduces
  on baseline `75c8aa07` with the same local Electron/dependencies; its recorded
  events include before-quit/will-quit/quit/node-exit and forced cleanup. The cause
  of that environment-specific native-close delay is not established. No deadline,
  normal-quit assertion or cleanup gate was relaxed. Full remote platform/native
  acceptance is required before integration and is recorded in GitHub.

## CI route

No workflow defaults or platform coverage were reduced. The new test files inherit
platform discovery in `test-suites.mjs`; `test:migrations` explicitly includes the
new service suite. The existing macOS/Windows latest/Windows 2022 development and
packaged `smoke:views` steps include `runtime-table-layout.mjs` and retain uploaded
screenshots, exact candidate metadata, normal shutdown and fixture cleanup evidence.
No additional CI route is needed for the feature. CI result, artifact inspection,
accepted candidate and delivered SHA belong in the linked GitHub checkpoint.


## CI repair: retain default Text wrapping

Full CI on `3109b1ca` passed common/static and both reached platform inventories
(macOS and Windows 2022), then its original category Ladle layout captures rejected
long Text overflow. The exact command reproduced locally:
`node scripts/smoke-discovery-layouts.mjs --category-move` reported
`text-value-button` element overflow. Defaulting previously unconfigured Text to
nowrap had changed the existing presentation. Restoring default wrapping preserves
that behavior while leaving explicit saved choices intact. Non-Text defaults are
unchanged. No overflow assertion, readiness deadline or fixture gate was relaxed.

Both review axes accepted the scoped repair. Nine focused service/UI checks pass,
including default-on and persisted off/on EN/RU toggles. The runtime helper verifies
both pre-wrap and explicit clipped nowrap/ellipsis. Fresh application/Ladle builds,
typecheck and lint pass. The original category capture now passes **150 EN/RU
screenshots**, with its existing wrapping and no-overflow checks. The repaired
macOS development `smoke:views` also passes both languages and both Text states,
including strict normal shutdown/backend exit and fixture cleanup.

Separately, the original Windows latest early native Reveal command reached exact
parent Open but timed out before SelectItem. Its bounded trace and ordinary
non-trace focused controls both passed on `3109b1ca`, including native returned
completion, renderer acknowledgment, normal shutdown/restart and cleanup. This is
not a claim of an identified native cause or repair. The original failure is
retained in GitHub alongside both controlled runs. The repaired candidate must pass
its affected focused routes before full CI/integration; those volatile gates and
artifact results remain in the issue checkpoint.
