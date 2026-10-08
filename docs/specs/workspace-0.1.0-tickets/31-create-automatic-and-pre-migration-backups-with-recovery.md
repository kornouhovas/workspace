# T31: Create automatic and pre-migration backups with recovery

Approved and published: [GitHub #38](https://github.com/kornouhovas/workspace/issues/38); Beads execution step: `workspace-31i.31`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Automatically protect application data and preserve a recoverable snapshot before schema changes, with visible backup status and usable recovery.

Roadmap scope: M1/M4. Specification user stories: 68, 69, 70, 71.

## Acceptance criteria

- [ ] Record backup schedule/retention/destination choices; automatic backups use the consistent snapshot boundary and report success/failure truthfully.
- [ ] Before applying a schema migration, create and verify a usable backup. Backup failure prevents unsafe migration and gives an actionable error.
- [ ] A new-format upgrade preserves existing data; an injected migration failure offers the tested recovery path rather than overwriting the last known-good state.
- [ ] Retention cleanup respects the selected policy and cannot remove the only required recovery point during a failed migration.
- [ ] Exercise automatic backup, backup failure, upgrade and restoration from the UI/service with real databases; project-file contents remain outside scope.

## Blocked by

- [T30 / GitHub #37](https://github.com/kornouhovas/workspace/issues/37): Export and restore local application data

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
