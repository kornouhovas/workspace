# ADR-003: Renderer Localisation Catalogs With Device-Local Preference

## Status

Accepted

Date: 2026-07-13

## Context

Workspace Project Board needs English and Russian interface languages. Product data remains local-first and sync-ready, while interface language is a device preference that affects only renderer presentation.

Anytype Desktop keeps default English text separate from locale files, resolves all keys through one translation function, falls back to English, exposes an explicit interface-language selector in Settings, and stores the selected language in Electron configuration. Anytype reloads windows because the setting also affects native Electron surfaces.

This application currently has no translated native menu or spellcheck-language integration. Persisting locale in Workspace, View, property, or `any-store` documents would incorrectly turn a device presentation preference into synchronized product data.

## Decision

Implement a small dependency-free renderer localisation layer:

- `en` is the canonical catalog and key source;
- automated tests require `ru` to have the same complete key set as English;
- one translation function resolves keys, interpolates named text values, and falls back to English;
- React context exposes the active locale and translation function;
- the locale is restored synchronously from renderer-local preference storage;
- changing locale writes the device preference, updates React immediately, and updates `document.documentElement.lang`;
- application-owned strings use translation keys; user-owned data is passed as interpolation values and is never translated.

The initial preference key is versioned so a future migration can move it behind Electron configuration without changing component contracts.

## Alternatives Considered

### Add i18next or Lingui

Rejected for the initial two-locale MVP because the repository forbids adding dependencies without approval and the required runtime behavior is small. Catalog and hook APIs remain structured so a mature library can replace the implementation later.

### Persist locale in Workspace settings or any-store

Rejected because language is device-local presentation state, not Workspace or project metadata and should not be synchronized.

### Follow Anytype and reload all Electron windows

Rejected for now because this app has no localized native menu. Immediate React updates preserve current Workspace context and avoid unnecessary rescans or reload flicker.

## Consequences

Positive:

- no new dependency;
- deterministic English fallback;
- mechanically verified catalog completeness;
- immediate language switching;
- no coupling between language and Workspace data.

Trade-offs:

- translation extraction and Crowdin synchronization remain future work;
- renderer-local storage is appropriate only while language affects renderer-owned surfaces;
- if native menus or spellcheck become localized, preference ownership should move to Electron configuration behind a documented IPC use case.
