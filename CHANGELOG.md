# Changelog

User-facing changes are maintained in English. The first target release is 0.1.0; no release has been published from this branch.

## Unreleased

- Edit workspace-local status colors from folder settings and Board/Table group tools; preserve independent same-name statuses and show updates across views.

- Reduce repeated discovery work and large Table/Board rendering, preserving
  offscreen drafts and keyboard access while fields load near the viewport.

- Add unsigned per-user Windows x64 NSIS packaging, installed-app restart and
  data-preservation checks, and installation/recovery guidance.

- Add a local macOS 14+ Apple Silicon DMG installation route, installed-app reopen/replacement checks and installation guidance. No release download is published.

### Added

- Keep ordinary Archive statuses active and offer separate reviewed archive
  configuration on first use, with existing configuration available in workspace
  settings. Status folders cannot be adopted as the special archive.

- Edit project status with path-disambiguated physical destinations and assign
  Table/Board status groups safely. No status, nested statuses and retained
  historical groups remain visible with unavailable destination explanations.

- Manage saved Table/Board views through keyboard-accessible tabs and contextual
  actions, with independent duplication and final-view protection. Find projects
  through toolbar search and a typed-filter popover with saved per-view settings.

- Inspect shared sources and their workspace relationships in Sources settings;
  review discovery and archive configuration independently, with source refresh
  and retained metadata when folders are excluded or unavailable.

- Create automatically named workspaces from the sidebar folder picker, each with
  its own default Table; reuse configured sources or postpone setup and return later.
- Rename, reorder and remove workspaces through sidebar controls and matching
  settings, preserving project files and retained source metadata after removal.

- Open saved workspaces in a viewport-bound desktop shell with an independently
  scrolling sidebar, categorized settings, keyboard return to work, and persisted
  English/Russian and Light/Dark/System appearance preferences.

- Review and delete custom properties or clear/reassign ordinary Select options across source workspaces, with atomic cleanup of saved Table/Board filters, grouping and presentation references.

- Rename project folders by dragging between Name groups, or move them between folder-backed category groups in Board and Table, preserving identity and metadata with safe conflict handling and existing recovery.

- Per-view Board column widths, card property visibility and content wrapping, with keyboard controls and independent duplicate settings.

- Per-view Table column visibility/order/widths, Text wrapping and manual project row order, with keyboard controls and dedicated row dragging.

- Single Select, MultiSelect and folder-category grouping in Board and Table, with saved group ordering/visibility and consistent edits across every occurrence of a project.
- Uncategorized retained projects remain accessible in a No value recovery group after a discovery-mode change.

- Source-owned calendar Date properties with English/Russian keyboard editing, validation and clearing; intended days survive restart, language and timezone changes, including years 0001–9999.

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

- Reviewed grouped discovery at exactly Root/Category/Project, with visible persisted empty categories and explicit interpretation of direct-looking root folders.
- Required read-only folder-backed category values in Table, stable source-owned category/property IDs and both-level safe exclusions; direct Tables expose no category property.
- Metadata-only category-property label rename with EN/RU keyboard controls, exact authored labels, sibling notifications, independent revision guards and retained drafts.
- Migration 0006 upgrade/rollback/reopen regressions and permanent grouped/category-label Ladle and production Electron scenarios.

- Accessible retained missing, unresolved, replaced and excluded project rows with editable Text and source-level unavailable/unreadable/root-conflict feedback.
- Explicit English/Russian Locate folder, target review and metadata-only Reassociate for direct and grouped projects, preserving logical IDs and exact Text through restart and source reuse.
- Service-validated source-contained recovery with reserved-path/native-identity conflicts, atomic new-category insertion, stale review refresh and uncertain-outcome reload without command replay.
- Preserved Text/category-label drafts across recovery and source refresh, populated-baseline regressions and permanent recovery Electron/Ladle scenarios.

- External direct/grouped project and category reconciliation through Refresh source, bounded backend folder notifications and startup rescanning, preserving logical IDs, exact Text/category labels and independent workspace views.
- Atomic creation of only genuinely new eligible categories needed by uniquely matched known-project moves; unrelated folders remain explicit discovery choices and conflicting existing categories retain recovery.
- English/Russian keyboard Refresh with pending/error/degraded guidance, current startup observation delivery and preserved Text/category-label drafts across external changes.
- Conservative unique native-evidence matching, bounded watcher cleanup and service/runtime regressions for notification-driven and shutdown-missed changes without folder markers or project-content scanning.

- Reviewed configured-source switching between Root/Project and Root/Category/Project, with EN/RU project effects, category availability, effective/inactive exclusions and explicit Apply/Cancel.
- Retained mode-change project history with editable exact Text and explicit target-depth reassociation; previous-mode return preserves reservations without silently reactivating projects or transferring values between folder roles.
- Preserved dormant category/property IDs, authored labels, hidden drafts, settings, archive designation and independent views through mode changes, restart and source reuse; populated migration 0007 and delivery-artifact regressions.

- English/Russian project creation in an applied direct root or chosen existing active grouped category, with authored names, fresh logical IDs and shared-source updates.
- Durable migration 0008 creation journal and visible interrupted operations, explicit reviewed recovery and same-operation receipt reconciliation without duplicate folders/IDs or inherited Text.
- Per-project file-manager-directed native Reveal, including directory packages, through trusted backend/main validation with localized pending, missing/unavailable, retained and dispatch acknowledgment feedback.
- Real process-crash, production IPC, EN/RU retry and graphical/package regressions; documented filesystem/native race and process-interruption durability limits.
- A bounded Windows Reveal adapter with fixed shipped resources, one ready-parent navigation and one selection after fresh backend and filesystem authorization; exact-code Windows platform acceptance remains pending.

### Fixed

- Healthy source observations preserve pending folder-reassociation confirmations while refreshing newer placement; source disconnects still reject obsolete responses.
- Windows grouped-source observation uses root notifications and bounded five-second validated scans without holding category watch handles during external parent moves.
- Malformed desktop requests are rejected without stopping the local workspace service.
- Saved workspace folder aliases retain source, workspace and view identities when their canonical path spelling changes.
- Same-source availability and locator notifications preserve Text drafts while resetting discovery review for the changed folder state.
- Backend restart discards obsolete source availability observations while preserving newer current-generation events over delayed reloads.

- Active category/child external renames remain reconcilable after a reviewed project-to-category role change while dormant direct-project identity and values stay retained.

- Completed creation receipts no longer reserve vacated old paths after verified external moves or explicit reassociation; original receipt retries remain idempotent.
- An undelivered creation request can be explicitly retried with its exact original payload and operation ID after transport loss, without automatic replay or permanently locked editing.
- Unicode case aliases retain interrupted-creation and historical destination reservations, preventing discovery from assigning a second project ID after an alias rename.

- Immediate Reveal after creation preserves localized dispatch acknowledgment when active observation reloads the unchanged authorized project, with stale target/selection/backend responses still rejected.

- Confirmed project creation remains visible when interrupted-operation loading fails; list errors are shown independently and clear after a fresh successful reload.

### Planned

- Remaining property and view-layout controls, including definition deletion/hiding/reordering.
- The full 0.1.0 local desktop release and its remaining capabilities.

The Unreleased entries describe verified source changes, not a published release. Planned items are not shipped functionality. Move verified changes into a dated version entry only when preparing an authorized release, following [the release policy](docs/releases.md).

Physical macOS27 native Electron shutdown #44 remains an unresolved final-release blocker. Local pre-quit feature evidence does not establish application restart or Windows acceptance; observed platform results and skipped scenarios are recorded with the execution evidence.
