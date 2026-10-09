# Issue #9: Create and Reopen an Empty Workspace
## Overview
Add the smallest complete workspace flow: select a real
directory with the native picker, name a workspace, create
its default Table view, and reopen the same workspace and
active view after a full application restart. Keep project
discovery and broader workspace management outside T02.
## Context
  - Plan destination after acceptance:
`docs/plans/issue-9-create-workspace.md`.
  - Source of truth: `work/ralphex/issue-9/task.md`;
GitHub #9; Beads step `workspace-31i.2`.
  - Checkout: `codex/issue-9-create-workspace` at fixed
review base `90f440fef9614a8867e40e76fcc519feff56b5bb`.
  - Existing boundaries: SQLite/Drizzle in an Electron
`utilityProcess`; typed message-port IPC; sandboxed
renderer and narrow preload API.
  - Relevant files: `src/service/`, `src/service/db/`,
`src/contracts/`, `src/desktop/`, `src/renderer/`,
`tests/`, `scripts/smoke-runtime.mjs`,
`scripts/check-artifact.mjs`, `README.md`,
`docs/development.md`, `docs/architecture.md`, and
`CHANGELOG.md`.
  - No new dependency is planned. Use the existing UI
foundation; record provenance and retain notices if
additional bb code is copied.
## Development Approach
  - **Testing approach**: Implement each bounded
component, then add behavioral tests before proceeding.
  - Complete each task and pass its affected tests, full
`npm test`, lint, and type checks before starting the
next. Every code-changing task includes new or updated
tests.
  - Use temporary real directories and SQLite databases.
Keep filesystem validation and containment in the service;
do not enumerate, mutate, or claim to discover projects.
  - For every local Node/npm/npx command, explicitly
