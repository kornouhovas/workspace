# Workspace

Workspace organizes real project folders through configurable views and properties. The current application slice is an Electron desktop settings screen backed by a separate TypeScript service and SQLite.

**Current state:** a runnable local desktop settings slice with English and Russian interface languages. The language preference is stored in a device-local SQLite database. Project discovery, workspaces, properties, Board and Table views, archive/restore, collaboration and AI are not implemented in this slice. The previous implementation remains in Git history and on `codex/architecture-reference-docs`; importing its data is out of scope.

## Development

Use Node.js 22.12 or newer and npm. From a clean checkout, run `npm ci`, then `npm run dev` to build and launch the desktop app. The main checks are `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run build:ladle`. See [docs/development.md](docs/development.md) for artifact commands, data locations and implementation boundaries.

The standard application database lives at `userData/workspace.sqlite`; development uses `userData/development/workspace.sqlite`. Tests use temporary databases. Electron `utilityProcess` runs the local backend over message ports; it does not open a network listener. English is the default language, and the settings screen can save English or Russian for the next launch.

- [Product and preserved capabilities](docs/product.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Decisions and open questions](docs/decisions.md)
- [Development workflow and commands](docs/development.md)
- [Agent instructions](AGENTS.md)
- [Changelog](CHANGELOG.md)

The first target release is **0.1.0**, a local desktop application for macOS and Windows with English and Russian interfaces. Shared-folder collaboration, AI agents and remote access follow in later stages.

Workspace is inspired by the architecture and ideas of [bb](https://github.com/get-bb/bb). Selected code may be adapted under its applicable licenses, with attribution recorded in [the reuse policy](docs/reuse.md). This foundation introduces no copied bb implementation code.
