# Issue 40: Windows local installation

GitHub [#40](https://github.com/kornouhovas/workspace/issues/40) owns acceptance
and current execution checkpoints. Baseline: `4bdbe6bc` on `new-workspace`.
Executor: Matt Pocock implement. The owner approved Windows 11 x64, unsigned
per-user offline NSIS, no elevation, manual updates, and ordinary issue-scoped
push/comments/CI in the currently public repository. No copied bb modules.

## Scenarios and approved seams

The owner approved testing the installer/installed app and public Workspace
service boundary. Existing service tests retain real temporary SQLite/filesystem
fixtures. Package configuration first failed because no Windows installer target
existed; the selected NSIS policy now passes that focused control. Real installer
acceptance must additionally pass on Windows; configuration alone is insufficient.

| Boundary | Evidence route |
| --- | --- |
| Repeatable offline x64 installer, canonical version and notices | `package:win`, artifact checker, installed executable ProductVersion/FileVersion/PE architecture and shipped notices |
| Actual install and bundled backend/SQLite | Silent NSIS install into a disposable path outside checkout; launch installed executable with temporary cwd |
| Create, quit, reopen | Keyboard creation plus public Workspace load snapshots retaining workspace/source/view IDs |
| Manual update and retained data | Same-candidate installer replacement, then reopen; existing recovery/migration suite covers new-format upgrades |
| Spaces, Unicode and permissions | Unicode/space install/source/data paths; current-user-only target and no elevation; existing Windows filesystem regressions |
| Production location and fixture isolation | Default Windows app-data path checked separately on an ephemeral hosted runner; development data remains separate |
| Version visibility, EN/RU, isolation | Windows executable Properties version; EN/RU keyboard flow/screenshots; renderer isolation and backend exit |
| Failure/cleanup | Bounded installer execution, original failure UI/report, owned process shutdown before uninstall and fixture removal |
| Supported OS | Windows hosted-runner installation evidence names its actual OS; Windows 11 desktop acceptance remains distinct if unavailable |

No release tag, download publication, signing credential validation, automatic
updater or downgrade compatibility is authorized. CI retains reports/screenshots,
not installer downloads. Full inherited desktop coverage remains required.
