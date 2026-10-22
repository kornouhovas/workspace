# Issue 69 acceptance map

Status: **in progress; not accepted or integrated**. [GitHub #69](https://github.com/kornouhovas/workspace/issues/69)
owns current gates. The [plan](../plans/issue-69-coherent-desktop.md) retains
scenario decisions, experiments, failures and historical receipts.

Application candidate renewal is pending after the category-header repair on top
of `10cc299e`. The previous application candidate `9face229` and all receipts
below are historical evidence, not final acceptance of the new application inputs.
The repair constrains native input minimum width and replaces the squeezed text
rename trigger with the shared edit icon and localized Hint. A real-Electron
regression checks legal120/180px columns at supported1024/1440px windows in EN/RU,
exact Save, zero cancelled writes, focus return and popup bounds. Old CSS fails
input containment; CSS alone still fails trigger/editor overlap. Both failures
pass with the complete repair. All affected hosted acceptance must be renewed.
No assertion, event clock, endpoint or numerical limit is relaxed.

## Appearance

Pinned main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` informs typography,
semantic palette, density and components. Existing Inter Latin/Cyrillic,
outline icons, Hint, Radix and semantic tokens remain. Accepted unique tabs
and one project area replace main's nested splits.

The [image manifest](issue-69-evidence/manifest.json) retains exact source/run
and hashes: [39702006958](https://github.com/kornouhovas/workspace/actions/runs/39702006958),
attempt 1, at `9face229`. The before image retains issue-start inputs. These historical
images were compared with the pinned references by the implementer and
independent Spec reviewer: no material mismatch. Original geometry, fonts, popup
bounds and EN/RU/theme/1024x720/1440x960 assertions remain. All three coherent
jobs complete native journeys, dev/package Views and asserted process cleanup.

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

Principal coherent journeys at `9face229` pass on macOS latest, Windows latest
and Windows 2022. Downloaded reports assert16 ordinary/24 long states,16 Board
captures,32 navigation states,16 real-files images, exact native selected target,
external document observation, unchanged bytes and normal exit/cleanup.
Development and packaged Views each complete three normal app/backend quits.

The alias index preserves every exact native alias, ambiguity, historical
records, owner/replacement/category predicates and transaction revalidation.
Snapshot batching preserves source-filtered ordered definitions, optional output
fields and workspace-local visibility, including historical pre-Select schemas.
Existing public service regressions cover values, assignment, grouping, metadata
removal, isolation, rollback, restart and migration. Current local service
checks: **107/107 pass**, lint/typecheck/docs pass; both reviews report zero findings.
At 1,000 projects, full snapshot JSON is identical. Request-local filtered assignment A/B/B/A
means are20.592/14.624/14.556/20.208ms. Stale-revision and same-revision
foreign-source tests both reject an unsafe-copy mutation. This measures service work only.

Scroll coalescing passes17 existing UI checks and a real-Electron regression
covering native input cancellation, coordinates, view changes, clamping and
draft retention with normal shutdown/cleanup. Both reviews have zero remaining
findings. Fixed4x traces show restoration work26.72 ->4.88ms and grouping406.7
->394.3ms; this diagnostic does not accept the strict300ms gate.

## Acceptance ledger

All runs are attempt1. Required reports/logs are downloaded and inspected unless
explicitly pending. Test-only reuse follows [CI policy](../ci.md#evidence-reuse-after-test-only-repairs):
earlier story/UI/driver/route repairs preserved application inputs, but the new
category-header application repair reopens full acceptance. Failed/unreached
rows are never counted as passes. Broad runtime
packages also include rebuilt Ladle extras under existing dist/** packaging;
their bytes are not claimed identical to earlier packages.

| Boundary | Actual SHA / run | Evidence and result |
| --- | --- | --- |
| Static/common and platform regression | `9face229`, [39702007107](https://github.com/kornouhovas/workspace/actions/runs/39702007107) | Common523/523 plus lint/type/docs pass. Mac2739pass/1observerfail/27skip. Windows main2773pass/13skip plus isolated51+13pass: aggregate2837pass/13skip each. Shell/workspaces/source settings and Windows Ladlebuild/108creationcaptures pass independently. Category readiness then fails; runtime tails unreached. Failed rows renewed below. |
| Observer cancellation fixture | `8c682531`, [39704164666](https://github.com/kornouhovas/workspace/actions/runs/39704164666) | **166/166 eachhost**. Actual worker partial-publication regression is red with direct write, passes with atomic complete receipt. Cancellation/ownership/terminal/cleanup assertions retained. Original full CI childcause was not recorded; unique causation is not claimed. |
| Coherent principal desktop | `9face229`, [39702006958](https://github.com/kornouhovas/workspace/actions/runs/39702006958) | **All3 hosts pass** appearance matrices, Board,32 navigation states, exact native target, external document/unchanged bytes and all cleanup gates. Dev/release Views each record three normal app/backend quits. Mac files host M2 Pro Virtual/kernel25.6.0; Windows latest/2022 EPYC9V74/kernel10.0.26100/10.0.20348. |
| Strict scale | `9face229`, [39701212914](https://github.com/kornouhovas/workspace/actions/runs/39701212914) | **Both pass**32 functional/timing observations and10 memory samples. Mac M1 Virtual/kernel23.6.0 max258.6ms, conservative peak933,085,184B. Windows EPYC9V74/kernel10.0.26100 max257.1ms, peak836,993,024B. Four normal app/backend exits and cleanup perhost. Windows CPU differs from preceding EPYC7763 failures; no universal reliability or unique historical cause is claimed. |
| Actual Mac DMG | `9face229`, [39702007001](https://github.com/kornouhovas/workspace/actions/runs/39702007001) | **Pass**, macOS14.8.9arm64: outside-build install, bundled backend, EN/RU, saved identity/views, isolation, reopen/replacement/data preservation, normal quit and cleanup. SHA256 `fc48a7c5fb542182bb271115dd946a66eec632206d4ddfa213405c5f1e1c8cd7`. |
| Actual Windows NSIS | `9face229`, [39702006868](https://github.com/kornouhovas/workspace/actions/runs/39702006868) | **Pass**, Server2025x64/kernel10.0.26100: offline Unicode/space path, bundled backend, EN/RU, saved IDs/views, independent APPDATA, reinstall/data preservation, uninstall and cleanup. SHA256 `7861ca8457430cd978892ba9b5d3fb17d628791b560991647e04c2734d394b71`. This is not Windows11 release acceptance. |
| Original category fixture | `ea3f2057`, [39705377859](https://github.com/kornouhovas/workspace/actions/runs/39705377859) | **All3 pass**209 UI checks,50states/150captures/50interactions, normal Electron quit. Actual project actions and Source-tools history replace stale cell selectors. Shared helper extraction renews these consumers again in the full-layout continuation. |
| Shared layout/rename consumers | Local fixed story/driver inputs | **407 UI checks**, original rename96states/288captures and unfiltered original Ladle302states/906captures pass with normal quit. Copied old-selector mutation fails both EN/RU controls; throwaways removed. Hidden content/accessible compact headers and below-minimum daily-control stress are adapted under the declared1024px minimum; operation paths/forms retain420px checks. Hosted unfiltered renewal remains required. |
| Continuation inventory | `a959e7a9`, [39706193093](https://github.com/kornouhovas/workspace/actions/runs/39706193093); repair `50d6ee5e`, [39706702525](https://github.com/kornouhovas/workspace/actions/runs/39706702525) | First all3 fail a literal-condition fixture before UI/layout/runtimes. Repaired guard compares evaluated ordered commands/environment with original verify for each profile/OS. Local133pass/3skip, both reviews0. Focused39706702525 passes all3 (Mac91pass/3skip; Windows94pass each). Runtime tails39706958232 then fail all3 at category header overflow before any runtime tail. |
| Independent review | Cumulative source, snapshot delta and subsequent fixture/route repairs separately reviewed | Standards0 and Spec0; current actual appearance independently reviewed. Final acceptance-ledger audit remains required. |

## Limits and remaining work

Local macOS27.0/build26A428 arm64 retains intermittent normal Electron quit
failures, including unchanged standalone HTML fixtures. Earlier local full:
3275total,3244pass/5fail/26skip; a separate visual run completed16ordinary/
24long states but failed quit without confirmed cleanup. Named-host CI passes
cover their actual hosts. Later local layout passes do not erase these failures.
Historical native owner-expiry and strict misses remain negative receipts in
the plan; profiling does not establish one universal cause.

#69 still owns renewed full/layout/strict/coherent/installer/appearance
acceptance and final ledger/integration. No required failed row is transferred
to #67. #55 owns persisted sessions; #56–#58 editor/draft refinements; #60 and
descendants filesystem/recovery extensions; #67 final UX01–UX20/platform/scale
acceptance; #42 release integration. #47/#7/#42 remain open. No release, main
merge or next issue is selected.
