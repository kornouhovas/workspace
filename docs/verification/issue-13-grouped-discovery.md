# GitHub #13 grouped discovery verification

## Scope and fixture boundaries

Task 4 extends permanent regression fixtures for the implemented grouped discovery and metadata-only category-property rename. All runtime roots, SQLite databases and Electron user/session data are disposable. Production IPC and components are exercised; project file bytes/inventories are compared without writing application markers. The fixed diff base is d1a00f6df2820362bf205bde48869b6799dd9145.

The automated service suite covers populated migration 0000–0005 upgrade to 0006, rollback, category/project replacement, exclusions, ownership, independent revisions and reopen. Ladle complements this with EN/RU long-content states at 1440×960, 1024×720 and 420×800. Electron scenarios cover direct and grouped preview/cancel/Apply, stale explicit re-Apply, read-only category values, metadata-only label rename, sibling/unrelated-source isolation, settings, restart and retained-source reuse assertions.

## Actual local execution

Executed on 2026-10-09, macOS 27.0 (26A428), arm64, Node 22.21.1, Electron 44.7.0. Every Node/npm invocation used the explicit PATH prefix below. No coverage tooling, upstream module copying, live-user fixture, tracker mutation, push or release was introduced.

| Command (all npm/node commands prefixed as below) | Actual result | Log below work/ralphex/issue-13/evidence |
| --- | --- | --- |
| npm test | Exit 0; 213 passed, 0 failed/skipped; includes fresh production build | task-4-test-1.log |
| npm run lint | Exit 0, including the final layout-script change | task-4-lint-1.log, task-4-lint-final.log |
| npm run typecheck | Exit 0 | task-4-typecheck-1.log |
| npm run check:docs | Exit 0; initial and final documentation checks | task-4-docs-1.log, task-4-docs-final.log |
| git diff d1a00f6df2820362bf205bde48869b6799dd9145 --check | Exit 0 | task-4-diff-final.log |
| npm run build | Exit 0; fresh production output before Ladle | task-4-build-1.log |
| npm run build:ladle | Exit 0; fresh Ladle output | task-4-ladle-build-1.log |
| node scripts/smoke-discovery-layouts.mjs | Exit 0; 68 EN/RU states, 204 screenshots, three sizes; wrapping, bounded scrolling, keyboard recovery/focus and normal quit passed | task-4-ladle-run-1.log; ladle/ladle-observations.json |
| npm run smoke:runtime -- dev | Exit 0; feature, shutdown, restart, reuse and expected startup-failure assertions passed | task-4-dev-run-1.log; dev/dev-observations.json |
| CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:dev:mac | Exit 0; newly built unsigned macOS arm64 app and included artifact check | task-4-package-1.log |
| npm run check:artifact -- release | Exit 0; explicit check of that fresh artifact | task-4-artifact-1.log |
| npm run smoke:runtime -- release | Exit 1; feature/restart/reuse assertions passed; final startup-failure app shutdown timed out after 10000ms | task-4-package-run-1.log; package/release-observations.json |

The exact command prefix was PATH=/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin:$PATH. Local graphical commands used WORKSPACE_SMOKE_EVIDENCE_DIR=work/ralphex/issue-13/evidence/ladle, /dev or /package respectively. Packaging used CSC_IDENTITY_AUTO_DISCOVERY=false. Commands ran once in the planned order after the checkpoint and fresh builds; there was no retry of the observed shutdown failure. Electron's installed loader fetched its pinned binary on the first graphical launch; no Node download, dependency version change or global configuration change occurred.

Artifact identity: release/mac-arm64/Workspace.app, product version 0.1.0, Electron 44.7.0, arm64, unsigned. app.asar SHA-256: 8e46705976101662efb3b097d09d742e2a24f3028dc15df8b83c31f850115b9d (task-4-artifact-identity.txt). Both included and explicit artifact checks passed before this artifact was launched; no older package was substituted.

### Runtime stages and retained failure

| Stage | Development | Fresh packaged app |
| --- | --- | --- |
| Pre-quit direct/grouped features, EN/RU label rename, production notifications, isolation and unchanged bytes/inventories | Passed | Passed |
| Initial normal quit and backend exit within unchanged ten-second bound | Passed | Passed |
| Restart: settings, workspace/source/view IDs, grouped mode, category/property/project IDs and authored labels/Text | Passed | Passed |
| Subsequent removal, empty restart and retained direct/grouped source reuse | Passed | Passed |
| Second and third normal quits and backend exits | Passed | Passed |
| Expected startup-failure UI/backend-status assertions | Passed | Passed |
| Final quit after expected startup failure | Passed | Failed: Electron shutdown timed out after 10000ms |
| Backend-exit assertion after that final quit | Passed | Unreached because the quit threw |

