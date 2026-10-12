# T30: Export and restore local application data

Approved and published: [GitHub #37](https://github.com/kornouhovas/workspace/issues/37); Archived Beads ID: `workspace-31i.30`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Export a consistent snapshot of local application data and restore it through a visible workflow without claiming to restore project-file contents.

Roadmap scope: M1/M4. Specification user stories: 68, 69, 70, 71.

## Acceptance criteria

- [ ] Export includes source/workspace/project metadata, definitions/values, views and device settings in the versioned new format; choose a consistent SQLite snapshot mechanism.
- [ ] Restore validates the format/version before replacing state and protects the current data on malformed input, interruption or failed replacement.
- [ ] A real round trip recovers multiple workspaces, a Text value, independent views and language settings after restarting the app; later domain tickets extend this regression fixture as their data is added.
- [ ] The UI explains that project files are separate; a restored record with a missing folder follows the existing reassociation flow and does not fabricate folder contents.
- [ ] Document recovery steps and test export during normal service use, invalid exports and failed restore using disposable databases.

## Blocked by

- [T07 / GitHub #14](https://github.com/kornouhovas/workspace/issues/14): Recover missing folders and unavailable sources
- [T20 / GitHub #27](https://github.com/kornouhovas/workspace/issues/27): Manage independent Table and Board views

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
