# workspace-jqv — Table, property rows, compact menus

Verified implementation milestone; whole-task native acceptance is still pending. Checkout `/Users/aleksandersk/Documents/programming/Projects/project_folder`, dedicated branch `codex/workspace-jqv-live-bb-visual`, predecessor `d5ab714f4f453e8605020ff9b77324311e2fd2dd`. This continues the existing six-criterion issue, without duplicating the earlier live bb audit.

## Implemented and measured

| Surface | Before | Final implementation / observed native result |
| --- | --- | --- |
| Table | 36px minimum rows; 40px headers; 14px cell text and stronger vertical seams | 32px minimum rows (33px measured including structural border), 32px column headers, 13px values, 12px column/group labels. Header/body seams use hairline tokens; stable column widths, fixed layout and horizontal overflow retained. |
| Open project | Outer frame, row borders and label/value cell divider; 36px property rows, 16px value-side inset | Visible/hidden/Add rows have no outer frame or cell/row borders. Measured 32px property rows, 148px label column plus 8px gap, 4px value inset; expandable host caps label column at 160px. Wrapped values grow naturally in 352px preview at compact desktop width. |
| Customize / Group | 288px menu, mixed 14px headings/options; default Select size overrides nominal h-7 | 256px Customize menu with 12px rows/headings and 11px descriptions. Group Select triggers explicitly use sm size overridden to 28px, border width 0, end-aligned value/chevron and muted text. Group rows measure 28px. Radix popper portals retain select semantics and collision placement. Focus outline remains visible. |

[Measured final Dark1440 geometry](../refinement-after/metrics-dark-1440.json) corroborates native observations; it was collected through read-only DOM queries. Renderer/service/preload/storage/security/opaque IDs/source bounds/folder roles were not changed. No handlers for grouping, selection, column resizing, persistence, editing or property actions were replaced.

## Native evidence and comparison

The four temporary user defect screenshots were inspected and archived under [current-feedback](../current-feedback/archive-manifest.json), with original dimensions and SHA256. They describe defects, not target appearance. The earlier six live bb 0.44.0 Light/Default references remain authoritative observations: [shell](../bb/shell-light.jpg), [thread menu](../bb/thread-menu-light.jpg), [submenu](../bb/submenu-light.jpg), [settings](../bb/settings-light.jpg), [appearance](../bb/appearance-light.jpg), [theme picker](../bb/theme-menu-light.jpg). bb has no Workspace Table/project/grouping screen; use its menu typography, compact hierarchy, spacing and quiet surfaces as the comparison, preserving Workspace actions.

Same native split at Light1440: [before](../refinement-before/native-light-1440x960-split.png) → [after](../refinement-after/native-light-1440x960-split.png). Current user [Group defect](../current-feedback/user-feedback-3.png) → [compact Group](../refinement-after/native-light-1440x960-group.png). [Hidden properties](../refinement-after/native-light-1440x960-hidden.png) demonstrate the same borderless rows and editor value in the hidden section.

[Native manifest](../refinement-after/native-manifest.json) contains 21 valid native screenshots. Split Table/project and Group have all four Light/Dark × 1440×960/1024×720 combinations. Customize settings have Light1024, Dark1024, Dark1440; Board and Workspace settings now also have all four combinations. All captured window bounds/pixels match, using test Electron PID80208, window2831 and current built file renderer. Security recorded contextIsolation=true, nodeIntegration=false, sandbox=true. Theme/size/reload are isolated fixture configuration; all UI input used CUA. Authorized native macOS capture/AppleScript foreground targets only this fixture PID. No CDP/Playwright UI input was used.

Primary after links: [Table/project Light1440](../refinement-after/native-light-1440x960-split.png), [compact split Dark1024](../refinement-after/native-dark-1024x720-split.png), [Group Light1440](../refinement-after/native-light-1440x960-group.png).

## Observed behavior

CUA successfully bound the isolated Electron and exercised:

- Empty Notes property editor → pasted long text → Tab saves; Table reflects saved value. Direct text typing through the native bridge lost characters, so reliable clipboard paste was used and the exact resulting value was observed.
- Property-name menu → Hide → editable Hidden properties row; Show restores the visible row. Both sections retain borderless geometry. Restored property appears again in Table after reload.
- Group by Status selected with keyboard; Sort disabled when ungrouped. Radix portal arrow focus and Return selection observed. Default and Ascending selected; Manual produced by keyboard reorder. A native pointer drag swapped Done/Active in both menu and Table.
- Hide empty removes zero-count No status from Table; No status stays the last settings option. Collapse/Expand all, Hide/Show group and Show all update Table immediately.
- After fixture theme/size reload, selected Table, open Project Alpha, saved text, grouping, Manual order and Hide empty were retained.
- A no-op drag and outside-list drop left accessibility state unchanged and caused zero service invocations: [call log](../refinement-after/noop-outside-drag-calls.json).
- Escape closes Group and returns focus to Customize Columns. Native CUA clicks on Hide sidebar then Show sidebar restored the sidebar and changed right pane 560→720→560 without control overlap. This exercises OS input, not CDP event dispatch.
- Compact split screenshot shows long text wrapping and stable-width horizontally overflowing Table; scrolling/resize interaction itself remains pending.

