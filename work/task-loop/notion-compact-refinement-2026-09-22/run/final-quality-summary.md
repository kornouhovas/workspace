# Executor quality summary — attempt 1

Observed before freeze on branch `codex/notion-compact-refinement`, base `3ea0073ae0c1fca627d8ba4f2e28a0f46ea8b7b3`.

| Check | Result | Artifact |
|---|---|---|
| `npm test` | Pass: 204 tests, 0 failures | `final-npm-test-2.txt` |
| `npm run typecheck` | Pass, exit 0 | `final-typecheck.txt` |
| `npm run build:renderer` | Pass, 252 modules transformed | `final-build-renderer.txt` |
| `git diff --check` | Pass, exit 0 after the final documentation updates | `final-git-diff-check.txt` plus the freeze checkpoint |
| Local Markdown links | Pass: 13 checked, 0 missing | `final-link-check.txt` |

Focused RED/GREEN evidence is preserved in `red-notion-compact-layout.txt`, `red-empty-board-columns.txt`, `green-empty-board-columns.txt`, and `green-workspace-backend-empty-columns.txt`.

Renderer and interaction results cover the twelve requirements as mapped in `final-evidence-map.md`. `native-responsive-evidence` remains inconclusive because no settled full-window native after pair could be captured; `root-cua-attempt-2026-09-23.md` and `native-capture-attempt-errors.md` preserve the exact limit. Renderer screenshots are explicitly diagnostics and are not represented as native captures.
