# Issue 33 verification

Contract/scenarios: [plan](../plans/issue-33-group-drag.md). Current candidate,
CI results and delivered SHA: [GitHub #33](https://github.com/kornouhovas/workspace/issues/33).

## Local evidence

- Service red/green: the new command fails on the baseline and passes after implementation. Typed tests cover exact Text/Number/Date/Single Select assignment, clearing, no-op revisions, SQLite reopen, source siblings, filtered disappearance, unchanged manual group/row order, stale or malformed requests, ownership and transactional failure without a committed event. Archived direct/grouped fixtures retain their paths and lifecycle.
- UI red-capability was checked against baseline `TextPropertiesTable`. EN/RU Board/Table scenarios verify all four types through real temporary SQLite, pointer assignment, Enter-activated clearing and focus continuity. Text scenarios also verify invalid-drop feedback and a committed-but-lost response, actual-state refresh and no replay.
- Built backend IPC rejects unknown/malformed/stale operands and routes the typed mutation without expanding renderer access.
- Real Electron `smoke:views -- dev` passed both languages, all four types in both layouts, pointer dragging, Enter-activated clearing, restored focus, reload and 360/1440px viewport containment. Existing view/filter/grouping/Table/Board scenarios, normal shutdown, backend exit and fixture cleanup passed. Local screenshots and JSON are in `work/issue-33/runtime-final-accepted`.
- The first runtime probe used synthetic End/Enter on a macOS native select; it did not commit selection. A standalone select reproduced that input limitation. A dedicated clear button now supplies an Enter-activated keyboard alternative in both DOM and real Electron checks; the native selector remains available for choosing other destinations. No physical-keyboard claim is made for every target OS.
- One existing Single Select UI fixture selected an unlabelled combobox; the new assignment selector made it ambiguous. It now targets the existing cell editor's accessible label, preserving its edit/save assertions.

Typecheck, lint, documentation links and diff checks passed. Independent Standards
and Spec reviews report zero remaining findings after repairs. Full-inventory
and CI evidence is recorded below and in the GitHub checkpoint. Existing ordinary CI discovers the new tests as platform tests;
the development and packaged `smoke:views` routes inherit the new runtime cases on
all three target runners. No new migration, dependency, bb module or reduced
platform/runtime assertion is introduced.

## Review repair

Independent review: Standards initially reported zero findings; Spec identified lost
keyboard focus when a project moves between keyed group containers. A projection
refresh token now ties focus restoration to the actual post-command query, including
lost replies. Visible projects regain their selector; filtered/hidden/collapsed
projects focus the stable result message. View/workspace changes suppress old focus
requests. A regression goes red on the pre-repair implementation; both languages
and layouts verify the repaired behavior and filtered-disappearance fallback.

A second focus review found that grouping could resolve before the property list,
while the selector was still disabled. A delayed-list regression reproduced that
ordering; restoration now waits for loading and falls back to the status when the
control is disabled. Both independent axes report zero remaining findings.

Runtime preparation was narrowed after instrumented failures showed no native
`dragstart`: `dragTo` could scroll the page between mouse-down and movement.
Pre-scrolling the destination heading puts both endpoints in view before the
native gesture. The isolated eight-scenario control passes without changing
assignment behavior, assertions or deadlines.

## Final source follow-up and local inventory

A same-group No value drop previously normalized authored empty Text to an absent
value. The regression was observed red; after fresh projection/property validation,
supported same-key drops now return the existing snapshot without writes/events.
Independent follow-up review found no new issues. Final assignment service/UI/IPC
checks pass **28/28**; the broader UI/filter/grouping/layout regressions passed before
this service-only follow-up.

The first fresh-build full inventory passed **2966**, failed **6**, and conditionally
skipped **25**. All failures were the unchanged `property-editor-driver` native
shutdown cases and `runtime-electron-quit` deadline control. These fixture apps do
not load the assignment UI or service. Isolated pristine base `2e448831` reproduced
two original shutdown failures (4 passed/2 failed); the candidate's same six tests
then passed in isolation. This does not establish the native shutdown root cause;
no deadline, cleanup or normal-quit assertion was relaxed. A renewed full inventory
on the final same-group candidate is tracked separately, along with required
cross-platform CI, rather than treating focused success as full acceptance.

The renewed final-source inventory (`npm run test:all`, reusing the verified build
with rebuilt final service/backend) passed **2972**, failed **1**, and skipped **25**.
Its sole failure is the unchanged native Number creator's ten-second normal-close
boundary in `property-editor-driver.test.mjs`. The same file passed in the isolated
candidate control above; the source and fixture remain unchanged. Final task checks,
typecheck, lint, docs and diff validation pass. This local native limitation is
retained explicitly; exact-SHA platform/packaged acceptance remains in GitHub.
The final narrow EN Board and wide RU Table screenshots were visually inspected.

## First remote candidate and scoped authoring follow-up

Full run39124807104 attempt1 on `d09edcd` passed common/static and all three
platform test suites. Windows latest's original development runtime then failed
in grouped RU rename rejection preparation: `locator.fill("")` retained the old
Unicode name. The editor readiness proof passed, the rename receipt recorded zero
requests and owned-process/native cleanup passed. The original job/artifact is
retained in the GitHub checkpoint; no filesystem command was submitted by that
failed case.

A real-Electron control intercepts native deletion while leaving standard locator
replacement available. The old two-fill helper reproduces the exact original
clear assertion. One `fill(draft)` authors the complete nonempty text through the existing
standard UI replacement and retains exact draft verification before Enter; empty draft verification
is unchanged. The control and readiness suite pass **31/31**, with zero submissions;
CI-route controls pass **39/39**. The installed Playwright 1.64.0 implementation confirms that empty fill uses
keyboard Delete while nonempty fill uses insertText. This removes the separate
keyboard-Delete preparation dependency; the historical event-loss cause remains unknown.

The focused `rename-authoring` selector runs only Windows latest's controls and
original development runtime, retaining exact SHA/run/attempt, both outcomes and
cleanup. Focused original-step/artifact success is required before a renewed full
run on its reviewed candidate. No rename service, product validation, deadline,
normal-quit or filesystem assertion is relaxed.

The completed first run passed macOS and Windows 2022 in full, including both dev
and packaged views artifacts. Its only failed job was Windows latest's original
development runtime authoring assertion above. Unreached Windows latest stages
remain unverified; successful other-platform evidence does not close that gate.

The reviewed authoring follow-up passes local original `smoke:runtime -- dev`
completely, including rename/rejections/restart/interruption recovery, category
moves and normal cleanup. Its renewed full inventory passed **2974**, failed **1**,
and skipped **25**. The sole failure is the unchanged deferred native Electron
quit control, already reproduced on pristine base in the earlier comparison;
all authoring/readiness and CI-route tests pass. No native lifecycle assertion
was changed. Both independent follow-up reviews report zero findings. Static
and documentation checks pass; the repair is published with `[skip ci]` so the
focused Windows original-command gate precedes renewed full CI.
