# T29: Delete custom properties and ordinary options without broken views

Approved and published: [GitHub #36](https://github.com/kornouhovas/workspace/issues/36); Beads execution step: `workspace-31i.29`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Remove a custom property or ordinary Select option after reviewing its usages, leaving values and saved views in an explicit valid state.

Roadmap scope: M3. Specification user stories: 41, 44, 49, 50, 56.

## Acceptance criteria

- [ ] Show affected usages and define the approved clear/reassign/cancel behavior before implementing destructive metadata changes; cancel preserves every record.
- [ ] Apply the selected action consistently to Single Select and MultiSelect without dangling memberships or changing project files.
- [ ] Property removal handles affected filters, grouping and layout references through an explicit user-visible policy; Name and folder-backed structural fields cannot be deleted as ordinary custom properties.
- [ ] Changes reach every workspace over the source, survive restart and leave unrelated sources/definitions intact.
- [ ] Failure within the metadata operation leaves a consistent database; service and UI fixtures include configured Board/Table views, option usages and stale usage previews.

## Blocked by

- [T21 / GitHub #28](https://github.com/kornouhovas/workspace/issues/28): Search projects and save typed view filters
- [T24 / GitHub #31](https://github.com/kornouhovas/workspace/issues/31): Customize Table columns and manual row order
- [T25 / GitHub #32](https://github.com/kornouhovas/workspace/issues/32): Customize Board columns and card wrapping

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
