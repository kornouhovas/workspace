# Install Workspace locally on macOS

## Selected support and distribution

This local build targets **macOS 14+ on Apple Silicon (arm64)**. Intel and macOS
13 or earlier are outside this distribution. The minimum is encoded in
`Info.plist`; observed platform coverage is recorded in the
[verification report](verification/issue-39-macos-install.md), not implied for
every macOS version by the declared minimum.

The DMG has no Developer ID signature or Apple notarization. No signing identity
has been configured. Bundled upstream binaries can retain ad-hoc signatures;
these do not establish publisher identity. This is a local installation route,
not a public release or automatic updater.

## Build the installable image

On Apple Silicon macOS, install Node **22.21.1**, npm and Xcode Command Line Tools.
From a clean checkout of the desired commit:

```sh
npm ci
npm run package:mac
npm run smoke:install:mac
shasum -a 256 release/Workspace-0.1.0-mac-arm64.dmg
```

`package.json` owns the version; substitute its current version in the output
filename after a version change. Locked dependencies, a fixed Electron runtime
and native arm64 rebuild make this a repeatable build procedure. DMG filesystem
metadata/timestamps are not guaranteed byte-for-byte identical between builds.
`--publish never` prevents builder publication. No release tag is created.
`package:mac:built` packages an already verified current build; use `package:mac`
when building from source. Never package concurrently with a build or another
artifact-producing command.

The output is `release/Workspace-<version>-mac-arm64.dmg`. The build checks
bundled renderer/backend, native SQLite and rename modules, ordered migrations,
canonical version and bb notice. Installation acceptance mounts the image
read-only, copies it into a disposable Applications directory, verifies OS-visible
versions/architecture/notices, creates a workspace, quits, reopens, replaces only
the app and reopens the same data. It uses isolated test data, never your normal
database. Its root-picker seam does not exercise the native dialog manually.

## Install and identify the application

1. Open the DMG in Finder.
2. Drag **Workspace.app** to **Applications**. Quit an existing Workspace instance
   before replacing it. Do not run your working installation from the mounted image.
3. Eject the disk image and launch **Applications → Workspace**.
4. Check **Workspace → About Workspace** for the product version. This standard
   macOS panel and menu use system localization and keyboard navigation; product
   language is selected independently in Settings.
5. Create a workspace over a folder you choose. Quit with **Command-Q**, reopen
   the installed application and confirm the workspace and language persist.

Applicable notices ship under `Workspace.app/Contents/Resources`: Electron's
`LICENSE.electron.txt`, `LICENSES.chromium.html`, `licenses/bb-MIT.txt` and
`licenses/THIRD_PARTY_NOTICES.txt` and `licenses/Drizzle-Apache-2.0.txt`
(from upstream Drizzle ORM 0.45.4, whose code is bundled into the backend).
Other packaged npm dependency licenses remain in
`app.asar`. UI provenance is recorded in [reuse](reuse.md).

## Updates and data locations

The installed app uses `~/Library/Application Support/workspace/` for
`workspace.sqlite`, recovery exports/backups and session data. An app replacement
must keep the same product identity and data location. Moving/replacing `.app`
does not migrate, import or delete project folders. Removing `.app` does not
remove these user data. Development uses the distinct `development` subdirectory;
acceptance uses `WORKSPACE_USER_DATA_DIR` pointing only at disposable fixtures.
Do not set that override for an ordinary installation.

Before updating, quit Workspace and retain a verified application-data export.
Replace only the `.app`, then reopen. Pending schema changes use the established
[pre-migration backup and recovery boundary](recovery.md#automatic-backups-and-updates).
Do not downgrade a migrated database blindly: use the matching previous app and
its verified snapshot through explicit restore. Replacing the same candidate in
acceptance proves data-location persistence, not a future schema upgrade. Project
files require their own backups.

## Troubleshooting

- **macOS blocks opening:** verify that you built or trust this exact local
  artifact. Follow Apple's [Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)
  guidance through Privacy & Security when appropriate. Organization policies may
  prevent approval. Do not disable Gatekeeper globally or remove quarantine recursively.
- **Wrong architecture/unsupported system:** check About This Mac and use this
  arm64 build on macOS 14 or later.
- **Backend unavailable:** keep the application-data directory intact. Confirm
  free space and permissions, quit/reopen, and use the visible failure guidance.
  A pre-migration backup failure intentionally blocks the update; preserve all
  recovery copies. Do not delete SQLite/WAL files to bypass startup failures.
- **Workspace folder unavailable after reopen:** reconnect the original source or
  use the existing explicit folder-recovery controls. Reinstalling the app does
  not restore project files or grant filesystem access.

Unsigned downloaded/quarantined Gatekeeper acceptance, Intel, signing,
notarization and public release delivery require their own observed evidence.
