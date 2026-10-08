# T13: Create and rename category folders through Select options

Draft for owner approval. Not published; no GitHub issue or Beads execution step has been created for this ticket.

## Parent

[Workspace 0.1.0 specification — GitHub #7](https://github.com/kornouhovas/workspace/issues/7).

## What to build

Create a folder-backed category and rename a category option after previewing the effect on its real folder and contained projects.

Roadmap scope: M2. Specification user stories: 22, 23, 28, 30, 44.

## Acceptance criteria

- [ ] Creating a category option creates or explicitly associates an eligible category folder under the source; settle existing/empty-folder rules before enabling the action.
- [ ] Rename preview lists the folder operation and affected projects; cancel leaves all state untouched.
- [ ] Applying a valid category rename retains project IDs/values and updates category projections, locators and sibling workspaces after restart.
- [ ] Display-label changes remain metadata-only; invalid names, collisions, stale previews and source escapes fail without overwriting.
- [ ] Color, hide/show and option-order controls preserve category identity and use an explicit presentation scope without renaming or moving folders; interruption and external-change fixtures verify recoverable operation state.

## Blocked by

- T12: Move projects by editing folder-backed Select

## Verification and boundaries

Test the observable result through the typed Workspace service with temporary real SQLite and filesystem fixtures where applicable, plus focused UI/IPC or actual-platform checks. Every new UI surface includes EN/RU text, keyboard operation and relevant empty/loading/error states. Extend regression fixtures when new types or workflows are added. Preserve the accepted source/workspace ownership, selected-source containment and renderer isolation. Record copied bb module provenance and applicable notices in any ticket that introduces them.

Resolve this slice's listed design details before its dependent mutations; ordinary implementation choices stay within the accepted contract. An unresolved consequential product choice requires a specific owner decision, not a silent new requirement. Keep synchronization, AI, remote access, website and legacy import out of scope.
