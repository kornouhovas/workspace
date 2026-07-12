# UX Flow: Interface Language Selection

## Goal

Allow the user to switch the application-owned interface between English and Russian without changing Workspace data or restarting the application.

## Entry Point

- User opens Settings from the Left Panel.

## Steps

1. Settings shows a Language section.
2. The Interface language control shows the active locale.
3. User selects `English` or `Русский`.
4. The application updates visible system text immediately.
5. The application stores the locale as a local device preference.
6. On the next launch, the application restores that locale before rendering the product UI.

## Rules

- English is the default and fallback locale.
- Invalid stored values normalize to English.
- Language selection is not scoped to a Workspace or View.
- Language selection is not synchronized through `any sync`.
- User-created names, property values, filenames, and paths are never translated.
- Locale switching must not trigger Workspace projection reloads, folder rescans, or property writes.
- `html[lang]` must match the selected locale for accessibility.

## Error Handling

- If browser preference storage is unavailable, the current session still switches language and the application continues without blocking the user.
- A persistence failure must not change Workspace data or show a destructive error state.
