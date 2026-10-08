# Workspace 0.1.0 ticket proposal

Status: draft, awaiting owner approval of granularity, blocking edges and merge/split choices. No implementation tickets or new Beads execution steps have been published.

Source: [specification #7](https://github.com/kornouhovas/workspace/issues/7), including its full body and comments (none at drafting time). These are proposed vertical implementation slices, not approved Ralphex plans. The new branch contains documentation/tool configuration and no runtime to prefactor; the first slice introduces a minimal real application path.

## How to read this proposal

Each ticket delivers an observable user workflow through the layers it needs, with acceptance and verification included. T01 establishes the first settings-to-database path; T02 creates and reopens an empty workspace. Later tickets extend real behavior rather than building a complete database, backend or frontend in isolation. Milestones are outcome groupings, not extra all-to-all dependencies.

Only actual prerequisite tickets appear in Blocked by. T01 is the initial executable frontier once approved. Numbers are stable draft identifiers, not GitHub issue numbers and not an instruction to execute strictly in sequence. T32/T33 can begin after T02; backups and view work need not wait for all filesystem features.

Localization, keyboard usability, validation, persistence/restart, renderer isolation, temporary test data and bb provenance are acceptance obligations in every affected slice. T35 verifies the composed release and does not postpone those obligations until the end. No new remote/sync/AI/site scope is introduced.

Open design details from the specification stay inside their bounded slice as explicit gates. Approval of this breakdown does not silently select retention periods, signing credentials, deletion policies, performance thresholds or other unaccepted product choices. Agents can settle ordinary implementation details; consequential alternatives require the owner's specific decision before dependent work.

## Proposed tickets

| Ticket | Deliverable | Blocked by | Roadmap |
| --- | --- | --- | --- |
| [T01](01-launch-desktop-and-persist-the-interface-language.md) | Launch desktop and persist the interface language | None | M1 |
| [T02](02-create-and-reopen-an-empty-workspace.md) | Create and reopen an empty workspace | T01 | M1 |
| [T03](03-manage-multiple-workspace-configurations-over-shared-roots.md) | Manage multiple workspace configurations over shared roots | T02 | M2 |
| [T04](04-preview-and-discover-direct-project-folders.md) | Preview and discover direct project folders | T02 | M2 |
| [T05](05-create-and-edit-shared-text-properties.md) | Create and edit shared Text properties | T03, T04 | M3 |
| [T06](06-preview-grouped-discovery-and-expose-folder-backed-categories.md) | Preview grouped discovery and expose folder-backed categories | T04 | M2 |
| [T07](07-recover-missing-folders-and-unavailable-sources.md) | Recover missing folders and unavailable sources | T05 | M2 |
| [T08](08-reconcile-unambiguous-external-folder-changes.md) | Reconcile unambiguous external folder changes | T06, T07 | M2 |
| [T09](09-change-discovery-mode-with-a-non-destructive-preview.md) | Change discovery mode with a non-destructive preview | T06, T07 | M2 |
| [T10](10-create-project-folders-and-reveal-them-in-the-file-manager.md) | Create project folders and reveal them in the file manager | T06 | M2 |
| [T11](11-rename-project-folders-without-losing-identity.md) | Rename project folders without losing identity | T06, T07 | M2 |
| [T12](12-move-projects-by-editing-folder-backed-select.md) | Move projects by editing folder-backed Select | T11 | M2 |
| [T13](13-create-and-rename-category-folders-through-select-options.md) | Create and rename category folders through Select options | T12 | M2 |
| [T14](14-remove-occupied-categories-with-an-explicit-destination.md) | Remove occupied categories with an explicit destination | T13 | M2 |
| [T15](15-archive-and-restore-projects-inside-their-source.md) | Archive and restore projects inside their source | T09, T12 | M2 |
| [T16](16-edit-number-properties-with-arithmetic-input.md) | Edit Number properties with arithmetic input | T05 | M3 |
| [T17](17-edit-date-properties-without-unintended-date-shifts.md) | Edit Date properties without unintended date shifts | T05 | M3 |
| [T18](18-edit-ordinary-single-select-values-and-option-presentation.md) | Edit ordinary Single Select values and option presentation | T05 | M3 |
| [T19](19-edit-multiselect-values-as-stable-option-sets.md) | Edit MultiSelect values as stable option sets | T18 | M3 |
| [T20](20-manage-independent-table-and-board-views.md) | Manage independent Table and Board views | T05 | M3 |
| [T21](21-search-projects-and-save-typed-view-filters.md) | Search projects and save typed view filters | T06, T16, T17, T19, T20 | M3 |
| [T22](22-group-table-and-board-by-exact-scalar-values.md) | Group Table and Board by exact scalar values | T16, T17, T20 | M3 |
| [T23](23-group-select-categories-and-multiselect-memberships.md) | Group Select categories and MultiSelect memberships | T06, T19, T22 | M3 |
| [T24](24-customize-table-columns-and-manual-row-order.md) | Customize Table columns and manual row order | T20 | M3 |
| [T25](25-customize-board-columns-and-card-wrapping.md) | Customize Board columns and card wrapping | T23 | M3 |
| [T26](26-change-scalar-and-single-select-values-by-group-dragging.md) | Change scalar and Single Select values by group dragging | T21, T23 | M3 |
| [T27](27-replace-multiselect-membership-by-group-dragging.md) | Replace MultiSelect membership by group dragging | T26 | M3 |
| [T28](28-rename-and-move-real-folders-through-group-dragging.md) | Rename and move real folders through group dragging | T15, T26 | M3 |
| [T29](29-delete-custom-properties-and-ordinary-options-without-broken-views.md) | Delete custom properties and ordinary options without broken views | T21, T24, T25 | M3 |
| [T30](30-export-and-restore-local-application-data.md) | Export and restore local application data | T07, T20 | M1/M4 |
| [T31](31-create-automatic-and-pre-migration-backups-with-recovery.md) | Create automatic and pre-migration backups with recovery | T30 | M1/M4 |
| [T32](32-install-and-reopen-the-local-app-on-macos.md) | Install and reopen the local app on macOS | T02 | M4 |
| [T33](33-install-and-reopen-the-local-app-on-windows.md) | Install and reopen the local app on Windows | T02 | M4 |
| [T34](34-keep-discovery-and-views-responsive-at-an-agreed-project-scale.md) | Keep discovery and views responsive at an agreed project scale | T08, T24, T25, T26, T32, T33 | M4 |
| [T35](35-prepare-and-verify-the-complete-local-0-1-0-release-candidate.md) | Prepare and verify the complete local 0.1.0 release candidate | T10, T14, T27, T28, T29, T31, T34 | M4 |

## Publication after approval

Publish one English GitHub issue per approved ticket under specification #7, in dependency order, with the ready-for-agent label and native blocking relationships where supported. If native blockers are unavailable, keep explicit links in each issue's Blocked by section. Do not change or close parent issues #7 or #6.

Create one linked Beads execution step per approved issue as the initial execution scaffold, retaining the GitHub URL and matching blocking edges. GitHub owns requirements and completion; Beads holds execution state/evidence. Add finer Beads steps only when implementation warrants them, rather than duplicating all acceptance text. Keep a mapping from draft ticket to GitHub issue and Beads ID, and verify both graphs after publication. No Ralphex execution starts from approval to publish tickets alone.

## Coverage

- Story 1: T01, T32, T33, T34.
- Story 2: T01.
- Story 3: T02.
- Story 4: T03.
- Story 5: T03.
- Story 6: T05.
- Story 7: T03, T20.
- Story 8: T03.
- Story 9: T02, T03, T32, T33.
- Story 10: T04.
- Story 11: T06.
- Story 12: T04, T06.
- Story 13: T04.
- Story 14: T04, T06.
- Story 15: T04, T06.
- Story 16: T09.
- Story 17: T07, T09.
- Story 18: T03, T06, T09, T12.
- Story 19: T10.
- Story 20: T06, T10.
- Story 21: T10, T11.
- Story 22: T10, T11, T12, T13, T14.
- Story 23: T04, T08, T11, T12, T13.
- Story 24: T08.
- Story 25: T07, T08.
- Story 26: T07, T08.
- Story 27: T07, T08, T10, T11, T12, T14.
- Story 28: T06, T13.
- Story 29: T12.
- Story 30: T13.
- Story 31: T14.
- Story 32: T06, T12, T18.
- Story 33: T15.
- Story 34: T15.
- Story 35: T15.
- Story 36: T15.
- Story 37: T15.
- Story 38: T15.
- Story 39: T15.
- Story 40: T05, T16, T17, T18, T19.
- Story 41: T05, T24, T25, T29.
- Story 42: T05, T16, T17, T18, T19.
- Story 43: T05, T16, T17, T18, T19.
- Story 44: T13, T18, T19, T29.
- Story 45: T05, T16, T17, T18, T19.
- Story 46: T20.
- Story 47: T20.
- Story 48: T20.
- Story 49: T21, T29, T34.
- Story 50: T20, T22, T23, T29, T34.
- Story 51: T22, T23.
- Story 52: T22, T23.
- Story 53: T19, T23.
- Story 54: T24, T34.
- Story 55: T25, T34.
- Story 56: T02, T20, T21, T22, T23, T24, T25, T29.
- Story 57: T26, T27, T28, T34.
- Story 58: T26.
- Story 59: T26.
- Story 60: T27.
- Story 61: T27.
- Story 62: T28.
- Story 63: T28.
- Story 64: T21, T26, T27, T28.
- Story 65: T01.
- Story 66: T01.
- Story 67: T01, T34.
- Story 68: T30, T31.
- Story 69: T30, T31.
- Story 70: T30, T31.
- Story 71: T30, T31, T32, T33.
- Story 72: T32, T33.
- Story 73: T01, T02, T05, T34.
- Story 74: Publication mapping and per-ticket GitHub/Beads evidence (cross-cutting).
- Story 75: T01, T32, T33.

T35 performs integration acceptance for all stories; the mapping above identifies earlier feature work so the final verification ticket cannot conceal missing implementation.
