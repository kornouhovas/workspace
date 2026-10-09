# Changelog

User-facing changes are maintained in English. The first target release is 0.1.0; no release has been published from this branch.

## Unreleased

### Added

- A launchable local desktop settings screen with English and Russian interface languages.
- A separate local TypeScript backend and SQLite persistence for the selected interface language, including English as the first-launch default.
- Named workspaces rooted at accessible folders, each with a persisted default Table view and active selection that restores after restart.
- A localized Table screen and saved-workspace selector, with distinct unconfigured, applied-empty and retained-metadata states.
- Development packaging configuration and macOS/Windows CI artifact checks for the desktop application.
- Rename, persistent ordering and safe removal of workspace configurations, retaining source metadata and project files even after the final configuration is removed.
- Shared-source availability notifications and an English/Russian retry-folder-access action, with deterministic selection after removal.
- Read-only previews of immediate child project folders, editable source-owned exclusions and explicit Apply to the default Table in English and Russian.
- Persistent opaque project IDs with conservative same-path/native-evidence matching; excluded, missing, replaced and uncertain records retain metadata without writing markers or modifying project content.
- Shared applied projects and exclusions across sibling configurations, committed revision notifications, stale-preview rejection and recovery that requires another explicit Apply.
- Automatic exclusions for symbolic links/junctions, dot-prefixed folders, Windows service folders and persisted designated archives; ordinary undesignated Archive folders remain eligible.
- Integrated development/packaged Electron scenarios and Ladle states for discovery, cancellation, stale review, source unavailability, retained metadata and long EN/RU layouts.
- Source-owned Text definitions with stable IDs, creation and rename in the default Table; immutable type and source ownership enforced by the service.
- Exact authored Text values, including Unicode, whitespace, line breaks and stored empty strings; explicit Clear removes the value rather than storing empty text.
- English/Russian keyboard cell editing, Save/Clear/Cancel, recoverable failed drafts and sibling-change notices with committed revision guards.
- Migration 0005, baseline upgrade/reopen and transactional rollback regressions, production property events, and permanent Text runtime/Ladle workflows.

### Fixed

- Malformed desktop requests are rejected without stopping the local workspace service.
- Saved workspace folder aliases retain source, workspace and view identities when their canonical path spelling changes.
- Same-source availability and locator notifications preserve Text drafts while resetting discovery review for the changed folder state.
- Backend restart discards obsolete source availability observations while preserving newer current-generation events over delayed reloads.

### Planned

- Other property types and definition deletion/hiding/reordering; filtering/grouping/dragging and Board/general view management.
- Grouped folder discovery, external reconciliation/reassociation, archive and restore.
- The full 0.1.0 local desktop release and its remaining capabilities.

The Unreleased entries describe verified source changes, not a published release. Planned items are not shipped functionality. Move verified changes into a dated version entry only when preparing an authorized release, following [the release policy](docs/releases.md).

Physical macOS27 native Electron shutdown #44 remains an unresolved final-release blocker. Local pre-quit feature evidence does not establish application restart or Windows acceptance; observed platform results and skipped scenarios are recorded with the execution evidence.
