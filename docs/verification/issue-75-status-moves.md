# Issue 75: status assignment verification

All scoped issue acceptance gates pass. [Issue #75](https://github.com/kornouhovas/workspace/issues/75)
owns the delivered integration SHA. The application implementation is `fdd9e97c`,
with the bounded status focus repair at `e1551eca`. The accepted native candidate
is `5dd4918fb5ffa3c0ad2fba3c0aa632fbbcd40c64`. Subsequent delivery documentation
changes no application, native, dependency or build input.

Baseline: `52c7a9e35e8c28ec5dd6eff21f720b873a8c4203`, the accepted #74 integration.
Both native/textual blockers (#72 and #74) are closed. See the
[scenario plan](../plans/issue-75-status-moves.md).

## Implemented behavior

The status cell opens the existing journaled move controller in status mode.
Category UUIDs identify destinations; full relative paths distinguish Clients/Active
from Personal/Active. Table and Board retain group selection and native drag entry
points. No status, nested statuses and historical unavailable groups retain their
projects and discovery visibility, with disabled destinations and EN/RU explanations.
The service revalidates source/category ownership, role placement, revision and
existing durable/current-mount authorization before the no-replace effect.

Moves retain basename, logical project UUID, properties, contents and descendant
role overrides. The separately owner-approved #74 explicit parent-folder operation
remains available. Ordinary-property assignment keeps its existing metadata semantics.
Pending/lost outcomes retain their original binding; cancellation does not replay
an accepted effect. Interrupted operations require fresh explicit recovery review.
Status return focus survives source refresh and dialog teardown, reacquires the
current project control and respects independently chosen focus.

## Appearance

Main's accepted workspace/Table/Board composition and the existing bb-derived
Inter, semantic controls and operation dialog are reused. Reference revisions remain
in [reuse](../reuse.md). No new CSS, upstream module, icon asset or dependency is copied.
Status/Notes and folder names in the final fixture are authored content, preserved
when the interface switches to Russian.

Each accepted status DEV/package report contains four EN/RU Table/Board behavior
cases and sixteen light/dark 1024x720/1440x960 whole-screen captures. Every reported
capture exists. Inspected current packaged examples include narrow RU dark Table
on macOS, wide EN light Board on Windows latest and narrow RU light Board on
Windows2022. Text wraps, path choices remain distinct and actions remain reachable.
The original styling and composition are retained.

## Requirement and retention coverage

| Requirement | Verified public boundary / retained evidence |
| --- | --- |
| Allowed distinct physical destinations | Status/category UUIDs and full-path projection/editor choices; no display-name merging |
| Whole folder, identity, values, contents and overrides | Disposable real SQLite/filesystem Table/Board commands; exact bytes/Text, role configuration and restart |
| No status / nested / historical destinations | Service rejections before effects; disabled native choices with explanations; visible projects/groups |
| Occupied, stale, changed parent and foreign source | Public command regressions preserve original bytes and occupied destination contents |
| Interrupted recovery and restart | Injected transaction failure, no automatic replay, fresh preview/explicit completion; inherited journal/crash/IPC coverage retained |
| Pending, lost response, cancellation and focus | Complete shared move-controller UI suite; status-specific UUID requests; four delayed-refresh/independent-focus cases; actual native return/restart |
| Ordinary assignment | Existing scalar/select service/UI checks and original ordinary/filesystem native assignment consumer |
| Durable identity, containment and no overwrite | Unchanged #72 service/native engines and original platform crash/journal/IPC suites |
| Existing parent operations | Original #74 public service/UI and DEV/package native journeys |

Existing requirement coverage is retained. Status choice/assignment expectations
are adapted only where #75 changes the contract. No migration, native primitive,
preload boundary or installer input changes. Both TDD seams were explicitly confirmed
by the owner: real temporary service/SQLite/filesystem checks and UI/Electron flows.
No live project folders are used.

Independent code-review axes found no Spec implementation defect. Two initial
Standards findings (ordinary CI suppression and asserted backend exit per shutdown)
were repaired and independently re-reviewed. The focus, fixture and routing repairs
also received independent review with no remaining material findings. Typecheck,
lint, build, artifact validation, documentation links and diff checks pass.

## Accepted evidence ledger

All runs below are attempt 1. Original failed runs retain their failed conclusion;
passing rows are reused only with their actual source provenance.

| Evidence | Source / run | Result and artifact |
| --- | --- | --- |
| Complete macOS suite complement | `8e0b258f` / [40216043193](https://github.com/kornouhovas/workspace/actions/runs/40216043193) | 3923 passed, 1 inventory failure, 27 skipped; artifact 12607543271 |
| Complete Windows latest complement | `8e0b258f` / 40216043193 | Isolated 51/51 and 14/14; main 3954 passed, 2 routing failures, 14 skipped; artifact 12607963924 |
| Complete Windows2022 complement | `8e0b258f` / 40216043193 | Same 51/51, 14/14 and 3954/2/14; artifact 12607378819 |
| Original repaired routing, macOS | `1ee7e4fc` / [40216820576](https://github.com/kornouhovas/workspace/actions/runs/40216820576) | 73/73; artifact 12607587618 |
| Repaired routing, Windows latest / Windows2022 | `2078ddfa` / [40217259409](https://github.com/kornouhovas/workspace/actions/runs/40217259409) | 74/74 each, LF/CRLF covered; artifacts 12607693833 / 12607703746 |
| Current affected controller/service suite, all three hosts | `e1551eca` / [40218363946](https://github.com/kornouhovas/workspace/actions/runs/40218363946) | 346/346 each; artifacts 12608565311 / 12608401430 / 12609260962 |
| Current status DEV, macOS / Windows latest | `ad8a5018` / [40220050595](https://github.com/kornouhovas/workspace/actions/runs/40220050595) | Four cases, sixteen captures, restart and two normal quits/backend exits per host; artifacts 12608818138 / 12608398312 |
| Retained role DEV/package and ordinary assignment DEV, Windows2022 | `e1551eca` / 40218363946 | Role reports passed/stopped/cleanup; ordinary assignment 13 groups, normal quit/backend exit and cleanup; artifact 12609260962 |
| Remaining/changed native rows | `5dd4918f` / [40221050560](https://github.com/kornouhovas/workspace/actions/runs/40221050560) | All three selected jobs SUCCESS; inspected artifacts listed below |

The final native rows are complete:

| Host | Status DEV | Status package | Retained role DEV/package | Ordinary assignment DEV | Latest artifact |
| --- | --- | --- | --- | --- | --- |
| macOS latest | Accepted ad8 / 40220050595 | Passed 5dd / 40221050560 | Passed 5dd / 40221050560 | Passed 5dd / 40221050560 | 12608558793 |
| Windows latest | Accepted ad8 / 40220050595 | Passed 5dd / 40221050560 | Passed 5dd / 40221050560 | Passed 5dd / 40221050560 | 12609199853 |
| Windows2022 | Passed 5dd / 40221050560 | Passed 5dd / 40221050560 | Accepted e155 / 40218363946 | Accepted e155 / 40218363946 | 12609294494 |

Every latest status report has the expected SHA/run/attempt/mode, four cases,
sixteen existing captures, restart, stopped processes, two asserted normal quits
with backend exits and passed owned cleanup. Latest retained reports have the
expected SHA and passed cleanup; ordinary reports contain 13 groups, 96 captures
and normal quit/backend exit. Package and artifact prerequisites pass on all three
hosts. Artifacts and raw logs are downloaded under `work/issue-75-ci/`.

## Evidence reuse argument

Backend, contract, desktop/native, migration, dependency and build inputs are
byte-identical from `8e0b258f` to the delivered application. The later application
change touches only DiscoveryPanel's status return and the status control marker
in TextPropertiesTable; it is renewed through 346 affected checks on all three
hosts and actual DEV/package consumers. There is no blanket reuse of the earlier
application graph across that renderer repair.

The complete `src` tree at `e1551eca` and `5dd4918f` is identical:
`c400bb712020e8dd2b28345e9007abc773408bc6`. The accepted status driver at `ad8a5018`
and `5dd4918f` is identical: `268ead99893d77a85742c008e32971e3700ace9b`.
Fixture/route-only repairs therefore reuse current public checks and unchanged
retained consumers, renewing all changed or unreached native rows. Evaluated
routing checks verify per-host command counts, ordinary-job suppression, the
25-input limit and unchanged full/runtime defaults. No assertion, deadline,
normal-exit, cleanup or supported-platform requirement is retired.

## Preserved negative evidence and repairs

| Negative receipt | Observed result / repair |
| --- | --- |
| Local full `8e0b258f`: 3951 total | 3901 passed, 23 failed, 27 skipped: 21 native close timeouts, Ladle403 from the task dependency symlink and omitted exact selector inventory |
| Hosted full 40216043193 | Only selector inventory and Windows raw-source CRLF guard fail; application/data/native assertions pass. Frozen inventory is reconciled and original routing files renewed separately |
| Routing 40216820576, Windows | 72/73 each. Logs directly show CRLF rejected by an LF-only regex. Both encodings are tested; focused Windows renewal passes 74/74 |
| Local packaged status before e155 | Status Cancel leaves body focused for 15 seconds while the status button is enabled. The bounded status-only return repair passes public delayed-refresh/independent-focus scenarios and accepted actual native cases |
| Initial unpatched DOM focus attempt | SIGKILL after 105 seconds; not an assertion-level red result. The twice-failing packaged focus predicate supplies the actual failing evidence |
| Runtime 40218363946, macOS DEV | Initial role Apply is safely rejected as stale_preview. Fixture construction had populated an already-configured observed empty source. Construction now precedes connection; a single reviewed grouped-role Apply configures an unobserved source |
| Runtime 40218363946, Windows latest DEV | EN Table passes; EN Board captures the exact stale-editor rejection with disabled Submit. The driver now uses the approved preparation/completion guards, rather than waiting only for the target path |
| Local final `e1551eca`: 3957 total | 3877 passed, 53 failed, 27 skipped: 52 inherited normal-close timeouts and one inherited cleanup-control failure. This full run remains non-green |
| Local serial native renewal | 56 passed / 15 close failures. Serial execution is not an established repair or cause. Earlier local package/DEV close timeouts remain negative receipts |

Ladle's original command passes after replacing only the task-owned dependency
symlink; no product/test allowlist is weakened. The status driver permits at most
four guarded submission attempts within the existing 15-second outer deadline.
Another draft requires fresh public active identity/path/category, original bytes,
absent target and no unfinished move journal. Unknown outcomes cannot be replayed.
Preparation is bounded separately by the unchanged approved helper.

The historical local shutdown cause remains unestablished. Fixture/lifecycle
implementations and used category-header strings/styles remain unchanged; added
localization keys do not justify claiming the entire issue-baseline graph identical.
These broader native fixture watchpoints retain their existing #67/#42 ownership;
passing scoped acceptance does not turn either local full receipt green. The hosted
full complement and current actual application lifecycle have separate passing
provenance. Local logs remain under `work/issue-75-local/` and the native capture
folders, including all failures.

## Delivery boundaries

No release, main merge, signing/installer change or live-data repair is included.
Windows Server CI remains distinct from Windows11 manual desktop and final #67/#42
acceptance. The final GitHub checkpoint records the verified integration/delivered
SHA and the documentation-only difference from the native candidate.
