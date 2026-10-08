# Workspace

Workspace organizes real project folders through configurable views and properties. This branch establishes a new implementation using SQLite, Drizzle and selected bb architecture and UI foundations.

**Current state:** product discovery and development foundation. There is no runnable application on this branch yet. The previous implementation remains in Git history and on `codex/architecture-reference-docs`. New development starts with clean application data; importing the previous application's data is out of scope.

- [Product and preserved capabilities](docs/product.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Decisions and open questions](docs/decisions.md)
- [Development instructions](AGENTS.md)
- [Changelog](CHANGELOG.md)

The first target release is **0.1.0**, a local desktop application for macOS and Windows with English and Russian interfaces. Shared-folder collaboration, AI agents and remote access follow in later stages.

Workspace is inspired by the architecture and ideas of [bb](https://github.com/get-bb/bb). Selected code may be adapted under its applicable licenses, with attribution recorded in [the reuse policy](docs/reuse.md). This foundation introduces no copied bb implementation code.
