# Issue 66: Recovery settings and About verification

Baseline: accepted `new-workspace` at `5dee808a`.
Initial application candidate: `a0b6a7a75aa4edf65e4b850192367fea678df195`.
Final scoped layout repair and exact tested SHA are recorded in the issue checkpoint and final receipt below.
[Scenario/retention map](../plans/issue-66-recovery-settings.md).
Live CI and delivered-SHA checkpoint: [issue 66](https://github.com/kornouhovas/workspace/issues/66).

## Implementation and retained guarantees

The accepted settings template now exposes verified backup status, policy,
destination, create/retry, export and file selection directly. Selected candidate
identity and explicit Replace/Cancel are contained in the existing shared dialog.
Escape returns focus to the original file/backup control; pending and unknown
outcomes cannot dismiss/replay replacement. Only `restored: true` triggers a full
renderer reload. This discards old navigation/project caches and hydrates current
restored source/workspace/session state. Existing SQLite/schema/ownership,
transactional failure protection and project-file exclusion are unchanged.

Recovery is reachable from startup failure and with missing sources. A working
backend allows the existing reviewed recovery even if the initial settings load
fails. An unavailable backend offers bounded diagnostic/matching-version recovery
instructions and no replacement control. About embeds the canonical package
version and third-party, full bb MIT, Drizzle Apache and Inter OFL notices at build
time, retaining packaged resources and source provenance separately.

No service, schema/migration, native command, dependency, installer or application
lifecycle implementation changed. New styles are scoped to recovery/About.

## Local verification

Host: macOS Darwin27.0.0 arm64, Node22.21.1.

- Direct category/focus tests initially failed in both languages, then passed.
  Startup recovery and About were added through red/green cycles. Recovery UI
  including malformed acknowledgement/unknown Escape:13/13.
- Public SQLite backup/recovery/session and components focused command:44/44
  before the additive unconfirmed-ack scenario. Complete affected App/recovery/CI
  files:154/154 before that additive scenario; final recovery/CI files47/47.
- Typecheck, lint, build, matching version and documentation links209 pass.
  The selected route's real exit23 failure probe propagates correctly.
- Independent Standards and Spec reviews of `5dee808a...a0b6a7a7`:0 findings each.
- One complete `npm test`:3430 passed /2 failed /27 skipped /3459 total,
  164.200 seconds after the successful fresh build. The two original ten-second
  synthetic native shutdown failures are recorded in the
  [failure inventory](issue-66-full-suite-failures.json), including log digest.
  Category-header/property fixtures, their components/driver/lifecycle are
  unchanged. New scoped recovery/About CSS does not select those components.
  Accepted #63 already records this variable-membership timing class; timing
  cause remains unproved. No retry, assertion reduction or deadline extension
  is used. These broader #67/#42 watchpoints remain explicit; this is not a
  full-suite-green or release claim.

## Appearance and native evidence

Compared actual whole-window recovery and About with accepted #68 settings
captures (`ordinary-en-light-1024-settings-backup.png` and existing About), pinned
main `080b416c` composition and bb `f135a001` styling. The sidebar, heading/card,
Inter, semantic themes, control and selected-row treatment remain shared. The
intentional difference is direct readable recovery content and a separate compact
review dialog in place of the nested disclosure; About now exposes complete
notices and actual version. Long backup paths/IDs wrap and settings scroll normally at1024x720.
Final inspection rejected the initial dialog: the new `.recovery-review` name
collided with the existing two-column project recovery definition. A geometry
assertion run against the original packaged a0b6a7a7 went red (`aligned:false`,
`stacked:false`). The repair gives only the new wrapper a unique
`.data-restore-review` class; the old recovery styles match baseline exactly.
Focused recovery/project-recovery/dialog renewal75/75, typecheck and renderer
build pass. Independent repair reviews:Standards0/Spec0 implementation findings.
Final appearance acceptance requires the new geometry assertion and inspected
new-candidate dev/release screenshots; the old dialog captures are not accepted.

Initial native receipts are retained under `work/issue-66`: an obsolete
`details.open` completion predicate caused a reload race; it was replaced with an
observed load event and ready App without relaxing restore assertions. The next
run reached both-language restore/restart/file-preservation checks but failed its
last ordinary quit. Adding actual App readiness to launch produced a passing
run with both source outage and corrupt temporary startup preservation. This is
readiness/consumer evidence, not proof of the earlier shutdown timing cause.
Portalled errors use the actual dialog's role instead of its old parent selector.

The unchanged session native consumer passed three real shutdowns, independent
sibling/session restoration, current property/file revalidation and retained
missing-project state. The unchanged desktop shell journey passed settings
category memory, Back/context/focus, independent preferences, languages/themes
and sizes. Initial candidate dev/release recovery, session and artifact-resource checks
also passed, but their old dialog images remain rejected as described above.
New-candidate dev/release geometry and hosted receipts remain pending below.

## Selected acceptance route

Final dev/release recovery/screens/resources and the actual three-host
`desktop-ux/recovery-settings` receipts are recorded below. Exact tested/delivered
SHA and artifact provenance belong to the issue checkpoint. Installer, strict scale,
Windows11 desktop and final #67/#42 release gates remain separately owned.

## Repaired local candidate receipt

Candidate **052f6787624ae3b8dfb6cb73226286f6a81d041c**, same host/Node as above:

- Actual development and rebuilt packaged recovery consumers pass. Each mode
  retains50 screenshots, EN/RU Backup/About/review/invalid restore/source outage,
  light/dark and both supported sizes, plus original360px stress and default
  English startup-unavailable captures. Startup cannot read a failed database's
  saved language; both-language instruction variants have renderer coverage.
- The new real geometry assertion passes on every review/error theme/size.
  Inspected repaired Russian dark1024 review: candidate, warning and actions are
  one readable vertical sequence with no inherited project-recovery columns.
- Each recovery mode has4 normal app/backend shutdowns and asserted cleanup;
  restore, real download, invalid protection, restart, separate project bytes,
  source outage and unchanged corrupt disposable startup bytes pass.
- Rebuilt packaged session consumer passes3 normal shutdowns, actual restored
  session/current files/missing project/sibling independence and cleanup. Actual
  ASAR/resource/font/version/license check passes for0.1.0.
- [Local provenance and screenshot hashes](issue-66-evidence/local-receipt.json)
  retain the actual source SHA/mode. Selected screenshots are adjacent. These
  replace the rejected initial dialog appearance, without relabeling old results.

The complete source change after a0b6a7a7 is confined to the new review class and
its scoped CSS plus the native driver geometry assertion and evidence/prose.
Service/schema/native/dependency/build configuration and unrelated component/
fixture/lifecycle inputs match. Renewed recovery/project-recovery/dialog/native
consumers cover the changed boundary; other passing broad results retain their
actual earlier provenance under the approved bounded-UI policy.

## Hosted acceptance

[Run39892142679, attempt1](https://github.com/kornouhovas/workspace/actions/runs/39892142679)
completed successfully for the exact repaired candidate **052f6787624ae3b8dfb6cb73226286f6a81d041c**.
All three artifacts were downloaded and inspected. The
[hosted receipt](issue-66-evidence/hosted-receipt.json) records job/artifact IDs,
exact provenance, log/report hashes, actual kernels, counts and cleanup.

| Host | Focused tests | Artifact |
| --- | --- | --- |
| macOS latest, Darwin25.6.0 arm64 |252/252, zero skips |12475835884 |
| Windows2022, kernel10.0.20348 |251/251, zero skips |12474948341 |
| Windows latest, kernel10.0.26100 |251/251, zero skips |12475960442 |

Every host passes type/lint, backup/recovery/session/renderer/dialog/version/
artifact checks, actual dev recovery/session/shell, rebuilt package/resource
inspection, original packaged Views6 journeys and packaged recovery/session.
Per host: recovery dev/release each has50 captures and4 normal shutdowns;
sessions dev/release each has16 captures and3 normal shutdowns; Views has3 normal
shutdowns. All owned process/fixture cleanup is asserted. Recovery also preserves
corrupt startup database bytes and exercises source outage without replacing
project files. The exact repaired dialog geometry passes in both languages,
themes and supported sizes. Inspected hosted macOS Russian dark review,
Windows2022 Russian dark invalid dialog and Windows latest English light About
against the same accepted settings composition; wrapping, error/focus/selected
states and real version/full notices are consistent.

This completes #66's scoped acceptance. The one broad local invocation remains
negative as recorded above; its unchanged synthetic timing watchpoints and all
final #67/#42, installer, strict scale and actual Windows11 release gates remain
separately owned. No main merge or release is claimed. Integration/delivered SHA
is recorded in the GitHub checkpoint; report-only follow-up files do not change
any tested application/build/package input.
