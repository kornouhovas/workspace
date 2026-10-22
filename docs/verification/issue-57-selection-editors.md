# Issue 57: immediate ordinary selection editors

Issue and current acceptance checkpoint: https://github.com/kornouhovas/workspace/issues/57
Implementation baseline: `e6de28fb`. See [scenario/retention plan](../plans/issue-57-selection-editors.md).

## Changed behavior

One Radix selection popover serves Table, Board and project details. Single Select
saves on choice; MultiSelect queues each complete set serially and stays open.
Failed desired selections remain explicit and editable; navigation observes the
pending queue, blocks after failure and never replays a mutation. Retry and Cancel
are explicit. Open menus retain projection ownership so regrouping/filtering
cannot evict their editor. Source snapshots still update ordinary values.

Existing create/rename/color/order/local-hiding commands are available inside
the same editor, with localized icon hints. The previous Properties management
entry retains reviewed option deletion until #58. Folder-backed Select remains
on its existing filesystem route. No storage, IPC, dependency or installer change.

## Appearance

Composition reference: main `080b416c`; shared controls/typography: accepted #68
handoff (`dc92467`) and #69 integration. Existing Inter, semantic light/dark tokens,
Radix popovers, local icons and noninteractive hints are reused; no upstream code
or asset was added.

The real Electron `smoke-selection-editors.mjs dev` inspected both editor types
in Table/Board/details, EN/RU, light/dark, 1024x720 and 1440x960: 48 journeys plus
chosen/options screenshots, no document overflow, bounded menu geometry, focus
return, sibling hiding isolation and restart persistence. Evidence is generated
under `work/issue-57-selections-dev`; hosted artifacts retain exact SHA/run/host.

Whole-screen inspection preserved the accepted sidebar/view/project composition.
Initial expanded option controls used long text buttons and were unnecessarily
tall in narrow Russian details. They now use the existing compact outline-icon
and localized-hint treatment. The options section scrolls within the available
popover height. Final candidate evidence must include that repaired presentation.
Native select controls keep their platform keyboard behavior; authored option
labels are not translated. Deliberate single-project/tab exceptions remain intact.

## Local verification

Node 22.21.1, macOS arm64. Typecheck, lint, build and the 31 focused selection/UI
route checks passed during implementation. The additional shared guard/scalar
consumer run passed 29 tests. Existing Single Select dev smoke passed both
languages, persistence, option lifecycle and normal shutdown.

Retained failed evidence: an early adapted MultiSelect smoke attempted Escape on
a hidden option just removed by an immediate save. The driver now closes from a
remaining visible checkbox. A subsequent run reported a Playwright Electron-close
timeout even though its lifecycle log reached quit/parent-exit; forced cleanup
was recorded. This receipt is not a passing shutdown result. Final scoped native
acceptance and the full suite remain pending at the initial candidate commit.

The DOM fixture initially selected an option by its position in a mixed-property
snapshot; it is corrected to resolve property/option IDs. Production service
contracts were unchanged. Coverage decisions are recorded in the plan.

## CI scope

`desktop-ci.yml`: manual `checks=desktop-ux`, `desktop_ux_profile=selections`
runs the selected renderer/service/IPC, safe metadata/folder-backed, shared guard
and native selection consumers on macOS latest, Windows latest and Windows 2022.
The profile propagates failures and uploads native screenshots/provenance.
Unchanged package/installer gates remain at the broader milestones (#67/#42).
Final local, review, exact-SHA hosted results and integration belong to the issue
checkpoint; this document does not assert their completion.
