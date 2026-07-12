# English And Russian Localisation Implementation Plan

## Goal

Implement complete English/Russian application-owned UI localisation with a Settings switch and device-local persistence, without adding dependencies or changing Workspace data.

## Task 1: Localisation Foundation

Files:

- `src/i18n/locales/en.ts`
- `src/i18n/locales/ru.ts`
- `src/i18n/index.tsx`
- `src/main.tsx`
- `test/i18n.test.js`

Steps:

1. Define supported locales, canonical English keys, Russian catalog completeness, interpolation, plural selection, and English fallback.
2. Add safe synchronous preference read/write helpers for `workspace.interfaceLocale.v1`.
3. Add `I18nProvider` and `useI18n`.
4. Set `document.documentElement.lang` on initial render and locale change.
5. Add unit tests for normalization, fallback, interpolation, plural forms, and storage failure.

## Task 2: Settings And Navigation

Files:

- `src/App.tsx`
- `src/components/workspace/settings-view.tsx`
- `src/components/workspace/left-panel.tsx`
- `src/components/workspace/states.tsx`

Steps:

1. Add the Language section and Interface language Select to Settings.
2. Translate shell titles, sidebar, Workspace menus, empty/loading/error states, Settings source/tree controls, folder role accessible labels, and related dialogs/toasts.
3. Keep user-provided names and paths unchanged.

## Task 3: Board, Views, And Filters

Files:

- `src/components/workspace/board-view.tsx`
- `src/components/workspace/view-tabs.tsx`
- `src/components/workspace/view-filter-menu.tsx`

Steps:

1. Translate Board empty/capability text and accessibility labels.
2. Translate View creation/actions and confirm dialogs.
3. Translate Customize Columns, visible/hidden properties, filters, counts, and Board width controls.

## Task 4: Table And Property Editors

Files:

- `src/components/workspace/table-view.tsx`
- `src/components/workspace/select-value-editor.tsx`
- `src/components/workspace/date-value-editor.tsx`
- `src/components/workspace/property-controls.tsx`

Steps:

1. Translate property type names/descriptions, menus, filter controls, confirm dialogs, and empty states.
2. Make date labels and month/day formatting follow active locale.
3. Preserve persisted enum ids and user-defined values.

## Task 5: Project Detail

Files:

- `src/components/workspace/project-detail-panel.tsx`

Steps:

1. Translate Properties, hidden properties, Add property, value menus, file tree, counts, actions, and accessible labels.
2. Preserve project names, custom property names, values, filenames, and paths.
3. Keep visible and hidden property behavior unchanged.

## Task 6: Coverage And Verification

Files:

- `test/dashboardStructure.test.js`
- focused localisation tests

Steps:

1. Replace brittle English-source assertions with localisation-key assertions where behavior is unchanged.
2. Add a static inventory check for unexplained app-owned English literals in target Workspace UI files.
3. Run all quality gates.
4. Visually verify English and Russian at `1440x960` and `1024x720` in Electron.
5. Independently audit catalog completeness, fallback, persistence, accessibility labels, and untranslated surfaces.