prepend
`/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to
`PATH`, for example `env
PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH
npm test`. Apply the same rule in internal reviews. Do not
use `npx node@22` or change global settings.
  - Commit completed, verified implementation changes
locally with explicit staged paths. The executor and
review agents must use the fixed review base above and
must not push, publish, release, tag, merge, initialize
the task store, or mutate GitHub/Beads. The coordinator
owns tracking and integration.
## Implementation Steps
### Task 1: Persist a canonical source and atomic
workspace creation
**Files:**
  - Create: `src/service/workspaces.ts`,
`src/service/db/migrations/0001_workspaces.sql`,
`tests/workspaces-service.test.mjs`.
  - Modify: `src/service/db/schema.ts`,
`src/service/settings.ts`, `src/service/entry.ts`,
`package.json`,
`src/service/db/migrations/meta/_journal.json`, and
existing settings service tests as needed for one shared
database connection.
  - [x] Define source, workspace, view, and
active-workspace records. Give each source, workspace, and
view a distinct opaque ID; make canonical root unique,
associate each workspace with one source, and associate
each default Table view with its owning workspace.
  - [x] Before writing records, validate a nonblank
workspace name while preserving its entered spelling.
Resolve and verify the selected root as an accessible real
directory through a replaceable filesystem boundary;
accept nonempty directories without inspecting their
contents. Normalize the stored root association and reject
invalid or inaccessible roots.
  - [x] Create or reuse the canonical source, workspace,
default Table view, and active selection in one SQLite
transaction. A second workspace over the same root reuses
the source but owns a separate view.
  - [x] Keep source path containment checks in the
service. Test sibling-prefix paths, `..`, and symlinks
that escape a source; expose no project operation in this
ticket.
  - [x] Test fresh migration, distinct IDs, same-root
source reuse, independent views, invalid names and roots,
deterministic permission denial, and rollback after an
injected database failure. Confirm failures leave no
partial source/workspace/view records and make no changes
inside the selected folder.
  - [x] Run affected tests, the full test suite, lint,
typecheck, and build with the required Node 22 `PATH`;
commit the verified task changes.
### Task 2: Reload and activate saved workspaces
**Files:**
  - Modify: `src/service/workspaces.ts`,
`src/service/entry.ts`,
`tests/workspaces-service.test.mjs`.
  - Create or modify: `src/contracts/workspaces.ts`.
  - [x] Define typed `workspace.create`, `workspace.load`,
and `workspace.activate` operations. The load result
includes saved workspace summaries, the active
workspace’s source ID and canonical root, its active
Table view ID, and source availability.
  - [x] Persist activation without changing view
ownership. On reopen, load the saved active workspace and
view; if its root has become unavailable, retain all
metadata and return an actionable source-unavailable
state.
  - [x] Reject malformed IDs and activation of a
nonexistent workspace. Keep service errors normalized
without exposing raw filesystem or database exception text
to the renderer.
  - [x] Test service close/reopen with a real SQLite file,
activation across two workspaces sharing one source,
independent view IDs, missing roots, malformed commands,
and read failures.
  - [x] Run affected tests, the full test suite, lint,
typecheck, and build with the required Node 22 `PATH`;
commit the verified task changes.
### Task 3: Add the native picker and typed desktop
boundary
**Files:**
  - Create: `src/desktop/root-picker.ts`,
`tests/root-picker.test.mjs`.
  - Modify: `src/contracts/desktop-api.ts`,
`src/contracts/service-protocol.ts`,
`src/desktop/main.ts`, `src/desktop/preload.ts`,
`src/desktop/backend-controller.ts`,
`src/service/entry.ts`,
`src/renderer/workspace-service-client.ts`,
`tests/backend-lifecycle.test.mjs`.
  - [x] Add a narrow Electron directory-picker method
using the native dialog. Return selected, cancelled, and
failed outcomes distinctly; cancellation sends no create
command.
  - [x] Carry typed workspace requests and results across
preload, IPC, controller, and backend ports. Validate
untrusted request shapes in the backend. Preserve settings
behavior and the existing readiness, timeout, shutdown,
and unavailable states.
  - [x] Test picker options and cancellation with a dialog
boundary seam, request routing and rejection, backend
failure, and renderer isolation. Do not treat an automated
picker seam as proof that a human exercised an OS-native
dialog.
  - [x] Run affected tests, the full test suite, lint,
typecheck, and build with the required Node 22 `PATH`;
commit the verified task changes.
### Task 4: Build the localized create and empty Table
screens
**Files:**
  - Modify: `src/renderer/App.tsx`,
`src/renderer/app.css`, `src/renderer/localization.ts`,
`src/renderer/workspace-service-client.ts`,
`tests/renderer-app.test.tsx`, and relevant component
stories.
  - [ ] Show a keyboard-operable name field, root picker,
selected-path display, and create action when no workspace
is active. Preserve user-entered names and displayed paths
verbatim.
  - [ ] Show loading, picker cancellation, validation,
permission, storage, and source-unavailable states with
useful EN/RU text and a next action. A failed create
leaves the form usable and does not display a workspace as
saved.
  - [ ] On success and after restart, show the workspace
name, root association, active default Table view, and
guidance explaining that project discovery is a later
feature. Provide a minimal saved-workspace selector so
separately created workspaces can be activated without
adding rename, reorder, removal, or view editing.
  - [ ] Test English and Russian text, keyboard flow,
cancellation, failures, two-workspace selection, persisted
session rendering, and narrow-layout behavior. Keep
existing language settings working.
  - [ ] Run affected tests, the full test suite, lint,
typecheck, application build, and Ladle build with the
required Node 22 `PATH`; commit the verified task changes.
### Task 5: Verify runtime, packaging, documentation, and
the final diff
**Files:**
  - Modify: `scripts/smoke-runtime.mjs`,
`scripts/check-artifact.mjs`,
`tests/artifact-smoke.test.mjs`, `README.md`,
`docs/development.md`, `docs/architecture.md`,
`CHANGELOG.md`; adjust `.github/workflows/desktop-ci.yml`
only if the existing matrix needs a command change.
  - [ ] Extend the automated Electron development and
packaged runtime checks with isolated data and a temporary
real root: create through the UI using a picker seam,
quit, confirm backend exit, relaunch, and verify the same
workspace, root, and active Table view. Check EN/RU and
narrow/wide layouts without claiming the native dialog
itself was manually exercised.
  - [ ] Check the new SQL migration and required runtime
resources in the development artifact. Preserve the
existing settings, startup-failure, sandbox, and
packaged-resource checks.
  - [ ] Run the full test suite, lint, typecheck, build,
Ladle build, documentation-link check, macOS development
packaging, artifact check, and development/packaged
runtime smoke checks with the required Node 22 `PATH`. Do
not claim Windows runtime acceptance without an observed
Windows run.
  - [ ] Update current-implementation documentation and
Unreleased user-facing notes accurately; leave future
features described as future work. Run `git diff --check`.
  - [ ] Run Ralphex internal reviews against
`90f440fef9614a8867e40e76fcc519feff56b5bb`, pass reviewers
the Node environment and executor restrictions, address
findings, rerun affected checks, and commit verified
changes locally.
## Post-Completion
  - The coordinator reviews the plan, implementation diff,
actual checks, limitations, and local commits against
GitHub #9.
  - An observed Windows development and packaged
create/quit/reopen run is required before claiming Windows
acceptance. The coordinator inspects actual EN/RU screens
and narrow/wide layouts.
  - The coordinator alone updates trackers and performs
any authorized integration or remote push.
