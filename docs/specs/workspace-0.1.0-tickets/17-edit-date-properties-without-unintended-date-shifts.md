# T17: Edit Date properties without unintended date shifts

Approved and published: [GitHub #24](https://github.com/kornouhovas/workspace/issues/24); Archived Beads ID: `workspace-31i.17`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create a Date property, set or clear its value and see the same intended date after restart and UI language changes.

Roadmap scope: M3. Specification user stories: 40, 42, 43, 45.

## Acceptance criteria

- [ ] Define the date value semantics and input/display contract from the preserved baseline; do not silently introduce time-of-day or timezone behavior.
- [ ] Create, edit and clear a date through the UI and typed service; reject invalid dates without changing the stored value.
- [ ] Immutable property type, source ownership and other-source isolation remain enforced.
- [ ] Restart and EN/RU switching preserve the intended value, including boundary-date fixtures; no project files change.
- [ ] Provide keyboard input and useful errors, with real SQLite round-trip tests.

## Blocked by

- [T05 / GitHub #12](https://github.com/kornouhovas/workspace/issues/12): Create and edit shared Text properties

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
