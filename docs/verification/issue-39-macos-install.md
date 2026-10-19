# Issue 39 macOS installation evidence

Scope and scenario map: [plan](../plans/issue-39-macos-install.md).
User guide: [macOS installation](../macos-install.md).
GitHub [#39](https://github.com/kornouhovas/workspace/issues/39) holds exact-SHA
CI/integration status. This file records local observations, not a released product.

## Observed local checks

Host: macOS 27.0, Apple Silicon arm64, Node 22.21.1. Baseline `d0e905fc`.
The initial manifest acceptance check rejected the existing packaged minimum
`13.0`; the selected `14.0` policy passes after the packaging configuration change.
Six disposable manifest controls verify accepted and rejected versions, identity,
executable and minimum OS. The installed runtime is exercised independently.

`package:mac:built` produced a locally installable DMG without Developer ID or
notarization. Artifact resources pass the existing checker. A read-only mounted
image was copied with `ditto` into a disposable Applications directory outside
the checkout; the actual installed executable launched with a temporary cwd and
a separate temporary application-data directory. The bundled backend/SQLite
created a workspace through keyboard-driven UI. Three normal app sessions passed:
create/quit, same-install reopen, then app replacement/reopen. Public Workspace
service snapshots retained workspace/source/view identities, and Russian persisted.
Parent/backend exit and final fixture cleanup passed. The mounted image was detached.
EN wide/RU narrow screenshots were inspected. Renderer Node access remained absent,
with context isolation and sandbox enabled. The test root-picker seam remains an
automation boundary, not manual native-dialog evidence.

The native macOS About panel was opened and inspected through accessibility and a
screenshot: **Workspace Version 0.1.0 (0.1.0)**. The OS menu is named Workspace,
while Electron's internal app name and existing default data-directory component
remain `workspace`; no production data path is renamed by this issue.

## Final local verification and remaining gates

Standards and Spec reviews found no blockers. The CI source-map suggestion was
applied. Fresh build/package and final DMG install/reopen/replacement pass,
including byte-equal Drizzle/provenance notices. DMG SHA256:
`d5812a7dd25a1039575c000bbdc2d68bad9965a196159cbde613ed55fb74a9e4`.
The local report was collected from the follow-up working tree based on
`40341fcb`; it is not an exact-commit CI receipt.

Lint, typecheck, version consistency, 161-file local Markdown links,
`git diff --check` and 46 focused manifest/CI-route controls pass.
The required complete local run (`npm run test:all`, reusing the fresh build)
finished with **3078 passed, 1 failed, 26 conditional skips** (3105 tests).
The sole failure was the unchanged `property-editor-driver.test.mjs` Number
creator fixture's normal Electron shutdown timeout after 10000ms. Its timeline
showed before-quit, will-quit, quit and node-exit; parent exit required confirmed
forced cleanup. The observed symptom matches the previously recorded
[local macOS 27 limitation](issue-38-automatic-backups.md#full-suite-result-and-local-limitation),
not an established shared root cause or a claimed repair. The local full suite is
**not green**. No application guard, deadline or assertion was relaxed.

Exact-SHA CI and integration remain pending in GitHub at this checkpoint. The dedicated `macos-install.yml` route targets
macOS 14 arm64; the existing desktop three-platform workflow remains unchanged.
The workflow retains reports/screenshots, not DMG downloads. Local evidence files
are under ignored `work/issue-39-install/`; CI evidence has SHA/run/attempt provenance.

The declared minimum is not a claim that every macOS version was tested. Local
unsigned builds do not prove Gatekeeper acceptance for downloaded/quarantined apps.
Signing, notarization, Intel, automatic updates, public downloads and release tags
remain outside this issue. Replacement acceptance uses the same candidate; future
schema changes retain issue 37/38's matching-version export/restore and pre-migration
backup policy rather than claiming an untested upgrade or downgrade.
