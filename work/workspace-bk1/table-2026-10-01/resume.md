# Resume

Product frozen in freeze.json; task.diff Board+Table only. Current own Electron12862/launcher12861, CDP9466/API9467, isolated /tmp/Workspace-bk1-table.app bundle com.workspace.bk1.table.fixture; fixture runtime.json path retained. Current light1440 Table at top/left. Do not operate user dev runtime10853/10851.

Explicit user CDP/Playwright scope covers isolated test Workspace windows of workspace-bk1 for Table/Board scrolling and view/theme/project selection, including replacements. Previous PID-specific scopes are historical; current permission was explicitly provided 2026-10-01 through root. CUA failures -3811 documented, scoped Playwright gate passed.

Reproduce: npm run build:renderer; if runtime active, avoid rebuilding unnecessarily. Native capture: node work/workspace-bk1/table-2026-10-01/capture.mjs LABEL1440 WIDTH HEIGHT. Readonly geometry layout-gate.mjs OUTPUT; measure.mjs OUTPUT. Authorized scroll-gates.mjs performs both directions/axes. configure.mjs THEME VIEW changes only fixture state. matrix.mjs takes12 after native captures. To relaunch after required stop: verify exact launcher/Electron commands; terminate only owned runtime/server, retain fixture; WORKSPACE_BK1_REUSE=1 node work/workspace-bk1/table-2026-10-01/launch.mjs. If bundle missing, copy installed Electron.app to /tmp/Workspace-bk1-table.app and set bundle id com.workspace.bk1.table.fixture/CFBundleName Workspace bk1 table; swiftc work/workspace-bk1/capture-window.swift -o /tmp/workspace-bk1-table-capture.

Do not cleanup while reviewer/pending applicable request. After coordinator acceptance/cleanup signal, verify exact runtime pid command and terminate only own Electron/launcher; remove only own temporary bundle/helper/disposablefixture. Preserve evidence. Independent review and scoped commit remain coordinator responsibility.

Evidence correction from independent reviewer: before-light-1024-table.png is actually dark. Preserve original filename; evidence-manifest.json records resolved visual theme. Before light1440 is correct, both before dark filenames are correct. No light1024 before capture exists; after matrix includes light1024. No UI operation or recapture was made for this correction.

Cleanup completed after independent acceptance/local commit: owned12862/12861 terminated after exact command checks, own temporary bundle/helper/disposablefixture removed. runtime.json is now historical. Existing reuse command requires an existing fixture; for a fresh reproduction omit WORKSPACE_BK1_REUSE. Evidence preserved, product frozen unchanged.
