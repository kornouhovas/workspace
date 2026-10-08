# T07: Recover missing folders and unavailable sources

Approved and published: [GitHub #14](https://github.com/kornouhovas/workspace/issues/14); Beads execution step: `workspace-31i.7`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

When a project folder or whole root disappears, keep metadata visible and let the user safely reassociate an unresolved project with a valid folder.

Roadmap scope: M2. Specification user stories: 17, 25, 26, 27.

## Acceptance criteria

- [ ] An unavailable root is represented once as source unavailability, without deleting its projects or values.
- [ ] A missing or ambiguous individual folder retains its logical project record and Text value and offers a locate/reassociation action.
- [ ] Reassociation validates containment, current existence and conflicting project associations; it does not overwrite or silently merge another project record.
- [ ] Cancelling or failing recovery preserves the existing metadata; successful reassociation survives restart with the same logical project identity.
- [ ] An end-to-end fixture removes/disconnects a location, recovers it through the UI/service and verifies metadata. No permanent marker files are introduced.

## Blocked by

- [T05 / GitHub #12](https://github.com/kornouhovas/workspace/issues/12): Create and edit shared Text properties

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
