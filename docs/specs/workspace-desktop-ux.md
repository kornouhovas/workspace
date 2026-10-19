# Workspace desktop experience

Status: interview draft. Accepted decisions below are recorded as they are made;
open questions are not requirements. Implementation has not started.

## Outcome

Restore the daily working experience of `main` on the `new-workspace` application,
using Radix UI primitives and Tailwind CSS with bb's visual language. The result
must combine the existing source, property, view, archive and recovery capabilities
with a coherent desktop workspace.

Completion of this specification's implementation and acceptance is an additional
prerequisite for the first local 0.1.0 release. The existing
[release specification](workspace-0.1.0.md), [performance issue #41](https://github.com/kornouhovas/workspace/issues/41)
and [integrated acceptance issue #42](https://github.com/kornouhovas/workspace/issues/42)
remain relevant. Issue 41 can proceed independently; its scenarios must be checked
again against the completed UI. This draft does not claim that GitHub dependencies
or the published release specification have already been updated.

## Accepted decisions

The owner accepted the following in interview round 1:

1. Restore the working cycle: sidebar navigation, saved-view and project tabs,
   project preview, project file tree, workspace session restoration and
   Light/Dark/System appearance. The later Q5 refinement deliberately replaces
   main's split tree with a single project area, as specified below.
2. `main` supplies working scenarios and the organization of the principal areas;
   bb supplies visual language, density, typography, colors, borders, icons and
   shared control presentation. Specific behavior conflicts require explicit
   decisions rather than silent substitution.
3. Deliver this work through a separate linked specification and implementation
   slices, with completion required before final 0.1.0 release acceptance.
4. Use bb's settings organization as the reference for Workspace settings.
   Round 2 resolves the categories and entry points below.

The requested implementation foundation is Radix UI plus Tailwind CSS. The
inspected bb reference uses Radix Primitives, Tailwind 4 and local shadcn-style
components (`radix-mira`), rather than Radix Themes. Board/Table, document tabs
and the project file tree remain Workspace components composed from this
foundation. Radix alone does not provide their domain behavior or application layout.

### Round 2 decisions

The owner accepted Q4 and Q6–Q9, then refined Q5 to remove nested splits.
This refinement takes precedence over earlier references to multiple panels.

- **Settings (Q4):** separate settings mode with General (language), Appearance
  (Light/Dark/System), Workspaces (list and details), Sources (list and discovery,
  exclusions and archive-location details), Backup and recovery, and About
  (version and licenses). Enter from the sidebar footer or a workspace context
  action targeting its section. Return restores the prior work area. Identify
  workspaces affected by source changes. Simple preferences apply immediately;
  discovery changes and data restore retain explicit review/application actions.
  Archive/Restore and Active/Archived switching remain in the work area.
- **Files (Q6):** show the real project file tree and open a selected file in the
  operating system's default external application on macOS and Windows. Open and
  Reveal in Finder/Explorer are distinct actions. Embedded file viewers and
  content editing are outside this specification.
- **Session (Q7):** retain open tabs, active view, project preview, expanded state
  and the allowed area sizes per workspace on this device. Include the session in application-data
  backups. On restart or restore, reload current properties/file trees and check
  project availability rather than treating cached content as current state.
- **Changed availability (Q8):** keep open project tabs when a project becomes
  missing, excluded, archived or its source becomes unavailable. A verified move
  updates the locator while preserving identity. Show the actual state and
  applicable recovery actions; archived projects retain permitted property
  editing. Do not silently close the tab or imply stale data is current.
- **Keyboard (Q9, narrowed by Q5):** provide menu/keyboard alternatives for tab
  reordering, opening the project area, resizing allowed boundaries and returning
  from expanded mode. Arbitrary panel-placement commands are excluded with splits.
  Include these actions and focus behavior in acceptance rather than assuming
  Radix primitives alone implement them.

### Single project area (Q5 refinement)

The owner explicitly removed nested splitting. The right-hand area can display
only one project at a time. That project can expand into the work area; the
project itself cannot be divided into additional panels. Multiple simultaneous
project panes, split trees and drag-to-split targets are outside this spec.

This is an intentional simplification of main, not an implementation omission.
Session restoration and keyboard commands must use the same simpler model and
must not reintroduce splits through persistence or shortcuts. Q10–Q12 resolve
the tab, transition and resize rules below.

### Tabs, transitions and resizing (Q10–Q12)

The owner accepted all three recommendations:

- A workspace can retain several project tabs, displaying only the selected
  project. A project has at most one tab in that workspace; reopening it reuses
  the existing tab. Main's duplicate-project-tab command is intentionally omitted.
- Selecting a project in Board/Table displays it in the right-hand project area;
  selecting a different project replaces that area's content.
- Expand displays the project in place of Board/Table while preserving sidebar
  navigation. Return to the right restores Board/Table beside the project.
- Close removes the displayed project; closing an expanded project returns to
  Board/Table. An empty right-hand area occupies no space.
- These transitions preserve the view's filters, grouping and scroll position.
- Sidebar and right-hand project-area widths are adjustable with pointer and
  keyboard and persist. Expanded mode occupies the available work area; returning
  to the right restores the previous project-area width.

#### Accepted session scenarios

| Initial state and action | Required result |
| --- | --- |
| Table or Board; open project A, then B | Only B is displayed in the right-hand area |
| A already has a tab; open A again | Reuse A's existing tab; no duplicate is created |
| Right-hand project; Expand | Same project occupies the work area and sidebar remains available |
| Expanded project; Return to the right | Restore the previous view and its scroll/filter/group state beside the project |
| Expanded project; Close | Return to the previous Board/Table state |
| Close the right-hand project | The view uses the released width; no empty project region remains |
| Resize right-hand area, expand, return | Restore the selected width |
| Restart or restore a backup | Restore the allowed session layout, then reload current data and availability |
| Keyboard user changes sizes or presentation | Same state transitions as pointer controls, with visible usable focus |

## Sources and authority

- Main UX baseline: commit `59afdbc8`; application sources match remote main
  `080b416c57b2869024ac62363e96b68b40f499c0`. Pin behavioral references below to
  that remote commit so later branch changes cannot silently alter the baseline.
- New runtime baseline: `d925f8b758caea6dc079061d42be1d132dcbc8a1`.
- bb reference: `f135a001e72942cee9118d2693208ec0725e2f18`, under the existing
  [reuse policy](../reuse.md). Keep actual extraction provenance and license
  notices when code is adapted.
- [Product](../product.md), [architecture](../architecture.md), accepted ADRs and
  typed service contracts retain authority over source ownership, project
  identity, filesystem operations and persistence. Restoring UI workflows does
  not restore superseded storage or fixed Status semantics.
- [ADR 0008](../adr/0008-desktop-experience-reference-authority.md) records the
  separation between behavioral and visual references.

## Baseline inventory

These are source observations. Broad capability inclusion is accepted; exact
interaction details and improvements remain interview questions until settled.

| Capability | Observed main behavior | Evidence |
| --- | --- | --- |
| Desktop shell | Sidebar, central work area and project preview area | [App](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L2930) |
| Navigation | Workspace management, search, settings and in-session Back/Forward | [Sidebar](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/left-panel.tsx#L421) |
| Project preview | Project properties and a real file tree in the right area | [Open preview](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L2418) |
| Project tabs | Main has expand, duplicate, reorder, close and reopen; Q10 explicitly removes duplicate tabs for the same project | [Project tabs](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/project-tabs.tsx#L74) |
| Close and return to preview | Distinct actions; active-tab close returns to the saved view | [Latest main ADR](https://github.com/kornouhovas/workspace/blob/080b416c/docs/adr/012-project-close-and-preview-only-right-host.md) |
| Split panels (intentionally excluded) | Main has nested splits; Q5 replaces them with one right-hand project area and expanded mode | [Session commands](https://github.com/kornouhovas/workspace/blob/080b416c/src/workspaceSession.js#L133) |
| Session restoration | Tabs, selected content, per-view preview and panel layout restored; file tree reloaded | [Session lifecycle](https://github.com/kornouhovas/workspace/blob/080b416c/src/workspaceSessionLifecycle.js) |
| Files | Real recursive tree; files open through the operating system | [Wired file action](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L2592) |
| Appearance | Persisted Light/Dark/System choice; System follows the operating system | [Theme](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L580) |

Main's project preview is not an embedded file-content viewer. Its historical
`previewFile` API does not establish a wired viewer/editor. Opening files in main
is macOS-specific; Q6 accepts external opening on both target platforms. The new
service/native command details still need to be specified.

## Design frontier

The pinned bb reference organizes settings as a separate application mode:
the sidebar displays setting categories and Back to app, while the main area
contains grouped controls. It remembers the previous app route and settings
route within the running session. Simple preferences persist per control;
operations use their own mutation/confirmation flow. Exact focus restoration is
not established by that route memory.

Sources: [Settings sidebar](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/settings/SettingsSidebar.tsx),
[route memory](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/hooks/useAppSettingsRouteMemory.ts),
[settings sections](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/src/components/ui/settings-section.tsx).

Settings mapping, external file opening, device/workspace session backup scope,
retained unavailable tabs and keyboard alternatives are accepted in round 2.

Q5 and Q10–Q12 now settle the single project area, unique project tabs,
Close/return/expand behavior, empty-area removal and width controls. Nested
splits and duplicate tabs are deliberate exceptions to main's baseline.

Subsequent branches include context placement of new operations, property editors,
Board/Table controls, save/cancel and navigation with unsaved edits, narrow-layout
behavior, measurable acceptance and implementation slices. Resolve prerequisites
before selecting these details.

## Completion criteria for this document

The finished specification must include the complete capability mapping,
user journeys, settings information architecture, session rules, component and
visual foundations, failure/recovery states, keyboard behavior, and observable
acceptance on both target platforms. Every significant main capability must have
an accepted destination or explicit exclusion. New-workspace capabilities must
remain reachable and retain their accepted safety and ownership contracts.

Before handoff, reconcile the accepted release requirements with the parent spec
and GitHub tracking under the applicable publication authorization. Record the
owner's confirmation of shared understanding before implementation begins.
