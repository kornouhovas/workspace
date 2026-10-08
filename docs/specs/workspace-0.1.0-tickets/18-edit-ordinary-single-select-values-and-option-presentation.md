# T18: Edit ordinary Single Select values and option presentation

Approved and published: [GitHub #25](https://github.com/kornouhovas/workspace/issues/25); Beads execution step: `workspace-31i.18`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create an ordinary Single Select, manage its non-destructive option settings and assign or clear a project value without moving folders.

Roadmap scope: M3. Specification user stories: 32, 40, 42, 43, 44, 45.

## Acceptance criteria

- [ ] Create a property and options; assign one option or clear the value, with immutable type and source ownership enforced.
- [ ] Rename/color/reorder options and define their hide/show presentation scope; hiding an option does not silently clear existing values.
- [ ] Option identity is stable across rename and restart; options from another property/source are rejected.
- [ ] Existing project folder names and positions stay unchanged through every ordinary Select edit.
- [ ] UI and real-database tests cover sibling-workspace updates, empty values and invalid saves. Destructive deletion with usages is handled in its dedicated ticket.

## Blocked by

- [T05 / GitHub #12](https://github.com/kornouhovas/workspace/issues/12): Create and edit shared Text properties

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
