# Acceptance matrix defined before implementation

Reference Board: `references/board.png`. Reference expanded project: `references/expanded.png`. Both are unmodified copies of the supplied 1486×1059 PNG files. The new request controls density and top-row decisions; existing behavior, data and architecture contracts remain binding.

No synthetic pixel-similarity threshold is used. Each row names an observable pass condition and the observation that would falsify it. Native full-window screenshots establish composition; CDP/DOM and accessibility probes establish behavior that pixels alone cannot prove.

| # | Requirement and planned evidence | Falsifying observation |
|---|---|---|
| 1 | Compare semantic action icons in native Board/project captures to the reference family; enumerate each preserved action with accessible name. | An action disappears, changes meaning, lacks an accessible name, or uses a visibly inconsistent icon treatment. |
| 2 | Measure the main content top anchor in settled Board and expanded states at both requested sizes. | Content start changes between states or leaves a blank band unrelated to the common header. |
| 3 | Capture collapsed sidebar and click/focus the toggle; compare its frame with the traffic-light region. | Toggle overlaps traffic lights, clips, disappears, or cannot be activated. |
| 4 | Record native window image and element center coordinates for traffic lights, sidebar toggle and right actions. | Controls occupy visibly different horizontal bands rather than one top-row centerline. |
| 5 | Show current workspace name and a long-name fixture; record title/button bounding boxes. | Name is absent, fails to truncate, or displaces/clips action buttons. |
| 6 | With uneven columns, set the shared Board scrollTop and record each column header/card movement; separately change horizontal scrollLeft. | Any column has its own vertical scroll or Board loses horizontal scrolling. |
| 7 | Compare each column bottom with its last card; include an empty column. | Column background extends to the viewport despite little/no content, or clips the last card. |
| 8 | Record computed font size/weight and left x anchor for project title, Properties, Hidden properties and file tree. | Any heading differs in size/weight or any named section uses a different left inset. |
| 9 | Capture short and tall sidebar states and measure Settings to sidebar bottom. | Settings floats with list height or has a large/variable bottom gap. |
| 10 | Record adjacent tab bounding boxes with many tabs at 1024 and 1440. | Gaps remain materially loose or overflow hides access to active tabs/actions. |
| 11 | Native screenshots plus computed style inventory for buttons, text, cards, gaps and padding across Board, table, tabs, menus, settings and editors; keyboard focus probe. | One surface remains materially oversized, text becomes unreadable, focus disappears, or practical hit targets collapse. |
| 12 | File tree shows only a numeric count while accessibility exposes a descriptive count; Board column counts are recorded before and after search/filter. | Visible file count includes prose, accessible label is unclear, or a column count differs from its visible cards. |

Cross-cutting behavior probes cover Board/Table switching, search/filter, project open/duplicate/restore/close, properties, settings, keyboard navigation and reload persistence using only the isolated fixture. Final quality commands are `npm test`, `npm run typecheck`, `npm run build:renderer`, and `git diff --check`.
