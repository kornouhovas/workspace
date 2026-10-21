# Issue 69 acceptance map

Status: **in progress, not accepted**. [GitHub #69](https://github.com/kornouhovas/workspace/issues/69)
owns current CI/integration gates; the [plan](../plans/issue-69-coherent-desktop.md)
records scenarios and test retention. Application candidate `af23242d5c6fec5d749fe89ea530a9317678d7f4`
starts from accepted `86ec752714c860662d4b1da0c25c2e5b71606bff`.

## Appearance comparison

Reference roles: main `080b416c57b2869024ac62363e96b68b40f499c0` for
composition/journeys; bb `f135a001e72942cee9118d2693208ec0725e2f18` for
typography, semantic palette, density and component styling. Reuse the existing
Inter Latin/Cyrillic assets, outline icons, Hint, Radix and semantic tokens.
Keep the accepted unique tabs and single project area instead of main's splits.

Compared current whole-window Table with the [pinned main Table](../research/desktop-experience-evidence/main-table-1440.png),
the [accepted #68 correction](issue-68-composition-correction.md), and the
#54/#64 project-area reference mapping. The [manifest](issue-69-evidence/manifest.json)
records synthetic-fixture images, exact renderer inputs and hashes; these are
appearance artifacts, not complete runtime passes. Captures are renewed on the
application candidate: visual foundation (16 populated/long, 24 empty), Board
(16 populated/long, eight empty, eight unavailable), navigation (32 transitions),
and files (16 preview/expanded plus disappearance). First three commands pass
normal quit/cleanup; the files command fails normal shutdown after its native
assertions. Its raw manually supplied SHA is malformed; the separate source
provenance records the error and exact built renderer inputs. The manifest uses
those verified inputs and preserves the failed receipt.

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

Local host: Node 22.21.1, macOS arm64; native sample identifies macOS 27.0
build 26A428. These observations are not substituted for supported hosted OS
or Windows 11 release evidence.

| Entry/control | Observed local behavior | Retained safety / limitation |
| --- | --- | --- |
| Source/Create/Active/Archived/Archive entries | Public UI regression fails before placement repair, passes afterward; Source tools Escape returns to the same trigger, entries hide in expanded mode and return without replacement | Only entry presentation moves. Forms, pending operations, receipts, errors and controller lifetime stay in their existing owners. |
| Sidebar and project resize/collapse/restore | Renewed `af23242d` navigation command passes pointer resize, keyboard endpoints, collapse/restore, released width and discoverable restore | No persisted-session claim; #55 owns restart restoration extensions |
| Preview/expand/return, close/reopen and tabs | Renewed `af23242d` navigation command passes 32 ordinary/long captures, focus, unique tabs, inactive-close/reopen and reorder, independent vertical/horizontal view scroll | View/filter/scroll constraints retained; original assertions unchanged |
| Back/Forward | Native workspace keyboard traversal passes; 241 selected UI/service scenarios include branch truncation, end states, settings return and removed-destination handling | Navigation does not undo committed metadata/filesystem commands; #56 retains the complete draft guard matrix |
| Board controls | Renewed `af23242d` Board command passes 16 populated/long, eight empty and eight unavailable captures; width/collapse/hide/restore, saved order/wrap, scalar grouping and MultiSelect membership | Exact memberships and values preserved; normal exit and asserted fixture cleanup passed |
| Real file tree/Open/Reveal | Renewed `af23242d` file command reaches 16 preview/expanded captures, arrow focus, Refresh/disappearance, exact Finder selection, exact external TextEdit document and unchanged bytes | Overall command **failed** normal shutdown; cleanup was skipped because exit was unverified. This is not a passing native receipt. |
| Table/font/settings/state matrix | Renewed `af23242d` visual command reaches 16 populated/long plus 24 empty variants with original bounds/font/context assertions | Renewed `af23242d` command passes normal shutdown and asserted cleanup; appearance alone still does not accept remaining milestone gates |
| Native shutdown | Original three-file reproduction 16 pass/13 fail; diagnostic renewal four pass/11 fail exposes original timeout rather than secondary discarded-handle TypeError | Normal 10-second deadline and forced-cleanup failure remain. Native root cause is still under investigation. |
| Independent review | Standards 0 findings; Spec 0 slice findings at `6dc5021` | Review explicitly does not accept remaining milestone gates |

Local artifacts are under `work/issue-69/` in the task checkout. Their names and
existence do not establish passing evidence. The receipts below renew scoped
hosted boundaries; broad desktop/package and strict scale acceptance remain gates.

## Hosted and completed-candidate receipts

Application/renderer inputs remain unchanged from `6dc5021` through `ed2c6feb`;
intermediate changes repair fixtures/drivers, diagnostic tracing and reports.
Candidate `af23242d` changes viewport cleanup scheduling and is under renewed
verification. Historical receipts keep their actual SHA; they do not alone
accept that production change.

| Boundary | Actual receipt | Result / limit |
| --- | --- | --- |
| Completed-candidate full local suite | `8cb8097`, Node 22.21.1/macOS 27 arm64, `npm run test:all` | 3,270 total, 3,244 pass, zero fail, 26 platform skips; later reviewed test-only repairs renew affected consumers |
| Original four-file native lifecycle, including fractional clipping and timing/delivery controls | `ed2c6feb`, [39663902847](https://github.com/kornouhovas/workspace/actions/runs/39663902847), attempt 1; downloaded logs/provenance on macOS latest, Windows latest, Windows 2022 | 66/66 on each host, normal quit preserved; local macOS 27 negatives remain unexplained |
| Actual arm64 DMG install/reopen/replacement | `ebd090ab`, [39659054203](https://github.com/kornouhovas/workspace/actions/runs/39659054203), attempt 1, macOS 14.8.9 | Installed bundled backend, exact workspace/source/view/language, EN/RU keyboard/isolation, replacement preserving data, normal exits and cleanup pass |
| Actual x64 NSIS install/reopen/reinstall/uninstall | `ebd090ab`, [39659356326](https://github.com/kornouhovas/workspace/actions/runs/39659356326), attempt 1, Windows Server 2025/kernel 10.0.26100 | Unicode/space path, independent default APPDATA, data/identity preservation, normal exits, uninstall and cleanup pass; not Windows 11 release evidence |
| Original strict packaged scale | `ebd090ab`, [39659477806](https://github.com/kornouhovas/workspace/actions/runs/39659477806), attempt 1, macOS 14 + Windows latest | **Failed numerical limits**. Both hosts complete 32 functional scenarios, ten memory samples, four normal quits/backend exits and cleanup. Mac first Table filter 603.2ms; Windows direct/grouped Table edit 344.5/382.8ms and grouped Table assignment 315.4ms exceed 300ms. All other original timings and memory limits pass. |

Subsequent original strict [39662918865](https://github.com/kornouhovas/workspace/actions/runs/39662918865),
attempt 1 at `fec9fc26`, **passes both hosts** after presented-control preparation:
32 timings, ten memory samples, four normal quits/backend exits and cleanup each.
Mac first filtering is 192.9ms, with control preparation separately 711.3ms;
conservative memory peaks are 968,359,936 bytes (Mac M1 Virtual) and 833,220,608
bytes (Windows AMD EPYC 9V45). Earlier Intel-host and local macOS 27 negatives
retain their own evidence. The later scoped-owner preparation correction passes the inspected native
receipt above. Original strict [39663902198](https://github.com/kornouhovas/workspace/actions/runs/39663902198),
attempt 1 at `ed2c6feb`, passes Mac (first filter 167.2ms, maximum interaction
202.8ms, peak 966,017,024 bytes) but fails Windows AMD EPYC 7763 direct
Table/Board filtered assignment at 328.7/330.7ms. Windows still passes all
functional, memory, four normal exits and cleanup assertions. This required
performance failure remains open; broad desktop/package CI remains pending.

`af23242d` skips cleanup frames for empty offscreen identity shells, preserving
loaded/focused/draft/pending fields and newly pinned first rows. The public
preservation test passes before/after; 64 related UI tests, typecheck/lint and
both review axes pass. The Windows package profile `39667106631` (attempt 1) completes 32 scenarios,
four normal exits and cleanup. Drop-to-ready callback counts fall from 416/417
to 45/29; the changed CPU prevents attributing timing differences solely to the
guard. Original strict `39667534800` is renewing. Full local suite reaches
3,275 total: 3,244 pass, five normal-shutdown failures in unchanged standalone
HTML fixtures, 26 platform skips. No green local full-suite result is claimed.
Native named-host receipts remain bounded to unchanged fixtures; current broad
desktop/package and coherent-journey acceptance remain required.

The macOS diagnostic [39660140707](https://github.com/kornouhovas/workspace/actions/runs/39660140707)
reproduces first filtering at 529.7ms: mutation/projection IPC approximately
4–25ms, a roughly 53ms renderer task including 14ms layout, and long idle/frame
gaps. The first requested frame at +23ms is delivered at about +297ms. This
locates observed delay, not its ultimate GPU/scheduling cause. The instrumented
copy completes four backend batches/252 records; its diagnostic memory
misses do not replace the separate unprofiled memory pass. Additional profiles
are diagnostic only; no runtime/dependency/scheduling workaround or target
relaxation is adopted. Full milestone acceptance remains open.

Installer reuse is bounded to installation behavior: comparison from `ebd090ab`
to the application candidate has no changes to package manifests/lockfile,
installer configuration, desktop startup/native resources, service/contracts,
migrations, licenses or native/resource-copy build scripts. The renderer guard
changes field cleanup scheduling only. Retain the actual DMG/NSIS receipts for
data locations, identity, replacement/uninstall and isolation; require current
packaged application behavior separately. This does not relabel old installers
as current binaries or supply Windows 11 release evidence.

## Remaining ownership

#69 owns coherent principal appearance, full acceptance-map completion and the
retained broad native failures. #55 owns persisted sessions; #56/#57/#58 editor
and draft refinements; #60 and descendants contextual filesystem/recovery
refinements. #67 owns final UX01–UX20/platform/performance acceptance and #42
release integration. This map does not transfer a principal visual defect or
nonfunctional action to unspecified future polish.
