---
status: accepted
---

# Use SQLite and Drizzle for structured local data

The new implementation uses SQLite and Drizzle in a TypeScript backend for structured application data, including properties and views. This replaces the earlier any-store direction and reduces the need to translate bb's TypeScript/SQL modules across a Go persistence boundary while preserving flexibility for dynamic properties.

SQLite does not provide the shared-folder collaboration protocol. The TypeScript settings service now owns a device-local SQLite database and applies its initial schema migration. Schemas for the wider product domain remain to be designed and implemented; the synchronization boundary is recorded in [ADR-0002](0002-local-database-and-folder-exchange.md).
