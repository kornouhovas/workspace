# Issue #8: Launch the desktop app and persist its interface language

## Overview

Build the first runnable local Workspace slice: an Electron desktop app with a React settings screen, a separate TypeScript backend, a narrow typed preload boundary, and an English/Russian preference stored in SQLite. Closing the app stops its backend. Backend and save failures are visible. Project discovery and other release features remain outside this issue.

## Context

- Plan destination after acceptance: `docs/plans/issue-8-launch-language.md`.
- Issue: GitHub #8; Beads execution step: `workspace-31i.1`.
- Starting point: a documentation foundation with no package manifest, application runtime, or test commands.
- Relevant files: `docs/specs/workspace-0.1.0-tickets/01-launch-desktop-and-persist-the-interface-language.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/reuse.md`, `docs/releases.md`, accepted ADRs 0001–0003, `README.md`, and `CHANGELOG.md`.
- New code boundaries: `src/contracts/`, `src/service/`, `src/desktop/`, and `src/renderer/`. Exact filenames may follow the selected build tooling.
- Proposed initial choices: Electron process IPC through `utilityProcess`, Drizzle with `better-sqlite3`, versioned SQL migrations, and an application database beneath Electron’s machine-local `userData` path. Development uses a distinct data directory; tests use temporary directories. Verify current package and platform compatibility against primary documentation before pinning versions or implementing these choices.
- Reuse only the bb styling and controls required for this screen, pinned to `f135a001e72942cee9118d2693208ec0725e2f18`. Inspect source dependencies and notices before copying. No whole-package import is assumed.
- Preserve the selected Ralphex executor and model configuration recorded in the run evidence.

## Development Approach

- **Testing approach**: Regular implementation followed by behavior tests for each task.
- Finish each task, including its new or updated tests, type checks, and build checks, before starting the next.
- Use the typed Workspace settings service with a real temporary SQLite database as the primary behavior test seam. Use focused renderer, IPC, and Electron checks for behavior that seam cannot prove.
- Keep the renderer free of Node and database access. Validate commands in the backend even when the preload exposes a narrow API.
- Keep run logs, fixtures, and generated artifacts under ignored `work/ralphex/issue-8` or other ignored build directories. Make coherent local task commits after verification; do not mutate GitHub or Beads, push, merge, publish, or start implementation before plan acceptance.

## Implementation Steps

### Task 1: Establish the application build and boundary choices

**Files:**

- Create: root package manifest, lockfile, TypeScript and build configuration, and minimal entries under `src/desktop/`, `src/service/`, and `src/renderer/`.
- Create: `docs/adr/0005-local-settings-runtime.md`.
- Update: `.gitignore` and `docs/architecture.md`.

- [x] Check official Electron, Drizzle, SQLite-driver, Vite, React, and packaging documentation for compatible current versions; pin a reproducible dependency set.
- [x] Record the selected process transport, driver, migration method, development/test/user data locations, and packaging implications before implementing dependent storage and IPC code.
- [x] Add scripts for tests, lint, type checks, renderer/backend builds, and a development launch. Define one canonical product version and a check that package/build versions agree.
- [x] Add a build smoke test that confirms the separate desktop, renderer, and backend entry points are emitted and that the version check fails on a mismatch.
- [x] Run the new test, lint, type, and build scripts successfully.

### Task 2: Implement durable settings through the typed service

**Files:**

- Create: `src/contracts/settings.ts`, `src/service/settings.ts`, `src/service/db/` schema and versioned migrations, and related tests.

- [x] Define the minimal typed query and command contract: load settings and set language to `en` or `ru`, with normalized validation and storage errors.
- [x] Implement a device-local settings record with English as the default. Run Drizzle migrations when the backend opens its database.
- [x] Reject malformed commands and unsupported language values at the service boundary. Return an error when a save fails; do not report an unsaved language as persisted.
- [x] Test first launch, English default, Russian save, service close and reopen, migration on a fresh database, malformed input, and an injected read/write failure using temporary real SQLite databases.
- [x] Run all current tests, lint, type checks, and builds before continuing.

### Task 3: Own and supervise the backend process

**Files:**

- Create: `src/service/entry.ts`, `src/desktop/main.ts`, `src/desktop/preload.ts`, typed client/IPC modules, and lifecycle/security tests.

