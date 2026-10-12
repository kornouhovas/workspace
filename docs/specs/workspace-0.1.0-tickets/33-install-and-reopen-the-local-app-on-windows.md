# T33: Install and reopen the local app on Windows

Approved and published: [GitHub #40](https://github.com/kornouhovas/workspace/issues/40); Archived Beads ID: `workspace-31i.33`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Install a version-identifiable Windows build and reopen locally saved workspace data from the installed application.

Roadmap scope: M4. Specification user stories: 1, 9, 71, 72, 75.

## Acceptance criteria

- [ ] Select and document supported Windows versions/architectures and the intended signing/distribution approach; do not imply credentials or signing have been validated when unavailable.
- [ ] An actual Windows installation launches the bundled backend/database runtime and passes create/quit/reopen with isolated test data.
- [ ] Package/app version values agree with the canonical product version; applicable notices/provenance and version display are included.
- [ ] Paths with spaces and non-ASCII characters, permissions and install/update data locations preserve new-format application data; development fixtures remain isolated.
- [ ] Produce reproducible installable artifacts and installation/troubleshooting instructions without publishing downloads or creating a release tag.

## Blocked by

- [T02 / GitHub #9](https://github.com/kornouhovas/workspace/issues/9): Create and reopen an empty workspace

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
