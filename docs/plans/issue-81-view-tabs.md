# Issue 81: Saved-view creation and ordering

Base: `199b81e9` (`new-workspace`). Tracker: [GitHub #81](https://github.com/kornouhovas/workspace/issues/81).

## Scope and scenarios

- The new-view menu creates and activates a Board or Table with the default name; repeated names are allowed. Retain explicit rename and independent duplication.
- Each saved tab exposes its own context actions. The active-view menu provides a keyboard-accessible path; keep deletion confirmation, last-view protection and error feedback.
- A pointer gesture moves the selected tab horizontally and shifts adjacent tabs; Escape and pointer cancellation leave the collection unchanged. Menu ordering uses the same persisted service command. Selecting a tab and dragging an inactive tab must not alter another workspace or project-tab ownership.
- Existing grouping, filtering, active-view fallback, session context and settings persist independently across views and restarts. Use real disposable SQLite and fixture roots for service and Electron checks.
- Inspect focus, popup bounds and changed appearance in EN/RU, both themes and 1024×720/1440×960. Record native host, result and retained limitations separately from behavior.

## Coverage and delivery

Adapt `views-ui.test.tsx` and `smoke-views.mjs` from the superseded name-first creation to type-first creation while retaining lifecycle, edit, duplicate, cancellation, ownership and error assertions. Retain `views-service.test.mjs` and `view-actions-native.test.mjs` for storage, restart, isolation and focus. Add checks for in-progress pointer movement, vertical constraint and cancellation, and loading continuity. The move, rename and recovery mock clients supply the existing default layout responses, retaining their original assertions. The service, IPC and database contracts are unchanged.

Run focused tests during development, inspect the real Electron flows, complete review, then run the full suite on the final candidate. Select `desktop-ci.yml` with `checks: desktop-ux` and `desktop_ux_profile: navigation` for macOS and Windows scoped acceptance, and inspect actual artifacts and results. The task's GitHub checkpoint owns CI, acceptance, integration and the delivered SHA; passing local checks alone does not close the issue.
