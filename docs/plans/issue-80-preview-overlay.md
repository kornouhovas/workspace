# Issue 80: project preview overlay

Base: `ec427055b0e639f54ba66320ee84a8ed0d7b0488` (`new-workspace`).
Tracker: [#80](https://github.com/kornouhovas/workspace/issues/80).

The saved view remains mounted at full width; the right project host overlays it,
with the existing resize control and session/navigation controllers. The expanded
host still replaces the view. Main `080b416c` and the existing #54 handoff supply
composition; the issue's overlay requirement supersedes its split width.

## Scenarios and coverage

- Retain the #54 renderer navigation, editor, retry and session tests; the existing
  public boundaries still exercise unique tabs, per-view state and late reads.
- Adapt the native navigation journey to measure Table and Board view/card width,
  position and scroll before and after opening/closing. The baseline Table check
  failed with 775px becoming 410px. Board virtualized total height is not a stable
  geometry measure while rows are being measured; visible card geometry is checked.
- Retain native EN/RU, light/dark, 1024/1440, expansion/return, width and scroll
  checks. Loading, unavailable/recovery, overlay menu layering, draft navigation,
  supported-host CI and integrated acceptance remain required gates.

## Local evidence

Node 22.21.1 on macOS: build and typecheck passed; project-navigation renderer
suite passed 16 tests. The native navigation journey passed with 32 visual
variants and Table/Board geometry checks. One earlier native attempt stopped at
an existing tab drag ordering assertion; a repeat passed, with cause unproven.
Lint and documentation links passed. These results do not replace the remaining
acceptance gates or the required final full suite and independent review.
