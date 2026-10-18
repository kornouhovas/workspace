# Issue 36: metadata deletion verification

Acceptance authority: [GitHub #36](https://github.com/kornouhovas/workspace/issues/36).
[Contract/scenarios](../plans/issue-36-metadata-removal.md) records the owner-approved
policy and TDD seams. Base: `127e8c0a915e8e511d14d08d9a4775a4cb10ec97`.

## Local evidence

- Red/green service slices exercised property cleanup, both ordinary Select actions,
  deduplication, post-deletion option append order and stale review rejection.
- 56/56 focused service/IPC/UI checks passed, including every ordinary property type,
  source sibling and foreign-source isolation, restart, configured Table/Board settings,
  dormant grouping/mixed filters, archived/retained values, transaction fault rollback,
  invalid/foreign tokens, keyboard EN/RU, lost replies and queued settings refresh.
- The Table focus regression was reproduced with the existing native Table scenario.
  A bounded focus probe showed focus attempts while the fieldset was disabled: queuing
  its own list-change notification triggered another load after save. The repaired
  route queues property events only, and restores focus after loading ends. The original
  native Table scenario passes without changing its assertions or deadlines.
- The focused native metadata scenario completed all eight EN/RU × Table/Board ×
  Single Select/MultiSelect cases, with cancellation/focus, replacement, property
  deletion, sibling view cleanup, reload, unchanged fixture files and 360/1440px checks.
  Its final Electron close hit the existing 10-second deadline despite recorded quit
  and parent-exit events; cleanup confirmed owned processes stopped. This run is not a
  passing lifecycle acceptance. Historical cause is unproven; no deadline was relaxed.

## Review and fixture reconciliation

Independent Matt Pocock Standards and Spec reviews against the immutable base found
zero issues, including the final values-list markup and fixture repairs. The first
full local inventory recorded 3012 pass / 8 fail / 26 skip. It exposed a local dependency
symlink causing Ladle 403; a real `npm ci` installation resolves that fixture. Two old
global text queries were scoped to the property columnheader / rename button because
the new management list legitimately repeats property names; exact whitespace and
current-workspace assertions remain. A DOM identity assertion now compares identity
as a boolean, retaining its condition while bounding Node failure diagnostics. Its
original worker was stopped after over two minutes of sustained CPU without progress;
the full-only focus failure remains unproven and all 36 scenarios pass in isolation. These reconciled files pass 129/129 focused checks.

Five standalone `property-editor-driver.test.mjs` cases still hit the original 10-second
Electron-close deadline in isolation. This HTML/native fixture does not load application
code, and its fixture, driver and lifecycle helpers are unchanged from the issue base.
Quit/page-close events occur before the deadline; actual parent exit is recorded at
forced cleanup. The historical native cause remains unproven. No deadline, product
assertion or lifecycle gate was weakened. The final reconciled `npm run test:all` inventory is **3035 passed / 4 failed /
26 conditional skips** (3065 total). All four failures are these unchanged standalone
property-editor close-deadline cases. Ladle, renderer, group-assignment and all new
metadata suites pass. The native caller-deadline control passed in this complete run;
the five-case isolated failure is retained separately rather than erased.

## Remaining gates

Final build, typecheck, lint, documentation links and diff checks pass. Exact-SHA
platform CI/artifact acceptance and delivery are recorded in the GitHub checkpoint;
the local standalone close failures above remain an explicit limitation.
The full local native `smoke:views -- dev` run passed all existing and eight metadata
cases, with normal backend/application exit and fixture cleanup. Narrow RU and wide EN
screenshots were inspected; the final markup removes dangling colons and separates
values into a list. The existing `smoke:views` dev/release routes inherit all existing
checks and include the metadata scenario on macOS and Windows. No new migration,
release or main merge is authorized by this report. Live run URLs, inspected artifacts
and delivered SHA belong to the GitHub checkpoint.
