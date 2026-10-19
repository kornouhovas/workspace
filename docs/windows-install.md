# Install Workspace locally on Windows

## Selected support and distribution

The supported target selected for this slice is **Windows 11 x64**. ARM64,
32-bit Windows and Windows 10 are outside this distribution. Automated installed
runtime coverage records the actual Windows Server runner separately in the
[verification report](verification/issue-40-windows-install.md). It does not prove
Windows 11 desktop acceptance, which requires an available target machine.

The offline NSIS installer is unsigned and installs for the current user without
administrator elevation. No signing credential or trusted publisher has been
validated. Distribution and updates are manual; there is no automatic updater,
public download publication or release tag. Executable metadata remains enabled
while code signing is explicitly disabled.

## Build an installer

Use an x64 Windows build host, Node **22.21.1**, npm and Visual Studio Build Tools
with Desktop development with C++ and a Windows SDK for the native adapter.
From a clean checkout of the desired commit:

```powershell
npm ci
npm run package:win
Get-FileHash release\Workspace-0.1.0-windows-x64-setup.exe -Algorithm SHA256
```

`package.json` is the canonical version. Substitute its version after a version
change. The output is `release/Workspace-<version>-windows-x64-setup.exe`.
Locked dependencies, fixed Electron and native x64 rebuilds provide a repeatable
procedure; timestamps mean binaries are not promised byte-for-byte identical.
`--publish never` prevents builder publication. `package:win:built` packages an
already verified current build; never run packaging concurrently with a build.
The build checks bundled renderer/backend, SQLite and rename native modules,
SQL migrations, version agreement and applicable bb notice.

`npm run smoke:install:win` is restricted to disposable GitHub-hosted Windows
runners: it modifies current-user install registration and must not replace a
normal user's installation. It uses a temporary Unicode/space installation path,
source and data directory, then separately verifies the normal app-data location.
Its automated folder-picker seam does not prove manual native-dialog behavior.
CI retains reports and screenshots, not downloadable installer artifacts.

## Install, identify and reopen

1. Quit any existing Workspace instance. Run the locally built setup executable.
2. Select a writable current-user directory (the default is beneath
   `%LOCALAPPDATA%\Programs`). No administrator rights or all-user installation
   are required. A protected folder is unsuitable for this installer.
3. Launch **Workspace** from the Start menu. To identify the installed version,
   right-click the installed **Workspace.exe**, open **Properties → Details**
   and read **Product version** and **File version**. The canonical `0.1.0`
   can appear as `0.1.0.0` in four-part Windows version metadata; only a zero
   fourth component is equivalent. These are standard Windows,
   keyboard-accessible, system-localized surfaces.
4. Select your language in Settings, create a workspace over a disposable folder,
   quit the app and relaunch it. Confirm the workspace, source, selected view and
   language remain. Use a path containing spaces and non-ASCII characters when
   performing Windows 11 acceptance.

Unsigned local installers may be blocked by Windows reputation or organization
policy. Validate the artifact's origin/hash; signing and reputation approval
have not been tested. Follow organization policy rather than assuming a trusted
publisher or disabling system protection.

Notices ship alongside `Workspace.exe` (`LICENSE.electron.txt`,
`LICENSES.chromium.html`) and under `resources\licenses` (`bb-MIT.txt`,
`THIRD_PARTY_NOTICES.txt`, `Drizzle-Apache-2.0.txt`). Other packaged dependency
licenses remain in `resources\app.asar`. See [reuse](reuse.md) for provenance.

## Updates, uninstall and recovery

Installed data lives in `%APPDATA%\workspace\`, outside the installation:
`workspace.sqlite`, session data and automatic/pre-migration `backups`.
Development uses its separate `development` subdirectory. Test overrides point
to disposable directories; do not set `WORKSPACE_USER_DATA_DIR` for normal use.
Project folders stay in the selected source. Do not synchronize the working
SQLite directory with external folder-sync software.

Before a manual update, quit Workspace and retain a verified application-data
export. Run the new installer for the same user and product identity. The
installer replaces application files and retains external application data.
Uninstall through Windows Settings or **Uninstall Workspace.exe** also retains
application data and project files. It is not a request to erase your database.
Reinstalling the same candidate verifies location preservation, not a future
schema upgrade or downgrade. Existing [pre-migration backups and explicit
recovery](recovery.md#automatic-backups-and-updates) apply to schema updates.
Manual exports download as `workspace-application-data.json`; keep those copies
separately. Project files need their own backups.

## Troubleshooting

- **Permission denied during install:** choose a writable current-user folder;
  this installer does not elevate into Program Files. Check organization policy.
- **Setup cannot replace files:** quit Workspace and let its backend exit before
  running the installer again. Do not remove a working database or its WAL files.
- **Backend unavailable on launch:** retain the exact app version and error;
  verify bundled `resources\app.asar`, unpacked native modules and `resources\native`
  from the same build. Node/npm are build prerequisites, not installed runtime
  dependencies. Do not mix files from different packages.
- **Workspace missing after update:** verify the same Windows account and
  `%APPDATA%\workspace` data location, and that no test override is set. Keep
  existing data and use the matching-version export/restore route; do not
  recreate or delete records as a substitute for recovery.
- **Native Reveal refused:** organization PowerShell/AppLocker restrictions can
  reject the fixed bundled helper. The application does not alter persistent
  execution policy or bypass enforced organization policy.
