# Issue 78: General preferences

Base: `a41d2e84` (verified new-workspace). Scope: F03, D68, A08 in #78.

## Scenarios and seams

Owner approved Settings/App and real Electron seams in this session.
- General exposes EN/RU and Light/Dark/System together; no Appearance tab.
- Each preference saves independently, retains accepted values until success,
  displays its own pending/error feedback, and permits explicit retry.
- Existing stored values survive reopen. System reacts to OS theme notifications;
  explicit themes remain fixed. User-authored names/paths remain exact.
- Retain workspace/contextual settings, backup/recovery and About entry.
- Back retains workspace/view/session/selection/scroll and useful focus.
- Inspect light/dark, EN/RU at 1024x720 and 1440x960 in Electron.

## Coverage retention and verification selection

Adapt the existing App appearance regression and shell keyboard route to General.
Retain language/service SQLite reopen and rejection coverage. Adapt shared native
settings drivers so all existing appearance consumers reach General; retain their
original scenarios and safety assertions. Adapt the interruption fixture's tab
name to General; its readiness guarantee is unchanged.

Run typecheck/lint/docs, focused App/service/native driver checks, the full test
suite once after review, and a bounded CI route on macOS/Windows latest/2022
for changed shell/preferences and retained session navigation. Installer/storage
inputs are unchanged; no installer or filesystem release matrix is selected.

Reference: existing shell composition from main `080b416c`, bb component patterns
at `f135a001` (docs/reuse.md). Deliberate change: language and theme share General.
Runtime/CI acceptance and delivered SHA are recorded in the GitHub checkpoint.

## Local implementation evidence

- TDD red: the adapted App regression rejected the separate Appearance tab;
  green after moving its controls into General. EN/RU independent pending/error
  scenarios pass, along with preserved language/theme acceptance and retry.
- Typecheck, lint, local documentation links and 71 CI routing checks pass.
- Real Electron shell passes 28 recorded checks, EN/RU/light/dark at both desktop
  sizes, retained scroll/focus, restart preferences, source review/Cancel and
  last-workspace focus, normal shutdown and owned-fixture cleanup.
- Inspected General captures: English dark 1024, Russian light 1024, English
  light 1440 and Russian dark 1440; remaining matrix captures are retained.
  Existing main/bb hierarchy/tokens remain; only the deliberate shared General
  composition differs. All controls/labels fit without horizontal overflow.
- Native theme probe established Playwright's default light media override:
  native dark was true while matchMedia stayed false. Clearing that override
  makes actual nativeTheme dark/light changes reach matchMedia and the app.
  The original shell rerun now covers System and fixed explicit Dark.
- The inherited source-list/direct preview was superseded by #74. Its current
  replacement edits an exclusion draft, reviews shared impact, cancels without
  acknowledgment and requires unchanged public project state. Independent Spec
  review found no loss of guarantee.
- Two independent code-review axes: zero Standards and zero Spec findings.
  Final evidence is recorded in the verification report and GitHub checkpoint.

## Completion

Scoped acceptance passes on macOS latest, Windows latest and Windows 2022.
The final test-driver repairs and full-suite limitation are documented in
[verification](../verification/issue-78-general-settings.md). Runtime receipts
retain their actual application and repair SHAs; the final documentation commit
inherits that reviewed evidence. No release/main merge is included.
