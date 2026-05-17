# Release Checklist Template

## Release Scope

Describe what is being released.

## Included Changes

- Change.

## Excluded Changes

- Exclusion.

## Verification

Required:

```bash
npm test
npm run typecheck
npm run build:renderer
go test ./...
npm run build:sidecar
git --no-pager diff --check
```

For UI:

```bash
npm run electron
```

## Manual Checks

- App opens.
- Main workflow works.
- Changed screens render correctly.
- No blank screen.
- No console/runtime error observed.
- Local data persists after restart when relevant.

## Risk Review

- Data/storage risk.
- Filesystem safety risk.
- UI regression risk.
- Packaging/runtime risk.

## Rollback Plan

Describe how to revert or disable the release.

## Release Decision

- Ready.
- Not ready.
- Ready with known risks.
