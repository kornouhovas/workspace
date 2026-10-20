# Issue 50: Shared source settings

Scope: [#50](https://github.com/kornouhovas/workspace/issues/50), parent #47.
Baseline: `e1de3d8e`, verified #49 application plus documentation-only policy updates.
Executor: Matt Pocock implement/TDD, not Ralphex.

## Scenarios and seams

- Public typed Workspace service with real temporary SQLite/folders: list unique sources and their workspace relationships without activating another workspace; retained orphan sources; current mode/exclusions/archive and availability.
- Renderer interactions: Sources list/detail, source-wide disclosure, settings Refresh/retry, direct/grouped reviewed discovery, stale review and cancel; archive empty-only review; EN/RU keyboard and independent operations.
- Electron: settings and working-area entry, two workspaces sharing configuration while retaining views, light/dark at 1024x720 and 1440x960.
- Retain existing discovery-mode/grouped/direct, reconciliation, recovery and archive service/journal tests. Adapt affected settings renderer/native locators only where the accepted navigation changes. No data-safety requirement is retired.
- Run typecheck/focused checks during implementation; review completed candidate before one full suite. Platform/CI acceptance and integration remain gates until actual evidence exists.

## Progress

Implementation in `codex/issue-50-source-settings`; checkpoint remains issue #50.

Inherited scenario decisions: retain all service/journal/renderer scenarios; adapt
`scripts/smoke-desktop-shell.mjs` Sources entry by selecting the source from its new
list before the same preview/cancel assertions. Replace the active-workspace
portal with a source-specific settings controller: settings selection must not
activate a different workspace. Existing working-area setup remains reachable.
Add `smoke:sources` to the ordinary three-platform desktop matrix; retain original
shell/management and all platform suites. No inherited requirement is retired.

Local implementation/review evidence: [verification](../verification/issue-50-source-settings.md).
The complete source candidate has no remaining Standards/Spec findings. Retain the
reported full-run failures and renewed affected evidence rather than describing the
initial full run as all-green. Current CI/integration state remains in issue #50.
