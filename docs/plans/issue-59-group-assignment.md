# Issue 59: ordinary group assignment

Baseline: `711eb15127bbb69bedb46cba125db9741f50f7eb`, after #58 closed.
Tracker: [#59](https://github.com/kornouhovas/workspace/issues/59).

## Contract and scenarios

Reuse the existing typed assignment service and exact scalar/Single Select and
MultiSelect semantics from #33/#34. No schema, IPC, filesystem or dependency
change is planned. Table and Board retain separate row/group ordering controls.

- Retain service/IPC/UI coverage of exact and empty values, source membership,
  destination validation, source-sibling ownership, unrelated values, revision
  races, filtered disappearance, reopen and failure/unknown-outcome observation.
- Add observable drag feedback, destination highlighting and Escape/end cleanup;
  a cancelled gesture cannot later submit its stale payload. Assignment does not
  optimistically relocate a row/card or replay an uncertain command.
- Protect active drafts and pending assignment from competing local edits and
  navigation. Observe newer accepted updates rather than applying an old reply.
- Keep existing keyboard selector/clear controls and focus return, including when
  filters remove a project. Inspect EN/RU, light/dark and 1024x720/1440x960.

## Verification and inherited scenarios

Agreed seams: public typed Workspace service with disposable real SQLite and
folders, IPC validation, renderer user interactions and real Electron journeys.
Use Matt Pocock TDD for new interaction guarantees. Retain existing assignment
service/IPC/UI and original native Views all-type assignment consumers; add
cancel/draft/pending cases at the renderer seam. Existing native payload and
ordering checks remain. No inherited requirement is retired.

Run focused checks and regular typechecking, early actual-screen comparison,
Spec/Standards review, then one full local suite on the completed candidate.
Record failures and scoped renewal separately. Select an actual three-host CI
profile for this boundary, inspect provenance/reports, then integrate under the
owner-authorized route. Wider release/platform gates remain with #67/#42.

## Visual handoff

Composition authority: main `080b416c`, `table-view.tsx` / `board-view.tsx` and
its project-status-drag journey; component/typography authority: bb `f135a001`,
retained Inter/Radix/Tailwind foundation. Accepted local comparison: #58's
`Board-ru-light-1024-review.png` and the inherited grouped Table/Board screens.

`GroupAssignment` retains separate drag, native keyboard destination and clear
controls. `TextPropertiesTable` owns gesture lifetime, target and actual-query
feedback. Target outline uses `--ring`, background uses `--accent`; the existing
`StatusMessage` supplies EN/RU text, borders and typography. The drag hint floats
inside the viewport with pointer events disabled, avoiding source movement and
preserving access to destinations. No new bb source or dependency is copied.

Deliberate differences from main remain: ordinary properties use typed metadata
commands, MultiSelect uses source-occurrence replacement, and assignment is
separate from row/group ordering. There is no optimistic relocation. The shared
shell, project area and accepted row/card/group presentation are retained.

Observed correction: inserting/removing feedback during drag moved the source.
A controlled production-CSS probe measured 47.8125px after removing a prior saved
message. Retain that message until an actual submission and float the drag hint;
the native layout regression now proves an identical source bounding box.

Delivery evidence and remaining CI gate: [verification](../verification/issue-59-group-assignment.md).
