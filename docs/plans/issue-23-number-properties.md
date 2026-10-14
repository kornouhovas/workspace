# Issue 23: Number properties with arithmetic input

Tracking and acceptance: [GitHub #23](https://github.com/kornouhovas/workspace/issues/23).
Baseline: `82e983cd`; task branch: `codex/issue-23-number-properties`.
The native blocker #12 is closed. The owner confirmed the repository is intentionally public.
Executor: Matt Pocock implement/TDD and two-axis code review; no Ralphex run.

## Scope and contract

Extend the existing source-owned property definitions, stable ordering, immutable types,
property revision and sibling notification contract. Keep independent workspace views,
project UUIDs, locators, authored Text and files unchanged. Number is ordinary metadata,
including on retained and archived projects. Null or whitespace-only input clears its
value. Equivalent numeric assignments are no-ops. Property names retain authored text.

The service accepts `workspace.createProperty` with `propertyType: number` and
`workspace.setNumberValue` with workspace/project/property UUIDs and `expression:
string | null`. Existing `workspace.listTextProperties` and definition mutation
snapshots remain the compatible shared projection, now including Number definitions
and `numberValues` when a Number definition exists. `values` still contains only Text.
Generic `PropertyDefinition`, `PropertySnapshot`, `PropertyMutation` types retain the
old Text aliases for existing callers. This avoids changing existing projection fixtures
for sources without Number. No expression text is persisted or reopened.

### Arithmetic

- Decimal literals with dot or comma, optional `e`/`E` exponent and exponent sign.
- Unary `+`/`-`, parentheses and binary `+ - * /`. Multiplication/division precede
  addition/subtraction; binary operators associate left to right. No implicit multiplication.
- Whitespace between tokens is allowed; grouping/thousands separators, functions,
  identifiers, power/modulo operators and host code are rejected.
- At most 512 input characters, 256 tokens and 32 nested parentheses/unary levels.
- IEEE-754 double precision. Every literal and intermediate/final result must be finite
  with magnitude at most 9,007,199,254,740,991. Negative zero becomes zero. Nonzero
  literal or multiplication/division underflow to zero is rejected. Rounding remains
  ordinary floating-point rounding; for example `0.1+0.2` stores `0.30000000000000004`.
- EN displays shortest round-trippable numeric text with dot; RU substitutes comma.
  Both languages accept both separators without thousands grouping. Changing language
  does not change a stored number or an active draft. Reopening edits the numeric result.

A bounded parser in the backend implements these rules without `eval`, Function or a
host-code execution facility. Service validation rejects malformed payloads, wrong types,
foreign ownership and arithmetic failures before writes. A failed transaction retains
values/revisions and emits no change notification.

### UI and persistence

Reuse the existing Table, value cell and bb-derived foundations; no new upstream code
or dependency is copied. Add Number creation and a single-line arithmetic editor with
visible associated label, supported grammar/limits, pending/error state, saved numeric
result, Enter Save and Escape Cancel, explicit Clear and restored trigger focus.
Existing Table empty/loading/retry/save-failure states cover both property types.

Migration 0014 transactionally preserves Text rows before rebuilding definitions with
both accepted types, restores child rows and the immutable-type trigger, and adds typed
Number storage with source/project foreign keys, range checks and type guards. SQLite
foreign keys remain enabled; there is no live folder access from the renderer.

## Scenario gates

| Scenario | Evidence route |
| --- | --- |
| Computation, grammar, limits, malformed/nonfinite rejection, old value retained | `number-properties-service.test.mjs` through the actual service |
| Ownership, type immutability, rename, cross-source isolation, no-op events | Number/Text service suites |
| SQLite restart, source siblings, unchanged project bytes | Number service suite and native Number smoke |
| Text-preserving populated upgrade and failed transaction rollback | Number service suite; migration fixtures and `test:migrations` |
| EN/RU create/edit/save/invalid draft/cancel/clear and focus | `number-properties-ui.test.tsx` with real SQLite/service |
| Actual preload/IPC/backend, desktop keyboard, 1024/1440 layouts and restart | `smoke:number` in dev and packaged modes; screenshots/evidence |
| Source/recovery/archive/discovery regressions | Inherited full suite and existing runtime routes |
| Review against standards and #23 | Parallel independent two-axis review |
| Target platforms and integrated delivery | Existing CI matrix plus Number dev/package steps; GitHub checkpoint |

Required unresolved gates remain acceptance gates, not completed criteria.
Local verification is recorded in [issue-23 verification](../verification/issue-23-number-properties.md).
CI/integration and human acceptance remain in the GitHub checkpoint.
