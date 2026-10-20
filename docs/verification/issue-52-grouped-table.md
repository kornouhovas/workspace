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

## First published candidate and diagnosis

Candidate `350293cc`, attempt 1: installer run `39453035604` passed macOS 14 arm64
and Windows/latest x64. Both downloaded reports match the SHA, verify installation,
reopen/reinstall/replacement preserving data, EN/RU/isolation and cleanup. The
Windows host is Server 2025 Datacenter, not Windows 11. Local final packaged views
also passed six checks, three normal quits/backend exits and cleanup.

Full desktop `39453035549`: Common/static and macOS/latest passed. Windows/latest's
isolated original category fixture failed its cleanup control before the intended
injection: `grouped.restart` / `stop_owned_timeout_stopped`, one utility started
and exited, normal supervisor handshake, owned shutdown confirmed. Later scenarios
were unreached; exit 1 correctly failed its expected exit 0. The original 2,692-test
remaining platform batch and 13 property-driver controls passed. The observed
failure is not an established UI/backend regression or a repaired lifecycle cause.
Windows/2022 also passed the full job. Windows/latest still-missing runtime receipts remain in the GitHub checkpoint.

Strict performance `39453041704`: macOS 14 `350293cc` completed all 32 functional
measurements, memory/startup/scan gates, four normal quits/backend exits and cleanup.
It failed direct Table grouping 585.8 ms and grouped Table assignment 329.6 ms against
300 ms. Its failure remains failed. Windows results are recorded below. The immutable
`d925f8b7` baseline also missed targets; that does not waive candidate limits.

A separate local profile reproduced first direct grouping 541.9 ms and later grouped
grouping 74.3 ms. The marked slow interval contained about 478.8 ms idle, 22.6 ms program
and 1.6 ms GC, with no >9 ms JS task. This does not support a local React/Radix CPU
bottleneck or prove the hosted cause. Subsequent diagnostic request timings were
fast but did not reproduce the slow interval. A reduced 20-project probe did not
retain the delay; it is not performance acceptance. No application optimization
or native cause is claimed from these observations.

Diagnostic-only renewal adds bounded main IPC timing/window-state observations to
`--profile-filters`; two red-to-green probe tests preserve original replies,
errors, single invocation and bounded/no-payload output. The original strict
command is unchanged. The category assertion now prints existing sanitized
first-failure evidence; no deadline/outcome is weakened. The existing runtime
continuation can narrow to Windows latest after its fixture gate passes.
See [the focused route policy](../ci.md#issue-52-failed-host-renewal).

Windows strict `39453041704`, attempt 1, `350293cc`, AMD EPYC 7763: only 22 measurements
completed. Eight interactions exceeded 300 ms (direct Table assignment 472.0/edit 327.3,
direct Board assignment 301.4/edit 397.4, grouped Table filters 396.5/360.5,
grouping 344.2/assignment 328.4). It then timed out after 30 seconds while expecting
the full projection after Table grouping/search reset. All collected startup/scan/
memory checks and three actual normal quits/backend exits/cleanup passed; remaining
cases are unreached, not passing.

The reset call site pressed Save without waiting for its enabled state after the
preceding grouping command. A real-Electron delayed-enable regression failed with
zero submits/filtered rows before repair and passed with exactly one submit/full
rows after preparing the enabled control. The production app is unchanged; the
unmeasured reset now prepares focus/enabled state before one Enter. Original
measurements, limits and full ordered membership/readiness predicates remain.
This demonstrates the driver race, not historical hosted causation. Timeout
inspection is readonly and bounded to counts/state flags without authored data.
Both diagnostic and original strict commands require renewed failed-host receipts.

Diagnostic repair verification: native readiness/probe/reset controls 10/10; CI route
contracts 50/50; typecheck, lint, documentation and whitespace checks passed. Both
independent Standards and Spec reviews reported zero findings. This delta changes
only tests, drivers, CI and documentation; application/build inputs remain at
`350293cc`. Retain its passing receipts and renew affected failed consumers.
