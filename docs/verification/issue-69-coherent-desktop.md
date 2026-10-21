# Issue 69 acceptance map

Status: **in progress, not accepted or integrated**. [GitHub #69](https://github.com/kornouhovas/workspace/issues/69)
owns current gates; the [plan](../plans/issue-69-coherent-desktop.md) preserves
scenario retention, experiments, exact failures and historical receipts.
Application candidate: `b577cfd2df4026c3f8584ce1880bf90dfd9d87d6`, based on
accepted `86ec752714c860662d4b1da0c25c2e5b71606bff`. Later diagnostic/CI changes
through `cbbbd263` do not change application inputs.

## Appearance and references

Pinned main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` informs typography,
semantic palette, density and component styling. Existing Inter Latin/Cyrillic,
outline icons, Hint, Radix and semantic tokens remain. Accepted unique tabs and
one project area replace main's nested splits.

Current captures come from the **passing macOS consumer** of coherent
[39681330400](https://github.com/kornouhovas/workspace/actions/runs/39681330400),
attempt 1, at the exact application SHA. The [manifest](issue-69-evidence/manifest.json)
records synthetic-fixture image hashes, renderer inputs and actual run/source.
The before image retains issue-start inputs. Original geometry, fonts, popup
bounds and EN/RU/theme/1024x720/1440x960 assertions remain. Actual Table,
long-content/empty/error, Board, real-tree preview/expanded and settings images
were inspected against the pinned references: no material mismatch found.
This appearance evidence does not accept the separate failed Windows Reveal.

| Surface | Concrete comparison / result | Evidence |
| --- | --- | --- |
| Sidebar and view strip | Main's fixed sidebar, workspace identity and compact horizontal tabs. bb Inter and neutral shared states. Real Back/Forward/restore, settings and contextual actions remain. | [Table](issue-69-evidence/table-1440.png) |
| Table working area | Repaired the second permanent command row introduced by the independent #54 scroll host. Table starts at 54px with a 12px strip gap in all 16 ordinary/long variants; previous 84px/42px failed the accepted <=24px gap. No threshold relaxed. | [Before](issue-69-evidence/before-table-1024.png), [after](issue-69-evidence/table-1440.png), [long RU dark](issue-69-evidence/long-table-1024.png) |
| Board | Main's horizontal group headers, cards and contextual column/card actions. Shared bb type/borders/spacing, real values and assignment controls. No decorative cards replace operations. | [RU dark narrow](issue-69-evidence/board-1024.png) |
| Preview | Right-hand project owns real properties and expanded folder contents; view remains available. Exact file names, tree indentation, selection and commands use existing typography. | [Populated tree](issue-69-evidence/preview-tree-1024.png) |
| Expanded project | One project/tab uses released work width; properties and real tree share a continuous surface. Return control remains keyboard discoverable. Main's nested splits are deliberately absent. | [Expanded real tree](issue-69-evidence/expanded-tree-1440.png) |
| Settings | bb section sidebar, selected row, constrained content column and bordered setting groups. General/Appearance/Workspaces/Sources/Backup/About remain real panels. | [General](issue-69-evidence/settings-1440.png) |
| Empty/error/unavailable | One empty/setup explanation per condition; no overlapping empty table guidance. File disappearance keeps selection and actionable error feedback. | [Disappeared file](issue-69-evidence/files-error.png), raw state matrices |


## Controls, behavior and retained safety

The following coherent journeys pass on macOS latest and Windows 2022 at the
application SHA above. Windows latest passes the regression union, visual and
Board journeys in that run, then fails native file Reveal. Its original file and
navigation renewals below pass; the remaining broad tail is still required.

| Entry / surface | Affected behavior evidence | Retained guarantee |
| --- | --- | --- |
| Source/Create/Active/Archived/Archive | Public UI placement regression; contextual actions, Escape and expanded-mode hide/return | Only entries move. Existing owners retain forms, drafts, pending operations, receipts and errors. |
| Sidebar / settings / workspace picker | Real workspace creation, management, contextual menus, sidebar collapse/restore/resize, EN/RU and settings return | Source identity, safe root validation, isolation and removal/destination handling remain service-owned. |
| Table / Board | Column width/order/hide/wrap, manual rows, scalar/MultiSelect grouping and assignment, unavailable/retry, active/archive projections | Exact project identities, memberships, values and committed revisions; UI never authorizes filesystem writes. |
| Views | Create/rename/duplicate/reorder/switch/delete, active fallback, final-view protection, cancellation and packaged reopen | View ownership and saved layout/filter/group state; Cancel performs no deletion. |
| Preview / expanded / tabs | 32 ordinary/long states; close/reopen, unique tabs, reorder, expand/return, released width and focus | Independent horizontal/vertical view scroll, filtered clamps, selection, resize endpoints and discoverable restore. |
| Rapid scroll / fields / editors | Native rapid jumps preserve exact ordered IDs and every clipped visible field; UI retains offscreen focus/draft/pending; scalar reopening uses latest localized value | Viewport cleanup skips redundant work only. Retained editors receive current revisions, options and callbacks. |
| Back / Forward | Actual workspace keyboard history, end states, branch truncation, fresh history and removed destinations | Navigation does not undo committed metadata/filesystem commands; editor guard extensions remain #56–#58. |
| Files / Open / Reveal | Real nested tree, arrow focus, Refresh/disappearance, exact native selected target, external document and unchanged bytes on Mac/Windows 2022 | Containment, fresh identity/authorization, alias ambiguity, no native permit replay; Windows latest original file renewal below passes; its earlier failure remains recorded. |
| Feedback / keyboard | Original narrow popup bounds, tooltip labels, topmost Escape, disabled/pending/error, cancellation and focus-return scenarios | No event clock, readiness predicate, deadline or numerical target is relaxed. |

Service optimization indexes every exact native alias, preserving ambiguous and
historical records plus original owner/replacement/category predicates and
transaction revalidation. All 148 focused reconciliation/discovery/observation
cases pass. Broader safety rows pass on Mac/Windows2022 in the full run below; the unreached
Windowslatest platform rows and all three runtime tails remain required.

## Exact candidate receipts

All runs below are attempt 1; downloaded reports/logs and required artifacts were
inspected. A diagnostic or earlier receipt is never relabeled as current success.

| Boundary | Actual candidate / run | Result / limit |
| --- | --- | --- |
| Original strict packaged scale | `b577cfd2`, [39680595721](https://github.com/kornouhovas/workspace/actions/runs/39680595721) | **Pass both hosts**: 32 timings, ten memory samples, four normal application/backend exits and asserted cleanup each. Mac M1 Virtual maximum interaction 286.8ms, conservative peak 924,696,576bytes. Windows Xeon8573C/kernel10.0.26100 maximum 241.2ms, peak 847,798,272bytes; Table assignment 227.5/214.4ms. |
| Coherent desktop / package | `b577cfd2`, [39681330400](https://github.com/kornouhovas/workspace/actions/runs/39681330400) | Mac and Windows 2022 pass principal journeys, real Open/Reveal and packaged Views. **Windows latest fails** file Reveal after 1374 regressions, visual 16/24 and Board 16/8/8; normal exit/cleanup pass. Later native/package steps there are unreached. |
| Actual arm64 DMG | `b577cfd2`, [39681337146](https://github.com/kornouhovas/workspace/actions/runs/39681337146), macOS14.8.9 | **Pass** installed bundled backend, identity, EN/RU, isolation, reopen/replacement preserving data, normal exits and cleanup. DMG SHA256 `0fc3cf1447947fa70c94c2e772f691cb2acd7931aa0d0aebb6b79657bcac3527`. |
| Actual x64 NSIS | `b577cfd2`, [39681752968](https://github.com/kornouhovas/workspace/actions/runs/39681752968), Server2025/kernel10.0.26100 | **Pass** Unicode/space path, bundled SQLite/backend, identity, EN/RU, isolation, reopen/reinstall, independent APPDATA, uninstall and cleanup. SHA256 `86ef9d9e75aae33517a4d9beff85b16f5d9d791eac6e33d2d93e91415d39207e`. Not Windows 11 release evidence. |
| Original Windows file consumer | diagnostic/CI-only `9b05276c`, [39684193756](https://github.com/kornouhovas/workspace/actions/runs/39684193756) | Trace-enabled diagnostic passes on EPYC9V45 with complete native events and original assertions/exit/cleanup. Readiness about 5s; earlier failure not reproduced or explained. It does not accept original native execution. |
| Original trace-disabled Windows consumer | `9b05276c`, [39684755404](https://github.com/kornouhovas/workspace/actions/runs/39684755404) | **Pass original execution**, EPYC7763/kernel10.0.26100: all tree/exact native selection/external document/bytes assertions, one select/done receipt, normal exit and cleanup; diagnostic collector complete. Earlier cause remains unknown. |
| Windows navigation | `9b05276c`, [39685187380](https://github.com/kornouhovas/workspace/actions/runs/39685187380) | **Pass** Windows latest and Windows 2022: all 32 states, rapid-scroll readiness, scroll/focus/resize/history, normal exit and cleanup. Package steps are intentionally skipped by this profile. |
| Broad integrated suite | `9b05276c`, [39685830877](https://github.com/kornouhovas/workspace/actions/runs/39685830877) | **Failed**: common passes; Mac platform2728 pass/2 stale inventory failures/26 skips, Windows2022 platform2760 pass/same2 failures/13 skips. Windowslatest early direct creation fails on hidden settings heading before native invocation; later collector/artifact errors follow unreached prerequisites. All runtime tails remain unreached. |
| Original early direct creation renewal | driver/test-only `df6708a6`, [39688465783](https://github.com/kornouhovas/workspace/actions/runs/39688465783) | **Failed later** at inherited420px stress capture: creation button right421>420 with expanded sidebar. Required desktop captures, identity/inventory and Reveal controls pass; original native/restart unreached. Normal failure quit/cleanup pass. |
| Narrow driver renewal | `8fb787e` | Real Collapse/Restore adapts retained420px stress; required1024/1440 remain expanded. Settings entry/return restore real navigation. Local original creation passes native/restart/exit/cleanup before final helper extension; new native settings assertions complete but local normal quit times out10s. Hosted original and three-host tail renewal remain required. |
| Current creation diagnostic | `cbbbd263`, [39690085187](https://github.com/kornouhovas/workspace/actions/runs/39690085187) | **Pass diagnostic** on EPYC7763/kernel10.0.26100: exact open/select/return1/1/1, independent COM/UIA agreement, creation/recovery/restart, two normal backend/application exits and cleanup.87 native/inventory/inspector controls and249 Reveal controls pass. Failure-only inspector is not reached; earlier owner-expiry cause remains unknown. Original trace-disabled renewal39690488883 pending. |
| Independent review | Cumulative source through `b577cfd2`; diagnostic/caller deltas separately reviewed | Standards 0 remaining findings; Spec 0 implementation findings. Initial unbounded diagnostic read finding repaired with separate finite budgets and preserved primary failure/cleanup. |

## Negative evidence and remaining ownership

Local macOS27.0/build26A428 arm64 retains intermittent normal Electron quit
failures, including unchanged standalone HTML fixtures. The later full local
run has 3,275 total: 3,244 pass, five failures and 26 platform skips. Current CSS
visual command reaches all 16/24 variants but fails normal shutdown; its fixture
cleanup remains unverified. Named-host successes above cover their actual hosts,
not every macOS version. Ultimate local native cause remains unproved. Historical
strict misses and rejected overscan, presentation memoization, projection-effect
and closed-panel experiments remain in the plan; none is converted into a pass.

#69 still owns unreached Windows coherent/package journeys, full integrated
acceptance and final ledger completion. The earlier Windows Reveal failure is
retained; the trace-disabled original consumer now passes with complete evidence.
No required failed row is transferred to #67. #55 owns persisted sessions;
#56–#58 editor/draft refinements; #60 and descendants filesystem/recovery
extensions; #67 final UX01–UX20/platform/performance acceptance; #42 release
integration. No release, merge into main, or next issue is selected.
