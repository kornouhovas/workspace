# AGENTS.md

## Project Instructions

This file now documents only backend and local storage work.

Focus backend/local work on:

- Electron main process backend orchestration.
- Preload IPC contracts for backend operations.
- Workspace backend modules in `src/workspaceBackend.js`, `src/workspaceObjects.js`, `src/workspaceProperties.js`, and related services.
- The local `any-store` sidecar and SQLite-backed workspace storage.
- File-system safety, path validation, migration behavior, and local runtime behavior.

After each completed user-requested action that changes project files, run the relevant verification and create a git commit for that action unless the user explicitly asks not to commit.
