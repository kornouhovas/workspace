# bb 0.44.0 reference matrix — workspace-1wx

Pinned version: installed `/Applications/bb.app` 0.44.0. Runtime renderer/server extracted from its app.asar.unpacked; disposable BB_DATA_DIR, ports38891/38892. No user project/settings modified. Supplemental checkout `/tmp/bb-reference-20260928` commit061685c4a3198fbe83592e6993e95e7c5790ba55; source evidence does not establish pixel or runtime equivalence. Detailed live evidence: [reference-runtime](reference/reference-runtime.md).

| Surface/behavior | Evidence | Workspace status |
|---|---|---|
| Inter, header48, sidebar320, nav28, text13/18.57, options20 | observed live computed styles | implemented; native comparison pending |
| right pill28, label12/16, close16 at6/6, plus28 | observed live | implemented; native hover/focus pending |
| default right width50% of content, sidebar background | observed live, settled metric JSON | implemented; narrow/native comparison pending |
| Light/Dark neutral OKLCH palette/radius8 | observed live settings + JSON + full-size reference screenshots1440x960/1024x720 | implemented; Workspace4 visual comparisons pending |
| blank launcher dedup, no reopen history | observed live repeat+/CmdShiftT | regression passed |
| blank context close/other/right only | observed live1440 dark screenshot | implemented |
| lastblank close hides panel without fixedview; fixedNavigation remains | observed live PluginGuide; earlier Tasks fixedNavigation | Workspace preserves its functional fixedNavigation |
| main split3areas, nested vertical split, maximize middle/restore/close middle→right focus | observed live isolated Guide/Automations/API Tester, fullsize nested screenshot | nested tree implemented; regression passed; UI workflow pending |
| tree/reload, maximize/reload | observed live | validated persistence implemented; regression passed |
| separator resize + reload at1440 (x879.5→999.492) | observed live root CUA after viewport reset | pointer/keyboard reducer implemented; own UI verification pending |
| max8, equalSizes insert/remove, nested axes, pair bounds15–85% | supplemental source split-layout/ops/types | implemented; targeted regression passed |
| edges x28/72%, y30/70%, horizontal corner priority; centre replace | supplemental source split-layout drop target | implemented tab drop; own runtime pending |
| pane edge move/centre swap; open-existing focus | move/swap observed live root CUA + fullsize screenshots; open-existing supplemental source | implemented; targeted regression passed |
| contenttab hover/middle/context/reopen/reorder/overflow, longlabels | source + initial user references; no disposable live contentthreads | implemented; runtime unverified |
| native traffic lights18/18, hiddenInset | installed/source native opts | implemented; native visual unverified |
| Board/Table/detail/settings/search/filter/property/folder flows | existing Workspace contracts/service fixtures | Board→Alpha→split observed CUA AX through disposable realservice browser; remainder runtime unverified |

Full-size reference JPEGs in `reference/` contain both themes at1440x960 and1024x720 plus dark blank-tab context. Early screenshots scaled720x480 or macOS perspective are excluded. Reference includes Settings content; equivalent Workspace shell comparisons still required and may not use different content as pixel acceptance proof.

Pane header pointer drag follows supplemental SplitThreadArea beginPaneDrag:7px engagement, transient restore of maximized source, restore maximize after cancel/drop. Own pointer drag runtime remains unverified. Shared dropdown/popover/tooltip classes follow supplemental shared-ui components; blank context separator observed live.

Own browser screenshots reported1440x960 but rendered UI720x480 in the top-left quadrant; neither workspace-browser-alpha-1440.jpg nor workspace-browser-split-check.jpg is valid geometry evidence. Browser AX confirmed Board→Alpha→Open in split with fixed rightNavigation only. Native ScreenCaptureKit failure remains; alternative automation approval is pending.
