# Workspace

Workspace organizes real project folders through configurable views and properties. The current Electron desktop app supports settings, workspace management, reviewed direct/grouped discovery, explicit folder recovery and shared Text properties, backed by a separate TypeScript service and SQLite.

**Current state:** a runnable local desktop app with English and Russian settings, workspace management and direct/grouped discovery. Users choose Root/Project or exactly Root/Category/Project for an unconfigured source, edit manual exclusions and explicitly apply the reviewed project names to the default Table. Exclusions and opaque logical project IDs survive unchanged rescans and restart. Configurations over the same canonical root share applied projects and exclusions, retain distinct Table views and receive source-scoped notifications. Removal retains source/project metadata and external files, including after the last configuration is removed; a new configuration over that source reuses the saved projection. Unavailable sources retain their projection and expose a retry action. SQLite is device-local; discovery writes no marker files or project content.

Discovery excludes links/junctions, dot-prefixed folders, the Windows service directories $RECYCLE.BIN and System Volume Information (case-insensitive), and any persisted designated archive-containing child. An ordinary undesignated Archive folder remains eligible. Files are ignored and project contents are never scanned. Grouped mode treats every immediate root folder as a category, including direct-looking projects; only its immediate child folders become projects. Empty categories remain visible and persist after Apply. Apply rejects observed filesystem/configuration changes and requires another reviewed Apply. Matching uses the same relative path under the verified root with unchanged sufficient native identity evidence; uncertain/missing records retain metadata and offer explicit recovery without automatic reassociation. Identity evidence and repeated validation are not a filesystem lock or a guarantee against indistinguishable native identifier reuse.

The default Table supports creating and renaming source-owned Text definitions and editing project values. Names and values preserve authored Unicode, whitespace and line breaks. An empty string is stored and shown as Empty text; Clear removes the value and shows No value. Sibling configurations share definitions/values while retaining independent view IDs; other sources remain isolated. Enter opens a cell, Enter in its textarea adds a line, Ctrl/Cmd+Enter saves and Escape cancels. Save, Clear and Cancel also have explicit buttons. Failed saves retain drafts, and same-field sibling changes show a notice without replacing unsaved text.

Text and required read-only folder-backed category values are implemented. Other ordinary property types, definition deletion/hiding/reordering, project folder edits, filtering/grouping/dragging, Board/general view management, configured-source mode switching, physical category editing, external reconciliation, archive/restore, collaboration and AI remain future work. The previous implementation remains in Git history and on `codex/architecture-reference-docs`; importing its data is out of scope.

## Development

Use Node.js 22.12 or newer and npm. From a clean checkout, run `npm ci`, then `npm run dev` to build and launch the desktop app. The main checks are `npm test`, `npm run lint`, `npm run typecheck`, `npm run check:docs`, `npm run build`, `npm run build:ladle`, and `npm run smoke:runtime -- dev` for a real Electron launch. See [docs/development.md](docs/development.md) for artifact commands, data locations and implementation boundaries.

The standard application database lives at `userData/workspace.sqlite`; development uses `userData/development/workspace.sqlite`. Tests use temporary databases. Electron `utilityProcess` runs the local backend over message ports; it does not open a network listener. English is the default language, and the settings screen can save English or Russian for the next launch. A workspace stores a canonical folder association and its own active Table view; the Table shows applied project names, Text columns, required grouped category values and editable retained rows with distinct excluded, missing, unresolved and replaced explanations.

- [Product and preserved capabilities](docs/product.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Decisions and open questions](docs/decisions.md)
- [Development workflow and commands](docs/development.md)
- [Agent instructions](AGENTS.md)
- [Changelog](CHANGELOG.md)

The first target release is **0.1.0**, a local desktop application for macOS and Windows with English and Russian interfaces. Shared-folder collaboration, AI agents and remote access follow in later stages.

Workspace is inspired by the architecture and ideas of [bb](https://github.com/get-bb/bb). The settings UI adapts selected bb controls and styling; provenance and the applicable license notice are recorded in [the reuse policy](docs/reuse.md).

Text schema migration 0005 preserves existing settings, discovery, logical project IDs and independent views. Real temporary SQLite/filesystem and production IPC tests cover upgrade, rollback, exact values, source ownership and service reopen. Ladle fixtures and permanent runtime smoke scenarios cover EN/RU Text workflows; presentation fixtures do not establish persistence. Physical macOS27 native Electron shutdown issue #44 remains unresolved and blocks final release. Failed quit evidence and any restart scenarios not reached must be reported separately from pre-quit feature checks. Windows runtime/package acceptance requires observed Windows evidence from the coordinator.

Grouped schema migration 0006 preserves prior settings, projects, Text data and views. Category IDs and the category-property ID belong to the source. The column label can be renamed in English or Russian with keyboard controls; this changes metadata only, preserving authored spelling/whitespace and leaving folder names and project values unchanged. A null label displays localized Category/Категория. Siblings share label changes, while discovery and Text revisions remain independent. Direct Tables expose no category property. Local verification and pending platform gates are recorded in [the grouped verification report](docs/verification/issue-13-grouped-discovery.md).

## Locate a missing project folder

Retained projects keep their logical IDs and editable Text values. A complete scan can show an individual folder as missing, unresolved or replaced before discovery Apply. If the whole source is unavailable, unreadable or has conflicting root identity, Workspace shows source feedback once and retains the saved rows; it does not label all projects missing. Restore access to the original root and use Retry folder access. Moving a whole source to another root is outside this flow.

Choose Locate folder on a missing, unresolved or replaced row. Select a directory from the service-validated source-relative list, review the project, previous path, target path and category, then choose Reassociate. Selection and Cancel write nothing. Recovery does not require discovery Apply and changes only the database association: the same project ID and exact Text values survive restart. No project files are moved, created, renamed, merged or overwritten. Excluded rows use discovery exclusions for reinclusion; continuously valid active projects have no recovery action.

Direct targets must be Root/Project; grouped targets must be Root/Category/Project. Links/junctions, hidden/service folders, excluded paths and designated archive paths are unavailable. Another non-replaced record reserves its path, and conflicting current native identity evidence blocks selection. Historical replaced evidence alone does not establish live ownership. Grouped recovery reuses a continuously verified active category or atomically creates a genuinely new category. An existing missing, unresolved, excluded or conflicting category cannot be repaired through project recovery; choose another eligible category.

A changed review returns stale_preview: use Refresh, select the target again and explicitly confirm. If the service connection is lost after submission, the outcome is uncertain; Workspace reloads committed state without replaying the command or claiming success. Text and category-label drafts survive same-source refresh and recovery. Filesystem observations provide no lock: later changes and indistinguishable native identity reuse remain possible. Automatic reconciliation/watchers and configured-source mode switching remain future work.

See [folder recovery verification](docs/verification/issue-14-folder-recovery.md) for local evidence and remaining platform gates.
