# Issue 49: Sidebar workspace management

Origin: [#49](https://github.com/kornouhovas/workspace/issues/49), parent #47.
Baseline: `afb09294` on `new-workspace`; blocker #48 is closed and no prior owner/checkpoint exists.
Branch: `codex/issue-49-workspace-management`.

## Scope and scenarios

- Folder selection creates `Workspace` immediately with the existing default Table. Picker cancellation creates nothing; picker/create failures remain actionable without leaking diagnostics. Duplicate names retain separate IDs.
- Configured source reuse preserves interpretation, projects and values; workspace views remain independent. Unconfigured sources offer preview/exclusions/Apply and Set up later; cancellation/postponement retains the saved workspace and the setup entry point.
- Sidebar contextual controls route Settings/Rename/Remove to the appropriate workspace; ordering has keyboard buttons. Existing settings management remains available, including cancellation, pending/error/retry and focus recovery.
- Removal retains files/source metadata after the last reference and chooses a valid remaining workspace or empty creation state.
- Exercise EN/RU keyboard interactions and inspect 1024x720 and 1440x960 in light/dark. Native picker and persistence use disposable Electron data.

## Inherited scenario migration inventory (before edits)

- Retain public service, real SQLite/filesystem, discovery, recovery, isolation, view ownership and native checks unchanged unless their UI entry locators change.
- Adapt `renderer-app.test.tsx` creation scenarios: replace the superseded pre-creation name field/blank-name validation with automatic-name creation, cancellation, pending/error and distinct-ID assertions. Retain post-creation rename validation and all management/discovery race assertions.
- Adapt runtime/install creation drivers to create automatically, then rename through settings when a fixture needs an authored name. Retain their original ownership, persistence, native and shutdown assertions.
- Adapt final-removal focus checks to the folder-picker button replacing the retired name input.
- Add focused sidebar contextual routing and postponed/cancelled setup scenarios to the inherited renderer suite. Test seams are specified by #49: typed service, renderer interactions, real Electron/platform routes.

## Verification and delivery

Run focused scenarios while implementing, typecheck regularly, review against this baseline and #49, then run the required full suite on the finished candidate. Record actual results in a versioned verification report. CI and human/platform gates remain in the [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/49).

## Test-only acceptance renewal

The owner authorized the evidence reuse policy in `docs/ci.md` after reviewing repeated full CI on 2026-10-20. Apply it to follow-up repairs; retain every current required scenario and platform under the [inherited coverage policy](../development.md#inherited-test-coverage). This preserves accepted guarantees rather than every historical test; retirement requires the recorded superseding contract or equivalent replacement coverage.

For `99584863` to `14bcb4cf`, the changed paths are the Single Select smoke driver, readiness/routing tests, the focused desktop workflow and documentation. Application/package inputs are unchanged. Run `39384877475` supplies the repaired Windows latest packaged Select receipt; the issue checkpoint records its inspected artifacts. Other affected Select modes/platforms still require candidate evidence or an explicit consumer analysis.

Full run `39381220528` contains successful common/platform and native workspace/shell evidence, but its Windows latest packaged Select failure skipped downstream Date, Number, archive, recovery, category, creation and main runtime steps. These are missing coverage, not inherited passes. Existing run `39385354293` is supplying current candidate coverage; inspect its remaining results and artifacts rather than cancelling it as redundant. Any new failure enters the revised loop. Keep the live acceptance ledger and delivery decision in the GitHub checkpoint; this policy update alone does not close #49.
