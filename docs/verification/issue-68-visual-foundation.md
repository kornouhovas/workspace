# Issue 68 visual foundation verification

The [handoff and retained scenarios](../plans/issue-68-visual-foundation.md)
pin main, bb and the accepted #52 revision. The baseline checkout is `a6622b4a`.
The [GitHub checkpoint](https://github.com/kornouhovas/workspace/issues/68)
owns candidate SHA, hosted run/attempt, integration and outstanding acceptance.

## Visual comparison

[Evidence manifest](issue-68-evidence/manifest.json) retains ordinary and long
Table captures before/after in EN/RU, both themes, 1024x720 and 1440x960.
The before/after reports retain measured geometry. After captures also include
Properties, row actions, the value editor and narrow Russian settings.
All data is disposable synthetic data; paths in screenshots are temporary roots.

| Reference / mismatch | Result and intentional difference |
| --- | --- |
| Main compact navigation and daily work | One sidebar workspace entry, view strip and visible project table replace duplicate workspace controls and permanent management stacks. The after table starts at about 238px (1440) or 272px (1024); the baseline table was below the initial viewport. Main's split/panel composition is intentionally excluded by the accepted single-project-area model. |
| bb typography and neutral surfaces | Packaged Inter Variable 5.2.8 Latin/Cyrillic, semantic light/dark surfaces, fine borders, consistent radii, compact rows and outline icons. Chromium reports actual custom Inter glyphs, separately from CSS/font declarations. Existing Radix/Tailwind foundations remain pinned. |
| Context commands and editors | Source/Properties/archive/row actions remain real mounted controls. Escape returns to the owning trigger; active operations own cancellation first. Property header rename is visible outside the closed tools. Long headings truncate while authored multiline values remain readable. |
| Settings | Section headings, descriptions and compact cards retain settings navigation and the inline archive location. Russian narrow captures preserve controls within the viewport. |

The Table and settings captures were inspected against pinned main composition
and bb styling, including long-content clipping, themes and language wrapping.
Existing Board functionality is retained; #53 still owns its visual acceptance.
The current value-editor presentation is shared with #56/#57; their remaining
commit/cancel/draft/navigation and safety criteria are unchanged.

## Local candidate evidence

Node 22.21.1, macOS arm64. Results describe observed commands, not hosted acceptance.

| Command / boundary | Observed result |
| --- | --- |
| Typecheck, lint, documentation links, whitespace | Passed; documentation checker covered 182 files before this report was added. Final documentation/whitespace checks run before commit. |
| Focused UI and interaction selection | 837/837 passed. |
| Independent Standards and Spec reviews | No remaining code findings after repairs and regressions; final reviewer selection 36/36 passed. |
| Full `npm test` (one completed candidate run) | 3215 tests: 3174 passed, 15 failed, 26 skipped. This is a failed full run. |
| Six category runtime adapter failures | Adapted original command entry through its actual row/context surface; all 26 category-runtime tests passed afterwards. No category/service assertions removed. |
| Nine original Electron fixture failures in full run | Property-editor and view-readiness fixtures timed out during process shutdown after UI assertions and quit events. Their unchanged original tests remain in the scoped profile, sequentially. |
| Isolated native controls | Property fixture 10/13 passed; readiness 7/15 passed, with shutdown failures. Unmodified `a6622b4a` property-driver control also failed shutdown (4/7 passed, three failures). This demonstrates the failure exists without the new UI adapter; it does not prove every candidate failure has the same cause. |
| Real shell, sources and saved views | Passed: shell 28 checks, source settings 9, saved-view runtime 6; normal process exit and fixture cleanup recorded. |
| Workspace management / 16 visual variants | UI checks/captures reached, but latest command failed the unchanged Electron shutdown gate. Retained as failures; hosted renewal required. |
| Local packaging and packaged assets | `package:built` and `check:artifact -- release` passed, including CSS-referenced Latin/Cyrillic fonts and full OFL notice. Hosted candidate packaging renews current build inputs. |

The native controls retain the 10-second shutdown deadline. No forced cleanup,
skip or unreached stage is counted as success. No runtime lifecycle workaround
was added to conceal the local shutdown failure. The before/after JSON reports
retain actual process/cleanup outcomes even when the screenshots are useful.

## Scoped CI and retention

`test:desktop-ux` selects affected React, typed service, IPC, artifact and real
Electron boundaries. The original blank-HTML native fixture files run sequentially,
then whole-screen/font inspection and shell/workspace/source/view runtime flows.
The hosted route adds fresh packaging, artifact checks and packaged saved views
on macOS latest, Windows latest and Windows 2022. Each artifact has exact SHA,
run and attempt provenance. A separate deliberate exit-23 dispatch must fail
before positive acceptance is considered. Ordinary full/platform/release routes
remain registered. Neither deliberate negative control nor skipped jobs pass CI.

The [retention table](../plans/issue-68-visual-foundation.md#requirement-retention-decisions)
records every affected inherited entry point and its retained guarantee. No
service, storage, migration or filesystem contract was changed. Hosted results
and final handoff are recorded in the originating issue rather than rewriting
this local evidence into a full-suite success claim.

## Hosted source receipt and test-only renewal

Run [39584260958 / attempt 1](https://github.com/kornouhovas/workspace/actions/runs/39584260958)
at `d890103ff4f4e6e5f1d96ca3e3654ad814c4dbb0` passed the complete source
foundation profile on all three supported hosts, including the original native
fixture tests, 16 visual variants per host, shell/workspace/source/views and
normal shutdown/cleanup. Fresh packages and font/license inspection also passed.
Artifacts were downloaded and provenance/JSON outcomes inspected; representative
Windows screenshots were compared separately. The overall run failed later and
is not described as a green workflow.

The new packaged step mistakenly called `smoke:runtime -- release --views`;
`--views` is unsupported there. All hosts reached the original general runtime
and failed at its obsolete daily Add entry. A failing regression now locks the
actual `smoke:views -- release` route. Focused renewal retains the originally
reached general runtime as well, adapting sidebar auto-picker, contextual
property/recovery commands and settings return. Its existing data, filesystem,
recovery, native, shutdown and cleanup assertions remain. Intentional ellipsis
of the noninteractive heading path is distinguished from accidental overflow;
regression controls still reject ordinary clipping and overflowing cells.

Only harness/tests/CI/docs changed after the source receipt. The issue checkpoint
records the reviewed diff and renewed packaged evidence; skipped source checks
in the focused renewal inherit their identified earlier receipt, not a new pass.

Local renewal: 93 driver/layout/route regressions passed; lint, documentation
links and whitespace checks passed. The original general packaged-runtime phase
passed through recovery, restart, removal/source reuse, startup failure, unchanged
files, backend exit and fixture cleanup. Its subsequent graphical rename recovery
advanced through intent/keep-original/first-effect and then reproduced the known
local 10-second Electron shutdown timeout. This remains a failed local command;
hosted renewal must pass the complete retained command. Both independent reviews
found no remaining issues after the offscreen recovery-row ordering repair.

The separate category renewal exposed another collapsed recovery-list entry:
Reload now opens its owning details before activation, leaving repeated-read and
no-replay assertions intact. Its local command advanced through English and
Russian recovery scenarios before another unchanged shutdown timeout; 34 affected
regressions passed. Intermediate hosted run `39586711625` was explicitly cancelled
while completing this local adapter audit, and supplies no acceptance credit.
