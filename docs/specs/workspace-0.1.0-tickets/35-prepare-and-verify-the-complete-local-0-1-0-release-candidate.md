# T35: Prepare and verify the complete local 0.1.0 release candidate

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Produce a verifiable local release candidate on both target platforms with the complete accepted workflow, release notes and recovery guidance. This is release integration and acceptance, not permission to publish.

Roadmap scope: M4. Specification user stories: 1–75 (integration verification; implementation ownership remains with the earlier tickets).

## Acceptance criteria

- [ ] Run the specification acceptance matrix against the same candidate revision on actual macOS and Windows; link every user story to its implementation issue and actual evidence.
- [ ] Exercise integrated interactions: archive with every ordinary property type, workspace/view isolation, external changes, category operations, all-type dragging, configured-view deletion cleanup and full-format export/restore.
- [ ] Inspect EN/RU fallback, user-authored text preservation, keyboard access, narrow layouts and empty/loading/error/recovery states across the completed workflows. Features must already include these checks; this ticket verifies their composition.
- [ ] Verify new-format upgrade/pre-migration recovery, installers, supported-environment guidance, runtime isolation, version consistency and distributed notices; document any real platform/signing limitation as an unmet acceptance item.
- [ ] Prepare accurate English release notes and installation/support/recovery instructions alongside identifiable artifacts. No stable tag, external publication or issue closure is inferred from merely producing a candidate.

## Blocked by

- T10: Create project folders and reveal them in the file manager
- T14: Remove occupied categories with an explicit destination
- T27: Replace MultiSelect membership by group dragging
- T28: Rename and move real folders through group dragging
- T29: Delete custom properties and ordinary options without broken views
- T31: Create automatic and pre-migration backups with recovery
- T34: Keep discovery and views responsive at an agreed project scale

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
