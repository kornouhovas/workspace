# Issue 49 workspace management verification

Scope, baseline and inherited-scenario migration are recorded in the
[plan](../plans/issue-49-workspace-management.md). Current CI/integration and
human/platform acceptance belong to [issue #49](https://github.com/kornouhovas/workspace/issues/49).

## Local candidate evidence

- Node 22.21.1 fresh build completed. The initial ambient Node 26 build was rejected by the existing native version guard; verification subsequently uses the pinned runtime.
- Typecheck, lint, documentation links and diff whitespace checks passed before review.
- The renderer suite passed 98 scenarios before the final contextual-management additions. Focused creation, source-postponement, contextual Settings/Rename/removal and keyboard/focus regressions passed during implementation. Final counts follow review/final verification.
- The combined renderer/public-workspace-service/native-driver run had 161 passes and eight failures, all at normal Electron shutdown in the property-editor fixtures. No ownership, SQLite, filesystem or interaction assertion was weakened.
- CI routing/inventory regression suites: 66 passed, including retention of the existing ordinary platform routes plus the new workspace-management journey.
- The new real-Electron journey produced 24 screenshots of setup/context/detail in EN/RU, light/dark, at 1024x720 and 1440x960. Inspection found controls within bounds, readable authored paths and keyboard focus; a shared source-control gap was added after inspection.
- Native cancellation, automatic name/default Table, postponement/cancellation, configured-source reuse and sidebar rename/reorder reached their assertions. The journey then failed its unchanged ten-second normal shutdown before restart/removal acceptance; those gates remain pending, even though owned forced cleanup succeeded.

## Native failure diagnosis

`node --import tsx --test --test-name-pattern='installed workspace keyboard driver retains|Create Number property$' tests/property-editor-driver.test.mjs`
reproduced the same normal-shutdown timeout on unchanged `new-workspace` baseline
`afb09294` (two failures). Finite receipts observed before-quit, will-quit, quit,
Node exit and page close, then forced parent termination at the existing deadline.
This excludes the new workspace controls as a necessary trigger and agrees with
the retained [#48 local diagnosis](issue-48-desktop-shell.md#local-shutdown-diagnosis).
It does not establish the underlying native cause or satisfy normal-shutdown acceptance.

The first new smoke attempt also exposed incorrect authored English/Russian
button locators; these were corrected to the current translated UI contract.
No product deadline or shutdown behavior was changed.

## Test migration and routes

The creation-name prompt and its renderer blank-name check are superseded by
picker-triggered standard naming. Rename validation is retained after creation.
The install/runtime driver creates first and then uses the public Rename settings
journey for authored fixture names; its asynchronous picker/deadline regressions
remain. Final-removal focus now targets the picker button. Existing service,
SQLite, discovery, recovery, IPC, native and independent-view scenarios remain in
the inherited test tree. No historical suite was imported.

`npm run smoke:workspaces` adds the issue's disposable real-Electron journey to
the existing ordinary macOS/Windows latest/Windows 2022 CI matrix, retaining
exact-SHA reports/screenshots and cleanup evidence. Other inherited routes remain
registered. Build artifacts are produced and consumed sequentially.

## Review repairs

Independent Standards review found no issues. Spec review found an own-event
activation race: a real `workspace.listChanged` precedes its successful reply,
but the contextual routing treated that event as superseding selection. The
renderer regression with valid UUIDs reproduces the missing editor before the
repair and passes afterward. Contextual activation now accepts the authoritative
matching selection within the same backend lifetime, while existing removal/
superseded-selection regression checks remain. The native journey now exercises
both Settings and Rename against an inactive workspace.

Review preparation also scopes authored root-path waits to visible content,
because the same path is retained in hidden settings sections. No ownership or
native assertions were removed.
