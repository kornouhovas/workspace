# T27: Replace MultiSelect membership by group dragging

Approved and published: [GitHub #34](https://github.com/kornouhovas/workspace/issues/34); Archived Beads ID: `workspace-31i.27`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Drag a MultiSelect project between groups while retaining unrelated memberships and correctly updating every visible occurrence.

Roadmap scope: M3. Specification user stories: 57, 60, 61, 64.

## Acceptance criteria

- [ ] A+B moved from A to C becomes B+C; moving A to an already selected B produces one B membership rather than duplicates.
- [ ] Dropping into empty clears all options; moving from empty to C sets C. The source membership is captured unambiguously when a project appears in multiple groups.
- [ ] Invalid/deleted destination options and stale source membership produce an explicit validated outcome without erasing unrelated values.
- [ ] Both Board and Table refresh membership, filters and visible duplicates from actual state; failed drops and restart preserve the correct option set.
- [ ] Tests exercise every accepted transition through the service and the two layout interactions, including a keyboard editing alternative.

## Blocked by

- [T26 / GitHub #33](https://github.com/kornouhovas/workspace/issues/33): Change scalar and Single Select values by group dragging

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
