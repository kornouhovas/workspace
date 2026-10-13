# Issue 22 Windows latest packaged-runtime failure

Original [full run 38450516144](https://github.com/kornouhovas/workspace/actions/runs/38450516144), attempt 1, tested `04fd8c53ba0d5aab2d148da15661168260965585`.

## Retained failure and boundaries

Common/static checks, all three platform suites and both macOS/Windows-2022 complete jobs passed. All six issue-22 archive runtime reports passed 12 checks each on the exact tested SHA, including ordinary shutdown/backend exit and fixture cleanup. Windows latest failed only the final original `npm run smoke:runtime -- release` step after the baseline runtime and graphical rename scenarios reached grouped commit/restart. Its category-move graphical route was unreached after the failure, and the overall run did not pass acceptance.

The rename report retains 46 individually passing normal shutdown receipts and a skipped final fixture cleanup: `Owned-process termination is unverified; fixture cleanup skipped`. No deletion was attempted. The original report does not identify which ownership predicate failed; passing shutdown receipts alone do not establish the later ownership check.

## Falsifiable hypotheses

1. A historical backend PID is present at final inspection, possibly reused by another process. A fresh probe alone cannot distinguish reuse from an owned survivor.
2. An Electron parent has no confirmed exit code/signal when final cleanup is checked, despite its channel close having resolved.
3. A launch remains ownership-unverified. The retained startup/shutdown receipts make this less likely, but do not record the final flag.
4. Native helper or disposable native-target cleanup remains unverified. The final gate must identify this separately from child/backend ownership.

None is established as the historical cause. Do not describe an unchanged successful rerun as proof of causation.

## Bounded diagnostics and focused feedback loop

`inspectOwnedProcesses` returns the same conservative boolean gate with finite reason/count fields and no process identifiers, fixture paths or raw exceptions. `ownedProcessesStopped` delegates to that inspection. The rename harness retains the exact inspection used for its cleanup decision, plus native-stop/target-count predicates. It does not permit deletion on uncertainty or change shutdown deadlines.

A public lifecycle regression reproduces the observed cleanup rejection using a present backend probe, verifies that no fixture deletion occurs, and covers unconfirmed parent, uncertain launch and positively absent backend observations. Existing lifecycle/startup regressions remain required.

The focused `checks: windows-release` route builds and packages its own candidate before running the original Windows-latest packaged-runtime command. It preserves exact SHA/run/attempt artifacts on success or failure. Diagnosis/focused/full/integration progress is recorded in the [issue checkpoint](https://github.com/kornouhovas/workspace/issues/22); no full acceptance or integration is established by this diagnostic addition alone.
