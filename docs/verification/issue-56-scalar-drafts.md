# Issue 56: scalar editor acceptance map

Issue: [#56](https://github.com/kornouhovas/workspace/issues/56).
Base: `b0b19ad18e85f4d955c5bd33b62bd9fbcf8f9693`.
Verified application: `b94ef85c44b6e2b4510251bc0e446e524205fe71`.
[Plan, diagnosis and inherited-test decisions](../plans/issue-56-scalar-drafts.md).
GitHub owns the final delivered SHA and integration receipt.

Scoped acceptance passes in [39809408645, attempt1](https://github.com/kornouhovas/workspace/actions/runs/39809408645),
`checks=desktop-ux`, `desktop_ux_profile=scalars`. All three selected jobs succeed;
all logs and artifacts were downloaded and inspected. This accepts the bounded
editor/navigation slice under the [verification matrix](../desktop-ux-verification.md),
not the final #67/#42 startup, installer or release milestone.

## Requirements and behavior

| Requirement | Evidence |
| --- | --- |
| Text Enter/newline, Cmd/Ctrl+Enter/blur, Escape/Cancel, authored empty versus Clear | Shared Table/Board/details public-service UI scenarios in EN/RU; inherited Text renderer/service checks; actual scalar dev/release journeys |
| Number arithmetic persists only the result; manual Date validates and stays timezone-free | Scalar/service UI scenarios; original Number and Date dev/release commands on all3 hosts, including extreme years/timezones, restart and exact stored values |
| Calendar selection commits immediately; dismissal does not revert | Native scalar matrix and all3-surface EN/RU UI cases, with canonical public-query values |
| Valid input saves before project/view/workspace/Settings/history/close; invalid/failed draft blocks until correction or Cancel | Real-service UI failure/lost-response/transition scenarios; native workspace/project invalid guards, correction and valid Date blur+close |
| Enter+blur/rapid transitions do not duplicate, auto retry or overwrite newer revisions/owners | Controlled public desktop boundary with real service and delayed/lost responses; inherited source/lifetime/revision scenarios; one pending write shared by blur/transition |
| Same-source refresh retains draft/focus and still admits new rows | Regrouping and reduced grouped-discovery regressions; inherited configured-mode roundtrip requires both retained statuses; original navigation/filter/viewport consumers |
| Focus, Escape ownership and shared presentation | Preview/expanded close save-and-return-focus regressions; native scalar trigger-focus assertion; original32-variant project navigation; appearance below |
| Inherited guarantees retained | Explicit retain/adapt decisions in the plan; all selected current renderer/service/viewport/navigation cases pass; no storage, isolation, recovery or platform promise retired |

The existing common editor owns values; the renderer uses typed services. A single
draft registry gates transitions and awaits the existing pending request. Invalid
or failed writes retain their draft and require correction, explicit Save or
Cancel. Existing identity/lifetime/minimum-revision checks remain. While a scalar
editor owns a draft, relocation/removal of existing projected rows is deferred;
newly observed filter/group IDs are admitted. Values and revisions keep updating.

## Hosted receipts

Every row below is from the exact application SHA above, run39809408645/attempt1.
Artifacts are named `desktop-ux-foundation-<host>`; their provenance envelopes
record SHA/run/attempt/profile/platform, including older child reports that record
SHA/mode but do not repeat run/attempt. No failed or skipped step is counted.

| Actual runner | Selected tests | Runtime reports inspected | Scalar captures | Native exit and cleanup |
| --- | --- | --- | --- | --- |
| macos-latest |871pass,0fail,0skip |8 |144 |17 recorded normal app/backend quits plus original navigation normal exit; owned cleanup passes |
| windows-latest |870pass,0fail,0skip |8 |144 |Same |
| windows-2022 |870pass,0fail,0skip |8 |144 |Same |

Each host's8 reports are scalar dev/release24 cases each, original Number dev/release,
original Date dev/release, original project navigation and packaged saved views.
Number/Date each complete2 language checks and3 normal quits per mode; Views
completes6 checks/3 normal quits. Build, typecheck, lint, package/resource/font/
license inspection and original commands pass. Separate Number/Date release
paths preserve their development receipts. Local receipt hashes and all24 report
validations are in `work/issue-56-ci-39809408645/inspected-ledger.json`.

## Appearance

References remain main `080b416c57b2869024ac62363e96b68b40f499c0` composition
and bb `f135a001e72942cee9118d2693208ec0725e2f18` styling through the
[accepted #69 map](issue-69-coherent-desktop.md). Compared accepted
`visual-af23242/ordinary-en-light-1024-value-editor.png` and
`files-af23242/preview-en-light-1440.png` with current whole windows.

The432 hosted scalar captures cover Text, invalid Number and calendar Date in
Table/Board/details, EN/RU, light/dark and1024x720/1440x960, in dev/release.
Inspected representative Table/Board/details captures locally and on each hosted
OS: focus/error borders, wrapped actions, hint text, canonical/manual/calendar
Date and narrow project scrolling retain the shared controls and principal
composition. No material composition/style mismatch was found. Native date-field
presentation follows the host; persisted and manually edited dates stay canonical.
No CSS, font, icon, dependency or upstream module was added. Existing long-content
styles/reference evidence remain unchanged; behavioral tests do not substitute
for the recorded comparison.

## Local checks, failures and repairs

- Focused repair files122/122, route16/16, performance fixture/query controls3/3,
  typecheck, lint, Markdown links and whitespace pass. Independent Standards0 and
  Spec0 remaining findings, including follow-up review of each repair/driver.
- One complete `npm test` at9d83956 reported3315pass/2fail/27skip (3344reported).
  Ladle403 came from a local dependency symlink outside Vite's serving boundary;
  real local dependencies fix it without changing serving permissions. The other
  failure was the pinned projection hiding a newly discovered retained project.
  Original39807241669/attempt1 reproduced that exact count2vs1 on all3 hosts:
  Mac869pass/1fail/0skip; each Windows868pass/1fail/0skip. No native tail ran.
  A wait alone failed. Public query2/DOM1 and the reduced discovery regression
  establish the projection defect; the repair and exact original cases pass in
  the final run. These failed overall runs are never relabelled green.
- Spec review's close-focus defect was reproduced and fixed by putting close and
  focus restoration in one accepted action; preview and expanded-tab tests retain
  persisted15 and the original trigger focus.
- Date's old Settings-with-invalid-draft journey is superseded by the guard. The
  driver asserts blocking, Cancel, actual language controls and canonical reopen/
  invalid validation in the other language. Existing Date UI retains live
  language-rerender draft ownership. Original timezone/restart/data/quit assertions
  remain and pass on all hosted modes. Local macOS27.0/26A428 had an unchanged10s
  normal-quit failure before restart; that local command remains failed, with
  forced/owned cleanup passing. Hosted success does not claim its local cause fixed.

## Scale and limits

An additional original packaged strict1000-project/20-property/10-view run exposed
an old assumption that focusing Refresh leaves valid Text unsaved. The adapted
consumer separately verifies blur commit and public external refresh with an
offscreen retained draft without moving editor focus, Escape and restart; both reviewers report0
findings. Numeric limits and all original identity/file/native assertions remain.

Complete local renewal on the sameb94 application:34 measurements,10 memory samples,
4 normal app/backend quits, all functional/ownership/restart/cancellation checks
and owned cleanup complete. Direct Table/Board edits113.2/75.5ms and grouped
Table/Board112.3/75.9ms meet300ms; peak upper-bound memory949862400bytes is below1GB.
The **overall strict command fails**: cold direct startup5577.3ms exceeds5000ms,
its sole numerical miss. No unique cause or startup regression attribution is
proved; an earlier contradictory passing startup sample is not substituted.
Scoped editor/event-cost evidence passes; full startup acceptance remains at the
already-owned #67/#42 milestone, and no startup limit is waived here.

The local report is `work/issue-56-scale-renewal/report.json`, with application SHA,
source-diff hash and tested driver SHA256
`09019fc434e56a6e48508b43bb7008d8f55d73faea0258097cd9d5d95557d78f`.
The final performance-driver follow-up changes no application, dependency,
backend, native, build/package or scoped-CI consumer input. Existing passing hosted
receipts retain their actualb94 SHA. Windows11 manual release acceptance, final
integrated performance/installer/recovery and release #67/#42 remain separately
owned; no release or main merge is claimed.
