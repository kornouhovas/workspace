# Issue 61: contextual categories verification

Baseline `73437086516018598438a38f23535226abdd7646`, delivered #60. Branch `codex/issue-61-contextual-categories`; current ownership/CI/integration gate: GitHub #61. No service, schema, native adapter, dependency or packaging configuration changed; renderer resources were rebuilt.

## Appearance and handoff

Main `080b416c` defines Table/Board, contextual row/card controls and the single preview/expanded project area. Inspected its `table-view.tsx` contextual menu/editor roles. bb `f135a001` defines the inherited Inter/neutral semantic foundation, with retained MIT notices. This slice reuses the local Radix ProjectOperationDialog; it copies no upstream code or assets.

The running entire screen was compared to those roles and the accepted #60 shell. Move retains the 440px operation dialog, current/destination relative paths, localized consequence text and explicit Cancel. Category options uses the same dialog and a separate physical-effect review; removal keeps current affected-project/destination/blocker information. The first screenshot exposed a redundant bordered body/heading and a long form preceding review; those were removed/hidden during review. Final light/dark, EN/RU, 1024x720/1440x960 images were inspected: authored names/paths stay literal, control labels wrap, buttons/paths remain inside the viewport, and the retained view/project shell stays visible.

Local final actual Electron route `node scripts/smoke-contextual-categories.mjs dev`: 22 journeys, 64 captures. Matrix covers Table/Board × list/preview/expanded Move, plus category rename/removal reviews. Manifest/report: `work/issue-61-categories-dev/report.json`. Representative images: `ru-dark-board-expanded-1024.png`, `en-light-table-list-1440.png`, `ru-dark-rename-1024.png`, `en-light-removal-1440.png`. UI theme changes use actual appearance controls. Initial direct settings-command captures were discarded because they did not update the mounted theme.

## Affected behavior

- Renderer/service/SQLite/folder/journal/crash/coordination/IPC/routing selection: 527 passed, 1 supported-platform skip (528 total); raw `work/issue-61-local/issue61-affected.log`.
- New details Move cases prove EN/RU preview/expanded Cancel, no mutation and visible owner focus; removal of the new wiring gives four failures (`issue61-details-red.log`). Named Move dialog red/green is retained separately.
- Category options red/green proves named review dialog, pre-Apply cancellation and explicit same-ID status after a lost response. Two-level Escape cancels review, then closes to the visible source trigger.
- Original `npm run smoke:category-options`: 16 checks, source siblings, identity/Text/file preservation, folder rename/associate/create and occupied/empty removal, EN/RU layouts, normal shutdown/backend exit and asserted fixture cleanup.
- Original `npm run smoke:runtime -- dev --category-move`: EN/RU ordinary move/rejection/restart and controlled intent/native-effect/destination-evidence/commit/keep-original interruption recovery passed. Original journal/native/receipt, no-overwrite, exact values, shutdown and owned cleanup assertions retained.
- Typecheck, lint, build/version and documentation links passed before the full local run.

## Review and retention

Independent Spec found two P2s (Escape dismissal and hidden focus-return target); Standards independently found Escape. New renderer regression reproduced the behavior; source tools now closes when launching the portaled dialog, return uses the visible contextual trigger, and Escape cancels review before dismissing. Follow-up Spec and Standards: zero unresolved findings.

| Inherited scenario | Decision and reason |
| --- | --- |
| Category move UI, status, unknown response, remount and recovery | Retain all scenarios/assertions; dialog only portals active form/review. Management history remains mounted to preserve return ownership. |
| Category options UI | Adapt browser globals for real Radix FocusScope and assert named dialog. Retain physical effect, Cancel/Apply, status ID and presentation assertions. |
| Category removal UI/service | Retain all scenarios: destination requirement, fresh preview, collision, partial recovery and no project deletion. |
| Folder-backed property label | Retain independent compact header editor and service tests: renaming its label never renames folders. No mutation boundary changed. |
| Project navigation, creation/rename and Board consumers | Retain focused checks for shared ContextTools/dialog/focus behavior. |
| Move/options/removal service, journal, crash and IPC | Retain public typed service with disposable real SQLite/folders; no backend rewrite. |
| Original native category drivers | Retain commands, deadlines, data/identity, restart, status/recovery, normal quit and cleanup assertions. |

## Acceptance provenance

One complete local `npm test`: **3378 passed, 27 skipped, 11 failed, 3416 total**; original log retained at `work/issue-61-local/issue61-full-local.log`. Four affected category-runtime DOM cases lacked `getComputedStyle`; only browser globals were repaired, and the original file renewed **26/26** with all receipt/identity assertions retained. The final bounded removal-form appearance, focus and screenshot-wait repairs are renewed separately through affected tests and actual native/hosted acceptance; this full receipt is not relabeled as a final-tree full pass.

Seven other nonpassing standalone fixture receipts remain explicit: category-header layout (1), property-editor driver (1), runtime-view readiness (2), view-scroll native (2), and rename-editor cleanup control (1). Six report the unchanged 10-second Electron normal-quit timeout; the cleanup control reports zero cleanup calls after its fixture boundary. Their fixture/lifecycle implementation and deadlines are unchanged by this issue. The product cause is not established; these are retained broader #67/#42 watchpoints, not passing evidence, retired assertions or an excuse to disable tests. Scoped actual application shutdown, backend exit and cleanup have independent passing native evidence. No whole-suite retry or full-green claim. The contextual-categories CI profile selects real affected regressions, dev and packaged new contextual journeys, original options and original category-move consumers on macOS latest, Windows latest and Windows 2022. It serializes artifact producers, retains failure propagation and uploads the actual evidence. Hosted acceptance and integration are pending; no passing CI or full-suite claim is made here.

No migration/native/IPC/installer/performance boundary changed. Broader #67/#42 and release-specific manual gates remain independent. Every failed or unreached required command remains open until its own passing evidence is recorded.

Local repair receipts: `issue61-removal-final.log` 10/10 options/removal checks; `issue61-runtime-renewal.log` 26/26 original category-runtime tests. Typecheck/lint/docs/diff checks renewed on final source. The native script waits for actual reviewed removal Apply and the exact affected path before screenshots. Native options dev/release reports now use separate mode directories so hosted evidence is not overwritten.

Final selected profile regressions after repairs: **877 passed / 1 platform skip / 878 total / 0 failed**, raw `work/issue-61-local/issue61-final-regressions.log`. Final contextual native route: **22 journeys / 64 captures**, including label-only rename and actual rename/removal review readiness, normal quit/backend exit/owned cleanup. Final original options native: **16 checks**, same lifecycle assertions. Original category-move native passed before the removal-only presentation repair; its move/service/native inputs are unchanged by that repair and the hosted route renews it anyway.
