# Quality Gates

Quality gates define what Codex must run before claiming work is complete.

## Full Verification

Use before completion when code changed:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

## Backend / Storage Slice

Use while working on backend, workspace domain, sidecar transport, or Go storage:

```bash
npm test
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

## Frontend Slice

Use while working on React, renderer state, UI components, or app shell:

```bash
npm test
npm run typecheck
npm run build:renderer
git --no-pager diff --check
```

## UI Visual Gate

Use when user-facing UI changed:

```bash
npm run build:renderer
npm run electron
```

Check:

- changed screen opens;
- no blank screen;
- no overlapping controls;
- text fits in buttons/cards/tabs;
- loading, empty, error, and success states still make sense;
- 1440x960 and 1024x720 layouts are usable.

## Documentation Gate

Use when docs changed:

```bash
git --no-pager diff --check
npm test
```

Also check:

- docs do not contradict implementation;
- task acceptance criteria match tests;
- links/paths refer to real files;
- no obsolete instructions remain.

## Completion Rule

Do not say "done", "fixed", or "passing" unless the relevant command output has been observed.

If a check could not be run, state that clearly and explain why.
