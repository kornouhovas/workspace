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
