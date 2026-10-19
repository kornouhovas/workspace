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

1. Restore the complete working cycle: sidebar navigation, saved-view and project
   tabs, project preview, split panels, project file tree, workspace session
   restoration and Light/Dark/System appearance.
2. `main` supplies working scenarios and the organization of the principal areas;
   bb supplies visual language, density, typography, colors, borders, icons and
   shared control presentation. Specific behavior conflicts require explicit
   decisions rather than silent substitution.
3. Deliver this work through a separate linked specification and implementation
   slices, with completion required before final 0.1.0 release acceptance.
4. Use bb's settings organization as the reference for Workspace settings. Exact
   categories, entry points and scope mapping remain to be resolved.

The requested implementation foundation is Radix UI plus Tailwind CSS. The
inspected bb reference uses Radix Primitives, Tailwind 4 and local shadcn-style
components (`radix-mira`), rather than Radix Themes. Board/Table, document tabs
and the project file tree remain Workspace components composed from this
foundation. Radix alone does not provide their domain behavior or split layout.

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
| Project tabs | Expand, duplicate, reorder, close, close others/right and reopen closed | [Project tabs](https://github.com/kornouhovas/workspace/blob/080b416c/src/components/workspace/project-tabs.tsx#L74) |
| Close and return to preview | Distinct actions; active-tab close returns to the saved view | [Latest main ADR](https://github.com/kornouhovas/workspace/blob/080b416c/docs/adr/012-project-close-and-preview-only-right-host.md) |
| Split panels | Nested horizontal/vertical splits, resize, focus, maximize and restore | [Session commands](https://github.com/kornouhovas/workspace/blob/080b416c/src/workspaceSession.js#L133) |
| Session restoration | Tabs, selected content, per-view preview and panel layout restored; file tree reloaded | [Session lifecycle](https://github.com/kornouhovas/workspace/blob/080b416c/src/workspaceSessionLifecycle.js) |
| Files | Real recursive tree; files open through the operating system | [Wired file action](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L2592) |
| Appearance | Persisted Light/Dark/System choice; System follows the operating system | [Theme](https://github.com/kornouhovas/workspace/blob/080b416c/src/App.tsx#L580) |

Main's project preview is not an embedded file-content viewer. Its historical
`previewFile` API does not establish a wired viewer/editor. Opening files in main
is macOS-specific; cross-platform behavior needs an explicit new contract.

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

Proposed Workspace categories are General, Appearance, Workspaces, Sources,
Backup and recovery, and About. A source detail page would identify every
workspace affected by shared configuration changes. Everyday Archive/Restore
actions would remain in the workspace; archive location belongs to source
settings. These mappings are recommendations awaiting round 2, not accepted
requirements.

After round 1, the following decisions are ready for discussion:

- How bb settings navigation maps to device, workspace and shared-source scopes.
- Exact preview/tab/split transitions, including Close versus return to preview,
  duplicate tabs and empty-panel behavior.
- File opening on macOS and Windows, distinct from Reveal and embedded viewing.
- Ownership, persistence and backup/export scope of the workspace session.
- Retaining open projects when they become archived, missing, excluded or their
  source becomes unavailable.
- Keyboard alternatives for tab ordering and split placement.

Subsequent branches include context placement of new operations, property editors,
Board/Table controls, save/cancel behavior, layout limits, measurable acceptance
and implementation slices. Resolve prerequisites before selecting these details.

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
