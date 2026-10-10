---
status: accepted
---

# ADR 0007: A bounded native no-replace rename primitive

## Decision and implemented scope

Issue #18 requires rejecting an occupied destination at the filesystem operation, including an empty directory inserted after validation. The coordinator selected a repository-owned synchronous C Node-API addon exposing only renameNoReplace(fromPath, toPath). Repeated existence checks followed by Node rename are insufficient: ordinary rename can replace an empty directory on macOS.

This first slice implements the adapter, typed private wrapper, builds and disposable Node/Electron fixtures. It does not implement the rename command, durable journal, recovery, renderer transport or Name editor. [The stage plan](../plans/issue-18-project-rename-stage-1.md) keeps those later steps deferred. [ADR 0006](0006-recoverable-project-creation.md) remains the creation decision; its Node mkdir adapter is unchanged.

- macOS calls renamex_np with RENAME_EXCL only. A filesystem that does not support the flag rejects the operation. There is no ordinary-rename fallback.
- Windows calls MoveFileExW with flags zero, preserving UTF-16. Replacement, cross-volume copying and delayed reboot operations are disabled.
- C Node-API version 8 avoids a node-addon-api dependency. Arguments must be exactly two absolute strings without NUL or malformed surrogate pairs. macOS conversion to UTF-8 happens only after UTF-16 validation; Windows retains UTF-16. Allocated buffers are released on every path.
- Results are finite categories: renamed, occupied, invalid_argument, source_unavailable, permission_denied, busy, cross_device, unsupported and filesystem_error. The wrapper adds native_unavailable for missing, malformed or incompatible modules. Raw paths, OS messages and exception text are never returned.

The wrapper loads lazily from its emitted module directory. Electron uses dist/service/native/project-rename.node; Node fixtures use the separate dist/service-test-native/project-rename.node. No cwd, PATH, environment override or renderer input selects an adapter. An unavailable adapter rejects attempted mutation without making module import or unrelated startup fail. Loading errors are caught, not replaced by another mutation method.

## Build and packaging responsibilities

The locked node-gyp 12.4.0 is invoked by its installed JavaScript path, never through npx or a downloading package runner. npm ci installs the existing resolution; no dependency was added. Compilation requires Node 22.21.1, Python and either Xcode Command Line Tools/macOS SDK or Visual Studio C++ Build Tools/Windows SDK. Version-specific Node and Electron 44.7.0 headers, and Windows import libraries, must be cached or downloadable from their official distributions. Missing tools fail the build; the script does not install SDKs or change global configuration.

Build separate Node-test and Electron-runtime binaries from the same C source for the current host architecture. Node-API stability does not establish actual Electron loading or architecture portability. Cross-compilation, universal artifacts and prebuilt distribution remain outside this decision. The runtime binary has one exact ASAR-unpack rule. Packaging excludes the test binary and ESM test wrapper. Artifact checks require the runtime wrapper, ASAR unpack metadata, a real unpacked binary and byte equality with the current runtime build.

This addon runs with backend privileges. Native memory safety, compilation, loading and packaging are repository responsibilities. It introduces no privilege elevation, persistent OS-policy change, shell mutation process or network listener. No native interface is exposed to the renderer.

## Remaining safety boundaries

No-replace protects the destination at the native operation. Paths can still be redirected by ancestor/source substitution between service checks and that operation. The future service must validate current ownership, policy, containment and full identity, commit intent before mutation, repeat evidence checks and preserve uncertainty after observed changes. This adapter alone provides no filesystem/SQLite atomic transaction, automatic rollback or coordinated power-loss durability.

A native self-alias result is not proof of an exact authored spelling change. The mounted filesystem decides case/Unicode aliasing; do not infer it from OS or folded text. The future service must detect actual self-alias identity and use journaled same-parent staging where required. The first slice records actual mounted case behavior without implementing that service policy. Destination links/junctions and distinct occupied entries must survive rejection with their identity and contents unchanged.

## Verification and platform checkpoint

Real temporary-directory fixtures cover a nonempty source, absent destination, empty/nonempty occupied directories, files, links/junctions and an empty destination inserted immediately before the native call. They compare full native identity and sentinel bytes. Both Node and an actual Electron utilityProcess (development files and an unpacked ASAR fixture) exercise the compiled primitive and wrapper, Unicode names, platform-specific literal names, argument rejection, missing/corrupt modules and fixed emitted locations.

The initial red run failed because the emitted wrapper/binaries did not exist. Local macOS arm64 compilation used Apple Clang 21.0.0 and Python 3.9.6; Node 22.21.1 and Electron 44.7.0 (embedded Node 24.21.0) subsequently loaded and exercised their separate binaries. The observed temporary mount was case-insensitive: the self-alias call returned renamed while retaining the directory identity and bytes. This is not service-level case-only rename acceptance.

Actual Windows compiler/loading, collision and mounted-filesystem results remain coordinator-owned acceptance at the implementation SHA. The early Windows job is prepared to run the focused fixture alongside existing creation/Reveal checks and preserve finite JSON outcomes. Editing CI grants no push or dispatch authorization. Journal/service/UI expansion waits for that checkpoint.

## References

- [Apple rename and RENAME_EXCL](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/man/man2/rename.2)
- [Microsoft MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)
- [Node 22.21.1 C Node-API](https://nodejs.org/download/release/v22.21.1/docs/api/n-api.html)
- [Electron native module requirements](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
