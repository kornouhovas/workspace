# Issue 71: Implementation candidate, acceptance still open

Issue: https://github.com/kornouhovas/workspace/issues/71.
Branch: `codex/issue-71-source-access`; integration baseline `649b2347`.
This is an implementation checkpoint, not completed issue acceptance or a release.
No owner database or project folders were repaired.

## Implemented boundaries

- Private N-API observations: APFS volume UUID/persistent file ID/creation time,
  Windows NTFS volume GUID/handle serial/full 128-bit ID/creation time; finite
  unavailable/unsupported outcomes and current-observation checks. Fixed module
  provenance is shared with the existing Node/Electron native build.
- Installation scope outside SQLite and backup payloads. Migration 0024 adds
  nullable evidence and source generation without translating old device numbers.
- Durable foreground/background continuity and explicit root/category/project
  enrollment. Tokens bind associations/configuration, reservations, generation,
  durable evidence and current scan observations; cancellation revokes tokens.
- Transactional binding preserves metadata, journal history and dormant role
  history. Known root/child mismatches remain distinct from insufficient evidence.
- Typed service/preload routes, source/project recovery UI in EN/RU, and backend
  gates for unconverted filesystem/native consumers. Immutable terminal original
  retries retain read-only receipt semantics.
- Backup validation checks evidence versions, volume consistency and ownership;
  matching old envelopes remain readable, with no installation-anchor restore.

## Observed local evidence

Host: macOS arm64, Node 22.21.1. Final focused receipt: **25 tests, 25 passed**, with real disposable roots/databases and typed IPC. Command:

```sh
node --import tsx --test tests/durable-folder-evidence.test.mjs tests/installation-scope.test.mjs tests/source-association-service.test.mjs tests/source-identity-upgrade.test.mjs tests/source-association-ui.test.tsx
```

`npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:docs` (216 Markdown files) and `git diff --check` passed on the repaired source candidate.

`npm run smoke:source-association` exercised actual Electron Sources review,
explicit mappings/Cancel/Apply and blocked native Reveal. Eight screenshot states
cover EN/RU, Light/Dark and 1024/1440 px. Narrow Russian/light and wide English/dark
layout were visually inspected. One repeated attempt completed the UI checks but
failed normal shutdown after the unchanged 10-second deadline; forced cleanup and
fixture removal were confirmed. Three subsequent isolated repetitions passed with
normal process exit and fixture cleanup. The timeout's cause remains unproven; it
is not declared fixed by the later passes. Local reports/screens are under
`work/issue-71-source-association/` and `work/issue-71-source-association-repeat-{1,2,3}/`.
These are neither Windows nor packaged-runtime receipts.

Independent Standards/Spec review found and drove repairs for durable token
binding, retained state, backend cancellation, parent-volume checks, unknown
evidence, dormant role history, truthful mismatch/unsafe projections, property
revision independence and terminal receipt stages. Focused follow-up found no
remaining defect in those specific repairs. A further red/green regression prevents
stable legacy metadata reads from revoking binding reviews; real source-change
invalidation and Apply fingerprint checks remain.

## Unresolved gates

The initial `npm run test:migrations` completed with 361 passing, 320 failing and
one skipped test. Many application scenarios still expect the old effects now
explicitly gated by ADR 0009; other failures expose migration fixtures that must
include the added schema or legacy retained-state expectations. They are not
silently skipped or counted as passing. The `npm test` attempt ran 3,500 tests: 2,351 passed, 1,089 failed,
33 cancelled and 27 skipped. Review repairs were made during/after that failing
attempt, so it is not exact-candidate acceptance evidence. Current source repairs
have renewed focused evidence only. No failing inherited scenario was silently
removed or newly skipped. Exact progress and the eventual commit are recorded in
the GitHub checkpoint.

Before acceptance: reconcile each inherited scenario under the retention policy;
keep SQL/native safety, archived metadata, journals/reservations, migrations and
terminal receipts covered. Superseded successful effect journeys may be deferred
to #72 only with an explicit per-scenario inventory and adequate no-effect
replacement coverage. No such bulk retirement is claimed by this candidate.

Windows native compilation/runtime, packaged Node/Electron loading, all remaining
required platform scenarios, final independent review and exact-SHA CI/integration
remain open. The existing owner-authorized integration route remains conditional on acceptance;
#71 closure and integration into `new-workspace` are not ready.
