# Pre-change deviation map

Compared artifacts: supplied `references/board.png` and `references/expanded.png` against the reused, independently verified native full-window baseline at 1440×960 and 1024×720. The new explicit requirements override the older screenshots where they request a denser scale or different scrolling behavior.

| Requirement | Pre-change observation | Result |
|---|---|---|
| 1. Icons | Existing Tabler icons preserve actions but several sizes/strokes differ across shell, tabs and detail. | fail |
| 2. Stable content start | Board uses a 96px header while expanded project uses 113px; content jumps vertically between states. | fail |
| 3. Collapsed toggle | Open-state toggle is safe at the sidebar edge; collapsed placement starts at the far left and can share the traffic-light region. | fail |
| 4. One top-row line | Traffic lights/toggle center near the native title-bar line; Board actions and tabs are centered lower in the 96px product header. | fail |
| 5. Workspace title | The current workspace name is absent from the top row. | fail |
| 6. Shared Board vertical scroll | Each Board column owns `overflow-y-auto`; columns can scroll independently. | fail |
| 7. Content-driven column height | Column surfaces stretch to the bottom of the Board viewport, including short and empty columns. | fail |
| 8. Detail headings/inset | Project title is 30px/bold, Properties 18px/semibold and Hidden properties 14px/medium; their hierarchy is inconsistent with the explicit equal-style requirement. | fail |
| 9. Settings bottom inset | Settings is bottom anchored but uses a visibly large bottom padding. | fail |
| 10. Tab gaps | Tabs use roomy gaps and tall 48-56px bands rather than the requested compact rhythm. | fail |
| 11. Compact shared scale | Baseline matches the older mockup scale, but the new request explicitly asks for a denser Notion-like scale across all surfaces. | fail |
| 12. Counts | File-tree badge visibly says `1 item`; Board counts are screen-reader-only and therefore not visible. | fail |

The baseline still preserves the prior product behavior and architecture guardrails. This linked task changes presentation and Board scrolling while retaining those contracts.
