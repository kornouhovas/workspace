# Desktop UX implementation breakdown

Status: approved and published on 2026-10-19. Specification
[#47](https://github.com/kornouhovas/workspace/issues/47) is a native child of #7 and blocks #42.
U01–U20 are native children of that specification with ready-for-agent labels and
the approved native blocking edges. This is a publication snapshot, not a second
tracker or a claim of implementation completion. Consult GitHub for current state.

Source: [desktop UX specification](../workspace-desktop-ux.md).
The [standalone spec issue body](spec-issue.md) preserves the requirements in the
to-spec format, with 41 user stories and UX01–UX20 acceptance.
The [published release amendments](release-amendments.md) add the requirement to
#7/#42 while preserving their existing scope and blockers.

## Publication authorization

On 2026-10-19 the owner confirmed that kornouhovas/workspace is public, approved
publication of the spec and U01–U20, and replaced the private-only application
repository rule. See D61 and the [tracker policy](../../issue-tracker.md).
This does not start implementation or authorize release publication.

## Regression continuity

The [test inheritance map](test-inheritance.md) identifies existing regression
families and migration responsibilities. Every ticket includes the mandatory
retain/adapt/replace/retire review and owns the affected UI/smoke updates before
its acceptance. U20 checks composition, not a backlog of disabled old tests.

## Published tickets

Each ticket gives a verifiable user journey through the layers it actually needs.
The existing backend already implements most domain operations; a vertical UI
slice reuses those services instead of inventing new migrations for every screen.
U01 introduces the shared foundation while delivering a real workspace/settings
journey. Later slices preserve old functional entry points during migration.

U-identifiers are stable planning references, not GitHub numbers or a sequential
execution instruction. Only immediate blocking edges are listed. Shared UI foundation
coordination alone does not make otherwise independent tickets block each other.

| Ticket | GitHub issue | Observable result | Blocked by |
| --- | --- | --- | --- |
| [U01](01-open-workspaces-in-the-desktop-shell.md) | [#48](https://github.com/kornouhovas/workspace/issues/48) | Launch into an existing workspace, browse its real Table projects, switch workspaces, change appearance/language in bb-style settings and return to work. | None |
| [U02](02-create-and-manage-workspaces.md) | [#49](https://github.com/kornouhovas/workspace/issues/49) | Add a workspace from a folder picker, start or postpone source setup, and rename/reorder/remove it through sidebar menus or workspace settings. | U01 |
| [U03](03-configure-shared-sources.md) | [#50](https://github.com/kornouhovas/workspace/issues/50) | Resume source setup or change discovery interpretation, exclusions and archive location from source settings with an explicit impact review. | U02 |
| [U04](04-manage-views-and-filters.md) | [#51](https://github.com/kornouhovas/workspace/issues/51) | Create or switch saved Table/Board views and use project search and typed filters from the working area, with settings restored on reopen. | U01 |
| [U05](05-customize-table.md) | [#52](https://github.com/kornouhovas/workspace/issues/52) | Use a full working Table with exact grouping, contextual property presentation, row ordering and persistent column layout. | U04 |
| [U06](06-customize-board.md) | [#53](https://github.com/kornouhovas/workspace/issues/53) | Use a populated Board whose columns and cards reflect saved grouping and presentation settings, including multiple memberships. | U04 |
| [U07](07-preview-and-expand-projects.md) | [#54](https://github.com/kornouhovas/workspace/issues/54) | Open projects from a Table or Board, expand into a unique retained tab, and return or close while preserving the previous view. | U05, U06 |
| [U08](08-persist-workspace-sessions.md) | [#55](https://github.com/kornouhovas/workspace/issues/55) | Restart or restore application data and resume each workspace with its retained tabs, active content and allowed layout state. | U07 |
| [U09](09-edit-scalars-and-guard-navigation.md) | [#56](https://github.com/kornouhovas/workspace/issues/56) | Edit ordinary scalar values consistently in Table, Board cards and project details, with navigation that saves valid input or retains an invalid draft. | U07 |
| [U10](10-edit-selections-and-options.md) | [#57](https://github.com/kornouhovas/workspace/issues/57) | Choose Single Select/MultiSelect values and manage ordinary options from the same compact editors across all working surfaces. | U09 |
| [U11](11-manage-property-definitions.md) | [#58](https://github.com/kornouhovas/workspace/issues/58) | Create or rename properties from contextual controls and safely remove custom properties or ordinary options after reviewing affected data/views. | U10 |
| [U12](12-assign-ordinary-groups.md) | [#59](https://github.com/kornouhovas/workspace/issues/59) | Move a project between ordinary-property groups using drag or an accessible action, and observe the actual committed projection. | U10 |
| [U13](13-create-and-rename-projects.md) | [#60](https://github.com/kornouhovas/workspace/issues/60) | Create projects in the view action area, or rename and Reveal them from row/card/project menus, with actual operation status. | U07 |
| [U14](14-manage-folder-categories.md) | [#61](https://github.com/kornouhovas/workspace/issues/61) | Change a project category and create, rename or remove category options through reviewed contextual filesystem operations. | U13 |
| [U15](15-archive-and-restore-projects.md) | [#62](https://github.com/kornouhovas/workspace/issues/62) | Switch Active/Archived in the workspace, archive or restore from project menus and retain editable metadata and identity. | U13, U03 |
| [U16](16-assign-filesystem-groups.md) | [#63](https://github.com/kornouhovas/workspace/issues/63) | Assign a Name or folder-backed category group in Board/Table using the same safe operations as explicit contextual commands. | U12, U14, U15 |
| [U17](17-browse-and-open-project-files.md) | [#64](https://github.com/kornouhovas/workspace/issues/64) | Browse the displayed project tree, Open a file in its default external application and separately Reveal an item in Finder/Explorer. | U07 |
| [U18](18-recover-retained-project-context.md) | [#65](https://github.com/kornouhovas/workspace/issues/65) | Keep a retained project open through exclusions, archive, verified moves or source loss, and reach the correct recovery from its working context. | U08, U14, U15, U17 |
| [U19](19-recover-application-data-from-settings.md) | [#66](https://github.com/kornouhovas/workspace/issues/66) | Inspect backups, export or explicitly restore application data from bb-style settings, then resume a validated workspace session. | U08 |
| [U20](20-verify-integrated-desktop-experience.md) | [#67](https://github.com/kornouhovas/workspace/issues/67) | Demonstrate the complete new interface on the same packaged candidate with all UX scenarios, renewed scale measurements and preserved recovery/safety behavior. | U11, U16, U18, U19, #41 |

## Dependency rationale

- U01 is the initial frontier; it uses existing populated workspaces and service
  contracts, so new creation UI does not block the first demonstrable slice.
- U02/U03 develop setup/settings while U04 develops view navigation. U05/U06 can
  proceed independently once U04 supplies saved-view controls.
- U07 binds both actual view surfaces into one project-navigation model. U08
  persists it; U09 supplies shared draft guards; U13 and U17 add operations/files.
- U10 needs U09's editor/navigation lifecycle; U11 and U12 then address independent
  metadata-management and group-assignment workflows.
- U14 and U15 reuse U13's contextual operation feedback; U15 also needs U03's
  archive configuration. U16 composes those filesystem controls with assignment.
- U18 verifies retained context against session storage, source changes,
  category/archive operations and file reads. U19 adapts app-data recovery using
  U08's persisted session contract; it need not wait for unrelated folder editing.
- U20 waits on terminal slices U11/U16/U18/U19 and existing performance #41.
  Every U01–U19 ticket is a transitive prerequisite. U20 repeats completed UI
  measurements without taking over #41's current diagnosis or ownership.

## Acceptance ownership

| Rows | Primary slices (U20 verifies their composition) |
| --- | --- |
| UX01 | U02, U03 |
| UX02 | U01, U02, U04, U07, U08 |
| UX03–UX06 | U07, U09 |
| UX07 | U07, U08, U18, U19 |
| UX08 | U03, U08, U15, U18 |
| UX09–UX10 | U09, U10 (archived composition U15/U20) |
| UX11 | U05, U06, U10, U11, U14 |
| UX12 | U04, U05, U06, U11, U12 |
| UX13 | U12, U16 |
| UX14 | U13, U17, U18 |
| UX15 | U11, U13, U14, U15, U16, U18 |
| UX16 | U01, U02, U03, U04, U15, U19 |
| UX17–UX18 | Every affected UI slice; full surface matrix U20 |
| UX19 | U08, U19 |
| UX20 | U19, U20 and existing #41/#42 ownership |

## Existing tracker snapshot

Read and verified on 2026-10-19; refresh before execution:

- #7 remains open; its original 35 native children include open #41/#42. The publication adds desktop spec #47 as a new native child; its 20 implementation
  issues are nested under #47, not duplicate direct release tickets.
- #41 remains open and independently owned. Its six native blockers #15/#31/
  #32/#33/#39/#40 are closed. Its checkpoint records ongoing verification;
  a closed prerequisite does not establish performance acceptance.
- #42 remains open, under #7. Native blockers #17/#21/#34/#35/#36/#38 are closed;
  #41 is open; new native blocker #47 is also open. Its comment names #44,
  which is closed. Retain these edges and
  the original platform/release requirements alongside the desktop UX gate.
- Existing ready-for-agent is available; no new triage label is needed.

## Verified publication receipt

The publication read back all 21 issue bodies, open states and readiness labels,
the spec parent #7, all 20 child parents, and the exact native blocker sets. The
approved graph is acyclic and every implementation slice reaches U20 (#67).
The sole initial unblocked implementation issue is U01 (#48); selection and
current ownership still govern execution.

The additive requirements in #7/#42 preserve their previous bodies and blocking
edges. #42 additionally depends on #47; #67 depends on the terminal UX slices and
existing #41. The #41 body and ownership were not changed. No issue was closed,
no implementation started and no application release was published.

The [test inheritance map](test-inheritance.md) and every child issue explicitly
require same-slice migration of affected old UI tests, preservation of valid
regressions, and reasoned replacement/retirement. Publication changed documentation
and tracker records only; the existing runtime tests were not executed or claimed
passing by this task.

Verification: local Markdown links/anchors, whitespace checks, current suite
inventory/partition inspection, local graph validation and remote body/relationship
read-back. Application and migration tests belong to subsequent implementation.
