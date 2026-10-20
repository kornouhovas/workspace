# Issue 52: grouped Table and contextual columns

Issue: [#52](https://github.com/kornouhovas/workspace/issues/52); baseline `d931bf32`.
Branch: `codex/issue-52-grouped-table`. Scope/retention mapping:
[implementation plan](../plans/issue-52-grouped-table.md).

## Behavior and boundaries

Table grouping and presentation open in Radix popovers. Column headers expose
compact contextual actions with full accessible authored names. Whole-Table controls
restore hidden columns; Name remains visible. Existing typed values/editors, exact
scalar/Select/category/MultiSelect grouping, ordering/hide/collapse/hide-empty,
manual row order, width/wrapping, independent view/workspace settings and recovery
routes remain on their existing typed service contracts. No schema/backend/IPC
change or additional dependency/upstream source import.

Escape dismisses the active popover and restores the trigger. Hiding a column
from its header falls back to the whole-Table trigger when that header disappears.
Pending/failed writes retain committed settings, disabled controls and explicit
feedback/retry/reset. Contextual grouping restores usable focus after pending saves.

## Review and observed local evidence

Host: macOS 27 arm64, Node 22.21.1. Generated evidence is local under `/tmp/issue52-*`.

- TDD: contextual Table entry was red before the popover implementation; header
  settings/hide/focus were red before header integration. Renderer checks passed
  23/23 (including rejected header-width save/retry); affected retained service/UI/native regressions passed 64/64.
- Typecheck, ESLint, application and Ladle builds, documentation links and
  whitespace checks passed. Fresh arm64 directory packaging and
  `check:artifact` resources/notices/version checks passed.
- Independent Matt Pocock Standards and Spec reviews, including the driver delta,
  reported zero actionable findings, including compact header actions, local
  rejected-save feedback and the inherited category-header assertion adaptation.
- Development views journey passed all six checks, three ready startups, three
  normal quits/backend exits and owned cleanup. It includes exact grouping,
  MultiSelect/category/recovery, values, filters, Table/Board layout, assignment,
  metadata removal, restart and isolation. The final application build renewed
  this journey successfully with the same six checks and all three normal quits.
- Desktop shell passed its existing journey plus Table/column/group popovers in
  EN/RU, light/dark and 1024x720/1440x960. Inspected screenshots exposed duplicate
  long names in header triggers; compact triggers retain full accessible labels.
  Final compact-trigger shell renewal also passed; inspected the final
  EN/RU light/dark screenshots and popup bounds at both required sizes.

The first development views run failed its native Table drag order assertion.
The focused real Table reproduction failed at the same assertion. Preparing both
endpoints through existing `dragRuntimeGroup` before mouse-down passed the same
native gesture/result assertion; no synthetic mutation, retry or changed deadline.
The existing native scroll/drag regression covers this helper. New popup inspection
also prepares the visible anchor and observes final Radix bounds before asserting;
Escape uses one page keyboard event without refocusing a disappearing panel.

## Outstanding acceptance

The first broad suite (3,179 tests: 3,152 passed, 26 platform skips, one failure)
was started before the visual header refinement and is not final-candidate evidence.
Its single failure was an inherited raw category-header button count. The adapted
check requires both accessible actions and retains no-inline-editor, exclusions
and Text-draft assertions; its focused scenario passed. Final source review, typecheck, ESLint, build, links and whitespace checks pass.
Final-candidate `npm run test:all`: 3,180 tests, 3,153 passed, 26 platform skips,
one failure in the unchanged minimal property-editor Electron fixture's normal
shutdown after the Single Select interaction passed. It emitted before-quit,
will-quit, quit and node-exit; the parent required forced cleanup after 10 seconds.
The isolated unchanged file passed 9/13, with four different normal-close failures;
the original failing Single Select case passed. Both failed runs remain failed.

`git diff d931bf32` is empty for this fixture/driver, runtime lifecycle helper,
Electron/Playwright dependency manifests and lockfile. The fixture loads only
minimal data-URL HTML, not application source. [Issue 51's baseline report](issue-51-contextual-views.md)
records the same local macOS 27 pattern on unchanged `53a87519`, including matching
native inputs. This establishes inherited reproduction, not a unique native cause
or an application repair. No deadline or normal-quit requirement is weakened.
Supported-host CI, packaged runtime/installer and strict representative-scale
evidence remain gates. No integration, issue closure
or release is claimed by this local report. GitHub owns current acceptance status.

The owner explicitly authorized publication to the current public repository for
#52. Preserve actual run/attempt/SHA evidence and earlier failures in its checkpoint;
apply shared CI evidence reuse only to demonstrated unchanged inputs.
