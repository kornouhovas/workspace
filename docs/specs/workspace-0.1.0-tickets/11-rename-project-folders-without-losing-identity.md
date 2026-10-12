# T11: Rename project folders without losing identity

Approved and published: [GitHub #18](https://github.com/kornouhovas/workspace/issues/18); Archived Beads ID: `workspace-31i.11`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Rename a project from Workspace while preserving its properties and recover the actual state if the filesystem or metadata write fails.

Roadmap scope: M2. Specification user stories: 21, 22, 23, 27.

## Acceptance criteria

- [ ] Editing Name renames the real folder in place and retains its logical project ID and Text values across restart in both discovery modes.
- [ ] Reject invalid names, occupied same-parent destinations, paths outside the source and stale locations; do not silently overwrite.
- [ ] Account for case-only renames according to the actual target filesystem and verify supported behavior on macOS and Windows.
- [ ] Exercise failures before/after the filesystem change and metadata commit. Persist enough operation state to reconcile or offer explicit recovery without pretending both resources changed atomically.
- [ ] After success or recovery, sibling workspaces and native reveal use the actual location; UI errors retain the real Name.

## Blocked by

- [T06 / GitHub #13](https://github.com/kornouhovas/workspace/issues/13): Preview grouped discovery and expose folder-backed categories
- [T07 / GitHub #14](https://github.com/kornouhovas/workspace/issues/14): Recover missing folders and unavailable sources

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