The packaged process reached all feature, restart and source-reuse stages before the final shutdown failure. Its overall result remains failed. The existing lifecycle helper performed forced cleanup after timeout and rethrew the failure; forced cleanup is not a passing normal quit. runtime-lifecycle.mjs and its ten-second bound are unchanged. No blind retry or #44 resolution is claimed. Earlier coordinator #44 evidence remains untouched.

Ladle evidence contains 204 screenshots; development and packaged evidence each contain 78 EN/RU screenshots across 1440×960, 1024×720 and 420×800. Actual narrow RU category editing and applied grouped screens were visually inspected in addition to automated overflow/control assertions. Category-label fixtures cover default/authored, no projects, loading, editing, saving, validation, storage failure, sibling change, saved and newer-change states. The runtime fixture covers the child-then-parent exclusion repair and source retention through production IPC. The 213-test Task 4 checkpoint did not include the dedicated event-before-opening-editor regression for coordinator Finding 2; it was added during the review recorded below.

Logs/screenshots and JSON observations are retained in the ignored evidence directory. These execution-recording results do not establish final platform/product acceptance.

## Review iteration 0 verification

The five independent quality, implementation, testing, simplification and documentation reviews against the fixed base identified one shared verification gap: the permanent EN/RU Finding 2 regression was absent, and the report incorrectly attributed it to Task 4. The new test uses production App/components and WorkspaceServiceClient with disposable real SQLite/filesystem data. A sibling label commit publishes revision 2 while its list response is held pending; the user opens the editor from the rendered revision 1 label before the newer list resolves. Assertions verify that the old draft remains, the header shows the newer label, the sibling-change notice is present, discovery revision is unchanged and Escape restores focus.

With the current production code, the focused test passed. Temporarily restoring the original bug (using minimumRevision.current instead of the rendered revision as the draft baseline) made it fail on the missing sibling-change notice. The production file was restored unchanged and the focused test passed again. Logs: work/ralphex/issue-13/evidence/review-0/finding-2-targeted-{green,red,restored}.log.

After the test addition, the explicitly prefixed npm test completed a fresh production build and passed 214 tests with 0 failures/skips; npm run lint and npm run typecheck exited 0. Logs: work/ralphex/issue-13/evidence/review-0/{npm-test,lint,typecheck}-fixed.log. The historical 213-test and graphical results above retain their original attribution. No new Electron graphical, packaged shutdown or Windows run was performed in this review.

## Coordinator Finding 3 fixture repair

The subsequent five-perspective review confirmed only the loading/error fixture race already recorded by the coordinator. The initial loading heading can appear before the deferred project-list request installs its resolver, so the optional resolver call could silently do nothing. The EN/RU test now waits for and asserts resolver installation, invokes it explicitly, and awaits the error heading. Its loading, Retry, applied-empty, retained and unavailable assertions remain intact; production behavior and timeouts are unchanged. The original intermittent failure remains preserved in work/ralphex/issue-13/review-intermittent-ui-failure.txt.

The focused EN/RU test passed, followed by a fresh production build and all 214 tests (0 failures/skips), lint and typecheck. Documentation links and the full-base diff whitespace check also passed. Every Node/npm/tsx invocation used the explicit Node 22.21.1 PATH prefix. Logs: work/ralphex/issue-13/evidence/finding-3-review/{focused,npm-test,lint,typecheck,check-docs,diff-check}.log. No graphical, packaged shutdown or Windows check was rerun; exact-new-commit CI and final platform acceptance remain coordinator gates.

## Pending coordinator gates

Final review and resolution of confirmed in-scope findings, inspection/acceptance of local macOS evidence, actual Windows CI/runtime/package evidence, tracker updates and authorized integration remain coordinator responsibilities. Independent native macOS27 shutdown #44 retains its unchanged ten-second normal-quit bound and remains a final-release prerequisite. A successful local quit does not resolve it. Failed or unreached stages cannot establish product/platform acceptance; checked Task items record implementation and truthful execution reporting only.
