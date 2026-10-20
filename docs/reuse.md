# bb reference and attribution

## Reference baseline

The inspected bb commit is `f135a001e72942cee9118d2693208ec0725e2f18`. Pin provenance to the revision actually copied; later upstream changes require a fresh comparison.

| Reference | Use |
| --- | --- |
| [AGENTS.md](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/AGENTS.md) | Concise boundary rules, contextual links and proportionate verification |
| [Desktop app dependencies](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/package.json) and [components config](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/app/components.json) | UI framework/component foundations |
| [Database connection](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/connection.ts) and [schema](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/packages/db/src/schema.ts) | SQLite/Drizzle patterns, to adapt to Workspace's own domain |
| [Release process](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/docs/bb-release-process.md) and [version script](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/scripts/bump-version.mjs) | Version consistency and Git-maintained release notes |
| [Changelog parser](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/changelog-parser.ts) and [site route](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/apps/web/src/routes/changelog.tsx) | One source for app/site release notes |
| [MIT license](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/LICENSE) | Root license terms and copyright notice |

## Adaptation policy

Use bb as a source of architecture, components and carefully selected code. Keep Workspace's project/source domain explicit. Before copying a module, identify its runtime dependencies, data assumptions, build seams and applicable notices. Prefer a small coherent extraction over importing unrelated session/chat behavior.

The new AGENTS.md borrows the compact organization and focus on boundaries, not all bb-specific policies. Cloudflare, iOS, plugin requirements and bb CLI parity are not automatically Workspace requirements.

## Attribution

Suggested description for architectural inspiration:

> Workspace is inspired by the architecture and ideas of bb.

When implementation code is actually adapted, extend this with an accurate statement that selected code is adapted from bb under the applicable license. bb's root MIT license names **Copyright (c) 2026 Michael Yong** and requires its copyright and permission notice to be included in copies or substantial portions. Keep the complete applicable license text with copied code or distribution notices; an inspiration sentence does not replace it.

Check nested notices too: bb's browser-automation plugin, for example, has a separate [DevBrowser notice](https://github.com/get-bb/bb/blob/f135a001e72942cee9118d2693208ec0725e2f18/plugins/browser-automation/DEVBROWSER-LICENSE). This is not a full audit of future selected dependencies.

## Adapted UI foundation

The initial settings screen uses these adapted controls and styles; the application has no general-purpose bb package dependency. The provenance and notice test in `tests/components.test.tsx` guards the local source record and full notice. The artifact check verifies that the notice is included in packaged resources.

The language control and status/empty-state primitives in `src/renderer/components/bb-foundation.tsx` and `bb-foundation.css` are adapted from the following source patterns:

| Upstream source | Destination | Adaptation |
| --- | --- | --- |
| `packages/shared-ui/src/components/ui/label.tsx` | `src/renderer/components/bb-foundation.tsx` | Retained the associated visible label and compact medium-weight label styling. |
| `packages/shared-ui/src/components/ui/select.tsx` | `src/renderer/components/bb-foundation.tsx`, `bb-foundation.css` | Used a native HTML select for the two language choices, preserving browser keyboard behavior without importing the Radix/responsive overlay stack. |
| `packages/shared-ui/src/components/ui/alert.tsx` | `src/renderer/components/bb-foundation.tsx`, `bb-foundation.css` | Kept the bordered status panel, title/description hierarchy and alert role for errors; limited variants to informational and error states. |
| `packages/shared-ui/src/components/ui/empty-state.tsx` | `src/renderer/components/bb-foundation.tsx`, `bb-foundation.css` | Adapted the bordered, centered empty-state panel without the upstream icon dependency. |

Upstream repository: [get-bb/bb](https://github.com/get-bb/bb), revision `f135a001e72942cee9118d2693208ec0725e2f18`. Complete upstream root MIT license notice: `src/renderer/components/bb/LICENSE`. No unrelated chat, session, table or mobile modules were copied. Ladle previews and component checks cover both languages and status states. This entry records UI-pattern adaptation; it does not claim line-for-line component copying.

Verify the actual distributed contents before each release. Reuse does not imply endorsement by bb or its authors.

## Issue 48 desktop shell

At the same pinned bb revision, inspected `apps/app/src/components/settings/SettingsSidebar.tsx`,
`apps/app/src/components/ui/settings-section.tsx`, `apps/app/src/components/ui/theme.css`
and `apps/app/src/hooks/useAppSettingsRouteMemory.ts`. `DesktopShell.tsx` adapts the
section sidebar, Back action, selected rows, heading/card hierarchy and in-session
settings-route memory patterns. `app.css` adapts semantic background/foreground,
sidebar, muted, border and ring roles and compact desktop typography. Workspace's
neutral palette, layout, state and service wiring are local implementations; bb's
router, plugins, mobile routes, chat/session state and large theme inventory were
not imported. This is a pattern adaptation, not a claim of verbatim module copying.

Pinned compatible foundation: Radix Tabs 1.2.1 and Radio Group 1.5.1, Tailwind CSS
and its Vite plugin 4.3.3, with the existing React/Vite versions. Selection was checked
against npm metadata and the committed lockfile; actual builds and interactions
are recorded in the issue verification report. The full bb MIT notice remains at
`src/renderer/components/bb/LICENSE` and in packaged resources. Radix and Tailwind
retain their dependency licenses in the npm dependency tree.

## Issue 50 shared source settings

Sources uses the existing issue-48 section/card, semantic theme and keyboard
foundation with a local source list/detail controller. No additional upstream
module is copied. Existing discovery and archive review services remain the
mutation boundaries; source selection does not activate a workspace.

## Issue 51 contextual saved views

Saved views reuse the semantic desktop tokens and existing service contracts.
Radix Tabs 1.2.1 supplies manual keyboard activation; Dropdown Menu 2.2.1 and
Popover 1.3.1 supply contextual actions, focus/dismissal and collision handling.
Versions are pinned in the npm lockfile and retain their dependency MIT notices.
The UI is a local implementation; no additional bb source was copied.
API references: [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)
and [Popover](https://www.radix-ui.com/primitives/docs/components/popover).
