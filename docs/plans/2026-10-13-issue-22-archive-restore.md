# Issue 22: Archive and restore

Scope: [T15](https://github.com/kornouhovas/workspace/issues/22). Baseline `5ad279e9`, task branch `codex/issue-22-archive-restore`.

## Owner decisions

Confirmed in the implementation conversation on 2026-10-13:

- Suggest `Archive` within the source; first designation requires explicit confirmation. Another safe source-contained folder can be selected. Changing designation requires no archived projects and no unfinished operations; no bulk relocation.
- Archive mirrors the original relative placement. Restore uses the stored original location. Occupied destinations require removing the conflict or explicitly choosing another basename under the original parent; missing parents require explicit creation. An incompatible discovery mode requires switching back before restore.
- Publication of issue-22 checkpoints and changes in the currently public repository is authorized for this issue.

## Agreed verification seams

The issue specifies the typed Workspace service with disposable real SQLite/filesystem fixtures, focused UI/IPC and restart/platform checks. Use these seams for vertical red/green slices. Never use live project folders.

## Scenario coverage

- Source-owned archive designation: default, safe selection, existing ownership conflicts, exclusions, sibling visibility, no relocation, stale review, empty-only changes.
- Direct/grouped archive: preserved UUID, original path/category and exact Text; byte-preserving no-replace move; Active/Archived visibility and frozen category.
- Restore: original destination, collision/no overwrite, explicit alternate basename, explicit parent creation, incompatible mode, Text persistence, restart.
- Invalid/foreign/excess input, source unavailable/replaced, symlink/ancestor substitution, aliases and reservations.
- Durable intent, effect, evidence and completion interruption; explicit recovery, immutable retry receipts; no automatic replay on reconnect/startup/reads.
- EN/RU, keyboard and focus, loading/error/empty states; obsolete responses and uncertain outcomes.
- Migration inventories/upgrade fixtures, typecheck/lint/build, focused tests, review, final full suite, required CI and integration gates.

## Progress

Implementation and focused service/UI/restart checks are in place. Native dependencies #16 and #19 are closed. See the [verification report](../verification/issue-22-archive-restore.md) for observed evidence. Both review axes and final local verification are complete. Platform CI/artifact inspection and integration remain pending. GitHub checkpoints own current execution and acceptance status.
