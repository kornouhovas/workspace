---
status: accepted
---

# ADR 0007: A bounded native no-replace rename primitive

## Decision and implemented scope

Issue #18 requires rejecting an occupied destination at the filesystem operation, including an empty directory inserted after validation. The coordinator selected a repository-owned synchronous C Node-API addon exposing only renameNoReplace(fromPath, toPath). Repeated existence checks followed by Node rename are insufficient: ordinary rename can replace an empty directory on macOS.

The first slice implemented the adapter, typed private wrapper, builds and disposable Node/Electron fixtures. The subsequent [service plan](../plans/completed/issue-18-project-rename-service.md) implements the rename command, durable journal, explicit recovery and production typed transport/client. Name editing/recovery UI remains deferred until coordinator interpretation of service-platform feedback. [The completed design plan](../plans/completed/issue-18-project-rename-stage-1.md) retains the original staging decisions. [ADR 0006](0006-recoverable-project-creation.md) remains the creation decision; its Node mkdir adapter is unchanged.

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

No-replace protects the destination at the native operation. Paths can still be redirected by ancestor/source substitution between service checks and that operation. The implemented service validates current ownership, policy, containment and full identity, commits intent before mutation, repeats evidence checks and preserves uncertainty after observed changes. These checks do not guarantee confinement or locate every displaced effect. There is no filesystem/SQLite atomic transaction, automatic rollback or coordinated power-loss durability.

A native self-alias result is not proof of an exact authored spelling change. The mounted filesystem decides case/Unicode aliasing; do not infer it from OS or folded text. The service detects actual self-alias identity and uses journaled same-parent staging where required, committing first-hop evidence before the second hop and requiring exact enumerated final spelling. The first slice's primitive-only observations remain historical evidence, distinct from service acceptance. Destination links/junctions and distinct occupied entries must survive rejection with their identity and contents unchanged.

## Implemented journal and recovery

Migration 0009 binds the caller's immutable operation ID, workspace/project, authored name and expected revision to source configuration, original/requested/optional staging locators and full root/parent/project identity. Intent, staged and destination_recorded commits precede completion; uncertain retains previous evidence. Final completion atomically changes the existing project locator, receipt and discovery revision without changing UUID, category, exact Text or independent settings/views/revisions. A validated exact-current-name request writes an unchanged terminal receipt with no native effect, revision increment or project event. SQLite protects transition/evidence consistency and retained history, including DELETE/REPLACE and cross-operation placement conflicts.

Unfinished creation and rename reservations participate in discovery, observation, reassociation and Reveal authorization before startup scanning. Conflicting source mutations pause, while reads, Text editing and unrelated sources remain usable. Completed/failed receipts no longer add placement reservations. Immutable terminal retries return recorded results; unfinished retries, reconnect and status/list reads never replay filesystem effects. Fresh token-bound explicit recovery advertises retry_original, finish_staged, complete_destination or keep_original only for a unique matching placement under current same-source authorization. Missing/replaced/linked/inaccessible/conflicting evidence remains unresolved; another folder cannot be adopted. Historical initiating workspace IDs survive removal, and a current sibling or reused source can authorize recovery.

All five rename/status/recovery requests use exact validation through production entry/controller/preload/client routing; absolute paths, staging locators, native evidence and adapter choice remain private. Committed project events precede responses and identify actual source siblings. Old Reveal authorization is invalid after rename; fresh authorization uses the committed/recovered location. See [architecture](../architecture.md#implemented-recoverable-project-rename-service) for the contract and [verification](../verification/issue-18-project-rename-service.md) for mapped checks.

Abrupt-process fixtures cover intent, first effect, staged evidence, final effect, destination evidence and final commit. A failed uncertainty write retains the earlier durable row. These are process-interruption guarantees: runtime WAL uses driver-default synchronous/fullfsync, and no coordinated filesystem/database flush protocol is implemented. Machine-crash/power-loss durability is unestablished.

## Verification and platform checkpoint

Real temporary-directory fixtures cover a nonempty source, absent destination, empty/nonempty occupied directories, files, links/junctions and an empty destination inserted immediately before the native call. They compare full native identity and sentinel bytes. Both Node and an actual Electron utilityProcess (development files and an unpacked ASAR fixture) exercise the compiled primitive and wrapper, Unicode names, platform-specific literal names, argument rejection, missing/corrupt modules and fixed emitted locations.

The initial red run failed because the emitted wrapper/binaries did not exist. Local macOS arm64 compilation used Apple Clang 21.0.0 and Python 3.9.6; Node 22.21.1 and Electron 44.7.0 (embedded Node 24.21.0) subsequently loaded and exercised their separate binaries. The observed temporary mount was case-insensitive: the self-alias call returned renamed while retaining the directory identity and bytes. This is not service-level case-only rename acceptance.

The coordinator subsequently established the primitive checkpoint at `de5de73c2cb178dce7591c8a80412805290dcf8d`: [CI run 38123519292](https://github.com/kornouhovas/workspace/actions/runs/38123519292) passed macOS and both Windows runner jobs, with all 18 native adapter cases passed in the retained coordinator evidence. This permits the bounded service stage; it does not establish service or UI acceptance. The initial local observations above retain their original scope.

The independent project-rename-service-early matrix now builds and runs focused journal/coordination/service/crash/IPC/fixture tests and actual development Electron service smoke on macOS, windows-latest and windows-2022, uploading separate sanitized evidence even on failure. Local service results and exact input identity are recorded in [the service report](../verification/issue-18-project-rename-service.md). Actual new Windows service results and coordinator interpretation at the reviewed implementation SHA remain pending. Existing Windows Reveal/shutdown gates, graphical development/packaged rename acceptance, Name UI and full issue completion remain separate. CI editing authorizes neither executor push nor dispatch.

## References

- [Apple rename and RENAME_EXCL](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/bsd/man/man2/rename.2)
- [Microsoft MoveFileExW](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)
- [Node 22.21.1 C Node-API](https://nodejs.org/download/release/v22.21.1/docs/api/n-api.html)
- [Electron native module requirements](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
