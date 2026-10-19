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

## Remaining verification

Final review, fresh package/installation evidence, full local suite and exact-SHA
CI are pending at this checkpoint. The dedicated `macos-install.yml` route targets
macOS 14 arm64; the existing desktop three-platform workflow remains unchanged.
The workflow retains reports/screenshots, not DMG downloads. Local evidence files
are under ignored `work/issue-39-install/`; CI evidence has SHA/run/attempt provenance.

The declared minimum is not a claim that every macOS version was tested. Local
unsigned builds do not prove Gatekeeper acceptance for downloaded/quarantined apps.
Signing, notarization, Intel, automatic updates, public downloads and release tags
remain outside this issue. Replacement acceptance uses the same candidate; future
schema changes retain issue 37/38's matching-version export/restore and pre-migration
backup policy rather than claiming an untested upgrade or downgrade.
