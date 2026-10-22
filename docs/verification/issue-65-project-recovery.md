# Issue 65: retained project recovery verification

Baseline: `90c4fbdb04f1720ecf174fd8b388bb39c0fb36cd` (accepted #61/#62).
[Plan and coverage selection](../plans/issue-65-project-recovery.md).
Live acceptance and delivered SHA belong to [#65](https://github.com/kornouhovas/workspace/issues/65).
This report records local evidence; review, the one full-suite run and hosted
three-platform acceptance remain pending at the initial candidate commit.

## Behavior and retained guarantees

The selected project now exposes its current retained status and recovery actions
outside the CSS-hidden Name field. Missing/replaced/unresolved and eligible
mode-inactive records use the existing reviewed reassociation service. Current
exclusions keep reinclusion guidance; a root outage suppresses speculative
individual missing state and filesystem access while retaining known exclusion/
mode metadata. Archived ordinary editing remains usable. No service, schema,
preload/native command or runtime dependency changed.

The existing nonmodal Radix operation boundary contains recovery even with the
saved view hidden. Its existing heading supplies the accessible dialog label.
Cancel/Escape restore the visible origin; successful completion can close while
its own pending receipt settles. Switching project or entering settings dismisses
the old review and invalidates delayed callbacks. Leaving an accepted command
shows an uncertain outcome; it never replays the command or selects old content.
A scoped settings context opens Sources through the existing draft guard and
Back history. Settings/Backup remain reachable without a source.

On Node22.21.1/macOS arm64:

- Production build and regular typechecks pass; lint and docs205 pass.
- First affected eleven-file command:480 pass/1 fail/481 total. The failed inherited
  renderer case correctly required known exclusion guidance during a root outage.
  The presentation policy was repaired without retiring that requirement.
- Renewed recovery/dialog/App/CI interactions:196/196 pass. Recovery-specific
  interactions separately pass56/56, including EN/RU entry/Cancel/focus, outage,
  Sources/return, delayed preview/command switching, settings/backup and read retry.
  Existing service identity/token/reconciliation/session/archive tests passed in
  the affected command; their production and service-test inputs remain unchanged.
- The final development Electron consumer passes7 journeys and64 captures, with
  three normal app/backend shutdowns and asserted owned-fixture cleanup. It proves
  real restart/current availability, explicit contained reassociation, stale-review
  reselection, same identity/ordinary values/old bytes, verified external rename,
  fresh target files, archived editing/restore, root outage/reconnect, and distinct
  excluded/mode-inactive retained states. Original session/data-recovery/archive
  consumers remain selected in the hosted profile, rather than being replaced by
  this new consumer.

The [local receipt](issue-65-evidence/local-receipt.json) records the base,
working-tree input hashes, original report digest, every capture digest and
normal shutdown/cleanup. It does not fabricate a committed candidate SHA.

## Appearance and control comparison

Compared actual Electron whole windows against main `080b416c` composition
([Table reference](../research/desktop-experience-evidence/main-table-1440.png))
and accepted #69 [preview](issue-69-evidence/preview-tree-1024.png)/
[expanded](issue-69-evidence/expanded-tree-1440.png) screens. Pinned bb `f135a001`
remains the Inter, neutral color, compact control/dialog reference through existing
components. Sidebar, unique retained tabs, one project area and return/close
controls retain that composition. No splits or embedded file editor were added.

The native comparison caught two concrete differences that DOM checks missed:
Locate was inside a CSS-hidden Name field, and the horizontal source toolbar's
100% flex basis became a full-height outage banner in the vertical host. Locate
and status now sit below the project path; the source banner has an automatic
basis and30% bounded scrolling height only inside project navigation. Native
geometry and actual Sources/Backup entry prove the working context stays usable.
At1024, action/Cancel rows wrap inside the available area; text and focus rings
remain contained in both languages/themes. Active projects do not gain a permanent
recovery toolbar. No shared typography/icon/token changed.

Retained examples from the64-capture matrix:

- [Missing preview, EN/light/1024](issue-65-evidence/en-light-1024-preview-missing.png)
- [Recovery review, RU/dark/1024](issue-65-evidence/ru-dark-1024-preview-review.png)
- [Unavailable source, EN/dark/1440](issue-65-evidence/source-unavailable-en-dark-1440.png)
- [Archived editing context, RU/light/1024](issue-65-evidence/archived-editable-ru-light-1024.png)
- [Excluded retained project, EN/light/1440](issue-65-evidence/excluded-retained-en-light-1440.png)
- [Mode-inactive project, RU/dark/1024](issue-65-evidence/mode-inactive-retained-ru-dark-1024.png)

## Failed and diagnostic evidence

Initial new-driver failures used an incorrect translated heading and a locator
from a previously closed page; both were corrected against the current public UI.
An early local launch failed the existing10000ms normal-quit gate. Diagnostic
callbacks observed before-quit/will-quit/quit within about110ms, but did not prove
why the parent stayed alive. The unchanged deferred-quit control passed; no
production quit logic, deadline or shared helper was changed. The failed receipt
remains failed; later original and final native runs independently passed normal
shutdown. A diagnostic live-reload copy supplied no restart acceptance.

One failed DOM identity assertion spent excessive time serializing a live React
DOM graph. Equivalent Boolean identity assertions preserve the exact same focus
guarantee and fail promptly. No test timeout or product assertion was relaxed.

Local detailed logs and failed/diagnostic reports remain under `work/issue-65-*`
and the coordinator's `/tmp/issue-65-*` logs. Hosted exact-SHA results and artifacts
will renew the selected profile before scoped issue acceptance. Broad #67/#42,
installer/manual Windows11 and release gates remain their existing scope.
