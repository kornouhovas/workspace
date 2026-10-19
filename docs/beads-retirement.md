# Beads retirement

## Scope and authority

The owner requested GitHub Issues as the sole tracker, preserving unfinished work, unique notes, dependencies and ongoing execution. [Tracker policy](issue-tracker.md) owns the replacement workflow. This migration changes no product acceptance, existing run ownership, model settings, task-branch push authorization or release permissions.

## Reconciliation checkpoint

The initial 2026-10-12 export contains 82 records, including 37 unfinished records. Twenty-eight unfinished records already reference GitHub issues; nine legacy records require explicit mapping or import without assuming similarly named newer work satisfies their acceptance. Existing closed records remain archived.

The mapped unfinished records contain 75 recorded relations (50 blocking, 24 parent-child and one provenance link). Initial read-only reconciliation found one missing blocking edge: #44 blocks final release #42. The legacy Linux creation record also retains a discovered-from relationship to the archived completed creation task; this is provenance, not a new execution blocker.

At the initial cutover, publication was held by a public/private policy conflict. The owner resolved application-repository visibility on 2026-10-19 (D61): kornouhovas/workspace is public. The legacy import remains a separate unfinished task; desktop UX publication does not publish those records. Preserve unique descriptions, acceptance criteria, comments and continuation notes in the local migration archive until that task is resumed. Do not present pending imports as completed GitHub work or silently discard them.

## Archive and recovery

The local archive is under `/Users/aleksandersk/Documents/Codex/archives/workspace-beads-20261012T184254Z/`. It contains the all-record JSONL export, full `.beads` directory archive, a Dolt-native backup, pre-migration GitHub issue/comment and relation snapshots, and the legacy-to-GitHub mapping. Raw private recovery data stays outside source control.

Restore only into an isolated disposable repository using the retained configuration and full directory archive or the Dolt-native backup. JSONL preserves issue-level content and dependencies but is not a substitute for database history and other tables. Recovery tooling is archival; ordinary task execution requires only Git/GitHub and the task's normal tools.

## Ongoing runs

Issue #19 uses `.worktrees/issue-19-category-move/work/ralphex/issue-19/current.json`. At inspection it was waiting for the owner's requested direct Actions diagnosis; migration does not resume Ralphex. Re-read current state and locks before continuing because another coordinator may update them.

Retain the existing issue and review baselines, event history, evidence, worktree and authorization. Existing runner metadata named `beads` is an inert legacy correlation ID; no database lookup is needed. The older observer's heartbeat is opt-in: continue bounded runner/CI observation without `--heartbeat`. GitHub checkpoints replace tracker leases and local task status. Do not reinitialize the runner or alter a live executor's checkout to perform the migration.

## Hook and script audit

The shared Git configuration has no custom hooks path and its hooks directory contains only inactive sample hooks. Application scripts and npm commands in the main checkout contain no Beads invocation. Historical Ralphex worktrees retain optional heartbeat support and legacy metadata; the GitHub-only policy above disables that opt-in path while preserving existing runs. Global CLI installation and unrelated projects are outside the removal scope.

## Shared-worktree tracker override

Local Git configuration `workspace.trackerPolicy` points to `.git/workspace-tracker-policy.md`, a deployed cutover snapshot shared by all worktrees and retained across branch switches. The original cutover source was `docs/agents/issue-tracker.md`; this rebuilt branch carries its adapted policy in `docs/issue-tracker.md`. The installed `~/.codex/skills/do-task-ralphex/SKILL.md` and continuous flow now consult that override before tracker actions. This makes the GitHub-only policy available to already authorized runs in older worktrees without editing their HEAD, snapshots or live executor files. Other projects retain their existing tracker behavior unless they explicitly configure an override.

On 2026-10-19 the shared override was updated with D61: the application repository
is public, and older worktrees must not reintroduce the superseded private-only
publication gate. The legacy-import backlog and existing run ownership remain
unchanged. The versioned rule is [tracker policy](issue-tracker.md).

The original installed skill files and before/after hashes are in the local archive. A fresh clone needs no Beads installation. For an older worktree using the installed Ralphex skill, inspect the shared `workspace.trackerPolicy` before tracker access. Keep the deployed policy and its path when moving the project; refresh the pointer after a move. Its contents and deployment hashes are retained in the archive.

## Verified local cutover

The original `.beads` directory was relocated intact into the external archive as `retired-beads`; its four tracked bootstrap files were removed and local Beads Git settings retired. No database or legacy record was deleted. The all-record export immediately before relocation matched the initial archive exactly.

Historical checks on the pre-rebuild checkout, without `bd` on PATH (not acceptance evidence for issue 19): sidecar build, all 450 tests in the current checkout's 58 test files, typecheck and read-only observation of the existing Issue #19 waiting snapshot passed. The observer reported `legacy_limited` ownership, not an executor ownership transfer or task acceptance. Documentation tests, 78 local links/anchors and diff whitespace checks passed. The unrestricted `npm test` command discovered sibling `.worktrees` and was stopped; the explicit current-checkout suite passed. Other checkout tests are not reported as passing.

Pending external work from the initial checkpoint: publish nine legacy tasks and five retained-history comments, add the missing #44 → #42 blocking edge, and verify the resulting GitHub mapping and notes. No GitHub writes have been performed by this migration checkpoint.
