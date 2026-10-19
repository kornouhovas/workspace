# Issue 40 Windows installation evidence

Scope/scenarios: [plan](../plans/issue-40-windows-install.md).
User procedure: [Windows installation](../windows-install.md).
GitHub [#40](https://github.com/kornouhovas/workspace/issues/40) owns current
exact-SHA Actions evidence and acceptance status.

## Initial local observations

Baseline `4bdbe6bc`, macOS arm64. The first distribution-policy test failed because
no Windows installer target existed. With the offline per-user x64 NSIS policy,
that control passes. Package version remains `0.1.0`. The existing runtime is
unchanged; backend/database stay bundled and renderer isolation is preserved.
No Windows installation is claimed from a macOS source/configuration check.

## Acceptance gates

The candidate adds a Windows hosted-runner route for actual silent NSIS install,
installed executable version/architecture/signature/notices, Unicode/space paths,
keyboard EN/RU, bundled backend/SQLite, normal exit/reopen, same-candidate reinstall,
independent default APPDATA persistence, uninstall data retention and owned cleanup.
Reports carry SHA/run/attempt and actual Windows OS. No installer downloads are
published. Inherited three-platform desktop acceptance remains required.

The owner has no available Windows 11 machine/VM. Windows Server runner results
must remain distinct from Windows 11 desktop evidence. Windows 11 installation,
manual native folder picker and unsigned-installer reputation/policy behavior
are not established by the automated route. Issue acceptance and integration
remain gated on required target-platform evidence; no release is claimed.

## Reviewed candidate local verification

Node 22.21.1 on macOS arm64: fresh build and canonical version consistency,
regular typecheck, lint, 44 distribution/CI-route controls, two installed-workspace
keyboard-driver controls, 164-file Markdown link validation and diff whitespace
checks pass. The complete built-candidate suite (`npm run test:all`) passes:
**3087 passed, 0 failed, 26 conditional skips** (3113 tests).
Both independent Standards and Spec reviews found no blocking defect. A
nonblocking shared-harness duplication observation is retained; no unrelated
runtime refactor was added. These local results do not claim a Windows installer
was run on macOS. Exact-SHA Windows and inherited CI results belong to GitHub.

## First Windows Actions result and bounded preparation repair

Run `39229884292`, attempt 1, SHA `b0bd694a`, Windows latest job `117985017134`,
artifact `12176673222`: NSIS build/resource checks and 44 policy/route controls
passed. The existing installed-workspace driver test failed at
`page.setContent: Timeout 1000ms exceeded` during fixture preparation. Actual
installation was unreached, not passed. Logs/artifact are retained in GitHub.

A controlled real-Electron intercepted resource with a 1200ms load reproduced
that exact timeout locally before the driver was called. Fixture preparation now
uses its independent default preparation budget, then the original one-second
keyboard deadline starts immediately before the driver. The delayed-load control
and existing 100ms still-disabled negative control pass. No product operation,
keyboard activation, shutdown deadline or assertion was weakened. This establishes
the preparation-budget mechanism; the historical Windows load trigger remains
unproven because its original receipt has no resource/navigation timing.

Before the installed step was reached, inspection of the actual bundled builder's
resource editor additionally exposed a representation error in the new checker:
Windows metadata can use three-part SemVer or four-part zero revision. The first
literal equivalent-version control failed the old expectation. The public checker
now accepts only the canonical version or the same version plus `.0`; controls
reject old/upstream versions, nonzero revision, wrong name and unexpected signing.
This is not presented as an observed original Actions version failure.

Both follow-up review axes found no blockers. Focused Windows original-step replay
and full inherited acceptance remain required on the repaired reviewed SHA.

Renewed local candidate checks: lint/typecheck, 50 policy/version/CI controls,
two delayed-load/deadline controls and docs/diff pass. The renewed full local
suite completed with **3086 passed, 7 failed, 26 skipped** (3119 tests).
Five existing property-creator cases and the existing deferred normal-quit case
reported ordinary Electron shutdown timeouts; the existing 250ms observer-cancel
case returned exit 1 instead of 0. The new installed-workspace cases and all
version controls passed. Original quit deadlines/assertions were retained.
Running the original property-driver file (9/9), normal-quit file (1/1) and exact
250ms observer cancellation (1/1) separately then passed. This does not override
the failed full result or establish its cause. The symptoms and original logs
are retained; full cross-platform CI must still run after focused Windows success.

## Observed repaired-SHA Windows installation and full CI

Reviewed code SHA **90d1e861fd81e2d74c9164c08545c989af002a12** passed:

- [Windows installer run 39231270069](https://github.com/kornouhovas/workspace/actions/runs/39231270069),
  attempt 1, job `117989548439`, artifact `12178060499`. Actual host:
  **Microsoft Windows Server 2025 Datacenter**, x64, kernel `10.0.26100`.
  Fifty policy/version/route controls and both original installed-driver controls
  pass. The actual NSIS Unicode/space installation, bundled backend/SQLite
  create/normal quit/reopen, retained workspace/source/view and language,
  same-candidate reinstall, independent normal APPDATA create/reopen, unchanged
  project marker, uninstall data retention and owned cleanup all pass.
  Installed ProductVersion is `0.1.0.0`, FileVersion `0.1.0`, product `Workspace`,
  signature `NotSigned`. EN-wide/RU-narrow screenshots were inspected.
  Installer SHA256: `1b9375bb78ac157c37e07e8cdce69c1c61e6257e5bd641fef77e5568b343788b`.
- [Full desktop run 39231966910](https://github.com/kornouhovas/workspace/actions/runs/39231966910),
  attempt 1: common/static checks and complete macOS latest, Windows latest and
  Windows 2022 acceptance pass. Downloaded/inspected runtime artifacts
  `12178499657`, `12179420419`, `12179260014`: all **54** final runtime reports
  pass, with normal shutdown/cleanup and candidate-matching SHA-bearing feature
  reports. Artifact API/run provenance binds the remaining runtime observations.
- [macOS installation run 39231972406](https://github.com/kornouhovas/workspace/actions/runs/39231972406),
  attempt 1, artifact `12178145853`: macOS 14.8.9 arm64 DMG install, bundled
  runtime create/reopen/replacement, EN/RU/isolation and cleanup pass on the same SHA.

This final report-only follow-up does not change the platform-tested code SHA.
Its Markdown links and whitespace checks are separate from those platform runs.
The first failed Windows run and the seven-failure renewed local full result
remain recorded above; successful CI does not rewrite those observations.

## Remaining target acceptance

**Issue 40 remains open and the task branch remains unintegrated.** The owner
selected Windows 11 x64 and confirmed that no target machine/VM is available.
Windows Server installation is observed Windows evidence, not proof of Windows 11
installation or its unsigned-installer desktop prompts. Windows 11 acceptance is
still required before issue closure/integration. No signing identity, automatic
update, future-schema upgrade/downgrade, release tag or public installer download
has been validated or published.
