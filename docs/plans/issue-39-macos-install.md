# Issue 39: macOS local installation

GitHub [#39](https://github.com/kornouhovas/workspace/issues/39) owns acceptance,
CI and integration status. Baseline: `d0e905fc` from verified `new-workspace`.
Executor: Matt Pocock implement, with artifact and installed-application seams
approved by the owner. No additional bb code is copied.

## Accepted distribution contract

The owner selected macOS 14 or later on Apple Silicon (arm64), a DMG without
Developer ID signing or notarization, and manual replacement of the app for
updates. Intel, automatic updates, release tags and published downloads are
outside this slice. Apple Silicon binaries may retain upstream ad-hoc signatures;
these do not identify a verified publisher. No signing credential is configured.
The owner separately authorized ordinary push/comments/CI in the currently public
repository for this issue.

`package.json` remains the canonical product version. Package and build JSON,
macOS bundle/display versions and the standard macOS About panel must agree.
Installed data stays outside the app; development/test data remain separate.
Existing recovery and pre-migration backup contracts apply to future updates.

## Scenarios and evidence routes

| Acceptance/failure boundary | Check |
| --- | --- |
| Reproducible arm64 DMG, macOS 14 minimum, canonical version | `package:mac`, `check:artifact`, manifest rejection controls and installed plist/lipo validation |
| Bundled backend and SQLite; no source-checkout runtime dependency | Launch copied `.app` with cwd in an isolated temporary tree; typed service create/load; native module checks |
| Actual install, quit, restart, same workspace/source/view identities | Read-only DMG mount, `ditto` install in a disposable Applications directory, three app sessions with public-service equality checks |
| Replacement preserves user data | Quit, remove only installed app, recopy verified candidate, reopen unchanged external application-data directory |
| EN/RU, keyboard, version visibility, renderer isolation | UI keyboard creation/language selection, screenshots, standard About menu, runtime version and isolation checks |
| Missing/mismatched bundle versions or support policy | Disposable manifest fixtures reject wrong identifier, executable, product/bundle version and minimum OS |
| Notices/provenance | Existing full bb license check plus installed Electron/Chromium/provenance files |
| Shutdown/failure cleanup | Retain owned processes, bounded normal quit, verify backend exit before replacement/removal; detach image and write report even on failure |
| Migration failure/recovery | Existing issue 37/38 recovery boundary; no schema migration in this slice, no downgrade compatibility claim |

Local reports: [verification](../verification/issue-39-macos-install.md).
Exact-SHA CI and integration are recorded in the issue checkpoint. The inherited
full CI matrix stays intact; an additional macOS 14 arm64 DMG installation job runs on
ordinary/full CI. No DMG is uploaded or published by that job.
