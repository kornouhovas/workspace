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

## Focused outcome

Reviewed candidate `a2949e167834accb7b7515e8eba14d8ea479f554` passes [focused run 38456446117](https://github.com/kornouhovas/workspace/actions/runs/38456446117), attempt 1. Build, 63 lifecycle/startup/route regressions, packaging/resource validation and the original packaged-runtime command all pass. Downloaded artifacts confirm baseline stages and ordinary shutdowns; rename has 46 passing shutdowns and category move has 34. Both assert fixture removal. The exact rename cleanup observation reports `confirmed`, 60 exited parents, 43 absent backends, `launchUnverified: false`, stopped native helper and zero native targets.

No historical hypothesis is proven by this successful scenario. The bounded diagnostic change and rejection regression preserve uncertainty conservatively; original run 38450516144 remains retained as a failure. Full acceptance [run 38457451345](https://github.com/kornouhovas/workspace/actions/runs/38457451345) follows on the same reviewed candidate.

## Subsequent full-run failure map

Full run [38457451345](https://github.com/kornouhovas/workspace/actions/runs/38457451345), attempt 1, on `a2949e1` has two new failures; the focused Windows packaged-runtime success does not waive them.

- Windows latest: `npm run test:platform`, `backend-lifecycle.test.mjs`, recovery fanout case. Expected commit revisions `[2, 3, 4]`, actual `[2, 3, undefined, 4]`. Injecting an actual observer hint through controlled watcher/timer dependencies reproduces this exact failure in 0.4 seconds using the real service/controller/preload/client route. The fixture incorrectly treats every event as a commit. The repair records commit and observation streams separately; it retains exact commit order, sibling fanout/unrelated isolation/listener cleanup assertions and additionally verifies the observer revision and both subscribed recipients.
- macOS: original `npm run smoke:runtime -- dev` reaches grouped/RU rename rejections but times out after 15 seconds waiting for the unchanged-name message. The retained screenshot instead shows the saved message and closed editor. The existing artifacts do not identify the actual submitted name or service outcome, so no historical cause is established. Bounded submission capture records only draft-equality booleans and finite response fields; forwarding is unconditional and wrappers are removed without overwriting a later owner. It changes no messages/assertions/deadlines. Local graphical rename passes all original checks, including matching no-op input/request and an `unchanged` receipt, but this is not proof of causation.

The next focused route, `checks: issue22-failures`, runs only Windows-latest recovery-fanout file and the original macOS development-runtime command with build prerequisites and capture/CI-route regressions. Required artifacts retain OS/SHA/run/attempt identity. Further full CI remains behind both focused original scenarios and artifact inspection.
