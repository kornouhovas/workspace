# Desktop UX implementation breakdown

Status: proposed for owner review; no GitHub issues have been created. This is a
publication preparation artifact, not a second tracker or implementation plan.
The product decisions are accepted; task granularity and edges await review.

Source: [desktop UX specification](../workspace-desktop-ux.md).
The [standalone spec issue body](spec-issue.md) preserves the requirements in the
to-spec format, with 41 user stories and UX01–UX20 acceptance.
The [prepared release amendments](release-amendments.md) add the requirement to
#7/#42 while preserving their existing scope and blockers.

## Publication gate

On 2026-10-19, GitHub reports kornouhovas/workspace as public. The repository
[tracker policy](../../issue-tracker.md) requires resolving a visibility conflict
with the owner before publishing retained private material. The owner has
requested spec publication and ticket preparation; confirmation that this
publication may be public is pending. Issue-scoped public authorization recorded
for #38/#41 does not extend itself to this new specification.

## Proposed tickets

Each ticket gives a verifiable user journey through the layers it actually needs.
The existing backend already implements most domain operations; a vertical UI
slice reuses those services instead of inventing new migrations for every screen.
U01 introduces the shared foundation while delivering a real workspace/settings
journey. Later slices preserve old functional entry points during migration.

U-identifiers are draft references, not issue numbers or a sequential execution
instruction. Only immediate blocking edges are listed. Shared UI foundation
coordination alone does not make otherwise independent tickets block each other.

| Ticket | Observable result | Blocked by |
| --- | --- | --- |
| [U01](01-open-workspaces-in-the-desktop-shell.md) | Launch into an existing workspace, browse its real Table projects, switch workspaces, change appearance/language in bb-style settings and return to work. | None |
| [U02](02-create-and-manage-workspaces.md) | Add a workspace from a folder picker, start or postpone source setup, and rename/reorder/remove it through sidebar menus or workspace settings. | U01 |
| [U03](03-configure-shared-sources.md) | Resume source setup or change discovery interpretation, exclusions and archive location from source settings with an explicit impact review. | U02 |
| [U04](04-manage-views-and-filters.md) | Create or switch saved Table/Board views and use project search and typed filters from the working area, with settings restored on reopen. | U01 |
| [U05](05-customize-table.md) | Use a full working Table with exact grouping, contextual property presentation, row ordering and persistent column layout. | U04 |
| [U06](06-customize-board.md) | Use a populated Board whose columns and cards reflect saved grouping and presentation settings, including multiple memberships. | U04 |
| [U07](07-preview-and-expand-projects.md) | Open projects from a Table or Board, expand into a unique retained tab, and return or close while preserving the previous view. | U05, U06 |
| [U08](08-persist-workspace-sessions.md) | Restart or restore application data and resume each workspace with its retained tabs, active content and allowed layout state. | U07 |
| [U09](09-edit-scalars-and-guard-navigation.md) | Edit ordinary scalar values consistently in Table, Board cards and project details, with navigation that saves valid input or retains an invalid draft. | U07 |
| [U10](10-edit-selections-and-options.md) | Choose Single Select/MultiSelect values and manage ordinary options from the same compact editors across all working surfaces. | U09 |
| [U11](11-manage-property-definitions.md) | Create or rename properties from contextual controls and safely remove custom properties or ordinary options after reviewing affected data/views. | U10 |
| [U12](12-assign-ordinary-groups.md) | Move a project between ordinary-property groups using drag or an accessible action, and observe the actual committed projection. | U10 |
| [U13](13-create-and-rename-projects.md) | Create projects in the view action area, or rename and Reveal them from row/card/project menus, with actual operation status. | U07 |
| [U14](14-manage-folder-categories.md) | Change a project category and create, rename or remove category options through reviewed contextual filesystem operations. | U13 |
| [U15](15-archive-and-restore-projects.md) | Switch Active/Archived in the workspace, archive or restore from project menus and retain editable metadata and identity. | U13, U03 |
| [U16](16-assign-filesystem-groups.md) | Assign a Name or folder-backed category group in Board/Table using the same safe operations as explicit contextual commands. | U12, U14, U15 |
| [U17](17-browse-and-open-project-files.md) | Browse the displayed project tree, Open a file in its default external application and separately Reveal an item in Finder/Explorer. | U07 |
| [U18](18-recover-retained-project-context.md) | Keep a retained project open through exclusions, archive, verified moves or source loss, and reach the correct recovery from its working context. | U08, U14, U15, U17 |
| [U19](19-recover-application-data-from-settings.md) | Inspect backups, export or explicitly restore application data from bb-style settings, then resume a validated workspace session. | U08 |
| [U20](20-verify-integrated-desktop-experience.md) | Demonstrate the complete new interface on the same packaged candidate with all UX scenarios, renewed scale measurements and preserved recovery/safety behavior. | U11, U16, U18, U19, #41 |

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

Read on 2026-10-19; refresh immediately before publication/execution:

- #7 remains open; its 35 native children include open #41/#42. The new desktop
  spec is not present yet; no existing issue title matches it.
- #41 remains open and independently owned. Its six native blockers #15/#31/
  #32/#33/#39/#40 are closed. Its checkpoint records ongoing verification;
  a closed prerequisite does not establish performance acceptance.
- #42 remains open, under #7. Native blockers #17/#21/#34/#35/#36/#38 are closed;
  #41 is open. Its comment also names #44, which is closed. Retain these edges and
  the original platform/release requirements when adding the desktop UX gate.
- Existing ready-for-agent is available; no new triage label is needed.

## Publication procedure after approval

1. Re-read repository visibility, #7/#41/#42 bodies/comments, native relationships
   and existing desktop-UX markers to avoid overwriting concurrent updates or
   duplicating partially published work.
2. Publish the prepared spec issue as `Spec: Workspace desktop experience` with
   ready-for-agent. Attach it beneath #7. Use the separately prepared release
   amendment during the authorized spec-publication phase; preserve all existing
   parent/release scope and acceptance.
3. After approval of this breakdown, create U01–U20 with ready-for-agent in
   dependency order. Replace draft U-identifiers and parent placeholders with
   real issue references, omit preparation-only titles/status, and attach each as
   a native sub-issue of the desktop spec.
4. Add native blocked-by relationships from the approved graph. If unavailable,
   record exact textual `Blocked by: #N` fallbacks. Add the accepted desktop UX
   prerequisite to #42 without removing #41 or other existing dependencies.
5. Read back every body, parent and blocker set, check for cycles/omissions, and
   record actual issue URLs in this publication snapshot. Do not close parents,
   start implementation, launch Ralphex, tag or publish a release.

The to-tickets phase does not edit/close the parent specification. Required #7/
#42 release amendments belong to the separately authorized spec-publication phase.
