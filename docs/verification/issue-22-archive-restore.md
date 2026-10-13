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

## Initial local candidate checkpoint

Both review axes accepted the source repairs; the fixture-only follow-up retained all assertions. On `7a1088504406e188591ceb1d3087c853d60b68d6`, the renewed full suite passes **2709 tests, zero failures, 21 expected platform skips** (2730 total). The unchanged build was reused after the final test-only repair; application source remains identical to `4e9de5a`. Typecheck, lint, local documentation links and diff checks pass.

Renewed development and packaged macOS runs each pass 12 checks on the recorded 7a10885 candidate, including EN/RU direct/grouped archive, archived Text editing, ordinary quit/restart and restore, narrow/wide screenshots, five ordinary application/backend shutdowns and asserted owned-fixture cleanup. Artifact resource validation passes. Local packaging is unsigned and is not a published release.

Exact-SHA three-platform Actions, artifact inspection and integration acceptance remain pending in the GitHub checkpoint. This report does not claim Windows acceptance before those checks complete. Further documentation-only commits identify inherited source/test evidence separately.


## First platform run and required focused continuation

Full run [38450516144](https://github.com/kornouhovas/workspace/actions/runs/38450516144) on `04fd8c5` passes common checks, all platform suites, and the complete macOS/Windows-2022 routes. All six new archive reports pass 72 checks in total. Windows latest fails its final existing graphical rename fixture cleanup in `smoke:runtime -- release`; subsequent category-move runtime acceptance is unreached. The overall run is a failure and has not been integrated. See the [retained diagnosis and focused route](issue-22-windows-release-runtime.md). Original ownership predicates are not recorded, so the historical cause remains unestablished; bounded diagnostics preserve the conservative gate without relaxing it.

## Reviewed diagnostic candidate

On `a2949e167834accb7b7515e8eba14d8ea479f554`, the renewed local full suite passes **2711 tests, zero failures, 21 expected platform skips** (2732 total). Both independent review axes accepted the bounded ownership diagnostics and focused CI route; affected lifecycle/startup/route checks pass 63/63. Application source remains unchanged.

Focused Windows-latest run [38456446117](https://github.com/kornouhovas/workspace/actions/runs/38456446117), attempt 1, passes the original packaged-runtime command after its build, regression, package and resource prerequisites. Retained artifacts confirm all baseline stages, 46 rename shutdowns, 34 category-move shutdowns and asserted cleanup. The rename cleanup inspection confirms 60 exited parents, 43 absent backend processes, no unverified launch, native helper stopped and zero native targets. The historical failure's cause remains unknown; this result establishes current-scenario acceptance, not a causal repair.

Full acceptance run [38457451345](https://github.com/kornouhovas/workspace/actions/runs/38457451345), attempt 1, uses the same reviewed SHA. Its final results/artifacts and integration remain tracked in the issue checkpoint.

The subsequent full run fails the existing macOS development-runtime grouped no-op message and Windows-latest recovery fanout fixture. These are new acceptance blockers; see the [retained failure map](issue-22-windows-release-runtime.md#subsequent-full-run-failure-map). The Windows fixture has deterministic exact-symptom red/green evidence; the macOS candidate adds bounded submission diagnostics and retains the unknown-cause limitation. Both reviewers accepted this follow-up without findings; affected full files pass 73/73 and type/lint/docs/diff checks pass. The local instrumented graphical rename route passes all original checks. Required focused platform acceptance, renewed full CI and integration remain pending.

## Renewed focused acceptance and local full suite

Candidate `ce37f64df5ad37fb9b53c88ea23504740415c91c` passes [focused run 38461193904](https://github.com/kornouhovas/workspace/actions/runs/38461193904), attempt 1. Windows-latest backend-lifecycle tests pass 59/59. Inspected macOS artifacts confirm all original baseline stages, 46 rename shutdowns, 34 category-move shutdowns and asserted fixture cleanup. Ten finite rename captures have matching editor/request, observed response and no observer failure: four completed, four rejected and two unchanged. Both no-op requests/receipts preserve exact original-name equality. Historical macOS cause remains unknown.

The renewed local full suite on this candidate passes **2715 tests, zero failures, 21 expected platform skips** (2736 total). It reuses the unchanged verified application build; changes after `a2949e1` are test/runtime-harness/CI and documentation only. Full three-platform [run 38462098920](https://github.com/kornouhovas/workspace/actions/runs/38462098920), attempt 1, tests the same reviewed candidate; final results/artifact inspection and integration are recorded in the issue checkpoint.

## Final platform acceptance

Full [run 38462098920](https://github.com/kornouhovas/workspace/actions/runs/38462098920), attempt 1, **passes** common/static checks and complete macOS-latest, Windows-latest and Windows-2022 jobs on exact reviewed SHA `ce37f64df5ad37fb9b53c88ea23504740415c91c`. All required stages were reached. Downloaded evidence was inspected for every OS: six archive reports pass **72 checks**, exact SHA, ordinary application/backend shutdown and asserted owned-fixture cleanup; 48 archive screenshots are retained. Representative EN/direct/wide and RU/grouped/narrow packaged screenshots were visually inspected on each OS.

Inherited creation/native Reveal, baseline runtime, graphical rename/category-move, category-options, restart/interruption, layout and package/resource routes all pass with retained positive shutdown/cleanup evidence. Both development and packaged rename reports on each OS contain all ten finite submission receipts with matching editor/request and expected completed/rejected/unchanged outcomes; no capture failures were retained. Exact-SHA observer documents and positive category-move service checkpoints also pass. Negative diagnostic controls and explicit non-native creation-matrix skips remain distinct from acceptance.

Earlier failed runs 38450516144 and 38457451345 remain retained. The Windows fanout fixture cause is reproduced and corrected; historical Windows ownership and macOS no-op causes remain unknown. Successful current scenarios establish acceptance without a causal claim. Existing path-confinement and power-loss limits above remain applicable.

The final report/plan commit changes Markdown only; application, tests, harnesses and CI match tested `ce37f64d`. Documentation links and diff checks cover that delivery update. The [GitHub delivery checkpoint](https://github.com/kornouhovas/workspace/issues/22) records the delivered SHA and authorized integration verification separately from the platform-tested SHA.
