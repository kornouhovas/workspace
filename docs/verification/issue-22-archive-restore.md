# Issue 22 archive and restore verification

Scope: [GitHub #22](https://github.com/kornouhovas/workspace/issues/22). Plan: [archive and restore](../plans/2026-10-13-issue-22-archive-restore.md). Baseline `5ad279e9`.

## Contract and owner decisions

The source owns a nullable archive designation. The UI suggests `Archive`; explicit reviewed confirmation persists the designation without moving or creating folders. Safe non-hidden source-relative folders can be selected, excluding existing project/category ownership. Archive creates missing destination ancestors exclusively when its reviewed operation runs. Changing designation requires no archived records or unfinished filesystem operations; there is no bulk relocation.

Archive mirrors the original relative placement and retains the existing project UUID, native identity and ordinary properties. Its active-model locator remains historical, mode-inactive evidence, while `project_archives` stores the physical locator, original mode/category name and parent evidence. This keeps source-mode changes and ordinary active-project reassociation from adopting archived records. Active and Archived views are separate; archived category placement is fixed and Text remains editable.

Restore uses the stored original path. An occupied destination requires removing the conflict or explicitly choosing another basename under the original parent. A missing parent requires explicit creation; a recreated grouped parent obtains a new category identity. A replaced existing parent is not adopted automatically. An incompatible discovery mode requires switching back. No path overwrite, copy/delete, silent renaming or automatic rollback occurs.

`project_archive_operations` stores immutable intent before parent creation or native no-replace movement, parent evidence as it is obtained, destination evidence and terminal receipt. Source mutation reservations survive restart. Reads, reconnect and receipt retries never replay filesystem effects; explicit fresh recovery can retry the original move, complete an evidenced destination or retain the verified original placement. A crash after mkdir but before recording parent evidence permits only explicit abandonment while the original project is verified; the unrecorded directory is left intact for a new review. No project-content enumeration/deletion, permanent identity marker, new native primitive or bb module was added.

The existing Node/path and native no-replace confinement limits still apply: observations do not lock ancestors or prove atomic confinement against every concurrent substitution. Process-interruption recovery is tested; power-loss durability across SQLite and filesystem is not established.

## Observed local evidence

- Node 22.21.1, real temporary SQLite and project folders: 35 service scenarios pass. Coverage includes direct/grouped identity and exact Text/file preservation, restart, collisions, explicit alternate name and missing-parent creation, mode round trip, occupied designation, invalid/foreign/extra requests, links and unavailable source, native-boundary collision, immutable receipt retry and no automatic replay.
- Abrupt separate-process fixtures cover intent, native effect, destination evidence and completed commit for both actions and discovery modes, plus unrecorded parent creation. Tests exposed and corrected an outer transaction that initially prevented intent durability.
- Populated migration-0012 upgrade/reopen preserves exact source/workspace/project/Text data and earlier tables; schema count becomes 14 with empty archive tables and valid foreign keys. Existing migration inventories and packaged/build fixture lists include migration 0013.
- The migration command passes 314 tests with one existing platform skip; the focused archive service/journal/UI set passes 49/49. Existing application UI regressions pass 95/95 after extending their mock transport with the new read-only archive queries.
- EN/RU DOM interaction tests cover explicit review/Apply, Escape/focus, source-unavailable/mode/collision/missing-parent decisions, interrupted recovery and unknown Apply/recovery outcomes with ID-bound status reads. All 14 archive UI tests pass; the readiness regression passed five consecutive focused runs.
- Development Electron UI completed 12 scenario checks: archive/Text/restart/restore in both modes and languages, plus 1440/1024 layouts. Native no-replace and the production backend/preload route run against disposable folders. Ordinary quit, backend exit and fixture cleanup pass. Layout styles are renewed before final verification.

## Completed local candidate and pending delivery

Both review axes accepted the source repairs; the fixture-only follow-up retained all assertions. On `7a1088504406e188591ceb1d3087c853d60b68d6`, the renewed full suite passes **2709 tests, zero failures, 21 expected platform skips** (2730 total). The unchanged build was reused after the final test-only repair; application source remains identical to `4e9de5a`. Typecheck, lint, local documentation links and diff checks pass.

Renewed development and packaged macOS runs each pass 12 checks on the recorded 7a10885 candidate, including EN/RU direct/grouped archive, archived Text editing, ordinary quit/restart and restore, narrow/wide screenshots, five ordinary application/backend shutdowns and asserted owned-fixture cleanup. Artifact resource validation passes. Local packaging is unsigned and is not a published release.

Exact-SHA three-platform Actions, artifact inspection and integration acceptance remain pending in the GitHub checkpoint. This report does not claim Windows acceptance before those checks complete. Further documentation-only commits identify inherited source/test evidence separately.
