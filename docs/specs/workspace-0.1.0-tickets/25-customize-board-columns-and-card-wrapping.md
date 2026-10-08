# T25: Customize Board columns and card wrapping

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Arrange and resize Board groups, control column visibility and card content wrapping, and reopen the same presentation.

Roadmap scope: M3. Specification user stories: 41, 55, 56.

## Acceptance criteria

- [ ] Column order/visibility and width persist in the owning view using stable group identity; newly appearing groups follow a defined default.
- [ ] Wrap-content controls change presentation without modifying project values; visible property presentation remains independent of property-definition ownership.
- [ ] Duplicating a Board copies settings independently; Table and sibling workspace settings do not change.
- [ ] Group reordering stays distinct from moving a project between groups; hidden/collapsed/empty group behavior stays consistent.
- [ ] Keyboard controls, narrow layouts and tests cover persisted changes, group/option rename and renderer refresh.

## Blocked by

- T23: Group Select categories and MultiSelect memberships

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
