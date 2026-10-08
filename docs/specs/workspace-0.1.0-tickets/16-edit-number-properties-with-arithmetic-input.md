# T16: Edit Number properties with arithmetic input

Approved and published: [GitHub #23](https://github.com/kornouhovas/workspace/issues/23); Beads execution step: `workspace-31i.16`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create a Number property, enter a number or supported arithmetic expression, and reopen its validated numeric value.

Roadmap scope: M3. Specification user stories: 40, 42, 43, 45.

## Acceptance criteria

- [ ] Number definitions and values follow the existing source ownership and immutable-type rules; empty values can be cleared.
- [ ] Define the supported arithmetic grammar and numeric limits, show the computed value, and reject malformed/nonfinite results without replacing the previous value.
- [ ] Expressions are evaluated as constrained arithmetic, not arbitrary host code.
- [ ] Sibling workspaces and restart show the same numeric result; project files remain unchanged.
- [ ] EN/RU formatting/entry expectations are explicit and tested through service validation and keyboard UI entry.

## Blocked by

- [T05 / GitHub #12](https://github.com/kornouhovas/workspace/issues/12): Create and edit shared Text properties

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
