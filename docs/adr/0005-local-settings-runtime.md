# ADR 0005: Local settings runtime and build

## Status

Accepted for the initial desktop settings slice.

## Decision

- Run the UI in an Electron main process and a React renderer built with Vite. Keep privileged APIs behind a narrow typed preload boundary.
- Run the TypeScript application backend in an Electron `utilityProcess`, communicating over Electron message ports. The backend owns domain rules and SQLite; it does not bind a network socket.
- Use Drizzle ORM with the `better-sqlite3` driver. Store ordered SQL migrations with the application and apply them when opening the backend database.
- Store normal application data below Electron's machine-local `userData` directory. Use a separate development subdirectory and disposable OS temporary directories for tests.
- Treat `package.json` version `0.1.0` as the sole product version. The build emits that version in `dist/version.json`; a smoke check compares it with the package version.
- Require Node.js `>=22.12.0` for development and CI. This satisfies the selected current Electron and Vite package engine requirements.
- Pin direct dependencies exactly and commit the npm lockfile. Package through electron-builder. Native modules are rebuilt for Electron and `better-sqlite3` is unpacked from ASAR; platform signing and distribution are outside this task.

## Rationale

Electron documents `utilityProcess` as a child process with Node.js and message-port support. This gives the backend a desktop-owned process boundary without adding a network listener. Drizzle supports `better-sqlite3` directly; it is a local synchronous SQLite driver and keeps the database in a device-local file. Electron's security guidance supports keeping the renderer sandboxed and exposing only purpose-built preload methods. electron-builder documents native-module rebuilding and ASAR unpacking for packages such as `better-sqlite3`.

## Version snapshot

Direct dependency versions selected from npm package metadata on 2026-10-09:

| Package | Version |
| --- | --- |
| Electron | 44.7.0 |
| React / React DOM | 19.3.0 |
| Vite | 8.3.4 |
| `@vitejs/plugin-react` | 6.1.2 |
| Drizzle ORM | 0.45.4 |
| `better-sqlite3` | 13.0.3 |
| electron-builder | 26.17.0 |

The npm `engines` metadata for Electron 44 and Vite 8 requires Node `^22.12.0` or newer supported releases. The committed lockfile is the reproducible resolution record for all direct and transitive dependencies.

## Consequences

- The desktop process must own backend startup, readiness, failures, and shutdown. The settings command contract and message protocol are implemented in the following tasks.
- `better-sqlite3` is a native module. Development and packaging must rebuild it against the selected Electron runtime, and packaged files must retain the native binary outside ASAR.
- CI and contributor environments need Node 22.12 or newer.
- Development data cannot reuse the normal user data directory, and tests must never use the developer's real application data.

## References

- [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Drizzle ORM with SQLite](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
- [Vite guide](https://vite.dev/guide/)
- [React `createRoot`](https://react.dev/reference/react-dom/client)
- [electron-builder v26 contents and native modules](https://www.electron.build/v26/docs/contents/)
- [electron-builder v26 troubleshooting](https://www.electron.build/v26/docs/troubleshooting/)
