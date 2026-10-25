# Issue 76 verification

Issue: [#76](https://github.com/kornouhovas/workspace/issues/76).
Base: `676737a3`; branch: `codex/issue-76-special-archive`.
The [scenario ledger](../plans/issue-76-special-archive.md) defines acceptance.
GitHub checkpoints own candidate/run provenance and integration readiness.

## Implementation and retained guarantees

First-use contextual Archive offers a source-relative special location with
separate review/confirmation before project review. Cancel before confirmation
writes nothing. Stored explicit configuration is reused and remains available
in workspace settings. No name-based adoption, automatic migration or live-data
repair occurs. Current role-aware filesystem inspection also vetoes ordinary
statuses not yet enrolled by discovery, at preview and every Apply reinspection.

Existing journaled archive/restore owns identity, properties, original paths,
source containment, no-overwrite, interruption recovery and read-only unknown
status checks. No schema, native resource, dependency, isolation or installer
input changed. Tests retain those guarantees rather than retiring failed cases.
The old native assertion that Archive is disabled without configuration is
adapted to the accepted first-use action; its remaining contextual scenarios stay.

## Local evidence

Toolchain: Node 22.21.1, macOS arm64. Disposable SQLite and folder fixtures only.

- UI red/green: first-use EN/RU tests initially fail on the missing location field;
  current archive/contextual UI and workflow checks pass 38/38.
- Service red/green: empty/populated un-enrolled Archive statuses initially receive
  an erroneous token; current tests reject both. A reviewed empty physical archive
  change initially exposed a policy-dependent binding regression; the corrected
  service passes it and the folder-arrival-before-Apply rejection scenario.
- Final focused role-command and durable-location files: 51/51 pass. Earlier
  archive/location/service selection: 84/84 pass.
- Workflow scheduling/artifact retention: 72/72 pass. DEV and packaged retained
  evidence use distinct uploaded directories.
- Typecheck, lint, documentation links, production build and diff whitespace pass.
- Final complete local suite: running at implementation checkpoint; its exact
  result and any renewed evidence are recorded in the subsequent GitHub checkpoint.

Independent Standards and Spec review found and repaired lost DEV evidence,
un-enrolled status adoption and the empty-designation-change regression. Both
axes report zero remaining implementation findings after re-review.

## Appearance and native evidence

The new state reuses the accepted ProjectOperationDialog, bb input/button controls
and existing main-derived work-area composition from the baseline. No new style,
asset, copied module or panel arrangement is introduced. The first-use state is
new behavior; it has no identical historical reference screen.

The actual Electron visual diagnostic captures EN/RU, light/dark and 1024x720/
1440x960 first-use dialogs plus workspace settings. Inspection confirms wrapping,
viewport fit, visible controls and ordinary authored Archive/App placement. Its
two journeys check cancellation, ownership rejection, designation, archive/restore,
UUID, Text, bytes and configured reuse. The diagnostic substitutes reload for
process restart and therefore supplies no process-restart acceptance. Its final
normal quit and owned cleanup pass; its diagnostic flag remains explicit.

The original local native run fails a 10s normal-quit gate after EN archive.
A minimal empty-app launch/ready/close reproduces that timeout without a workspace
or Archive interaction; forced owned-process cleanup succeeds. This does not
establish its precise cause or make the failed native receipt passing. The final
native driver now observes the current archived record, absence of unfinished
operations and settled archive panel before its normal close/restart; all original
quit deadlines and process/cleanup assertions remain.

Required hosted evidence is `desktop-ci.yml`, `checks: special-archive`: complete
suites and actual DEV/package first-use/settings/restart on macOS latest, Windows
latest and Windows2022, plus retained contextual archive and original recovery/
restart consumers. Hosted results and inspected artifacts remain acceptance gates;
release/manual Windows11 and final #67/#42 acceptance are separate.
