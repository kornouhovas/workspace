# T05: Create and edit shared Text properties

Approved and published: [GitHub #12](https://github.com/kornouhovas/workspace/issues/12); Archived Beads ID: `workspace-31i.5`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create a Text property, edit and clear values on discovered projects, and see the same source data from another workspace after restart.

Roadmap scope: M3. Specification user stories: 6, 40, 41, 42, 43, 45, 73.

## Acceptance criteria

- [ ] Create and rename a custom Text definition and edit or clear its value from Table; empty and nonempty values remain distinguishable where relevant.
- [ ] Definitions and values are source-owned; sibling workspaces observe changes while another source is unaffected.
- [ ] Type changes after creation are rejected by the service, not merely hidden in the UI; invalid property/project ownership is rejected.
- [ ] Values and logical project references persist through service/application restart without altering any project folder.
- [ ] The new UI supports EN/RU, keyboard editing and useful validation/save errors; tests run through the typed service with real SQLite.

## Blocked by

- [T03 / GitHub #10](https://github.com/kornouhovas/workspace/issues/10): Manage multiple workspace configurations over shared roots
- [T04 / GitHub #11](https://github.com/kornouhovas/workspace/issues/11): Preview and discover direct project folders

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
