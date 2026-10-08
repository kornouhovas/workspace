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

Application scripts and CI will be introduced with the application scaffold; do not cite commands or passing builds that do not yet exist. The legacy documentation tests asserted old paths, wording and any-store architecture, so they are not the validation contract for this rebuilt tree. Tests should verify useful behavior rather than freeze documentation phrasing.

Use temporary data for destructive and recovery checks. Never use live user project folders as test fixtures. Report completed checks, limitations and the actual commit at handoff; distinguish a written design from an implemented capability.
