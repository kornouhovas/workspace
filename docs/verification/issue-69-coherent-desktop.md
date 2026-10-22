# Issue 69 acceptance map

Status: **acceptance evidence complete**. The tested application and driver
candidates are recorded below; actual delivered/integrated SHA is recorded in
[GitHub #69](https://github.com/kornouhovas/workspace/issues/69). The
[plan](../plans/issue-69-coherent-desktop.md) retains
scenario decisions, experiments, failures and historical receipts.

Application acceptance source: `770e07e5846293309b5357d6f7bc81134772a4c1`,
based on accepted `86ec7527`; application changes end at `458be520`. Runtime
driver renewal sources: `3d0a88c3`, `c5d9f5d8` and
`d6bcd7c0209673cdbfece719d9b9f6a9e22c6c45`, `341ef774` and `afc496a3`. The complete
subsequent delta contains tests, drivers, CI routes and documentation. Required
combined receipts retain their actual source below.
The plan retains earlier failed/diagnostic receipts; none is relabeled as passing.
Retained safety predicates, event clocks, endpoints and numerical limits remain
intact; inherited UI-driver adaptations follow current requirements recorded
in the plan.

## Appearance

Pinned main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and
journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` informs typography,
semantic palette, density and components. Existing Inter Latin/Cyrillic,
outline icons, Hint, Radix and semantic tokens remain. Accepted unique tabs
and one project area replace main's nested splits.

The [image manifest](issue-69-evidence/manifest.json) records exact source/run
and file hashes. Principal images come from passing macOS coherent
[39712599909](https://github.com/kornouhovas/workspace/actions/runs/39712599909),
attempt1, at `770e07e5`; the category-header capture comes from original unfiltered
[39711258611](https://github.com/kornouhovas/workspace/actions/runs/39711258611)
at that same SHA. Before retains issue-start inputs. Implementer and independent
Spec reviewer find no material mismatch in the changed Board, preview, expanded
project and category-header images. Table, long Table, settings and error images
are byte-identical to the previously reviewed images. Geometry, loaded fonts,
popup bounds and EN/RU/theme/1024x720/1440x960 assertions remain.

| Surface | Concrete comparison / result | Evidence |
| --- | --- | --- |
| Sidebar and view strip | Main's fixed sidebar, workspace identity and compact horizontal tabs. bb Inter and neutral shared states. Real Back/Forward/restore, settings and contextual actions remain. | [Table](issue-69-evidence/table-1440.png) |
| Table working area | Repaired the second permanent command row introduced by the independent #54 scroll host. Table starts at 54px with a 12px strip gap in all 16 ordinary/long variants; previous 84px/42px failed the accepted <=24px gap. No threshold relaxed. | [Before](issue-69-evidence/before-table-1024.png), [after](issue-69-evidence/table-1440.png), [long RU dark](issue-69-evidence/long-table-1024.png) |
| Category header | Scoped input minimum width fixes native intrinsic overflow in legal narrow columns; shared edit Icon/Hint replaces text squeezed over the editor. Exact label, Save/Cancel and return focus remain. | [RU editor](issue-69-evidence/category-header-1024.png), actual-Electron legal-column regression |
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

Current all-three-host coherent reports assert16 ordinary/24 long states,16 Board
captures,32 navigation states,16 real-files images, exact native target, external
document observation, unchanged bytes and normal exit/cleanup. Development and
packaged Views each complete three normal app/backend quits perhost.

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

All runs below are attempt1. Retained application receipts are at `770e07e5`;
driver renewal sources are explicitly marked perrow. Reports are inspected where
marked. Failed overall runs retain their original conclusions. Historical9face229 strict,
coherent and installer receipts were renewed after the application repair.

| Boundary | Run | Actual evidence / result |
| --- | --- | --- |
| Original unfiltered layout + native regression | [39711258611](https://github.com/kornouhovas/workspace/actions/runs/39711258611) | **All3 pass**, inspected:302states/906captures, normal Electron quit; new production-CSS/fonts native regression passes eachhost. EN/RU, legal120/180px columns at1024/1440px windows, exact Save, zero cancelled writes, focus return and Hint bounds. Old CSS and CSS-only overlap controls fail separately; complete repair passes. |
| Full broad desktop/package | [39712591684](https://github.com/kornouhovas/workspace/actions/runs/39712591684) | **All3 failed** at the ambiguous global source-root locator in the original development runtime. Common531/531 and lint/typecheck/docs pass; Mac2746pass/27skip; each Windows2843pass/13skip including isolated suites. Prefix creation/native routes pass; later runtime/package rows are unreached. Original logs and artifacts retained. Original-command repair and bounded tail renewals are recorded below; this overall run remains failed. |
| Original source-context runtime renewal | [39718705396](https://github.com/kornouhovas/workspace/actions/runs/39718705396), `3d0a88c3` | **All3 pass, inspected**:67 native/layout/route regressions and255 captures eachhost. Base stages alltrue,3 normal quits plus failed-startup exit check; rename46 and category move34 normal shutdowns eachhost, owned processes/fixture cleanup confirmed. |
| Remaining runtime/package renewal | [39719353774](https://github.com/kornouhovas/workspace/actions/runs/39719353774), `3d0a88c3` | **Both Windows hosts failed** original unfiltered layouts after608 captures: loading-history project action remains offscreen420 after programmatic scroll; normal quit passes. Windows runtime tails are unreached. Mac layouts, creation, base runtime and Views pass, then development MultiSelect fails on hidden option-summary entry;2 normal quits/cleanup pass. Native/route controls and affected407 UI checks pass all3. Layout and Select-context renewals pass below; no failed/unreached step is reused. |
| Coherent desktop | [39712599909](https://github.com/kornouhovas/workspace/actions/runs/39712599909) | **All3 pass, inspected**. Mac M1 Virtual/kernel25.6.0; Windowslatest/2022 EPYC7763/kernel10.0.26100/10.0.20348. All principal journeys, exact native/external document, dev/package Views normal exits and asserted cleanup. |
| Strict scale | [39712595815](https://github.com/kornouhovas/workspace/actions/runs/39712595815) | **Both pass, inspected**:32 functional/timing observations,10 memory samples,4 normal app/backend exits and cleanup eachhost. Mac M1 Virtual/kernel23.6.0 max222.2ms, conservative peak941,244,416B. Windows EPYC7763/kernel10.0.26100 max294.1ms, peak870,428,672B. Original300ms limit retained. |
| Actual Mac DMG | [39712603825](https://github.com/kornouhovas/workspace/actions/runs/39712603825) | **Pass, inspected**, macOS14.8.9arm64: outside-build install, bundled backend, EN/RU, saved IDs/views, isolation, reopen/replacement/data preservation, normal quit and cleanup. SHA256 `e2bff9866343fe81a5810754e132e84d3081c2f7fc5366374c40aa1407a1685e`. |
| Actual Windows NSIS | [39712607793](https://github.com/kornouhovas/workspace/actions/runs/39712607793) | **Pass, inspected**, Server2025x64/kernel10.0.26100: offline Unicode/space path, bundled backend, EN/RU, persisted IDs/views, independent APPDATA, reinstall/data preservation, uninstall and cleanup. SHA256 `932f2e31af64c32e50bc5f928037bf6ff2f598974d2d330373b17f90854474b2`. This is not Windows11 release acceptance. |
| Loading-history original layout renewal | [39721020706](https://github.com/kornouhovas/workspace/actions/runs/39721020706), `c5d9f5d8` | **All3 pass, inspected**:302states/906captures/274interactions and normal quit eachhost. Production-header and actual-hook native regressions3/3 each; original reachability predicate and negative controls retained. |
| Select option-context renewal | [39721960056](https://github.com/kornouhovas/workspace/actions/runs/39721960056), `d6bcd7c0` | **Pass, inspected**:82 regressions; original Macdevelopment MultiSelect and both changed drivers in dev/package, EN/RU2checks and3 normal app/backend exits/owned cleanup perconsumer. |
| Remaining complete runtime consumers | [39722181287](https://github.com/kornouhovas/workspace/actions/runs/39722181287), `d6bcd7c0` | **All3 failed**, inspected. Mac/Windows2022 dev Views6, MultiSelect2, Select2, Date2, Number2 pass normal exit/cleanup, then archive hidden-summary entry fails with cleanup. Windowslatest creation crash matrix completes8runs/16 quits but terminal ownership is unverified and fixture cleanup is skipped; subsequent commands unreached. Focused ownership/context repairs pass below; no failed cleanup or unreached row is reused. |
| Creation ownership renewal | [39724337019](https://github.com/kornouhovas/workspace/actions/runs/39724337019), `341ef774` | **All3 pass, inspected**:118 regressions eachhost;8 crash scenarios/16 normal quits; direct/grouped2 quits each, exact native invocation/acknowledgment/FileManager outcome.20 backend occurrences/20 confirmed exits,0 pending,30 stopped parents and owned cleanup perhost. |
| Archive/category context renewal | [39724340885](https://github.com/kornouhovas/workspace/actions/runs/39724340885), `341ef774` | **All3 pass, inspected**:141 regressions eachhost; original dev/release Archive12 checks/5 quits and CategoryOptions16 checks/2 quits eachmode; data/restart/ownership/cleanup pass. |
| Packaged tail renewal | [39724821487](https://github.com/kornouhovas/workspace/actions/runs/39724821487), `341ef774` | **Mac/Windows2022 pass, inspected**:15 reports/131 normal quits each; dev DataRecovery, eight release features, creation crash/direct/grouped and base/rename/category. Windowslatest fails first dev Views; failure exit/cleanup pass, later rows unreached. Changed Views consumers renewed below; unchanged passing rows retain this source. |
| Views context renewal | [39742850826](https://github.com/kornouhovas/workspace/actions/runs/39742850826), `afc496a3` | **All3 pass, inspected**:79 native/UI/service/route regressions eachhost,0 skips. Original dev/release6 checks and3 normal app/backend quits eachmode; all data/native/configuration/filter/group/restart assertions and owned cleanup retained. |
| Missing Windowslatest tail | [39743567968](https://github.com/kornouhovas/workspace/actions/runs/39743567968), `afc496a3` | **Pass, inspected**:103 regressions,0 fail/skip;20 reports/146 normal quits. Dev Views/MultiSelect/Select/Date/Number/DataRecovery and all packaged feature/creation/base/rename/category commands pass data/native/persistence/ownership and owned cleanup. Package resources verified. Failed-startup exit check remains separate from normal quits. |
| Independent review | Cumulative source and subsequent scoped deltas separately reviewed | Standards0 and Spec0; current changed appearance0 material findings. Complete input/consumer and combined acceptance-ledger audits report no gaps; final Windows reports inspected. |

The entire `770e07e5..afc496a3` diff leaves application, migrations, native
resources, dependencies, build/package inputs and relevant execution inputs
unchanged. [Same-checkout production builds](issue-69-evidence/build-input-equivalence.json)
before/after the complete overlay produce10 byte-identical renderer outputs. Independent Standards audit
finds0 reuse/mapping gaps. Existing coherent/installer exports are unchanged;
changed consumers are layout fixtures, creation, base runtime, rename/category
move, Select/MultiSelect, archive/category options and Views. Their specific
original-command receipts are recorded above. Successful common/platform/prefix
reports retain their original770e07e5 receipt; no failed/unreached row is reused.

Regression seams are owner-confirmed: real disposable SQLite/public Workspace
service, UI user actions and actual Electron/package. Existing107 service checks
and stale-revision/foreign-source negative controls protect data safety; affected
UI352/352 and actual production-CSS/native bounds protect the header repair.
The full/current platform rows renew integrated retained guarantees.

Earlier39710122953 at458be520 passes Mac/Windowslatest full layouts but fails
Windows2022 rename-list-loading-direct-russian420 control reachability after611
captures, with normal quit. Changed-diagnostic39711258611 completes the original
command on all3 without reproducing that failure. Original same-measurement
predicate is retained; finite failure geometry is verified with a controlled
negative native trigger. No unique historical cause or universal reliability
is claimed. The portaled history has real layout/wrapping and keyboard/action
coverage; the old `.project-rename button` geometry selector is not claimed to
enumerate its portaled buttons. See the plan for complete retained failure maps.

## Limits and remaining work

Local macOS27.0/build26A428 arm64 retains intermittent normal Electron quit
failures, including unchanged standalone HTML fixtures. Earlier local full:
3275total,3244pass/5fail/26skip; a separate visual run completed16ordinary/
24long states but failed quit without confirmed cleanup. Named-host CI passes
cover their actual hosts. Later local layout passes do not erase these failures.
Historical native owner-expiry and strict misses remain negative receipts in
the plan; profiling does not establish one universal cause.

#69 closes its required development/package tails through the inspected combined
receipts above. Earlier failures remain historical evidence; no required failed
row is transferred to #67. Delivery/integration verification is recorded in the
GitHub checkpoint. #55 owns persisted sessions; #56–#58 editor/draft refinements; #60 and
descendants filesystem/recovery extensions; #67 final UX01–UX20/platform/scale
acceptance; #42 release integration. #47/#7/#42 remain open. No release, main
merge or next issue is selected.

### Final runtime renewal

Views39742850826 atafc496a3 passes all3 dev/release and is inspected. Controlled
native focus-return regression is red with old menu entry and green with
Views-specific context preparation; it demonstrates a matching mechanism without
proving unique historical timing. Shared grouping/product inputs remain unchanged.
Windowslatest39743567968 at the same afc496a3 passes all missing tails:20 reports,
146 normal quits, complete data/native/persistence/ownership and cleanup evidence.
Successful unchanged rows retain their actual sources above. Documentation-only
handoff inherits these receipts after documentation checks and unchanged-build
proof; no receipt is relabeled as a test on a later delivered commit.
