# Issue #18: Bounded Electron Stdout Protocol Repair

## Overview

Repair whitespace framing in the existing native-fixture supervisor while retaining strict rejection of invalid nonblank output. Deliver one locally verified repair commit, then stop for coordinator review and Windows validation.

Plan destination: `docs/plans/issue-18-electron-protocol-repair.md`.
Authority: `work/ralphex/issue-18/protocol-repair.md`.
Planning does not authorize execution.

## Context

- Tracking: https://github.com/kornouhovas/workspace/issues/18; Beads `workspace-31i.11` remains claimed. Coordinator owns trackers.
- Reviewed starting SHA: `96a2c2ec925c163ad8e2c2f701f15db0b3bf2382`.
- Immutable issue base: `a5728daa64caab6b90700854ad5e27417fcf683e`.
- CI `38121669251` shows six Electron lifecycle failures with `protocolError=true` despite successful shutdown and cleanup. Node lifecycle checks passed.
- Existing red evidence: `work/issue-18/ci-38121669251/replay.tap` and `replay/native-adapter.json`. Injecting only CRLF before the first Electron event reproduced exit 0, confirmed shutdown, removed fixtures and `protocolError=true`.
- The supervisor parses stdout in `tests/project-rename-native.test.mjs`; `tests/fixtures/project-rename-native-electron.cjs` supplies acknowledged Node/Electron lifecycle messages.
- Dependencies remain unchanged: installed Node 22.21.1, Electron 44.7.0 and existing toolchains; retain run-local `gpt-6.1-sol/high`.

## Development Approach

- Testing approach: TDD, reusing the recorded red reproduction before parser changes.
- Diagnose one variable at a time. Synthetic replay establishes parser behavior; actual Windows root cause remains unverified.
- Every code change includes meaningful stream regressions. Required local checks must pass before completion.
- Use disposable fixtures and fresh ignored evidence directories. Prepend `/Users/aleksandersk/.nvm/versions/node/v22.21.1/bin` to PATH.
- No dependency/toolchain installation, global changes, timeout/heap increases, skipped checks or production service/UI/native API changes. Preserve completed repairs and defer rename journal/service/Name UI.

## Implementation Steps

### Task 1: Repair bounded stdout framing at the existing supervisor boundary

**Files:**
- Modify: `tests/project-rename-native.test.mjs`.
- Modify as needed: `tests/fixtures/project-rename-native-electron.cjs`.
- Create only if necessary: `tests/fixtures/project-rename-native-protocol.cjs`, a small helper used by the actual supervisor and stream tests.

- [ ] Preserve and reference the existing red evidence before editing the parser. Add a persistent fixture-controlled CRLF replay through an actual Electron subprocess and the existing supervisor; confirm the pre-fix protocol failure without changing lifecycle behavior.
- [ ] Add regressions driving the actual parser with LF/CRLF, empty and whitespace framing, multiple records per chunk, split JSON/newline chunks and whitespace-only trailing framing. Complete valid messages must retain their original lifecycle effects.
- [ ] Implement minimal framing handling: ignore only whitespace records/tails; continue rejecting malformed JSON, unknown stages, incomplete non-whitespace trailing JSON and output exceeding the existing 16,384-byte budget. Keep errors sticky, count ignored whitespace toward the budget and bound pending data and accumulated events.
- [ ] Add finite diagnostic categories/counts for ignored whitespace, malformed JSON, unknown stages, incomplete trailing bytes and output limits. Test rejection and bounds using the same parser, including excessive valid-stage records. Retain no raw stdout/stderr, paths or exception text.
- [ ] Preserve and run acknowledged success/failure, missing-ack and abnormal-exit checks for Node and Electron development/ASAR routes. Assert actual loader exit codes, utility termination and shutdown-before-cleanup ordering; protocol failures must never become successful lifecycle results.
- [ ] Run `npm run build`, then `node --import tsx --test tests/project-rename-native.test.mjs tests/artifact-smoke.test.mjs` with fresh ignored native evidence. Run `npm test` once on final changed code, `npm run lint`, `npm run typecheck`, `npm run check:docs` and working/staged/immutable-base `git diff --check`. Preserve failures without retry masking; do not build while fixtures consume dist.
- [ ] Record commands, results, red/green evidence, tested revision and remaining Windows uncertainty in ignored run evidence and a concise plan verification record. Stage explicit task paths, commit verified changes with an English message, report the commit and limitations in Russian, then stop. Do not push, edit trackers or coordinator snapshots.

## Post-Completion: Coordinator Windows Checkpoint

- Obtain separate follow-up review before an authorized task-branch push.
- Inspect exact repair-SHA Actions results on `windows-latest` and `windows-2022`, including all six Electron cases, early product checks and unchanged full/runtime/artifact gates.
- Use bounded diagnostics to distinguish whitespace framing from nonblank launcher records or truncated output. Preserve failures, skips and unreached outcomes.
- Actual Windows evidence must establish the cause and acceptance. Historical creation failures passed current CI and do not justify production changes.
