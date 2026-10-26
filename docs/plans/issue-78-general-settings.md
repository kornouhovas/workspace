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
