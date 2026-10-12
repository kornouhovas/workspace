# Retain original full-suite category fixture diagnostic evidence

## Overview

Repair the confirmed P2 evidence transport gap in verify/npm test. Persist existing sanitized category service checkpoints outside temporary fixture cleanup and upload them separately with exact CI provenance. This is one bounded configuration/documentation task; it does not repair or establish the historical macOS failure cause.

## Context

- Issue: https://github.com/kornouhovas/workspace/issues/19
- Linked Beads execution step: workspace-31i.12; preserve existing tracker history.
- Planning source: work/issue-19/fixture-ci-evidence-planning.md.
- Confirmed review: work/issue-19/fixture-diagnostics-continuation/matt-review.json.
- Historical full-suite failure: run 38183864986, SHA bf107318c02d1cd4716d78eab34ae5bca5d7002c, macOS verify/npm test, control-read utilityCount expected 4, actual 3. The early category matrix passed; it did not retain evidence from that concurrent full-suite invocation.
- Modify only .github/workflows/desktop-ci.yml and docs/development.md.
- Existing seam: tests/project-category-move-fixture.test.mjs uses WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR through controlEvidence; each control writes service-checkpoint.json beneath its named subdirectory. Without the environment variable, checkpoint removes temporary evidence before subsequent assertions.
- Existing sanitizer/persistence: scripts/smoke-project-category-move.mjs; read for verification only.
- Existing patterns: actions/upload-artifact@v4, always(), provenance-bearing names and seven-day retention in desktop-ci.yml.
- Dependencies: installed js-yaml 4.3.2 and existing GitHub Actions expressions; no new packages, scripts or framework.
- Actual checkout: codex/issue-19-category-move, clean at planning, HEAD 371bad9d8ff32aba18641b9f97f61541db6aaa25. Immutable issueBaseSha remains 4f9f11f785c63a65585ea6f33f167fc438272c64. Read the actual lastReviewedSha at future review launch rather than freezing this planning snapshot.

## Development Approach

- Testing approach: configuration inspection with the installed YAML parser, documentation checks and diff inspection. No new implementation-mirroring unit tests, test-policy changes, local full-suite rerun or coverage threshold for this reversible configuration repair.
- Preserve the existing npm test command, package script, concurrency, assertions, exit status and failure conclusions.
- Preserve service, fixture, runner and early-matrix behavior. No retries, continue-on-error, suppression, timeout changes, UI work or replay of completed service/diagnostic tasks.
- Keep historical causes explicitly unproven. Local YAML checks establish configuration validity only.
- Complete and verify the single task before committing its two changed files.
- This planning session stops after the reviewed plan is saved; it launches no implementation, review, push or continuation.

## Implementation Steps

### Task 1: Retain sanitized category checkpoints from verify/npm test

Files:

- Modify: .github/workflows/desktop-ci.yml
- Modify: docs/development.md
- Read only: tests/project-category-move-fixture.test.mjs, scripts/smoke-project-category-move.mjs, package.json, .gitignore.
- [ ] Add step-scoped WORKSPACE_CATEGORY_MOVE_SERVICE_EVIDENCE_DIR to the existing verify npm test step. Use work/ci-category-move-full-suite/${{ matrix.os }}-${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }} so each OS/run/attempt has a distinct directory beneath the already ignored work/ tree. Keep run: npm test unchanged.
- [ ] Add a dedicated actions/upload-artifact@v4 step immediately after npm test with if: always(), name issue-19-category-move-full-suite-${{ matrix.os }}-${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}, retention-days: 7 and if-no-files-found: warn. Its sole path must be work/ci-category-move-full-suite/${{ matrix.os }}-${{ github.sha }}-run-${{ github.run_id }}-attempt-${{ github.run_attempt }}/*/service-checkpoint.json. Upload no directory roots, raw logs, SQL, databases, control files or fixture contents. Missing evidence remains missing/unreached and cannot establish acceptance.
- [ ] Add one concise statement to the Project category move service checkpoint section of docs/development.md identifying the separate original full-suite checkpoint artifact, its sanitized contents/provenance/retention and its distinction from early-matrix evidence. Keep the historical cause unproven and actual CI/artifact acceptance pending.
- [ ] With Node 22.21.1, parse the entire workflow using the installed js-yaml load function. Inspect the parsed verify job for the exact step-scoped environment value, matching upload glob, always() condition, artifact provenance fields, seven-day retention and missing-file policy. Verify that the existing controlEvidence seam creates the matching control subdirectories and that git check-ignore confirms the selected evidence path is ignored.
- [ ] Compare the diff with the task-start revision. Require unchanged npm test/package command, test concurrency/assertions/failure policy, other jobs and existing upload steps. Confirm the artifact path selects only service-checkpoint.json files and adds no broader evidence collection.
- [ ] Run npm run check:docs and git diff --check; require successful YAML/configuration, documentation and diff checks. Record actual outcomes and explicitly leave exact-SHA CI/artifact acceptance pending.
- [ ] Stage only .github/workflows/desktop-ci.yml, docs/development.md and this verified plan update, commit the verified repair with an English message and inspect the resulting commit/worktree. Preserve unrelated changes, tracker history and existing review receipts.

## Acceptance Criteria

- The existing verify/npm test invocation retains sanitized category control checkpoints before any later assertion fails.
- A separate always() upload selects only those checkpoints and identifies OS, exact SHA, run and attempt with finite retention.
- npm test and all existing test/service/runner policies remain unchanged.
- Documentation distinguishes original full-suite evidence from early-matrix evidence.
- Local configuration/docs checks pass and the bounded repair is committed; historical cause and actual CI acceptance remain unresolved.

## Post-Completion — Coordinator-Owned

- Separately review the bounded delta using the actual lastReviewedSha at launch; retain the immutable issue base and previous receipts.
- Task-branch push and its Actions are already authorized, but are outside this executable task. Inspect the original verify/npm test results and dedicated artifacts at the exact reviewed SHA on all three matrix OS targets.
- Preserve failed, skipped, missing and unreached outcomes. Artifact retention does not prove the historical cause or turn a failed suite into acceptance.
- No main merge, release, global skill changes, UI expansion or automatic continuation is included.
