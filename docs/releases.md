# Versions and releases

## Accepted policy

Use SemVer with **0.1.0** as the first target release. Keep release history in Git and write user-facing notes in [CHANGELOG.md](../CHANGELOG.md), beginning with `Unreleased`. Stable releases receive immutable `vX.Y.Z` tags. A source commit, successful build, version change and published release are distinct events.

Record verified user-facing additions, fixes and breaking changes as work completes. Before release, turn the relevant Unreleased entries into a dated version section and check notes against accepted issues and artifacts. Planned work is explicitly labelled and is never presented as released functionality. English commit messages provide development history; they are not automatically the user-facing changelog.

The future product site and application consume the same versioned changelog source. The website build/deploy must include changelog changes in its inputs/triggers. Source and site repositories remain private unless separately authorized.

## Implementation stages

- Foundation: version policy and the changelog are committed in Git; no release exists yet.
- Application scaffold: define a canonical product version, synchronize package/build versions and add consistency checks. Choose development/prerelease build identifiers without creating a stable release for every commit.
- Distribution: add platform packaging, signing, artifact checks, immutable tagging and a documented publish workflow. Select the update mechanism and supported OS versions before release readiness.
- Website: render the same notes and connect each release to its actual downloadable artifacts.

The first implementation must keep version bumps and changelog edits reviewable and fail mismatched version checks. Publishing or creating a release tag requires release authorization; this policy does not grant it.

## bb reference

At the [inspected bb revision](reuse.md), a version script updates desktop/application manifests together, and CI checks consistency. The changelog is edited in Git and parsed for both the website and in-app display; it is not generated from commit messages in the inspected release path. Workspace adopts the shared-source principle, without inheriting bb-specific npm/desktop tag names or moving tags.