- [x] Start the compiled TypeScript backend as a desktop-owned local process with IPC and no listening network socket. Pass only the selected machine-local data directory and required startup configuration.
- [x] Add startup readiness, timeout, process-exit, request-error, and shutdown handling. Show a bounded startup error state when the backend cannot start.
- [x] Expose only settings queries and commands through the preload. Set `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`; keep renderer imports free of Node, filesystem, and database modules.
- [x] Test request routing, malformed payload rejection, readiness and startup failure, backend exit, shutdown cleanup, security configuration, and absence of a network listener.
- [x] Run all current tests, lint, type checks, and builds before continuing.

### Task 4: Extract the needed bb UI foundation and add Ladle

**Files:**

- Create: selected controls/styles under `src/renderer/components/`, Ladle configuration and stories, and applicable license/provenance files.
- Update: `docs/reuse.md`.

- [ ] Inspect the pinned bb source paths and copy or adapt only the controls and styling needed for a labeled language selector and status/error presentation.
- [ ] Record upstream URL, revision, source and destination paths, adaptations, and complete applicable notices. Exclude unrelated chat, session, table, and mobile modules.
- [ ] Add Ladle previews for the selected controls and relevant states in both languages.
- [ ] Add focused component interaction and keyboard tests, plus a test or check that required provenance and notices remain present.
- [ ] Run all current tests, lint, type checks, application builds, and the Ladle build before continuing.

### Task 5: Build the localized settings screen

**Files:**

- Create: `src/renderer/` screen, localization dictionaries, typed service client usage, and UI tests.

- [ ] Render a minimal useful empty state, settings control, loading state, backend-unavailable state, and save-error state. Provide English and Russian text for every new UI string.
- [ ] Load the saved preference through the typed client and apply it to the UI. Switch language through the service command and reflect success only after persistence succeeds.
- [ ] Fall back to English for missing Russian translation keys. Leave user-authored names and paths untouched.
- [ ] Test keyboard operation, initial English state, language switch, saved preference reload, missing-key fallback, startup failure, and failed save without false success.
- [ ] Run all current tests, lint, type checks, application builds, and Ladle build before continuing.

### Task 6: Prepare development artifacts and targeted CI

**Files:**

- Create: platform development packaging configuration and `.github/workflows/` CI.
- Update: package scripts and artifact smoke tests.

- [ ] Configure launchable development artifacts for macOS and Windows, including the compiled backend, migrations, renderer assets, native SQLite dependency, and full bb notices.
- [ ] Add a macOS/Windows CI matrix for install, tests, lint, type checks, builds, Ladle build, artifact creation, and artifact-content checks. Do not push merely to activate CI.
- [ ] Add artifact checks for required files, version consistency, and startup resources; keep installer signing, stable release publication, and update delivery outside this task.
- [ ] Run all available local checks and create and launch the macOS development artifact. Record any Windows artifact or runtime condition that cannot be verified locally.

### Task 7: Verify Issue #8 acceptance

- [ ] Run the full test suite, linter, type checks, builds, Ladle build, and artifact checks. Confirm the tests cover the Issue #8 behaviors: default and persisted language, failed loads and saves, malformed commands, locale fallback, backend startup and shutdown, renderer isolation, and packaged resources.
- [ ] On this macOS host, run an actual Electron lifecycle check with temporary application data: launch, verify renderer isolation, switch to Russian, close, confirm backend exit, relaunch, and confirm the saved language.
- [ ] Exercise an actual backend startup failure and confirm the app presents an error instead of loading indefinitely.
- [ ] Inspect the complete diff from `55bbbc9eb4e3b6f92623c63341ac56fc428016bc`, verify `git diff --check`, and report evidence and any unmet Windows acceptance condition accurately.

### Task 8: Update user and developer documentation

**Files:**

- Update: `README.md`, `docs/development.md`, `docs/architecture.md`, `docs/reuse.md`, `docs/releases.md`, and `CHANGELOG.md` as applicable.

- [ ] Document the actual development launch, checks, data directories, backend transport and lifecycle, database driver and migrations, language behavior, and development artifact workflow.
- [ ] Move the verified language and desktop additions into an appropriate `Unreleased` changelog entry without presenting them as a published release.
- [ ] Add or update documentation/link and notice checks where they provide useful regression coverage; rerun the affected tests, type/build checks, and `git diff --check`.
- [ ] Commit verified task changes locally with explicit paths and report the resulting commit.

## Post-Completion

- The coordinator reviews the plan and implementation evidence against GitHub #8 and the fixed baseline.
- Windows artifact creation and actual Windows launch/restart behavior require Windows infrastructure. If unavailable during this run, report that acceptance condition as unverified; a macOS build or CI definition alone does not satisfy it.
- The coordinator owns GitHub/Beads status and integration. No push, merge, signing, installer release, or publication is included.
