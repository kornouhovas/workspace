# T32: Install and reopen the local app on macOS

Approved and published: [GitHub #39](https://github.com/kornouhovas/workspace/issues/39); Beads execution step: `workspace-31i.32`. GitHub owns current requirements and status.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Install a version-identifiable macOS build and reopen locally saved workspace data from the installed application.

Roadmap scope: M4. Specification user stories: 1, 9, 71, 72, 75.

## Acceptance criteria

- [ ] Select and document supported macOS versions/architectures and the intended signing/distribution approach; do not claim an unavailable signing identity has been configured.
- [ ] An actual macOS installation launches the bundled backend/database runtime and passes create/quit/reopen with isolated test data.
- [ ] Package/app version values agree with the canonical product version; include applicable notices/provenance and an observable version display.
- [ ] Install/update data-location rules preserve new-format user data and stay separate from development fixtures; later migrations reuse the established recovery boundary.
- [ ] Produce reproducible installable artifacts and installation/troubleshooting instructions without publishing downloads or creating a release tag.

## Blocked by

- [T02 / GitHub #9](https://github.com/kornouhovas/workspace/issues/9): Create and reopen an empty workspace

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
