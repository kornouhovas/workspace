# Feature: English And Russian Interface Localisation

> Historical requirements snapshot. Current scope/status belongs to GitHub Issues; current behavior follows accepted contracts/ADRs. Old Current State, execution gates and checkboxes below are historical, not evidence of present completion. Preserve unmet criteria using the [carry-forward map](../specs/documentation-cleanup.md#legacy-acceptance-carry-forward).

## Goal

Support English and Russian across the Workspace Project Board interface. The user selects the interface language in Settings, the app updates immediately, and the choice remains active after restart on the same device.

## Research Basis

The implementation adopts these patterns from Anytype Desktop:

- translation catalogs are separate from UI components;
- UI code resolves text through one translation function;
- English is the canonical fallback when a key is missing;
- supported interface languages are explicit and shown in a dedicated Settings control;
- locale files can later be maintained independently from application code.

Sources:

- [Anytype localisation workflow](https://github.com/anyproto/anytype-ts#localisation)
- [Anytype translation fallback](https://github.com/anyproto/anytype-ts/blob/develop/src/ts/lib/translate.ts)
- [Anytype language settings screen](https://github.com/anyproto/anytype-ts/blob/develop/src/ts/component/page/main/settings/language.tsx)
- [Anytype Electron language persistence and reload](https://github.com/anyproto/anytype-ts/blob/develop/electron/ts/api.ts)

## Scope

- locales: `en` and `ru`;
- English remains the default and fallback locale;
- language control appears in Settings;
- selection is stored as a device-local renderer preference;
- application-owned visible text, menu commands, dialogs, toasts, placeholders, tooltips, accessible labels, loading states, and error states are translated;
- `document.documentElement.lang` follows the selected locale;
- user-owned names and values remain unchanged.

## Non-goals

- translating Workspace, project, folder, property, or select-value names created by the user;
- translating filesystem paths;
- translating backend error payloads that are not mapped to application-owned messages;
- adding a translation service or Crowdin integration in MVP;
- changing spellcheck language or native Electron application menus;
- adding a new npm dependency.

## Acceptance Criteria

- Settings contains an Interface language control with `English` and `Русский` options.
- Changing language updates the visible application immediately without reloading Workspace data.
- The selected locale survives Electron restart on the same device.
- Unknown or corrupt stored locale values fall back to English.
- Automated tests prove that English and Russian catalogs have the same complete key set.
- App-owned UI strings in the Workspace product surface resolve through the localisation layer.
- Both locales are visually usable at `1440x960` and `1024x720`.
- Existing project, Workspace, View, property, filter, file, and folder behavior is unchanged.

## Quality Gates

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

Electron visual checks must cover Settings, sidebar, Board, Table, Customize Columns, Project Detail, and representative menus in both locales.
