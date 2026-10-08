# T34: Keep discovery and views responsive at an agreed project scale

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Use the installed app with a representative source and property dataset while discovery, filtering, grouping and edits remain responsive within agreed limits.

Roadmap scope: M4. Specification user stories: 1, 49, 50, 54, 55, 57, 67, 73.

## Acceptance criteria

- [ ] Before optimization, record representative project/property/view counts and measurable startup, scan, view-interaction and memory targets; no unagreed performance claim is accepted.
- [ ] Build reproducible disposable direct/grouped datasets and measure packaged macOS and Windows behavior rather than a renderer-only mock.
- [ ] Fix demonstrated bottlenecks across query/scan/render boundaries as necessary; retain exact membership, ordering and logical identity semantics.
- [ ] Large-view loading and refresh expose useful progress/error states and do not lose accepted edits; include filtered group dragging and external-change refresh in the measured scenarios.
- [ ] Record before/after results against the chosen targets and run affected correctness regressions; leave unrelated optimization out of scope.

## Blocked by

- T08: Reconcile unambiguous external folder changes
- T24: Customize Table columns and manual row order
- T25: Customize Board columns and card wrapping
- T26: Change scalar and Single Select values by group dragging
- T32: Install and reopen the local app on macOS
- T33: Install and reopen the local app on Windows

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
