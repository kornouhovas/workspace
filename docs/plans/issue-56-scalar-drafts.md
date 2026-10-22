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
