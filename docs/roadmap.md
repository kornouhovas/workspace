# Product roadmap

This roadmap derives from the product interview. It describes intended outcomes, not shipped functionality or delivery dates. Open choices are tracked in [the decision ledger](decisions.md). The first release boundary is accepted; ordering within later stages remains adjustable.

## M0 — Development foundation and product contracts

Deliver a fresh branch with preserved Git history, English docs, concise agent instructions, GitHub-only tracking, explicit executor selection and release policy. Preserve the previous implementation as a reference, without importing its documentation into the new tree.

Workspace/source ownership, previewed discovery-mode changes, local folder identity/recovery, typed group dragging, initial folder commands, archived editing and application-data backup scope are settled. Specify remaining folder-backed Select edge cases and archive collision behavior before their implementation slices. Convert accepted milestones into GitHub issues with measurable acceptance criteria; record execution checkpoints in GitHub under [tracker policy](issue-tracker.md). Archived Beads IDs remain historical evidence. Record source provenance for every bb module selected.

Exit: foundational docs are consistent, remaining questions are explicit, and the first implementation slice has an agreed contract and checks. Documentation scaffolding alone does not complete the design interview.

## M1 — Application and persistence foundation

Depends on the core M0 ownership and topology decisions.

- Establish the desktop shell and typed service boundary using selected bb foundations.
- Create SQLite/Drizzle ownership, initial schema, migrations and transaction helpers.
- Establish service errors, command validation and change notifications.
- Add English/Russian localization and device settings from the start.
- Add bb-based tokens/components and a component preview environment.
- Establish targeted tests, type checking, builds and OS validation in CI.
- Define development-data isolation and application-data backup/recovery paths, including automatic backups, pre-migration backups and manual new-format export/restore.

Exit: a packaged development app on each target platform can create and reopen an empty workspace with persisted settings and a verified renderer/backend boundary.

## M2 — Sources, project discovery and safe folder operations

Depends on M1 and accepted folder/identity contracts.

- Select roots; create multiple workspace configurations, including configurations over the same root.
- Support direct-project and grouped-project discovery, previews, exclusions and mode changes that retain metadata without moving files.
- Maintain project identities and reconcile external folder changes.
- Implement folder-backed Select, explicit moves and create/rename/reveal commands; workspace removal leaves project files intact.
- Implement archive, Active / Archived switching and restore with preserved properties; ordinary archived properties remain editable and folder-backed category stays fixed until restore.
- Handle unavailable roots, permission errors, collisions and interrupted operations.
- Validate Windows/macOS path behavior using isolated fixtures and actual platform runs.

Exit: all accepted source/move/archive scenarios preserve identity and metadata across restart, including documented failure/recovery cases. No filesystem action operates outside its authorized source boundary.

## M3 — Properties and views

Depends on M1; folder-backed behavior also depends on M2.

- Implement typed property definitions, values, Select options and validation.
- Implement view lifecycle and independent duplication.
- Rebuild Table and Board with grouping, filtering and name search.
- Preserve visibility/order controls, row/group ordering, widths and wrapping.
- Reconcile fixed Status interactions with the new folder-backed Select model.
- Add grouping-property changes through dragging in Board/Table for all property types, with explicit assignment and destination rules; ordinary Single Select can drop into its empty group to clear the value.
- Add empty/loading/error states, keyboard behavior and accessible interactions.
- Validate every row of the [preservation baseline](product.md), including persistence after restart and shared-root configurations.

Exit: each baseline capability has an observable acceptance scenario; source-scoped values and workspace/view settings obey their settled ownership rules. No feature is considered preserved solely because it appears in the UI.

## M4 — Local release 0.1.0

Depends on M2 and M3.

- Complete macOS and Windows installers and the selected signing/distribution path.
- Complete the [desktop experience specification](specs/workspace-desktop-ux.md): main-derived working journeys with the accepted single-project-area model, Radix/Tailwind and bb-style settings; verify the complete daily workflow rather than isolated controls.
- Exercise realistic folder counts, startup and view interactions against agreed performance targets.
- Verify language switching, fallback and user-authored text preservation.
- Verify migration, automatic and pre-migration backups, manual export/restore and upgrade behavior for new-format application data; do not claim project-file recovery from metadata backups.
- Complete release notes, version consistency checks and license/provenance review.
- Document installation, supported environments and recovery/support paths.

Exit: both platforms pass the release and desktop UX acceptance matrices, including renewed performance and session-recovery checks on the integrated UI, and the approved release process produces versioned artifacts. Creating a tag or publishing downloads requires release authorization. Legacy application-data import is excluded.

## M5 — Shared-folder collaboration

Depends on a stable local identity and data model; implementation follows the first local release.

- Define and validate the metadata exchange protocol using concurrent/offline prototypes.
- Enable/disable hidden-folder sharing and onboard a fresh computer from exchange data.
- Share property definitions, values and shared views while keeping private views private.
- Merge compatible edits; retain and resolve conflicting alternatives without blocking unrelated work.
- Handle duplicate/out-of-order delivery, stale devices, deletes, snapshots and safe cleanup.
- Define visibility of provider/file conflicts and recovery from interrupted synchronization.

Exit: multi-device scenarios reconstruct the same accepted state without losing conflict alternatives. A live SQLite file is never the shared synchronization unit.

## M6 — AI work with project context

Depends on accepted AI product/security contracts and the local service boundary; exact ordering relative to M5 remains open.

The user deferred the parallel-agent working-file policy to this stage's implementation design. Decide shared directories versus isolated versions, non-Git behavior, result application and cleanup before implementing concurrent editing; none is an accepted default yet.

- Implement personal project-scoped chats with local Codex execution and API-key authentication.
- Validate the Codex App Server adapter and keep provider credentials on the executing host.
- Implement Discussion and Work on project modes, session persistence, observable execution and enforced tool permissions.
- Support parallel editing agents within a project with an explicitly selected working-file isolation and result-application workflow.
- Define human review, cancellation, errors and recovery. Shared chats, other providers/subscription login and remote-host execution are later additions.

Exit: an end-to-end authorized task operates on the intended project context, preserves session ownership and exposes changes/errors clearly. Provider access is tested rather than inferred from a consumer subscription name.

## M7 — Hosted access and additional clients

Depends on authenticated remote-service and filesystem-access contracts.

- Let a desktop host expose the service to its owner's other devices through explicit settings.
- Add owner-device enrollment, authentication, transport protection and access revocation; multi-user invitations/roles follow later.
- Provide remote views/property editing, chats with execution on the host, and project-file viewing/downloading. Full mobile file editing is a later capability.
- Build a responsive mobile browser client with connected-only operation, clear disconnect state and state reload on reconnect; do not replay an offline queue of changes/commands. Native mobile applications follow only if needed.
- Validate remote access independently of shared-folder exchange.

Exit: an authorized second device can use the intended workspace safely, with observable host availability and tested revocation. This is not implied by merely starting a local HTTP listener.

## M8 — Website and ongoing distribution

Release metadata foundations start in M0; the public site can be scheduled when naming and distribution are settled.

- Build a product site with installation information, downloads and changelog.
- Render the same versioned changelog used by the application.
- Connect immutable release versions to correct platform artifacts.
- Include attribution and the agreed language/support/privacy surfaces.
- Ensure changelog-only changes trigger the intended site publication workflow.
- Add Linux and expanded folder interpretation as separately scoped roadmap work.

Exit: published pages match released artifacts and notes. Source repository visibility stays private unless separately authorized; publication itself remains an explicit action.
