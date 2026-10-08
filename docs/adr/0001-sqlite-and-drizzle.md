---
status: accepted
---

# Use SQLite and Drizzle for structured local data

The new implementation uses SQLite and Drizzle in a TypeScript backend for structured application data, including properties and views. This replaces the earlier any-store direction and reduces the need to translate bb's TypeScript/SQL modules across a Go persistence boundary while preserving flexibility for dynamic properties.

SQLite does not provide the shared-folder collaboration protocol. Database ownership, migrations and schema details still need implementation; the synchronization boundary is recorded in [ADR-0002](0002-local-database-and-folder-exchange.md).
