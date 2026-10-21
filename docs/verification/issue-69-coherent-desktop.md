# Issue 69 acceptance map

Status: **in progress, not accepted**. [GitHub #69](https://github.com/kornouhovas/workspace/issues/69)
owns current CI/integration gates; the [plan](../plans/issue-69-coherent-desktop.md)
records scenarios and test retention. Candidate slice `6dc502147c9ab6f72fa3838e616608bbd8a88128`
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
appearance artifacts, not complete runtime passes.

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
| Sidebar and project resize/collapse/restore | Original navigation command passes pointer resize, keyboard endpoints, collapse/restore, released width and discoverable restore | No persisted-session claim; #55 owns restart restoration extensions |
| Preview/expand/return, close/reopen and tabs | Original navigation command passes 32 ordinary/long captures, focus, unique tabs, inactive-close/reopen and reorder, independent vertical/horizontal view scroll | View/filter/scroll constraints retained; original assertions unchanged |
| Back/Forward | Native workspace keyboard traversal passes; 241 selected UI/service scenarios include branch truncation, end states, settings return and removed-destination handling | Navigation does not undo committed metadata/filesystem commands; #56 retains the complete draft guard matrix |
| Board controls | Original Board command passes 16 populated/long, eight empty and eight unavailable captures; width/collapse/hide/restore, saved order/wrap, scalar grouping and MultiSelect membership | Exact memberships and values preserved; normal exit and asserted fixture cleanup passed |
| Real file tree/Open/Reveal | Original file command reaches 16 preview/expanded captures, arrow focus, Refresh/disappearance, exact Finder selection, exact external TextEdit document and unchanged bytes | Overall command **failed** normal shutdown; cleanup was skipped because exit was unverified. This is not a passing native receipt. |
| Table/font/settings/state matrix | Original visual command reaches 16 populated/long plus 24 empty variants with original bounds/font/context assertions | Overall command **failed** normal shutdown; appearance evidence alone does not accept the milestone |
| Native shutdown | Original three-file reproduction 16 pass/13 fail; diagnostic renewal four pass/11 fail exposes original timeout rather than secondary discarded-handle TypeError | Normal 10-second deadline and forced-cleanup failure remain. Native root cause is still under investigation. |
| Independent review | Standards 0 findings; Spec 0 slice findings at `6dc5021` | Review explicitly does not accept remaining milestone gates |

Local artifacts are under `work/issue-69/` in the task checkout. Their names and
existence do not establish passing evidence. Exact-SHA hosted, broad suite,
package/installer and strict representative-scale gates remain pending.

## Remaining ownership

#69 owns coherent principal appearance, full acceptance-map completion and the
retained broad native failures. #55 owns persisted sessions; #56/#57/#58 editor
and draft refinements; #60 and descendants contextual filesystem/recovery
refinements. #67 owns final UX01–UX20/platform/performance acceptance and #42
release integration. This map does not transfer a principal visual defect or
nonfunctional action to unspecified future polish.
