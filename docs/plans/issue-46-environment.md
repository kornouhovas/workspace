# Issue 46: Development environment improvements

Source: [Issue #46](https://github.com/kornouhovas/workspace/issues/46). Owner accepted four retrospective improvements and clarified that `new-workspace` owns instructions for its derived task checkouts. Baseline: `5ad279e9607cbc837cc3a5d633204e29fb6a2a6a`.

## Scope and acceptance

| Boundary | Required check |
| --- | --- |
| Compact acceptance CLI | Collect 16 mandatory reports/eight screenshots, require report-produced SHA/run/attempt/OS identity, hash exact inventory; validate offline; retain a failed diagnostic manifest when evidence is incomplete |
| Truthful outcomes | Reuse rename/move acceptance helpers; require runtime/layout/category checks, normal shutdown/backend exit and owned cleanup; only explicit recovery-only native skips and after-commit status reconciliation are accepted |
| Invalid evidence | Disposable CLI fixtures reject missing, failed, stale, corrupt, duplicate, unbound or unsafe-path evidence; expected skips are covered by reduced actual issue-21 report fixtures |
| CI wiring | Full matrix produces provenance and compact artifacts while retaining original complete artifacts and ordinary coverage; existing workflow-contract checks cover routing, early checks and shared Node pin |
| Fast workflow checks | `check:ci` runs existing routing/diagnostic checks before full local tests and in the common CI prerequisite job |
| Node setup | `.nvmrc`, npm engines and CI setup agree; install/build/test gate rejects unsupported versions with setup guidance |
| Navigation | New-workspace-derived work uses that checkout's AGENTS/source map. Historical root receives a scoped bootstrap pointer; unrelated historical work stays intact |

No product behavior, filesystem mutation policy, dependency versions or runtime deadlines change. Local historical-root pointer delivery is a separate scoped commit; the implementation branch integrates through `new-workspace` after checks. Complete runtime reports remain available for detailed diagnosis. SHA-bound manifests identify the run but are not a GitHub cryptographic attestation.

## Verification checkpoint

The CLI first failed against the absent implementation, then passed using reduced real issue-21 macOS reports. Invalid-evidence regressions cover the required failure classes. Before adding report-produced provenance, the collector also passed against the complete retained reports from all three issue-21 platforms. Those historical reports lack the new per-report provenance and cannot be presented as acceptance of this new gate; fresh full CI must validate actual producer wiring and compact artifact upload. GitHub owns current candidate/run/delivery status.

The first complete local run found one existing text-extracted runtime writer fixture missing the new provenance dependency. A minimal direct call reproduced the ReferenceError; the original focused test failed, then passed after injecting the real helper and asserting persisted provenance. All original failure/unreached assertions remain. Both review axes accepted this repair; the full suite is renewed using the unchanged verified build.

Final local verification after all review/fixture repairs: full `npm run test:all` passed 2,691 tests with zero failures and 21 existing platform/filesystem skips. It reused the unchanged build produced by the preceding full run. Fast routing checks passed 30 cases; tool/runtime-gate checks passed 31 cases; lint, typecheck, local links (122 files) and diff checks passed. Actual unsupported Node 20 was rejected before work. Both final review axes have no remaining findings. Fresh full matrix, compact artifact inspection and integration remain pending in the GitHub checkpoint.

## First full CI failure map

Run [38405916421](https://github.com/kornouhovas/workspace/actions/runs/38405916421), attempt 1, tested `e18af2a5986984744679ec98985c839194a8631d`. Common and the entire macOS job passed, including actual provenance collection and offline validation of its downloaded compact artifact (24 files). The macOS compact ZIP is 2,674,493 bytes versus 219,978,671 bytes for the retained complete evidence ZIP.

Windows latest passed platform tests but direct development creation/Reveal reported one parent Open and zero Select calls; its finite receipt rejected with readiness/deadline after about 10.94 seconds. Windows 2022's platform suite failed the original closed-service `stress_legacy` control: the single actual Node rename returned EPERM. The collector correctly rejected unreached reports on both jobs and uploaded failed manifests with available evidence. Those collection failures are consequences, not independent product causes.

The original evidence does not identify an individual OS handle or the missing readiness condition. A bounded diagnostic candidate retains the last allowlisted readiness binding stage privately and adds `checks: environment` for precisely the two original failing Windows commands plus relevant regressions and existing four-fixture idle/native/legacy/scan comparisons. It changes no command authorization, deadline or original success assertion. Local affected checks passed 89 cases with six Windows-only skips. Both diagnostic review axes found no findings. The existing strict legacy-stress acceptance remains in force; completed comparisons alone cannot satisfy it. GitHub owns focused results and subsequent gates.

## Second full CI failure map and reproduced repairs

Full [38421362760](https://github.com/kornouhovas/workspace/actions/runs/38421362760), attempt 1, tested `01323ddc2c7830c3e0261fb7cb1a71eaf07a7545` after inspected focused success [38420755726](https://github.com/kornouhovas/workspace/actions/runs/38420755726) on the same SHA. Windows 2022 fully passed and its downloaded compact archive independently validated all 24 files. All first-failure original commands passed in the focused run: one exact native Reveal dispatch/selection, strict legacy test and four successful legacy comparisons. Historical causes remain unestablished.

Two later release-runtime boundaries failed: macOS grouped rename Reveal returned from the actual native API, desktop replied dispatched, but service post-verification rejected unavailable; Windows latest category-move recovery hit the unchanged 10-second ordinary Electron shutdown limit, then confirmed forced cleanup. Failed compact archives retained the actual receipts and shutdown records. Forced cleanup is not acceptance.

A real SQLite/filesystem regression reproduces a hidden-file metadata update during post-native discovery, causing the same rejected/unavailable outcome with an unchanged target. The repair retries exactly one `changed` read-only scan, retaining every identity, policy, reservation and accessibility check. It never retries native dispatch. Persistent churn still rejects after two reads; replacement still rejects. The original CI did not retain scan state, so this reproduced mechanism is plausible, not definitive historical attribution.

The installed Playwright close implementation itself calls app.quit. The driver had requested app.quit and immediately started that second live quit path. A red ordering regression reproduces concurrent close before process exit. The repair waits for the owned normal main-process exit before Playwright channel disposal, inside the same total shutdown deadline. Backend termination remains independently checked. Timeout and forced cleanup remain failures. The Windows record alone cannot definitively prove this mechanism caused that particular timeout.

Focused Reveal/lifecycle checks passed 101 cases with zero failures/skips; routing, lint, typecheck, documentation and diff checks passed. Both repair review axes found no findings. `checks: packaged` retains the original production packaged rename boundary on macOS and packaged category-move boundary on Windows latest, with real package/resource prerequisites and regressions. GitHub tracks the candidate SHA, renewed local full result, focused evidence and later full gate.

After both packaged-boundary repairs and final reviews, the renewed full local suite passed 2,703 tests with zero failures and the same 21 expected platform/filesystem skips. It reused the fresh build produced for the service repair. GitHub tracks focused packaged execution before renewed full exact-SHA acceptance and integration.


## Focused packaged cleanup failure

Focused [38435865642](https://github.com/kornouhovas/workspace/actions/runs/38435865642), attempt 1, tested `28c4a2548878b10dbcee60edda03757578a038d7`. The macOS packaged rename boundary passed with 46 normal shutdowns. Windows completed every category-move scenario and all 34 normal shutdown/backend-exit verifications, then final cleanup rejected ownership. JSON receipts are retained locally with exact run/SHA names. This is distinct from the previous shutdown timeout.

A deterministic regression reproduces the exact cleanup rejection after a positively verified backend exit when its numeric PID later belongs to another process. The old final check re-probed every historical PID, losing earlier independent exit evidence. The repair records per-launch exit proof only after successful independent verification, retires confirmed PIDs from the pending set, and keeps all observed PIDs of unresolved launches. A later launch reusing the PID requires fresh proof. Replacement backend PIDs accumulate within the launch; partial confirmation and live backends reject. Main-process objects and unresolved-launch gates remain independently checked. Original CI did not retain process identity for the final probe, so PID reuse remains a reproduced mechanism rather than definitive attribution of that run.

The focused selector now supports Windows-only packaged category-move execution; ordinary full coverage and default packaged coverage stay intact. GitHub owns candidate checks, review, focused results and subsequent full acceptance.


Local ownership checks passed 58 cases; routing checks passed 33. Both review axes accepted the repair after correcting GitHub matrix include/exclude ordering. Lint, typecheck, documentation links and diff checks passed. The first renewed parallel full run passed 2,707 cases but failed two unchanged observer timing cases (21 expected skips): truncation returned no diagnostic before its 90 ms budget, and fresh binding with heartbeat returned deadline instead of source mismatch within 200 ms. The original observer file passed all 107 cases in isolation. A full file-serial control uses the same inventory/assertions/deadlines and unchanged build to distinguish scheduling contention; this changes no repository or CI default. GitHub records its actual result before candidate dispatch.


The full file-serial control passed 2,709 tests with zero failures and the same 21 expected skips (2,730 total; 415.7 seconds). Both observer cases passed inside that complete inventory. The parallel failure remains retained rather than erased; isolation supports scheduling sensitivity without proving a particular host stall. No assertions or deadlines were loosened. All ownership code and tests were unchanged during this control; only the reviewed matrix-selector repair and checked report text changed after the earlier parallel run.
