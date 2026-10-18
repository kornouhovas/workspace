# Issue 32 verification: Board columns and cards

Task base: `9458c3e8`. Current CI, exact-SHA acceptance and integration status are recorded in [GitHub #32](https://github.com/kornouhovas/workspace/issues/32). Contract and scenarios: [plan](../plans/issue-32-board-layout.md).

## Implemented and inspected

- Typed service persists per-view column widths by grouping property and canonical group identity, card field visibility and wrapping. Existing grouping order/hide/collapse/hide-empty remains view-owned; new groups append by the established grouping rules with a 384px default width.
- Option/category renames retain stable keys and widths. Category presentation remains dormant across discovery-mode changes. Duplicate settings copy then diverge; sibling and Table settings remain independent. Name stays visible for identity/recovery, and source definition controls remain available when card fields are hidden.
- Migration 0022 preserves populated views, active selection, filters/grouping, Table settings and exact values. Malformed payloads/references, wrong key types and out-of-range widths reject without writes or notifications. Saved malformed/semantically invalid settings require explicit reset; injected write failure retains the committed configuration.
- Shared presentation state and native slider controls retain Table behavior, pending/read/save errors, retry/reset, focus and delayed-response ownership. Card wrapping controls display only, including MultiSelect chips; editing remains available with wrapping disabled.

## Observed local evidence

Node 22.21.1 on macOS; real temporary SQLite and filesystem fixtures. No live user projects were used.

- Service persistence tracer: failed before the Board API existed, then passed after implementation.
- UI tracer: failed before Board controls existed, then passed in EN/RU.
- Review repair tracer: structurally valid saved unknown/wrong-type references returned success before repair; now return a visible storage error and accept explicit reset.
- `npm run test:migrations`: 637 passed, one conditional skip, zero failures after reconciling migration counts, schema inventories, packaging lists and populated old-schema fixtures.
- Focused Board service/UI, existing Table UI and production IPC: 15/15 passed after review repair.
- Typecheck, lint, documentation links and diff checks passed.
- Real Electron development `smoke:views`: EN/RU keyboard resize/order/hide/show/wrapping, unclipped Text editing, stable rename, new default width, independent duplicate, reload and 360/1024/1440px containment/scroll checks passed. Both wrap states include MultiSelect computed-style checks. Normal quit, backend exit and fixture cleanup passed. Visually inspected narrow English and wide Russian screenshots in local `work/issue-32-board-runtime-final`.
- Initial full inventory exposed the task's dependency-symlink Ladle 403 and three Table category-cell DOM regressions. Local dependencies replaced the symlink; category display wrapping is now restricted to Board. The original App/Ladle plus Board/Table UI files passed **100/100** after repair, without changing existing selectors/assertions.
- Renewed fresh-build `npm test`: **2936 passed, 4 failed, 25 conditional skips**. The failures are the three unchanged `property-editor-driver` native shutdown cases and the unchanged deferred `runtime-electron-quit` control. Their product assertions complete, but the strict ten-second normal-close deadline fails. These fixtures do not load Board/Table. The same files passed **4/4** when isolated on both this candidate and pristine base `9458c3e8`; the earlier issue-31 report retains a prior baseline reproduction of the same native boundary. Isolation does not identify the full-run shutdown cause. No timeout, normal-quit or cleanup assertion was relaxed; full remote platform/native acceptance remains required.
- Independent two-axis review: Standards 0 findings; Spec 0 remaining findings after the saved-reference repair and MultiSelect follow-up.

Full local inventory and cross-platform CI are acceptance gates tracked in GitHub, not implied by the focused results above. The ordinary CI platform suite discovers the new service/UI files automatically, and the existing dev/packaged `smoke:views` route now includes Board presentation scenarios on all three runners. No required platform, native assertion or deadline was removed. No new bb code, dependency or workflow selector was introduced.

## First remote candidate and scoped follow-up

Full run39113135361 on `058046b` passed common/static and all three platform test
suites. Windows latest then failed only the existing packaged Number runtime:
RU property-name input never appeared after raw focus/Enter on its creator.
Both dev/release Board JSON files retain successful EN/RU checks and cleanup.
The original failure is retained in GitHub; remaining first-run results and final
acceptance are tracked there.

A controlled delayed-disabled native Number creator reproduces that exact
missing-form pattern using the old direct focus/Enter, in both Number labels.
Restoring the existing enabled creator helper passes the same controls. Number
smoke now uses that helper; its 15-second caller deadline, keyboard entry,
assertions, data preservation, restart and normal closure are unchanged. No
product Number policy is modified. The historical artifact lacks a focus/readiness
timeline, so this is a reproduced failure pattern rather than unique-cause proof.
The focused Windows route is documented in [CI](../ci.md); focused original and
artifact acceptance precede any renewed full run on the same reviewed SHA.
