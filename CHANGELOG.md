# Changelog

User-facing changes are maintained in English. The first target release is 0.1.0; no release has been published from this branch.

## Unreleased

### Added

- A launchable local desktop settings screen with English and Russian interface languages.
- A separate local TypeScript backend and SQLite persistence for the selected interface language, including English as the first-launch default.
- Named workspaces rooted at accessible folders, each with a persisted default Table view and active selection that restores after restart.
- A localized empty Table screen and saved-workspace selector; project discovery remains future work.
- Development packaging configuration and macOS/Windows CI artifact checks for the desktop application.

### Fixed

- Saved workspace folder aliases retain source, workspace and view identities when their canonical path spelling changes.

### Planned

- Project discovery, project properties, editable Table and Board views.
- Configurable folder discovery, archive and restore.
- The full 0.1.0 local desktop release and its remaining capabilities.

The Unreleased entries describe verified source changes, not a published release. Planned items are not shipped functionality. Move verified changes into a dated version entry only when preparing an authorized release, following [the release policy](docs/releases.md).
