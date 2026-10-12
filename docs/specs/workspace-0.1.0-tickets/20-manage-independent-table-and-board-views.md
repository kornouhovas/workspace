# T20: Manage independent Table and Board views

Approved and published: [GitHub #27](https://github.com/kornouhovas/workspace/issues/27); Archived Beads ID: `workspace-31i.20`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create and switch between ungrouped Table and Board views, duplicate their settings and manage each workspace's view collection independently.

Roadmap scope: M3. Specification user stories: 7, 46, 47, 48, 50, 56.

## Acceptance criteria

- [ ] Both layouts render real discovered projects and existing fields; subsequent property types extend the same presentation contract.
- [ ] Create/activate/rename/reorder/delete views with at least one retained; invalid deletion cannot leave a workspace unusable.
- [ ] Duplicating a view copies settings independently; editing the copy leaves the original unchanged and a failed duplication exposes no orphaned partial view.
- [ ] Workspace-owned view state and active selection persist after restart; source property edits are visible across layouts/workspaces without sharing presentation settings.
- [ ] Tests demonstrate both layouts and lifecycle actions through the service plus focused keyboard/UI interactions. Grouping/filtering and detailed layout controls follow separately.

## Blocked by

- [T05 / GitHub #12](https://github.com/kornouhovas/workspace/issues/12): Create and edit shared Text properties

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
