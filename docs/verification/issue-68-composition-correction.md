# Issue 68: reopened composition correction

Issue: https://github.com/kornouhovas/workspace/issues/68.
Correction baseline: `a59828455de6b335e3a526a7850a3253c0da4810`.
Branch/worktree: `codex/issue-68-composition-correction`,
`.worktrees/issue-68-composition-correction`.

The owner rejected the first delivery's appearance. Historical platform and
behavioral receipts do not establish appearance acceptance. This correction is
not integrated until its required review and affected-platform evidence pass.
The desktop specification permits agents to perform routine design and visual
review; this correction does not add an owner approval gate.

## Comparison contract

Main `080b416c57b2869024ac62363e96b68b40f499c0` owns composition and daily work;
bb `f135a001e72942cee9118d2693208ec0725e2f18` owns the component language. The
[pinned main Table capture](../research/desktop-experience-evidence/main-table-1440.png)
and [corrected handoff/retention](../plans/issue-68-visual-foundation.md#reopened-composition-handoff)
define the review target. The single-project-area exception remains accepted.

| Confirmed mismatch at correction baseline | Correction and verification |
| --- | --- |
| Workspace heading/path, setup and management rows precede daily work | Sidebar supplies workspace identity; source path and setup/recovery management are contextual. Compare whole ordinary/long screens with main. |
| Separate permanent search/Apply/Clear/layout/grouping/Properties row | One View settings entry in the view strip. Existing controllers and filter semantics remain; errors and result feedback remain in the work area. Native geometry requires table immediately below the strip, gap <=24px. |
| Repeated saved-view heading | Keep its accessible focus anchor, remove its repeated visual heading. |
| Unconfigured source presents several unrelated empty problems | One setup state and actionable setup entry; no filter/metadata table is presented as failed or empty work before discovery. |
| Source-empty and filtered-empty messages overlap | Source-empty owns an empty source; filter-empty owns zero matching projects in a nonempty source. Property-empty guidance belongs in Properties. |
| Zero-count rename/category recovery stacks | Move their presentation into Source tools, retaining subscriptions, receipts and explicit recovery commands in their original controllers. |

There is no new dependency, build/resource change, schema, IPC, service or
filesystem behavior. The existing loaded Inter and semantic themes are retained.
No Board visual acceptance or later editor/navigation behavior is claimed.

## Verification record

Node 22.21.1, macOS arm64. Candidate commit, hosted renewal and the remaining
platform gate belong to the originating issue checkpoint.

- The initial unconfigured-state regression failed on the duplicate creation
  guidance and passed after the presentation correction.
- A new portaled nested-menu regression failed when Escape closed the parent
  first; the repaired ContextTools dismisses inside out, retaining exact draft
  contents and returning focus to each trigger. Six contextual-tools tests passed.
- Affected React/service-backed selection passed 611/611 before final review;
  the later complete affected selection passed **937/937**, including the adapted
  Active/Archived scenarios and artifact checks. A separate final renewal passed
  **195/195**; adapter/measurement regressions passed **18/18**.
- Standards review initially reported zero findings. Spec review identified the
  remaining permanent filter toolbar; its correction moves those controls into
  the strip's contextual View settings. Reviews also caught inactive archive
  controls escaping a hidden ancestor, nested popover ownership, SVG outside
  dismissal and an adapter readiness race. Each was repaired, with red/green
  regression evidence for the functional cases. Final Standards/Spec reviews
  have no remaining source findings.

Early captures and failed driver attempts are not passing final receipts. The
driver's first filtered-empty attempt used an incorrect English label, and a
later attempt overlapped an artifact rebuild and failed with ERR_FILE_NOT_FOUND.
Neither changed a product deadline or supplies acceptance. Final native execution
must use stable completed build artifacts and record normal shutdown/cleanup.

Hosted evidence from the first delivery is historical for changed renderer inputs.
Unchanged installer/storage/native-resource inputs do not require inventing a new
release claim. Renew the affected desktop-UX route for this candidate before
integration, retaining the explicit reference comparison below.

## Final local appearance and behavior

[Evidence manifest](issue-68-correction-evidence/manifest.json) pins the unchanged
renderer inputs, script digest, baseline/reference SHAs and image hashes; the
issue checkpoint maps those inputs to the committed candidate. All captures use
synthetic data and disposable roots. No owner-provided live-data image is public.

| Reference comparison | Observed result / deliberate difference |
| --- | --- |
| Main strip immediately above Table | Ordinary and long tables start at **70.5px**, with **20.75px** between strip bottom and table, across all 16 variants. The baseline's extra management/search rows are removed. Main's screenshot table starts near 60px; bb control metrics, retained sidebar brand and real Active/Archived commands intentionally account for the small offset. |
| Main contextual daily controls | Existing view/search/layout/grouping/property commands are reached through View settings; Source tools owns source paths, discovery and recovery history. Empty creation/recovery explanations no longer form a permanent stack. |
| bb visual language | Actual Inter Latin/Cyrillic platform glyphs, semantic light/dark tokens, fine table borders and compact outline controls remain. Both required sizes/languages/themes were inspected, including menus, drafts, values and settings. |
| Empty-state ownership | Eight unconfigured, eight configured-empty and eight filtered-empty captures show one explanation per condition. Unconfigured includes a real setup entry; empty-filter feedback remains visible outside the settings menu. |
| Long content and focus | Authored names/values remain exact; narrow headers ellipsize and Text wraps. Nested menus dismiss inside out, preserve drafts and return focus; selected Active/Archived controls remain isolated. |

Representative images: [baseline](issue-68-correction-evidence/before-ordinary-en-light-1440-table.png),
[ordinary](issue-68-correction-evidence/ordinary-en-light-1440-table.png),
[narrow Russian dark long content](issue-68-correction-evidence/long-ru-dark-1024-table.png),
[unconfigured](issue-68-correction-evidence/unconfigured-ru-dark-1024.png),
[configured empty](issue-68-correction-evidence/configured-empty-en-light-1440.png),
[filtered empty](issue-68-correction-evidence/filtered-empty-ru-dark-1024.png).
The JSON report records all 16 populated/long and 24 empty-state variants, actual
font glyphs, viewport bounds, normal process exit and passed fixture cleanup.

Native shell/workspace/source journeys passed with 28/11/9 checks respectively,
including System appearance, restart, keyboard focus/scroll return and unchanged
project files. Saved-view runtime passed all 6 original scenario groups, including
filtering, Table/Board layout, grouping/assignment and metadata removal, with
normal shutdown and fixture cleanup. Its adapters retain the original assertions.

## Full-run failures and acceptance boundary

The local full `npm test` completed **3221 tests: 3173 passed, 22 failed, 26 skipped**.
Two failures were obsolete Archived form locators; the renewed views UI and full
937-test affected selection passed after following the real contextual controls.
Twenty failures were 10-second Electron shutdown timeouts in the original property
fixtures, view-readiness fixtures and deferred-cleanup control. They remain failed
local receipts. No shutdown deadline, normal-exit, mutation, filesystem or cleanup
assertion was relaxed, and no runtime lifecycle repair is claimed.

Two early native attempts and one affected-selection attempt overlapped renderer
rebuilds, causing missing-file failures. Those attempts supply no acceptance;
the final visual run and 195-test artifact/UI renewal used stable completed build
artifacts. Other native driver failures exposed old inline/heading assumptions;
adapters now use the contextual surfaces and selected sidebar/view identities.
The original native consumers retain their assertions and are renewed directly.

The unchanged workflow's scoped failure propagation receipt remains identified
in the original report. New renderer inputs require current desktop-UX CI on all
three configured hosts; skipped ordinary jobs are not passes. Exact run/attempt,
required artifacts, reviewed candidate and delivered SHA belong to GitHub.
