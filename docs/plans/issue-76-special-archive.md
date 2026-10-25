# Issue 76: separate special archive

Tracker: [#76](https://github.com/kornouhovas/workspace/issues/76).
Baseline: `676737a3`; branch: `codex/issue-76-special-archive`.
Matt Pocock implement; native/textual blockers #72/#74 are closed; no parent or
previous ownership checkpoint. Owner approved publication and both public TDD
seams: Workspace service with disposable SQLite/folders, and React/Electron flow.

## Scope and scenarios

| Requirement | Evidence selected |
| --- | --- |
| Ordinary Archive status stays active | Role-command public regression: active category/project UUIDs before and after review, restart, separate designation, archive and restore |
| First use selects a separate location | Contextual EN/RU UI regression and actual Electron action from active Table; review/Cancel has no command/effect |
| Explicit designation reused and configurable | Existing source settings archive editor; current null shown as unconfigured; configured native reopen skips setup |
| No guessed conversion/migration | Current role-aware filesystem status inspection plus saved project/category ownership veto; explicit reviewed designation; no schema/default/data rewrite |
| Identity, values and original recovery path | Role-command regression with Archive/cpp and exact Text; retained archive service/journal/durable/legacy/crash suites |
| Unavailable/wrong identity/interruption | Retained durable archive/location/crash/recovery tests; pending/unknown contextual UI guards retained |
| Appearance | Existing main composition and bb controls, no copied modules; EN/RU, light/dark, 1024x720 and 1440x960 actual Electron captures |
| Delivery | Type/lint/docs/build, full suite, independent Standards/Spec review; affected hosted platform/packaged routes before integration |

All affected inherited safety/recovery scenarios are retained. Existing explicit
archive configuration is reused as stored, regardless of its authored name.
Changing it remains reviewed and empty-only. The first-use designation review is
separate from project movement; confirming the location does not move a project.
Cancel before designation confirmation writes no metadata/files. After explicit
configuration, movement still needs its own review and Apply.

No release/main merge, live-data repair, schema/native adapter change or automatic
migration is included. GitHub owns current acceptance and delivery status.

Local checks, review findings and native evidence limits are recorded in the
[verification report](../verification/issue-76-special-archive.md).

## Accepted outcome

- [x] Ordinary Archive status remains active; first use configures a separate location.
- [x] Cancel/review has no mutation; configured reuse/settings and explicit empty-only changes remain.
- [x] Live un-enrolled status veto, late-arrival rejection and durable archive/restore safety pass.
- [x] Standards and Spec reviews have zero remaining findings.
- [x] Full candidate complements and failed-case renewals are inspected on all three supported CI hosts.
- [x] DEV/package first-use/settings, retained archive/restart and sampled appearance evidence pass.

Application candidate: `bb7701e6`. Accepted native/test renewal: `5e78d4b6`,
run40226779029/attempt1. The [verification report](../verification/issue-76-special-archive.md)
records exact receipts, unchanged-input reuse, local failures and separate release
limits. GitHub owns the integration/delivery checkpoint.
