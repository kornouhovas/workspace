# Decision ledger

This ledger records the product interview. Accepted choices are separate from proposed implementations. The roadmap remains provisional where its prerequisites are open.

Design tracking: [GitHub #6](https://github.com/kornouhovas/workspace/issues/6). Foundation execution step: `workspace-ty8` in the shared Beads store.

## Accepted

| ID | Decision |
| --- | --- |
| D01 | Rebuild on `new-workspace` in the same repository, preserving Git history. Replace the working tree and write fresh documentation; retain the previous implementation on its prior branch. |
| D02 | Start with clean application data; no legacy import is required. Existing external user data remains untouched. |
| D03 | Use SQLite and Drizzle for structured data; selectively adapt bb architecture/modules and its UI foundations. |
| D04 | First release is local desktop with preserved view/property capabilities, new folder configuration and EN/RU; shared-folder collaboration, AI and remote hosting follow. |
| D05 | GitHub Issues owns requirements/status; Beads owns linked execution steps and dependencies. Ralphex can plan and execute bounded implementation work. |
| D06 | Write documentation, issues, plans and commits in English; communicate with the user in Russian. English is the default product language, with Russian selectable in settings. |
| D07 | Multiple workspace configurations may use the same selected root. |
| D08 | Initially support direct projects and projects grouped one level beneath Select-value folders. Expand folder interpretation modes later. |
| D09 | The folder-backed Select's display name can be renamed independently of folder names. |
| D10 | Archive moves a project into an archive folder within its source, preserves properties and supports restore; archive is distinct from a Select value. |
| D11 | Use SemVer, target 0.1.0 first, maintain English CHANGELOG.md with Unreleased and immutable release tags vX.Y.Z. Future site/app consume the same changelog. |
| D12 | First-release platforms are macOS and Windows; Linux follows later. |
| D13 | Collaboration uses shared properties plus private/shared views; a shared view is not an Internet-public link. |
| D14 | Keep a local working database; exchange logical changes/snapshots through an opt-in hidden folder delivered externally. Support independent writers, merge compatible edits and retain conflict alternatives. |
| D15 | Remote hosting is a separate later mode in which a user's computer serves other devices. Agent/chat ownership and execution placement remain open. |
| D16 | Workspaces over the same root share projects, property definitions/values, discovery mode and archive location. Each workspace owns its view set and presentation settings. |
| D17 | Initially each workspace selects one root. Aggregating multiple roots in one workspace follows later. |
| D18 | Folder-backed Select changes explicitly move projects; renaming an option renames its folder after showing the effect. Deleting an occupied option requires a project destination and never implicitly deletes the projects. Ordinary Select edits metadata only. |
| D19 | Archive preserves the original relative path and restores to the former location. Occupied paths or missing parents require an explicit recovery choice; restoration never overwrites silently. |
| D20 | A separate local TypeScript backend process owns SQLite and product policy. Desktop starts it and presents the React UI. Remote exposure is a later opt-in authenticated capability. |

## Open design branches

| ID | Question and prerequisite |
| --- | --- |
| O01 | Resolved by D16: source owns shared data/discovery/archive; workspace owns views and presentation. Detailed shared-view membership remains in O10. |
| O02 | Resolved by D17: one source per workspace initially. |
| O03 | Can a source switch discovery mode after projects have properties? Define preview, reassociation and unavailable folders without silently losing identities. |
| O04 | D18 settles bidirectional folder-backed Select semantics. Define option creation/clearing, external renames, move collisions, empty folders, mixed-depth projects and exclusions. |
| O05 | D19 settles archive relative paths and explicit recovery. Define archive folder selection/default, archive-time collisions, archived-project views and category edits while archived. |
| O06 | Define durable project/source identity across external moves, copied roots, disconnected volumes, symlinks, case differences and replaced folders. |
| O07 | Reconcile fixed Status behavior with folder-backed Select: explicit moves, drag/drop, direct-mode values and custom-property group transitions. |
| O08 | Define required native folder actions, project creation/rename/deletion semantics and keyboard/accessibility acceptance. |
| O09 | D20 settles the separate backend process. Choose transport/lifecycle, database partitioning/driver, migration/backup/recovery policy, watcher strategy and performance targets. |
| O10 | Define local ownership and storage of private views and preferences; distinguish workspace configuration from shared-source metadata. |
| O11 | Before shared-folder implementation: choose merge protocol, device/participant identity, bootstrap/disable flows, deletion handling, snapshots/GC, offline behavior and project-file conflict boundaries. |
| O12 | Before AI: decide chat scope and ownership, supported providers, authentication, execution machine, file-write approvals, tools and concurrent agent edits. Subscription access must be verified per provider. |
| O13 | Before remote mode: define authentication, encryption, access grants, host offline behavior, remote files and mobile/browser client scope. |
| O14 | Before distribution: choose supported OS versions/architectures, signing, installer/update strategy, privacy/support policy and release automation. |
| O15 | Before website: settle product name/domain, downloads, changelog rendering/localization and publication workflow. Repository visibility remains private unless explicitly changed. |
| O16 | Decide when to turn roadmap milestones into GitHub issues and linked Beads steps; reconcile existing tasks without silently importing the legacy backlog. |

## Decision tree

Source/workspace ownership → folder interpretation and identity → folder-backed Select commands and archive recovery → schema/service contracts → preserved UI behavior → first local release.

The local model then supports three later branches: shared-folder metadata exchange; AI context and execution; remotely hosted service access. These branches require their own product contracts and failure scenarios before implementation. Versioning, attribution, localization and task tracking apply throughout.
