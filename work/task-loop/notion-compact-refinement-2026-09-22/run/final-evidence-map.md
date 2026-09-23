# Twelve-row implementation evidence map

This map records executor observations before independent verification. Native rows remain pending until settled CoreGraphics full-window after captures are available. CDP renderer evidence is kept separate from native evidence.

| # | Executor result | Evidence and measurable observation |
|---|---|---|
| 1 | Pass in renderer; native pending | `renderer-after-variable-board-1440x960.png` and `renderer-after-final-expanded-1440x960.png` show the reference-family folder, board, table, document, panel, plus and sliders icons. `cdp-probe-board-result.json` records accessible names for sidebar toggle, Add View and Customize; `cdp-probe-expanded-result.json` records restore/close names. No action was added or removed. |
| 2 | Pass in renderer; native pending | `cdp-probe-board-result.json` records Board viewport y=76 beneath the 64 px header. `cdp-probe-expanded-result.json` records expanded panel y=64 and title y=76. Settled captures show the same first-content anchor with no 96/113 px state jump. |
| 3 | Pass in renderer; native traffic-light confirmation pending | `renderer-after-collapsed-board-1024x720.png` and `cdp-probe-collapsed-result.json`: collapsed toggle x=80..112, y=16..48, 32×32, accessible name `Показать боковую панель`; the Board expands to x=16. CoreGraphics must confirm the macOS traffic-light relationship. |
| 4 | Pass in renderer; native traffic-light confirmation pending | `cdp-probe-collapsed-result.json`, `cdp-probe-board-result.json`, and `cdp-probe-expanded-result.json`: toggle centerY=32, workspace centerY=31.5, right-action centerY=31.5. CoreGraphics must add the window-frame observation. |
| 5 | Pass | `renderer-after-long-name-many-tabs-1024x720.png` and `cdp-long-name-many-tabs-result.json`: diagnostic workspace string scrollWidth=586, clientWidth=123 inside a fixed 160 px slot; right actions remain at x=940..1008. The DOM-only long-name substitution was restored immediately and did not change fixture storage. |
| 6 | Pass | `cdp-probe-board-scroll-filter-result.json`: at 1024, shared Board maxTop=433 and maxLeft=322; setting top=400/left=240 shifts every column from y=76 to -324 and x by -240 while all three column `scrollTop` values remain 0. `cdp-probe-board-scroll-filter-final-result.json` repeats the common vertical movement after the empty-column behavior change. |
| 7 | Pass | `cdp-probe-board-scroll-filter-final-result.json`: unfiltered column heights 1216/544/208 follow 14/6/2 cards. Search `Archive 01` retains all columns with 1/0/0 cards and heights 124/90/90. `renderer-after-filtered-empty-columns-1440x960.png` and `renderer-after-filtered-empty-columns-1024x720.png` show compact dashed empty states ending immediately below their headers. |
| 8 | Pass in renderer; native pending | `cdp-probe-expanded-result.json`: project title, Properties, Hidden properties and file-tree heading each compute to 13 px, weight 500, line-height 20 px; title/Properties/Hidden properties left x=281 at 1024, with the file-tree heading using the same content inset. File badge text is `1`, accessible label `1 элемент`. |
| 9 | Pass | `renderer-after-settings-1024x720.png` and `cdp-probe-settings-result.json`: Settings button y=676..708 in a 720 px viewport, leaving a constant 12 px bottom inset. It remains bottom-anchored while the workspace list is short. |
| 10 | Pass | `renderer-after-long-name-many-tabs-1024x720.png` and `cdp-long-name-many-tabs-result.json`: four real project tabs use 144×32 frames with 4 px gaps; overflow is horizontally scrollable and the active Atlas Website tab is revealed while actions remain visible. |
| 11 | Pass in renderer; native pending | Board: `renderer-after-variable-board-*.png`; Table: `renderer-after-table-1024x720.png`; Settings: `renderer-after-settings-1024x720.png`; menus/actions: `cdp-open-tab-context-result.json`; editor/detail: `renderer-after-final-expanded-*.png`. `cdp-probe-focus-result.json` proves a keyboard-focused button matches `:focus-visible` with a 1.5 px solid outline. Controls observed in settings are 28 or 32 px high; semantic card/button targets remain available. |
| 12 | Pass | `cdp-probe-expanded-result.json` records visible file count `1` and aria `1 элемент`. `cdp-probe-board-scroll-filter-final-result.json` records count/card pairs 14/14, 6/6, 2/2 before search; 1/1, 0/0, 0/0 for `Archive 01`; and 14/14, 6/6, 2/2 after clearing. |

## Cross-cutting behavior

- Board/Table: `cdp-click-table-tab-result.json`, `renderer-after-table-1024x720.png`.
- Project open and many tabs: `cdp-create-many-tabs-result.json`.
- Duplicate, restore and close: `cdp-project-tab-actions-result.json` (other-workspace localStorage entries were omitted from the stored result).
- Tab persistence across reload: `cdp-probe-reload-persistence-result.json`.
- Property creation/edit/reload persistence on the isolated fixture: `cdp-set-text-property-result.json`, `cdp-probe-property-persistence-result.json`.
- Search no-results copy: `cdp-probe-no-results-result.json`, `renderer-after-no-results-1024x720.png`.
- Keyboard focus: `cdp-key-tab-result.json`, `cdp-probe-focus-result.json`.

## Current boundary before freeze

Implementation, renderer diagnostics and behavior probes are complete. The current isolated Electron main PID is 13188 and CoreGraphics window id is 6374, but the window remains a 148×151 Stage Manager thumbnail. Root-thread exact-path CUA failed with ScreenCaptureKit `-3811` before binding or raise, and the published macOS API has no supported CoreGraphics-window-id selector. The run cannot honestly mark native visual evidence complete until a future environment can foreground that exact window and CoreGraphics produces settled full-window Board/expanded captures at 1440×960 and 1024×720, including the macOS frame and traffic lights.
