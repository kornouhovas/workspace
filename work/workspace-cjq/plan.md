# Table grouping implementation plan

Goal: one-level property grouping for Table, scoped to each existing view.
Architecture: a pure domain module normalizes grouping, computes memberships and counts from backend projects; existing JSON/Go adapters retain the additive view field. React renders domain groups and submits complete grouping settings through updateView. No new storage or dependency.
Spec: [saved task](spec.json); [reference](reference.png).

- [x] Domain red/green: normalization, typed keys, all property types, catalog/manual/value ordering, empty-last, filtered unique counts, hidden/collapsed states and deletion recovery.
- [x] Contract persistence: backend projection receives full property catalog; duplicate copies configuration; JSON/Go preserve it; deleted property disables and retains a notice, deleted category references are pruned.
- [x] UI: Group menu with separate Group by and Sort controls, visibility/hide-empty/manual controls; compact accessible section headers in shared table, existing cells and column layout.
- [x] Verification: targeted tests then complete cross-layer gates; isolated real Electron scenarios and full-resolution visual matrix, persistence and keyboard interactions.
- [x] Root integrated review accepted; scoped local commit completed after authorization.

Review focus: zero versus empty; exact whitespace/case text; duplicate multi-select values; hidden grouping columns; deleted properties and category references; late mutations and view isolation.
