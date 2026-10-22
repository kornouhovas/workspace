# Issue 56: scalar drafts and navigation

Issue: [#56](https://github.com/kornouhovas/workspace/issues/56).
Start: `b0b19ad18e85f4d955c5bd33b62bd9fbcf8f9693`, accepted integration after #55.
Blockers #54/#69 are closed. Matt Pocock execution; no Ralphex.
Current delivery/CI status belongs to the GitHub checkpoint.

## Scope and agreed seams

Use the existing common editor and accepted #69 composition in Table, Board and
project details. Keep backend validation, result-only Numbers, timezone-free Date,
empty versus absent Text, source identity and monotonic snapshots. No migration,
new dependency, filesystem command, installer or release change is planned.

The owner confirmed three test seams: public Workspace service with disposable
real SQLite/project roots; UI user actions; actual Electron/native keyboard,
focus and whole-window appearance. Tests observe values through public queries.

## Scenario and acceptance map

- Text: Enter newline; Cmd/Ctrl+Enter and blur commit; Escape/Cancel discard;
  authored empty string and explicit Clear remain distinct.
- Number: Enter/blur commits arithmetic result; reopening shows result. Invalid
  expressions retain editable draft and block leaving; correction/cancel recovers.
- Date: manual Enter/blur and validation; calendar selection commits immediately;
  picker dismissal preserves committed values; no timezone conversion.
- Shared navigation: project preview/tab/close/expand/return, saved view,
  workspace/settings/Back/Forward wait for valid pending saves. Invalid/failed
  saves retain editor/focus and require correction or explicit cancellation.
- Async ownership: Enter plus blur joins one request; rapid transitions do not
  queue or duplicate writes; failed/lost reply does not auto retry; explicit Save
  retries; same-source notifications preserve draft and minimum revision; delayed
  replies cannot replace newer snapshots or another source/project's editor.
- Appearance: compare the same three scalar editors in Table/Board/details with
  accepted #69 whole-window composition (main080b416c/bbf135a001); EN/RU, both
  themes, 1024x720/1440x960, focus/error/pending/cancel/return inventory.

## Inherited test retention

Retain Number and Date UI/service suites (validation, arithmetic, extreme dates,
language draft lifetime, delayed/lost replies, revision ownership) and existing
Text service/UI checks (empty/absent and exact authored content). Adapt only a
superseded explicit interaction when blur now owns a valid commit; name each
adaptation and replacement here. Retain project navigation/sessions, Select,
MultiSelect, grouping/filter/virtualized-row and renderer isolation guarantees.
New scalar UI checks cover multiline blur and invalid-draft navigation. No
scenario is retired solely for failure or maintenance cost.

## Verification selection

During implementation run focused scalar/navigation/renderer files and typecheck.
Before acceptance run lint/type/docs/build, the completed full suite once, real
Electron scalar/navigation and existing Number/Date runtime consumers. Select a
matching three-host desktop UX CI profile for new editor/navigation behavior.
Installer inputs remain unchanged; broad installer/release milestones retain
#69/#67/#42's owners. Appearance, behavior and retained safety evidence are
recorded separately; failed/unreached checks remain explicit gates.

## Observed development evidence

- Multiline Text blur regression: red (no save), green after shared editor repair.
- Invalid Number project replacement/close regression: red (Atlas replaced by
  Beacon), green after shared registry/navigation integration.
- Typecheck passes after both slices. Initial shell Node26 build was rejected by
  the existing native fixture requirement; use pinned Node22.21.1 for all checks.

## Retention reconciliation and additional reproduction

- `renderer-app.test.tsx` multiline pending/failure/clear scenario: adapt the
  superseded “blur must not save” assertion to D54's one blur submission; pending
  Enter joins that write. Keep every transport/validation/explicit retry/cancel,
  focus, exact content, empty-string and Clear assertion.
- Grouped Apply rescan, category-label editing, needed-category observation and
  configured-mode round-trip scenarios previously focused other controls while
  assuming a valid Text draft stayed unsaved. Adapt those fixtures to one explicit
  failed Text save at the public desktop boundary, preserving their same editor,
  draft, source/category identity, exact persisted Text, recovery and observation
  assertions. Update only the expected one failed blur attempt; notifications do
  not replay it. The new scalar scenarios cover successful blur instead.
- Retained-source retry scenario keeps all source/list-failure/draft assertions
  and expects the single failed blur attempt. Automatic blur failures leave focus
  with the user's source action; guarded transitions restore focus to the draft.
- A same-source sibling Number update regrouped the edited Text row and discarded
  its active editor (new real-service UI regression red). Keep the rendered
  grouping/filter projection while any scalar editor owns a draft; values and
  monotonic revisions continue updating. Release the latest projection on
  save/cancel (green). This parallels existing offscreen draft retention.
- Project-navigation label/focus scenarios are retained unchanged: clicking the
  field's own label focuses it without submitting blur or opening a preview.
  Existing Select/MultiSelect behavior remains unchanged.

Original Date native driver adaptation: D55 blocks entering Settings with invalid
Date. Replace the now-unreachable native Settings-with-invalid-draft journey with
blocked Settings, Cancel, actual language controls and invalid-date checks in the
other language. `date-properties-ui.test.tsx` retains live language-rerender draft
ownership at its public UI seam. Original timezone boundaries, saved values, focus, restart,
clear, project bytes and normal-exit/cleanup gates remain. The first original
negative and its later renewal are recorded in the verification map.

## Review repair

Independent Standards review reported no findings. Spec review found a return-focus
regression: separately guarded focus restoration was dropped while closing a
project awaited a valid pending save. Preview close reproduction failed with
focus on no trigger, then passed after close and return-focus scheduling became
one guarded action. Remove the redundant separate focus API. Added expanded-tab
close regression and actual native Date blur-plus-close trigger-focus assertion.
Focused scalar/navigation renewal:30/30 pass; typecheck/lint pass. Independent
Spec follow-up confirms the repair and reports no remaining findings.

## Full run and original Actions repair

The one complete local `npm test` on9d83956 reported3315pass/2fail/27skip
(3344reported tests). Ladle's403 was an environment defect: a dependency symlink
resolved outside Vite's serving boundary. Replace that local symlink with a real
APFS-cloned dependency directory; do not expand application serving permissions.
The original Ladle file then passes.

Original `desktop-ux/scalars`39807241669/attempt1 fails on all3 hosts at the
configured-mode round-trip's exact retained-status count (expected2, actual1).
macOS869pass/1fail; each Windows868pass/1fail/0skip. Native/package commands
are unreached, not accepted. Artifacts/provenance and original job logs are
retained locally under `work/issue-56-ci-39807241669` and `/tmp/issue56-ci-*.log`.

Diagnosis loop: original mode test plus reduced public-service/UI grouped
new-discovery scenario. Ranked hypotheses: pinned projection hides new enrollment
(public query2/DOM1 until release), independent read timing (eventual wait alone
passes), or service enrollment mismatch (public count also1). A wait alone failed;
service retained Category+Project and queryView2 while DOM showed onlyProject.
The reduced discovery scenario fails against the pristine9d83956 Table source
and passes with the repair, retaining the active editor/focus/draft and showing
new Cedar. This establishes projection membership, not timing, as the defect.

Repair: defer relocation/removal of existing editor owners but admit newly
observed filter/group IDs, including previously empty groups. Preserve source,
view and group-property boundaries; Map/Set joins stay linear. The inherited mode
scenario still requires exactly2 statuses and awaits independently updated rows.
No requirement/assertion/deadline is removed. Both independent review axes report0
remaining findings. Renew affected files and the original3-host scalar/native/
package route; retain the failed full/Actions conclusions. Separate packaged
Number/Date evidence paths prevent overwriting development receipts.

## Optional broad scale consumer reconciliation

The original packaged strict1000-project/20-property/10-view command reached a
superseded interaction: it focused Refresh while expecting valid Text to remain
unsaved. D54 now commits that blur. Adapt the driver to verify the committed value,
then separately keep an offscreen draft through public external refresh without
moving focus, Escape and restart. Preserve exact IDs/project bytes, ordinary UI
refresh event-to-paint measurement,300ms/5s/1GB limits and native cleanup. Both
independent review axes report0 findings; fixture/query controls3/3 and lint pass.

Original broader attempt: direct Table112.9ms/Board75.6ms edits and normal exit,
but missing-textarea assertion fails before grouped mode. Complete adapted renewal
uses the sameb94 application with the recorded changed-driver hash:34 measures,
10 memory samples,4 normal app/backend quits, owned cleanup and all identity/
value/restart/cancel assertions complete. Editor durations: direct Table113.2ms,
Board75.5ms; grouped Table112.3ms,Board75.9ms. Memory maximum949862400bytes.
The overall strict command remains **failed**: cold direct startup5577.3ms exceeds
5000ms (only numerical miss). The earlier same-app cold4234.5ms is not substituted
for this contradictory sample. No unique cause or startup regression attribution
is proved. Scoped editor/draft event-cost rows pass; full startup/installer/release
acceptance remains the already-owned#67/#42 milestone boundary. Do not claim a
green full strict run, change a limit or treat this as numerical startup acceptance.

## Final scoped receipt

[39809408645/attempt1](https://github.com/kornouhovas/workspace/actions/runs/39809408645)
atb94ef85c passes all3 selected jobs. Actual totals: Mac871/871, eachWindows870/870,
0fail/0skip. All24 runtime reports,432 scalar screenshots' manifests, provenance,
normal exits and owned cleanup inspected;17 explicit normal quits plus original
navigation normal exit perhost. Build/package/resource gates pass. Correction to
an earlier checkpoint: the initial Windows run had868pass/1fail/**0skip**; its
one-test inventory difference from macOS was not a skipped test.

Final application inputs are unchanged from that run. The final uncommitted
follow-up is only the reviewed performance consumer and documentation; its tested
harness hash matches the report. Preserve b94 hosted receipts at their actual SHA
and the failed local full/strict outcomes. Delivery/integration SHA belongs to the
GitHub checkpoint. No next issue, main merge or release is selected.
