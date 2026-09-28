# Runtime reference bb 0.44.0

Официальный renderer/server из /Applications/bb.app/Contents/Resources/app.asar.unpacked/node_modules/bb-app. Server NODE_ENV=production, SERVER_PORT=38891, HOST_DAEMON_PORT=38892, BB_DATA_DIR=/tmp/bb-interface-reference-1wx/server-data. Пользовательский bb на38886 не изменялся. Root CUA IAB tab5.

Подготовка test fixture: включён официальный builtin Plugin Guide через Installed plugins только на isolated server. Никакие AI сообщения/терминалы не запускались. Tasks и Simple Notes из пользовательской сессии не входят в default installed plugin set; primary live cases исследованы на Plugin Guide и Automations.

Подтверждено live:
1. Sidebar width320, navigation rows28, primary text13px/18.5714 normal Inter; options20. Pane/header48; right pills28 с text12px/16; leading close16x16 left6/top6; plus28.
2. Right Newtab launcher dedup: repeated+ сохраняет одну вкладку.
3. Context Newtab: Close tab; separator; Close other tabs disabled; Close tabs to right disabled при единственной вкладке. Дополнительного Reopen menuitem нет.
4. Close last Newtab через context и middle click скрывает right panel, если у plugin нет fixed Navigation. Cmd+Shift+T не восстанавливает blank launcher. Это отличается от пользовательского Tasks: там fixed Navigation остаётся открыта после закрытия Newtab.
5. Automations sidebar options -> Open in split создаёт два main panes с PluginGuide. Maximize второго -> Restore split -> Close второго возвращает PluginGuide. Controls28px/header48, horizontal разделитель1px.
6. Default right split50% remaining viewport: при1440/sidebar320 правая панель560px x880. Измерения после settling: bb-right-panel-settled.json. Early measurements могут содержать transform animation и не должны использоваться.
7. Light/Dark переключены через Settings/Appearance в isolated browser. Точные CSS vars сохранены bb-light-palette.json и bb-dark-palette-layout.json.

Качественные screenshot evidence:
- bb-tab-context-dark.jpg:1440x960, desktop sidebar/plugin panel/right tab/context close actions.
- bb-appearance-light-1440-settled.jpg:1440x960, sidebar320/header48, Appearance forms/light.
- bb-appearance-light-1024.jpg:1024x720, narrow desktop layout/scroll.
Все перечисленные снимки просмотрены. screenshot API отдаёт JPEG bytes, поэтому расширения приведены к .jpg.

Недостоверные для geometry:
- bb-initial-1440.jpg: ранний viewport override содержал UI720x480 в1440x960.
- native-bb-home-1440-dark.jpg: отдельный Electron wrapper official renderer38891, window1440x960/min1024x720/hiddenInset/lights18. Screenshot2730x1876 попал в macOS window perspective/animation; не годится для pixel acceptance. Native input был прерван пользовательским изменением Electron.

Remaining: несколько реальных content tabs/long labels/overflow/reorder/reopen/history/persistence, split edge drop target semantics и resize min/max; отдельные native titlebar details. Fresh server не имеет enrolled machines, поэтому New project/terminal disabled. Не выдумывать подтверждение этих сценариев. Source modules supplemental до runtime/fixture verification.

Native Workspace CUA также blocked ScreenCaptureKit-3811 у root и subagent; explicit разрешение альтернативного Playwright/Electron API запрошено, ещё не получено на момент записи.

## Additional three-pane checks

Live bb 0.44.0 isolated fixture: Plugin Guide + Automations + Plugin API Tester. Maximize middle Automations hides other areas; Restore split restores all three. Close middle Automations collapses to Guide + API Tester and activates right API Tester. CUA semantic Enter actions and AX/DOM count verified 3 → 1 → 3 → 2. Main separator resize remains unverified: DOM reports1440x960 while captured viewport is720x480, and coordinate drag did not change geometry. bb-three-panes-dark-1440.jpg is720x480 and must be used only for qualitative evidence. Source ops.ts confirms MAX_PANES=8 and equalSizes on insertion/removal; source-only evidence.

Reload persistence verified live: Guide+API Tester remained two panes after reload. Maximize right API Tester then reload preserved Restore split control (count1). This confirms maximized session persistence. Screenshot bb-two-panes-after-close.jpg remains qualitative until file dimensions verified.

## Main separator resize verified

CUA viewport reset+set1440x960 resolved prior mismatch. For Guide+API Tester, separator x879.5 (50/50 of remaining1120px) moved to999.492 by drag880→1000. Reload preserved999.492. Screenshots bb-two-panes-reloaded-1440.jpg and bb-two-panes-resized-reloaded-1440.jpg capture settled2pane state; first confirmed1440x960 by file. Earlier unverified resize limitation superseded by this successful observation.

Nested vertical split verified live: unopened Automations sidebar row rect8,146,303,28 dragged from120,160 to600,160 (horizontal engagement) over top area of Guide. Result Automations above Guide in left area; API Tester remains right. Separator horizontal x320,y479.5,width679.492,height1 and vertical x999.492,y0,height960. Three Close pane controls. bb-nested-three-panes-dark-1440.jpg captures this fixture. Earlier diagonal sidebar drag of alreadyopen API Tester had no change (sorting arbitration); no move/swap runtime claim from that attempt.

Pane move/swap runtime verified: API Tester header p rect1040.492,14.711,106.938,18.57 dragged1090,24→600,900 (bottom Guide). Result three equal vertical panes Automations/Guide/API Tester, boundaries319.328/639.664. Then API Tester header rect360,655.375 dragged410,664→880,160 centre Automations, swaps first/last positions: API Tester/Guide/Automations. Screenshot bb-three-vertical-moved-dark-1440.jpg and bb-three-vertical-swapped-dark-1440.jpg. No duplicates (3 close controls).