## Checks

Observed completed logs: [targeted regressions](refinement-regression.txt) 44/44 pass (grouping/mutations/views/pane keyboard/compact layout/renderer boundary), [typecheck](refinement-typecheck.txt) exit0, [renderer build](refinement-build-renderer.txt) exit0, [documentation checks](refinement-docs.txt) 2/2 pass; `git diff --check` exit0 after documentation updates. Build retains the existing >500kB bundle-size warning. [Final source SHA256](refinement-source-state.json) covers five UI files and two UI contract documents. No dependencies or backend code changed. DESIGN_RULES.md was not edited.

## Remaining gates and actual blocker

During Dark1024 Board capture the native foreground became unstable: CG returned Stage Manager thumbnail/perspective dimensions instead of requested 1024×720. Dimension validation rejected it; the invalid file is retained locally under refinement-invalid and excluded from accepted manifest/staging. CUA next click reported that the user changed the app; fresh AX returned ScreenCaptureKit error -3812. One authorized fixture foreground attempt and 750ms animation settle initially still failed dimensions. The user then confirmed foreground, and CUA/native capture recovered. Later dimension mismatches were localized to actual fixture bounds changing to 1800×1055 (one Electron process PID80208 only); reasserting fixture size immediately before native capture produced validated results. The capture helper includes that configuration and 750ms native foreground animation settle. No unvalidated images enter the manifest. Fresh CUA observation can still intermittently return -3812 after capture; a new exact-path app binding had restored access in ~0.1s. CUA transferred explicitly to independent reviewer for remaining targeted gates; executor performs no further UI input.

Further native observations: a 70-character property name was renamed through AX setValue and selected for Group by. Its 43-character populated text value produced a truncated group option with retained count/actions, and No value (2) remained last. [Validated Dark1024 long-label Group](../refinement-after/native-dark-1024x720-group-long-label.png). A clipboard paste initially used a different string; the exact long label was subsequently set and observed through the native editable field.

Pending concrete runtime checks transferred to reviewer: Light1440 Customize menu; nested value menu; Add property/editor focus; column resize and horizontal scroll; outside click closes overlay without underlying activation; descending sort and remove grouping; Escape during an active drag. Independent final native review remains required. Existing source tests cover preserved model behavior, but are not claimed to replace these native observations.

Criteria 1 and 2 have retained bb evidence, official sources, measured implementation and partial native comparison. Criterion 3 is partial as above. Criterion 4 programmatic verification passed; remaining native preservation scenarios are explicit. Criterion 5 requires independent final acceptance and scoped commit identity. Criterion 6 implementation and four-combination split/Group evidence exist; its remaining interactions are pending. Do not close the issue or claim all six accepted from this checkpoint.

## Official sources and installed compatibility

Installed `tailwindcss@4.2.4`, `radix-ui@1.4.3` confirmed by npm ls. Official Tailwind pages currently show v4.3; implementation uses existing v4 utilities supported by installed 4.2.4, without an upgrade:

- [border width](https://tailwindcss.com/docs/border-width): remove frame/row/cell border classes from project property rows; do not merely recolor borders.
- [border collapse](https://tailwindcss.com/docs/border-collapse): main Table combines structural adjacent borders; collapse does not remove borders from property rows.
- [padding](https://tailwindcss.com/docs/padding): reduce explicit control/value/section padding while retaining focused editor controls.
- [table layout](https://tailwindcss.com/docs/table-layout): keep fixed layout and explicit col widths for resize/scroll rather than deriving columns from content.
- [Radix Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu): retained Root/Trigger/Content and existing dismissal/focus guards, with compact item composition.
- [Radix Select](https://www.radix-ui.com/primitives/docs/components/select): retained Root/value/onValueChange, Item text/indicators and disabled semantics; Group uses position=popper and end alignment for viewport-aware portals.
- [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover): retained anchored inline editors/property actions and focus/dismissal hooks; property-row border removal does not remove editor focus styling.
