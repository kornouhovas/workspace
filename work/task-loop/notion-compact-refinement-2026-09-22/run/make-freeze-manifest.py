from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
RUN = Path(__file__).resolve().parent

PRODUCT = [
    "design-qa.md",
    "docs/design/compact-redesign-handoff.md",
    "src/App.tsx",
    "src/components/workspace/board-view.tsx",
    "src/components/workspace/left-panel.tsx",
    "src/components/workspace/menu-styles.ts",
    "src/components/workspace/project-detail-panel.tsx",
    "src/components/workspace/project-tabs.tsx",
    "src/components/workspace/settings-view.tsx",
    "src/components/workspace/table-view.tsx",
    "src/components/workspace/view-filter-menu.tsx",
    "src/components/workspace/view-tabs.tsx",
    "src/i18n/locales/en.js",
    "src/i18n/locales/ru.js",
    "src/lib/lucide-icons.ts",
    "src/styles.css",
    "src/workspaceAppState.ts",
    "src/workspaceViews.js",
    "test/dashboardStructure.test.js",
    "test/notionCompactLayout.test.js",
    "test/workspaceAppState.test.js",
    "test/workspaceBackend.test.js",
    "test/workspaceViews.test.js",
]

RUN_FILES = [
    "../task.json",
    "workflow.yaml",
    "acceptance-matrix.md",
    "baseline-deviation-map.md",
    "baseline-provenance.md",
    "process-assessment.md",
    "reference-provenance.md",
    "references/board.png",
    "references/expanded.png",
    "red-notion-compact-layout.txt",
    "red-empty-board-columns.txt",
    "green-empty-board-columns.txt",
    "green-workspace-backend-empty-columns.txt",
    "final-npm-test-2.txt",
    "final-typecheck.txt",
    "final-build-renderer.txt",
    "final-git-diff-check.txt",
    "final-link-check.txt",
    "final-quality-summary.md",
    "final-evidence-map.md",
    "verifier-request-attempt-1.md",
    "native-capture-attempt-errors.md",
    "native-capture-plan.md",
    "root-cua-attempt-2026-09-23.md",
    "native-window-list-pid13188-after-inspector.txt",
    "main-show-window-1440-result.json",
    "main-steal-focus-window-result.json",
    "main-force-visible-window-result.json",
    "main-restore-window-flags-result.json",
    "cdp-probe-board-scroll-filter-final-result.json",
    "cdp-probe-expanded-result.json",
    "cdp-probe-collapsed-result.json",
    "cdp-long-name-many-tabs-result.json",
    "cdp-probe-settings-result.json",
    "cdp-probe-focus-result.json",
    "cdp-project-tab-actions-result.json",
    "cdp-probe-reload-persistence-result.json",
    "cdp-probe-property-persistence-result.json",
    "cdp-probe-no-results-result.json",
    "native-before-board-window-1440x960.png",
    "native-before-expanded-window-1440x960.png",
    "native-before-board-window-1024x720.png",
    "native-before-expanded-window-1024x720.png",
    "renderer-after-variable-board-1440x960.png",
    "renderer-after-variable-board-1024x720.png",
    "renderer-after-final-expanded-1440x960.png",
    "renderer-after-final-expanded-1024x720.png",
    "renderer-after-collapsed-board-1024x720.png",
    "renderer-after-filtered-empty-columns-1440x960.png",
    "renderer-after-filtered-empty-columns-1024x720.png",
    "renderer-after-long-name-many-tabs-1024x720.png",
    "renderer-after-table-1024x720.png",
    "renderer-after-settings-1024x720.png",
    "renderer-after-no-results-1024x720.png",
    "comparison-board-reference-vs-renderer.png",
    "comparison-expanded-reference-vs-renderer.png",
]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


files: dict[str, str] = {}
for relative in PRODUCT:
    path = ROOT / relative
    if not path.is_file():
        raise FileNotFoundError(path)
    files[relative] = digest(path)

for relative in RUN_FILES:
    path = (RUN / relative).resolve()
    if not path.is_file():
        raise FileNotFoundError(path)
    files[str(path.relative_to(ROOT))] = digest(path)

manifest = {
    "schema_version": 1,
    "attempt": 1,
    "branch": "codex/notion-compact-refinement",
    "base": "3ea0073ae0c1fca627d8ba4f2e28a0f46ea8b7b3",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "native_after_status": "inconclusive_missing_full_window_pair",
    "files": dict(sorted(files.items())),
}

(RUN / "freeze-manifest-attempt-1.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
)
print(f"frozen_files={len(files)}")
