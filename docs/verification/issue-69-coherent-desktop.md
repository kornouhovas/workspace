# Issue 69 acceptance map

Status: **in progress; not accepted or integrated**. [GitHub #69](https://github.com/kornouhovas/workspace/issues/69)
owns current gates. The [plan](../plans/issue-69-coherent-desktop.md) retains
scenario decisions, experiments, failures and historical receipts.

Last strict-tested candidate: `f5398b92` (based on accepted `86ec7527`).
The pending candidate adds measured scroll-restoration coalescing; native
process-name lookup remains `299a46be` and service snapshot batching `f5398b92`.
Changed renderer/backend/package inputs reopen affected acceptance below.
No assertion, event clock, readiness endpoint or numerical limit is relaxed.

## Appearance

Pinned main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` informs typography,
semantic palette, density and components. Existing Inter Latin/Cyrillic,
outline icons, Hint, Radix and semantic tokens remain. Accepted unique tabs
and one project area replace main's nested splits.

The [image manifest](issue-69-evidence/manifest.json) retains exact source/run
and hashes: the passing Mac consumer of [39681330400](https://github.com/kornouhovas/workspace/actions/runs/39681330400),
attempt 1, at `b577cfd2`. The before image retains issue-start inputs.
These images retain their actual appearance source. The pending scroll-only
renderer change requires current appearance confirmation; they are not runtime
tests executed at the new SHA. Actual images were compared with
the pinned references with no material mismatch found. Original geometry,
fonts, popup bounds and EN/RU/theme/1024x720/1440x960 assertions remain.

| Surface | Concrete comparison / result | Evidence |
| --- | --- | --- |
| Sidebar and view strip | Main's fixed sidebar, workspace identity and compact horizontal tabs. bb Inter and neutral shared states. Real Back/Forward/restore, settings and contextual actions remain. | [Table](issue-69-evidence/table-1440.png) |
| Table working area | Repaired the second permanent command row introduced by the independent #54 scroll host. Table starts at 54px with a 12px strip gap in all 16 ordinary/long variants; previous 84px/42px failed the accepted <=24px gap. No threshold relaxed. | [Before](issue-69-evidence/before-table-1024.png), [after](issue-69-evidence/table-1440.png), [long RU dark](issue-69-evidence/long-table-1024.png) |
| Board | Main's horizontal group headers, cards and contextual column/card actions. Shared bb type/borders/spacing, real values and assignment controls. No decorative cards replace operations. | [RU dark narrow](issue-69-evidence/board-1024.png) |
| Preview | Right-hand project owns real properties and expanded folder contents; view remains available. Exact file names, tree indentation, selection and commands use existing typography. | [Populated tree](issue-69-evidence/preview-tree-1024.png) |
| Expanded project | One project/tab uses released work width; properties and real tree share a continuous surface. Return control remains keyboard discoverable. Main's nested splits are deliberately absent. | [Expanded real tree](issue-69-evidence/expanded-tree-1440.png) |
| Settings | bb section sidebar, selected row, constrained content column and bordered setting groups. General/Appearance/Workspaces/Sources/Backup/About remain real panels. | [General](issue-69-evidence/settings-1440.png) |
| Empty/error/unavailable | One empty/setup explanation per condition; no overlapping empty table guidance. File disappearance keeps selection and actionable error feedback. | [Disappeared file](issue-69-evidence/files-error.png), raw state matrices |

## Behavior and retained guarantees

| Surface / entry | Required behavior | Safety and ownership |
| --- | --- | --- |
| Source, Create, Active/Archived, Archive | Contextual controls, Escape, expanded-mode hide/return | Existing owners retain drafts, pending operations, receipts and errors; UI never authorizes filesystem writes. |
| Workspace/sidebar/settings | Creation/management, picker, contextual actions, collapse/restore/resize, EN/RU and return | Source identity, safe roots, isolation, removal and unavailable destinations stay service-owned. |
| Table/Board/views | Columns, rows, grouping/assignment, lifecycle, active fallback, final-view protection, cancel and restart | Exact IDs, membership, values, committed revisions and saved configuration; Cancel performs no deletion. |
| Preview/expanded/tabs | 32 ordinary/long states; close/reopen, unique tabs/reorder, expand/return and released width | Independent view/project scrolling, selected IDs, resize clamps, focus and discoverable restore. |
| Fields/editors/rapid scroll | Ordered IDs and real clipped fields during rapid jumps; latest localized scalar reopening | Offscreen focus/draft/pending retention; viewport cleanup skips redundant work without changing overscan. |
| Back/Forward | Workspace/settings history, end states, branch truncation, fresh history and removed destinations | Navigation does not undo committed metadata or filesystem operations. |
| Files/Open/Reveal | Real nested tree, arrows, Refresh/disappearance, exact native target, external document, unchanged bytes | Containment, fresh identity/authorization, alias ambiguity, no permit replay. |
| Keyboard/feedback | Tooltips/labels, hit targets, bounds, topmost Escape, cancel, return, pending/error/disabled in both languages/themes | Existing ownership and original deadlines; no acceptance of placeholders as actual fields. |

Principal coherent journeys at `b577cfd2` pass on Mac and Windows 2022.
Windows latest passes the regression union, visual and Board journeys, then
fails file Reveal; later journeys are unreached. Later original file and
navigation receipts retain their actual SHA in the plan. Changed native and
backend inputs require affected current runtime acceptance before delivery.

The alias index preserves every exact native alias, ambiguity, historical
records, owner/replacement/category predicates and transaction revalidation.
Snapshot batching preserves source-filtered ordered definitions, optional output
fields and workspace-local visibility, including historical pre-Select schemas.
Existing public service regressions cover values, assignment, grouping, metadata
removal, isolation, rollback, restart and migration. Current local snapshot
checks: **105/105 pass**, lint/typecheck/docs pass; both reviews report zero findings.
At 1,000 projects, full snapshot JSON is identical. Filtered assignment A/B/B/A
means are 23.559/20.429/20.674/23.188ms. This measures service work only.

Scroll coalescing passes17 existing UI checks and a real-Electron regression
covering native input cancellation, coordinates, view changes, clamping and
draft retention with normal shutdown/cleanup. Both reviews have zero remaining
findings. Fixed4x traces show restoration work26.72 ->4.88ms and grouping406.7
->394.3ms; this diagnostic does not accept the strict300ms gate.

## Acceptance ledger

Every run below is attempt 1. Downloaded reports/logs and required artifacts are
inspected unless explicitly pending. Historical successes are not relabeled as
current acceptance; the plan retains superseded reports and precise failure maps.

| Boundary | Actual SHA / run | Result and remaining gate |
| --- | --- | --- |
| Appearance and coherent reference | `b577cfd2`, [39681330400](https://github.com/kornouhovas/workspace/actions/runs/39681330400) | Inherited images above. Mac/Windows 2022 principal/native/package journeys pass; Windows latest native Reveal fails. Current affected coherent renewal remains required. |
| Broad suite before snapshot batching | `9a359816`, [39694044347](https://github.com/kornouhovas/workspace/actions/runs/39694044347) | Common passes. Mac 2722 pass/14 fail/27 skip; both Windows hosts 2755 pass/14 fail/13 skip. All failures are workflow mutation fixtures, repaired below. Other platform/source/native prerequisites pass independently. All runtime tails were unreached. Current backend requires renewed broad acceptance. |
| Observer workflow repair | `b8579bba`, [39696523771](https://github.com/kornouhovas/workspace/actions/runs/39696523771) | **97/97 pass on each of all three hosts**; original collector complete/ordinary/exit0. All24 LF/CRLF guards retained, scoped to the actual verify job. |
| Native owner repair | `299a46be`, [39693324029](https://github.com/kornouhovas/workspace/actions/runs/39693324029); controls `9a359816`, [39693870739](https://github.com/kornouhovas/workspace/actions/runs/39693870739) | Original trace-disabled creation passes exact native open/select/return, independent COM/UIA, recovery/restart, normal exits and cleanup. Overall first job fails only a stale terminal fixture; corrected original file plus fresh process controls pass12/12. Native guards/resources unchanged by snapshot batching; affected full runtimes still require renewal. |
| Previous strict failures | `9a359816`, [39694044226](https://github.com/kornouhovas/workspace/actions/runs/39694044226); `ba683bab`, [39695914995](https://github.com/kornouhovas/workspace/actions/runs/39695914995) | First: Mac Text310.8ms and Windows assignment314.8ms exceed300. Bounded renewal: Mac passes (max255.1ms), Windows assignment312.8ms fails. All32 cases, memory, four normal exits and cleanup otherwise pass. |
| Assignment diagnosis | `b8579bba`, [39696644374](https://github.com/kornouhovas/workspace/actions/runs/39696644374) | EPYC7763 reproduces313.7ms, immediate delivery, backend75.66ms/projection38.77ms. Diagnostic only; all32 observations/four normal exits/cleanup complete. Leads to the measured changed snapshot candidate; not another unchanged retry. |
| Current original strict | `f5398b92`, [39697859659](https://github.com/kornouhovas/workspace/actions/runs/39697859659) | **Windows passes** all32 targets (Xeon8370C, max296.5ms). **Mac fails grouped Table grouping309.8ms>300**; all32 cases/memory/four normal exits/cleanup otherwise complete. Mac-only diagnostic39698462359 pending; no unchanged strict retry. |
| Previous actual installers | `9a359816`, Mac [39694044252](https://github.com/kornouhovas/workspace/actions/runs/39694044252), Windows [39694305845](https://github.com/kornouhovas/workspace/actions/runs/39694305845) | Both pass installed bundled backend, identity, EN/RU, isolation, replacement/reinstall, normal exits and cleanup. Exact hashes remain in the plan. Snapshot batching changes backend/package inputs: renew both installers. Server2025 x64 is not Windows11 release acceptance. |
| Independent review | Cumulative renderer/native work and current snapshot delta separately reviewed | Standards0 and Spec0 implementation findings; appearance reviewed against actual images. Final acceptance-ledger review remains required. |

## Limits and remaining work

Local macOS27.0/build26A428 arm64 retains intermittent normal Electron quit
failures, including unchanged standalone HTML fixtures. The earlier local full
run has 3,275 total: 3,244 pass, five failures and 26 platform skips. A later
local visual run completes16 ordinary/24 long variants but fails normal shutdown and does not
confirm cleanup. Named-host CI successes cover their actual hosts, not all Mac
versions. Historical native owner-expiry and strict misses remain failures;
profiling does not establish one universal cause.

#69 still owns current strict/full/coherent/package/installer acceptance and the
final ledger/integration. No required failed row is transferred to #67.
#55 owns persisted sessions; #56–#58 editor/draft refinements; #60 and descendants
filesystem/recovery extensions; #67 final UX01–UX20/platform/performance
acceptance; #42 release integration. No release, merge into main or next issue
is selected.
