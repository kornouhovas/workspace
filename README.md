# Workspace

Workspace organizes real project folders through configurable views and properties. The current Electron desktop app supports settings and management of multiple workspace configurations, backed by a separate TypeScript service and SQLite.

**Current state:** a runnable local desktop app with English and Russian settings and workspace management. Users can select an accessible folder, create named workspaces with a default Table view, switch, rename, reorder and remove saved configurations, and reopen the active workspace after restart. Configurations over the same canonical root share a source and retain distinct Table views. Removal retains source metadata and external files, including after the last configuration is removed. An unavailable folder can be checked again with the localized retry action; source changes notify its referencing configurations. Workspace/source/view records are stored in device-local SQLite. Project discovery and editing, properties, Board views, archive/restore, collaboration and AI are not implemented in this slice. The previous implementation remains in Git history and on `codex/architecture-reference-docs`; importing its data is out of scope.

## Development

Use Node.js 22.12 or newer and npm. From a clean checkout, run `npm ci`, then `npm run dev` to build and launch the desktop app. The main checks are `npm test`, `npm run lint`, `npm run typecheck`, `npm run check:docs`, `npm run build`, `npm run build:ladle`, and `npm run smoke:runtime -- dev` for a real Electron launch. See [docs/development.md](docs/development.md) for artifact commands, data locations and implementation boundaries.

The standard application database lives at `userData/workspace.sqlite`; development uses `userData/development/workspace.sqlite`. Tests use temporary databases. Electron `utilityProcess` runs the local backend over message ports; it does not open a network listener. English is the default language, and the settings screen can save English or Russian for the next launch. A workspace stores a canonical folder association and its own active Table view; the current empty Table explains that project discovery is a later feature.

- [Product and preserved capabilities](docs/product.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Decisions and open questions](docs/decisions.md)
- [Development workflow and commands](docs/development.md)
- [Agent instructions](AGENTS.md)
- [Changelog](CHANGELOG.md)

The first target release is **0.1.0**, a local desktop application for macOS and Windows with English and Russian interfaces. Shared-folder collaboration, AI agents and remote access follow in later stages.

Workspace is inspired by the architecture and ideas of [bb](https://github.com/get-bb/bb). The settings UI adapts selected bb controls and styling; provenance and the applicable license notice are recorded in [the reuse policy](docs/reuse.md).
