# T26: Change scalar and Single Select values by group dragging

Approved and published: [GitHub #33](https://github.com/kornouhovas/workspace/issues/33); Beads execution step: `workspace-31i.26`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Drag a project between ordinary Text, Number, Date or Single Select groups in Board and Table and observe the saved value and resulting projection.

Roadmap scope: M3. Specification user stories: 57, 58, 59, 64.

## Acceptance criteria

- [ ] Exact scalar destinations assign their exact value; Single Select assigns the destination option and its empty group clears the value.
- [ ] Settle remaining ordinary scalar empty-drop validation explicitly without introducing range/bucket grouping.
- [ ] The typed mutation updates source-owned values and all project representations; it never moves folders.
- [ ] Filtered/ordered views show actual post-edit membership, including a project disappearing when it no longer matches; failed drops explain the failure and retain actual values.
- [ ] Distinguish a value-changing drop from group/row reordering, provide an editing alternative and test both layouts plus persisted service outcomes for each supported type.

## Blocked by

- [T21 / GitHub #28](https://github.com/kornouhovas/workspace/issues/28): Search projects and save typed view filters
- [T23 / GitHub #30](https://github.com/kornouhovas/workspace/issues/30): Group Select categories and MultiSelect memberships

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
