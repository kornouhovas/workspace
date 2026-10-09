# Development workflow

## Scope and sources

Start from [AGENTS.md](../AGENTS.md), the actual checkout and relevant product/architecture decisions. This branch is a fresh implementation foundation. Historical code can answer factual questions; it does not silently override new decisions. Ask about unresolved consequential behavior and continue independent authorized work.

Use an isolated task branch based on `new-workspace` for implementation. Preserve unrelated files and existing task ownership. Commit completed, verified file changes in coherent English commits; stage explicit task paths. Push, merge and publication require corresponding authorization.

## GitHub and Beads

The private [kornouhovas/workspace](https://github.com/kornouhovas/workspace) repository is the primary issue tracker. Each implementation issue should describe the user outcome, scope, acceptance criteria, dependencies and relevant document links. Check for an existing issue before creating another. Verify repository visibility before the first write to a new repository.

Beads records linked execution steps, blockers and continuation notes for a GitHub issue. Use the GitHub URL/number in each new task's description. For substantial work, maintain an epic or grouping for `new-workspace`; avoid importing the previous backlog automatically. Requirement changes and final product completion belong in GitHub; closing a Beads step does not close its GitHub issue.

Beads is most useful for dependent steps and multi-session continuation. Keep small tasks small; do not reproduce every issue paragraph as a second specification. No automatic GitHub↔Beads or Beads↔Ralphex synchronization is configured.

The installed Beads worktree behavior shares the database through the repository's common Git directory. The retained `.beads` metadata is configuration, not a versioned copy of the live Dolt store. Preserve existing records; do not run initialization or copy a live database to simulate branch isolation. Fresh-machine task-store recovery is separate from checking out this branch.

## Ralphex

Repository defaults are in [.ralphex/config](../.ralphex/config). They select Codex, `docs/plans`, the `new-workspace` base and disabled automatic finalization. Models remain machine configuration; record the actual executor configuration in run evidence when reproducibility matters. Old progress logs and worktrees are not part of the new foundation.

For a selected issue:

1. Read its current acceptance criteria and linked Beads state. Create a bounded English task snapshot and plan; include fixtures, tests, completion criteria and exclusions.
2. Review the plan against settled product decisions. Resolve consequential open questions before the dependent implementation.
3. Run in an isolated task checkout. Set `--base-ref` explicitly; use `new-workspace` when working on a child branch, or a saved starting SHA when working directly on that branch.
4. Inspect the resulting diff and actual test evidence. Update linked execution state and GitHub only to the extent acceptance is satisfied.

Supported planning invocation in the inspected local Ralphex installation:

```sh
ralphex --codex --base-ref new-workspace --skip-finalize \
  --plan "Read the task snapshot at /absolute/path/task.md and create an English implementation plan in docs/plans."
```

This is a template with a placeholder path, not a command already run. Inspect installed help before execution; planning mode may offer continuation into execution. Continue only within the authorized task scope. For a reviewed plan, pass its actual path to Ralphex with the same deliberate review base. A plan is not authorization to push, merge or release.

## Verification

| Change | Required evidence |
| --- | --- |
| Documentation/configuration foundation | Local links/anchors, consistency with accepted choices, configuration inspection and `git diff --check` |
| Domain/service | Behavioral tests at public boundaries, validation/error cases and transaction behavior |
| Persistence/migration | Disposable real SQLite databases; restart, migration and relevant recovery scenarios |
| Filesystem | Isolated temporary roots; containment, collisions, permissions, interruption/recovery and platform behavior |
| UI | Relevant interaction tests, type/build checks and inspection of changed screens, including narrow layouts and both languages |
| Release | Full integrated checks, platform packages, version consistency, migration/recovery and release acceptance matrix |

The application scaffold now provides the scripts below. The legacy documentation tests asserted old paths, wording and any-store architecture, so they are not the validation contract for this rebuilt tree. Tests should verify useful behavior rather than freeze documentation phrasing.

Use temporary data for destructive and recovery checks. Never use live user project folders as test fixtures. Report completed checks, limitations and the actual commit at handoff; distinguish a written design from an implemented capability.

## Current desktop slice

The repository currently builds and runs an Electron application with settings, workspace management, direct/grouped project discovery, read-only categories and shared Text properties. Use Node.js 22.12 or newer (the CI matrix pins 22.21.1) and install the committed dependency resolution with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build the renderer, desktop process, backend, migrations and version file, then launch Electron. |
| `npm test` | Run behavior tests and build smoke checks. |
| `npm run lint` | Lint source, scripts and tests. |
| `npm run typecheck` | Type-check the TypeScript application and tests. |
| `npm run build` | Produce desktop, renderer and backend outputs, copy migrations, and verify the product version. |
| `npm run ladle` | Start the component preview server using its separate `.ladle/vite.config.mjs` configuration and Ladle's compatible React plugin. |
| `npm run build:ladle` | Build the component previews, including discovery and Text no-definitions/no-projects/loading/editing/saving/validation/failure/sibling-change/saved states in EN/RU. |
| `node scripts/smoke-discovery-layouts.mjs` | After the Ladle build, capture all discovery and Text states in Electron at 1440×960, 1024×720 and 420×800; assert long-content wrapping and no horizontal overflow. |
| `npm run smoke:runtime -- dev` | Launch Electron with temporary data through Playwright Core; create same-root and different-root configurations through the UI with a root-picker test seam; rename/reorder/select, restart, remove inactive/active/final configurations, restart empty and reuse retained sources; preview/exclude/cancel/Apply, stale-preview refresh requiring explicit re-Apply, unchanged project IDs, sibling notifications, unavailable-root retention and saved projection reuse; create/rename Text columns, save authored/empty/whitespace text, clear values, verify sibling visibility and unrelated-source isolation before quit; after restart check Text persistence, logical IDs and retained-source reuse; check file bytes/no markers, EN/RU layouts, isolation, backend shutdown and startup failure. |
| `npm run package:dev:mac` | Build and verify a macOS development directory artifact on macOS. |
| `npm run package:dev:win` | Build and verify a Windows development directory artifact on Windows. |
| `npm run check:artifact -- release` | Check packaged desktop/backend/renderer resources, SQL migrations, version, native SQLite binary and bb license notice. |
| `npm run smoke:runtime -- release` | Run the same Electron workspace lifecycle checks against the platform development artifact. |

The app uses `package.json` version `0.1.0` as its product version. The build writes it to `dist/version.json`; `npm run check:version` checks consistency. The app stores `workspace.sqlite` below Electron's machine-local `userData` directory. Development uses the `development` child directory for both SQLite and Chromium session data so it does not share production settings. Tests use disposable temporary directories. For isolated manual runs, `WORKSPACE_USER_DATA_DIR` sets the entire data root before Electron becomes ready; SQLite and Chromium session data both use that directory directly. The runtime smoke script sets `WORKSPACE_TEST_ROOT_PICKER_PATH` to a temporary fixture path so UI checks can bypass the native dialog; do not set it for normal app use.

Electron main owns the window and starts the TypeScript service in a `utilityProcess`. The service communicates through Electron message ports and does not open a listening network socket. It owns SQLite through Drizzle and `better-sqlite3`, and applies the versioned SQL migrations shipped under `dist/service/db/migrations` when it opens the database. The renderer calls only the narrow preload API; it has no direct Node.js, filesystem or database access. Closing the app stops the service process.

The UI exposes the saved interface language, with English as the first-launch default and Russian as the other supported value. Loads and saves go through the service; a failed save does not change the active language. Users can create named workspaces over accessible real directories, activate, rename, reorder and remove saved configurations, and reopen the active workspace and default Table view after restart.

Names retain authored text and duplicates are allowed. Ordering is persisted; stale permutations and invalid IDs fail without changing another configuration. Removing an inactive workspace preserves selection. Removing the active workspace selects the first remaining workspace in saved order and its existing Table view, including an unavailable source. Removing the final workspace clears selection and shows creation. Removal deletes only the configuration and its owned views, retaining source/project records, discovery configuration and external files. Recreating over that root reuses the source identity. Each workspace has a distinct view even when workspaces share one canonical source. The existing Table view shows committed project names and source-owned Text columns; no new view identity is created by discovery.

Committed workspace-list changes and observed source availability/locator changes travel through utilityProcess message ports, main, preload and the typed client. The localized retry-folder-access action refreshes the actual source; notifications include all referencing workspace IDs and unrelated roots remain isolated. Unchanged observations do not emit events. Applied discovery revisions use that same source-scoped route; sibling configurations reload the committed projection and invalidate open previews. Unchanged rescans emit no discovery event. Delayed lists/previews/Apply responses are guarded against newer revisions, selection/removal/cancel and backend restart. External folder watching is not implemented.

The automated runtime picker seam validates the UI and persistence route; it does not exercise the OS-native dialog by hand. The adapted UI controls retain their upstream MIT notice at `src/renderer/components/bb/LICENSE`; packaging places the notice in the artifact's `licenses` directory.

The desktop CI workflow runs install, tests, lint, type checks, build, Ladle build, Electron runtime smoke checks for the development app and packaged artifact, artifact creation and artifact-content checks on macOS and Windows. The smoke script requires a graphical desktop session. Local verification on macOS does not establish Windows launch or restart behavior; those require an observed Windows runner or a Windows host.

Optional runtime evidence: set `WORKSPACE_SMOKE_EVIDENCE_DIR` to an ignored output directory when running either smoke mode. The script writes identity/project/revision/event observations and management/removal-confirmation/discovery/Text editing and Table screenshots for EN/RU at 1440×960, 1024×720 and 420×800, and rejects horizontal overflow. It temporarily disconnects disposable roots and uses the production retry action to verify recovery; it never operates on live project folders.

## Direct discovery verification and limits

Preview and exclusion edits are read-only. Apply revalidates the reviewed token, source/workspace ownership, configuration revision, root identity and complete direct-entry interpretation, then commits exclusions and project associations in one SQLite transaction. A changed interpretation returns stale_preview, refreshes the draft and requires another explicit Apply. Links/junctions are excluded before target traversal; recognized project contents are never enumerated by the service. Dot-prefixed directories and Windows service directory names are excluded, as is the immediate child containing a persisted archive designation. Archive selection and mutations remain future work; folder names alone do not designate an archive.

Real temporary SQLite/filesystem tests cover containment, link swaps, archive casing/designation, root replacement, malformed/foreign commands, insufficient/reused evidence, transactional rollback, missing/excluded retention and same-source fanout. Upgrade and artifact checks cover migrations 0003_source_discovery.sql, 0004_direct_projects.sql, 0005_text_properties.sql and 0006_grouped_discovery.sql, including a populated upgrade from the actual prior schema. Runtime fixtures compare sentinel bytes and directory inventories, including nested/excluded/external content, so permanent marker writes are detected. UI tests cover EN/RU keyboard controls, pending-state prevention, focus recovery, stale responses and failure recovery. Ladle screenshot fixtures exercise presentation states through production components; they do not replace real service/runtime evidence.

Known automatic exclusions use directory-entry evidence without accessing excluded metadata. Inaccessible dot/service directories or an exact designated archive child do not block accessible projects; candidate access failures still prevent Apply and preserve saved records. Archive casing aliases require verified identity evidence. Ordinary files are ignored before project-name validation. Child names, manual exclusions and archive path components follow the current OS basename rules, allowing safe POSIX colon/backslash names while retaining Windows drive/separator protection on Windows. When an unsaved exclusion disappears or becomes automatic, the UI rebuilds the draft from the current service preview, preserves remaining choices, and requires explicit Apply. Regression tests exercise this recovery through real SQLite/filesystem fixtures and the production UI/client, plus cancellation of delayed recovery.

With WORKSPACE_SMOKE_EVIDENCE_DIR set, runtime observations are written before each quit and on failure. The known physical macOS27/Electron44.7.0 shutdown issue #44 remains an external release prerequisite even when an individual run quits normally. Preserve failed evidence and distinguish completed feature assertions from post-quit failure; do not retry blindly or relax shutdown assertions. Windows behavior requires observed Windows evidence; local macOS checks do not establish it.

No filesystem lock joins discovery observations to the database transaction. Changes observed during validation are rejected, but later filesystem changes or indistinguishable reused native evidence cannot be ruled out. Missing/unresolved associations are retained without automatic reattachment or cross-path matching. Reconciliation/reassociation and folder watching remain later capabilities.

## Shared Text verification and limits

Text definitions and values belong to the source, not a workspace view. Creation and rename preserve nonblank authored names and allow duplicate names; commands address immutable UUIDs. setTextValue preserves strings exactly. Null means absence and deletes the row; an empty string remains stored, with a distinct localized label. Metadata commands never alter project folders, discovery configuration, selection or view IDs. Retained logical project records keep values; a replacement association receives a new ID without inherited values.

The service validates exact payloads, immutable Text type, entity existence and same-source ownership, then commits data/snapshot/revision transactionally. No-op commands emit no event. Tests inject insert/update/delete failures into real temporary SQLite and check rollback, reopen and unchanged filesystem inventories/sentinel bytes. Production entry/controller/preload/client regressions exercise committed event-before-response ordering, sibling fanout, unrelated-source isolation and listener cleanup. React tests cover delayed responses, backend generations, EN/RU recoverable drafts, focus and keyboard controls. Availability/locator notifications preserve editors for the same logical workspace/source and reset discovery review. Backend transitions clear obsolete source observations; EN/RU regressions cover batched/separate restarts and newer current-generation events overtaking delayed loads.

The Ladle smoke records 34 discovery/Text stories at three sizes (102 screenshots) and exercises Text cancellation, pending prevention and explicit retry after validation/storage failures. The Table uses a bounded horizontal scroller for multiple columns; authored names/values wrap within cells and the document must not overflow. Fixture states use deterministic disposable typed responses, not SQLite, and complement the real runtime/service checks.

Runtime observations include separate booleans for pre-quit features, first shutdown, restart persistence, retained-source reuse and startup failure. A false stage flag means that stage has not completed; inspect the error and preceding stages to distinguish failed assertions from scenarios not reached. Use separate WORKSPACE_SMOKE_EVIDENCE_DIR directories for Ladle, development and packaged runs. Keep every failed attempt, the unchanged ten-second normal-quit assertion and forced-cleanup failure reporting. Native macOS27 shutdown #44 remains unresolved independently of feature results; do not repeatedly rerun the same failure or treat forced cleanup as normal success. The coordinator arranges Windows CI and owns platform acceptance and final delivery. Other property types, property deletion/hiding/reordering, view features, backup/recovery, synchronization and filesystem mutations remain outside this Text slice.

The GitHub #12 Task 4 local checkpoint on macOS 27.0 / arm64 passed 174 tests, lint, type checks, documentation links, production/Ladle builds and the unsigned development artifact check. Development and packaged Electron runs reached all pre-quit, restart/persistence, removal/source-reuse and startup-failure assertions and quit normally within the existing ten-second bound. The Ladle run captured 102 screenshots and checked 18 Text-state interactions. Logs and earlier failed regression attempts are retained below work/ralphex/issue-12/task-4-evidence; the execution plan records the specific runs. These individual passes do not resolve the independently open #44 blocker or establish Windows acceptance.

## Grouped discovery verification and current boundary

Grouped discovery reviews and atomically applies Root/Category/Project through the production typed route. Before first Apply, choose direct or grouped interpretation. Configured sources rescan their saved mode; the service rejects configured-source mode changes. Table displays required read-only category values and all active saved categories, including empty categories in zero-project sources. Metadata-only category-property label editing remains the next task.

The preview explains empty and mixed-depth roots: immediate root folders always mean categories, including direct-looking projects; their immediate child directories mean projects; ordinary files and deeper project contents are ignored. Empty categories stay visible. Both category and project exclusions use exact source-relative paths, retain OS-native basename rules and are checked before excluded targets are accessed. A designated category-depth archive excludes the category; a deeper archive excludes its containing immediate project. Archive is nullable and never inferred from a folder name.

The grouped service suite uses disposable real SQLite/filesystem fixtures, compares inventories and file bytes, spies on forbidden excluded/project-content access, and exercises category replacement/link swaps, repeated snapshot changes, unavailable/unreadable/retargeted roots, casing/designation, invalid modes/paths, token ownership and saved exclusions. Production IPC tests cover optional mode, both depths, grouped Apply, category metadata, sibling fanout, event-before-response ordering and no-op notifications. EN/RU interaction tests use the real service for keyboard exclusions, initial mode choice, hierarchy and focus, and cover delayed responses after cancellation, selection/removal, newer events and backend restarts. Existing direct, Text and lifecycle regressions remain in the full task checkpoint. Local Electron/Ladle graphical execution, fresh packaging and platform acceptance are scheduled separately in the issue plan; these automated checks do not claim those gates passed.

The grouped persistence regressions upgrade the actual populated 0000–0005 schema and preserve settings, source/project/Text IDs, authored Text values, active selection and independent views. Real SQLite triggers protect required same-source active categories and reject direct category values. Service tests cover replacement and missing-category retention, stale category/project records, rollback after category/project/property writes, category/link swaps during the transaction, no-op rescans, empty-category revisions, reopen and source reuse after final removal. Byte/inventory comparisons detect filesystem writes. EN/RU production-client interaction tests cover child-then-parent exclusion normalization, refresh/reinclusion, keyboard Apply, saved empty categories for siblings, read-only values and preserving Text drafts across grouped rescans. Delayed Apply regressions separately guard discovery and category-property revisions while accepting an initiating commit event before its response.

## Category property label verification

Grouped Table includes a focused category-property header editor in EN/RU. Enter or Save submits the authored nonblank label; Escape or Cancel restores focus and current committed data. A pending save disables duplicate submission. Failure and sibling-change feedback retain the draft, and a sibling change requires an explicit save. Category cells remain read-only, and direct Tables expose no category property.

The typed workspace.renameCategoryProperty command accepts exactly type, workspaceId, propertyId and name. Its metadata-only transaction increments categoryPropertyRevision and emits workspace.categoryPropertyChanged only on a committed change. It preserves Text/discovery revisions, valid discovery tokens, folder bytes and logical identities. The validated event shares the production entry/controller/main/preload/client route and listener cleanup.

Disposable SQLite/filesystem tests cover malformed/foreign/missing/direct inputs, long authored and duplicate labels, rollback, no-op/reentrant events, source isolation and close/reopen. Production IPC tests cover event-before-response ordering, malformed event rejection and unsubscribe/unload. EN/RU client-backed interaction tests cover keyboard/focus, validation, failure recovery, retained Text/label drafts, independent list/save revision guards and delayed responses after selection/removal/backend restart. These automated checks do not establish graphical platform acceptance; the grouped Ladle and actual development/package scenarios remain the final fixture/evidence task.
