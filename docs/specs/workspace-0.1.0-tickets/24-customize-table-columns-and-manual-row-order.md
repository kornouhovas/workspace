# T24: Customize Table columns and manual row order

Approved and published: [GitHub #31](https://github.com/kornouhovas/workspace/issues/31); Beads execution step: `workspace-31i.24`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Reorder rows and visible properties in Table, resize columns and wrap Text while keeping the presentation specific to that view.

Roadmap scope: M3. Specification user stories: 41, 54, 56.

## Acceptance criteria

- [ ] Manual row order persists by logical project identity through restart; newly discovered or missing projects have a defined non-destructive placement policy.
- [ ] Hide/show and reorder visible properties without deleting their definitions or values; resize columns and toggle Text wrapping.
- [ ] Duplicated views start with copied settings and diverge independently; another workspace keeps its layout.
- [ ] Distinguish row reordering from property-changing group drops; when grouping/filtering is available, reuse persisted row identity rather than assigning another meaning to the drag.
- [ ] Keyboard alternatives, usable narrow layouts and focused UI/service persistence checks demonstrate all controls.

## Blocked by

- [T20 / GitHub #27](https://github.com/kornouhovas/workspace/issues/27): Manage independent Table and Board views

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
