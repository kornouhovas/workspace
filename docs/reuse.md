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

No bb implementation code has been imported in this foundation. When code is added, create a provenance entry with upstream URL/revision, source paths, destination paths, local adaptations and license/notice location. Verify the actual distributed contents before each release. Reuse does not imply endorsement by bb or its authors.
