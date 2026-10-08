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

The repository currently builds and runs an initial Electron settings application. Use Node.js 22.12 or newer (the CI matrix pins 22.21.1) and install the committed dependency resolution with `npm ci`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build the renderer, desktop process, backend, migrations and version file, then launch Electron. |
| `npm test` | Run behavior tests and build smoke checks. |
| `npm run lint` | Lint source, scripts and tests. |
| `npm run typecheck` | Type-check the TypeScript application and tests. |
| `npm run build` | Produce desktop, renderer and backend outputs, copy migrations, and verify the product version. |
| `npm run ladle` | Start the component preview server. |
| `npm run build:ladle` | Build the component previews. |
| `npm run smoke:runtime -- dev` | Launch Electron with temporary data through Playwright Core; check isolation, language persistence through restart, backend shutdown and startup failure. |
| `npm run package:dev:mac` | Build and verify a macOS development directory artifact on macOS. |
| `npm run package:dev:win` | Build and verify a Windows development directory artifact on Windows. |
| `npm run check:artifact -- release` | Check packaged resources, version, native SQLite binary and bb license notice. |
| `npm run smoke:runtime -- release` | Run the same Electron lifecycle checks against the platform development artifact. |

The app uses `package.json` version `0.1.0` as its product version. The build writes it to `dist/version.json`; `npm run check:version` checks consistency. The app stores `workspace.sqlite` below Electron's machine-local `userData` directory. Development uses the `development` child directory for both SQLite and Chromium session data so it does not share production settings. Tests use disposable temporary directories. For isolated manual runs, `WORKSPACE_USER_DATA_DIR` sets the entire data root before Electron becomes ready; SQLite and Chromium session data both use that directory directly.

Electron main owns the window and starts the TypeScript service in a `utilityProcess`. The service communicates through Electron message ports and does not open a listening network socket. It owns SQLite through Drizzle and `better-sqlite3`, and applies the versioned SQL migrations shipped under `dist/service/db/migrations` when it opens the database. The renderer calls only the narrow preload API; it has no direct Node.js, filesystem or database access. Closing the app stops the service process.

The current UI exposes the saved interface language, with English as the first-launch default and Russian as the other supported value. Loads and saves go through the service; a failed save does not change the active language. The broader project organization features remain future work. The adapted UI controls retain their upstream MIT notice at `src/renderer/components/bb/LICENSE`; packaging places the notice in the artifact's `licenses` directory.

The desktop CI workflow runs install, tests, lint, type checks, build, Ladle build, Electron runtime smoke checks for the development app and packaged artifact, artifact creation and artifact-content checks on macOS and Windows. The smoke script requires a graphical desktop session. Local verification on macOS does not establish Windows launch or restart behavior; those require an observed Windows runner or a Windows host.
