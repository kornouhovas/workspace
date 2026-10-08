# T01: Launch desktop and persist the interface language

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Launch a minimal local desktop application, choose English or Russian, and see that preference survive a complete application restart. This is the first thin path through the React UI, isolated preload, typed service, separate TypeScript backend and SQLite/Drizzle; no project discovery is required.

Roadmap scope: M1. Specification user stories: 1, 2, 65, 66, 67, 73, 75.

## Acceptance criteria

- [ ] A clean checkout builds and launches the minimal desktop app with its owned local backend; closing the app stops its owned process. Backend startup failure is visible instead of a permanently loading screen.
- [ ] The settings control defaults to English, switches to Russian and persists through restart using a real database; missing translations fall back to English.
- [ ] Renderer isolation, disabled Node integration and sandboxing are verified; the service rejects malformed settings commands and has no remote exposure.
- [ ] Record the initial transport, SQLite driver, data location and migration choices. Development/test data is isolated from user installations and the working database is outside project folders.
- [ ] Introduce only the bb-based components needed by this screen, a Ladle preview, applicable provenance/notices, type/build checks and targeted service/UI CI. Produce launchable development artifacts for macOS and Windows; final installer/signing work is separate.

## Blocked by

None (can start immediately after the breakdown is approved).

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
