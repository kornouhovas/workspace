# Issue 20: category folder options verification

Scope: [GitHub #20](https://github.com/kornouhovas/workspace/issues/20), [plan](../plans/issue-20-category-options.md). Executor: Matt Pocock; no Ralphex run.

## Accepted refinements

The owner accepted persistent empty category folders, separate explicit association of eligible existing folders after reviewing projects, and workspace-owned color/hidden/order presentation. Folder identity and folder names remain source-owned. The owner confirmed that the public repository is intentional for GitHub Actions and authorized continued use.

## Local evidence

- Node 22.21.1, disposable real SQLite and filesystem service fixtures in `tests/category-options-service.test.mjs`: preview without mutation; create/reopen empty categories; reviewed association; category rename retaining category/project IDs, exact Text and file bytes; sibling visibility; separate workspace presentation; native occupied insertion; invalid names/extra fields/ownership; changed/replaced/restarted reviews; destination replacement; normalized storage failures.
- Actual child-process exit fixtures at committed intent, native rename effect and destination evidence: startup and reads do not replay; conflicting discovery/creation reject; an authorized sibling explicitly keeps the original or completes the verified destination. Missing/replaced identity is not adopted.
- EN/RU UI tests in `tests/category-options-ui.test.tsx`: physical-effect preview, keyboard Escape cancellation and single explicit Apply through the typed client.
- `scripts/smoke-category-options.mjs dev` on macOS: production Electron/preload/utilityProcess/native service, EN/RU UI rename/cancel/Apply, exact identity/Text/file retention, workspace presentation isolation, four preview captures at 1440×960 and 1024×720, exact IPC rejection of caller paths, restart persistence, normal quit/backend exit and owned-fixture cleanup. Captures visually inspected. Evidence: `work/issue-20-category-options-runtime/evidence.json` (local, generated, not source).

The existing migration assertions advance from 11 to 12 migrations; preserved source/project/value/view checks remain intact. The additional journal is append-only; terminal receipts and immutable request bindings are protected by SQLite triggers. Cross-command operation IDs cannot be reused.

## Remaining delivery gates

Full local suite: 2623 passed, zero failed, 20 existing platform skips. The final focused category service/UI run passed all 28 checks, including persisted order and keyboard ordering. Lint, typecheck, docs links and diff checks passed. Standards and Spec reviews reported zero findings on the frozen implementation and final policy-guard delta.

Final macOS arm64 development **and packaged** runtime routes each passed nine checks, including actual UI creation and association as well as rename, presentation, IPC validation and restart. Both routes verified normal quit, backend exit and fixture cleanup; artifact resources were checked. Generated evidence: `work/issue-20-dev-final/evidence.json` and `work/issue-20-release-final/evidence.json`.

Final commit, exact-SHA macOS/Windows Actions and integration verification remain pending. Local macOS evidence does not prove Windows acceptance. No release or merge to `main` is authorized by this issue.
