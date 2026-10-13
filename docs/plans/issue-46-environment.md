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
