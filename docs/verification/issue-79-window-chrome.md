# Issue 79 verification

Scope: [native macOS top strip](../plans/issue-79-window-chrome.md).
Reference: main `080b416c57b2869024ac62363e96b68b40f499c0`, native window
configuration and navigation/header composition. The local implementation retains
bb fonts, controls, colors and single-area project navigation.

## Appearance

Actual Electron screenshots cover English/Russian, light/dark, 1024x720 and
1440x960. Native buttons occupy the reserved left part of the same strip as
Back/Forward/sidebar controls and saved-view/project tabs; the separate native
Workspace title row is removed. Windows keeps its existing frame/composition.
Local final files live under `work/issue-79-native-close/`; `native-dark.png` is a full
native window capture including traffic lights, distinct from renderer captures.
Reference details and deliberate deviations are in the plan above.

## Affected behavior and retained guarantees

- Red control on the unmodified baseline: the real macOS content origin was
  32px below the outer origin. After implementation both origins coincide and
  native buttons report x18/y18.
- `npm run typecheck`: passed after implementation.
- Focused App/readiness regressions: 151 passed.
- `npm run smoke:window-chrome`: passed all eight appearance/interaction
  combinations, actual window geometry/isolation, minimize/restore/fullscreen
  return, normal process exit and disposable fixture cleanup.
- Native macOS input separately produced move, enter/leave-full-screen, maximize,
  minimize and restore events. Ctrl+Cmd+F returned from fullscreen. The full-window
  image shows native controls and application navigation in the same strip.

Independent review: Standards found no violations; Spec identified missing project-tab
and native-Close evidence. Both were repaired and the follow-up Spec review passed.
The final native driver covers project expansion, keyboard tab activation, menu
dismissal/focus and Close in all eight variants with the sidebar collapsed. Native
Close separately records exit code 0, backend termination and fixture cleanup.
The retained native shell/settings journey also passes.

The first complete-suite run exposed an inherited source guard prohibiting the
sandbox-provided platform read. The adapted guard permits only the exact platform
comparison and retains every other Node/process/database prohibition. Its affected
backend lifecycle file passes 60/60. No product/security requirement was retired.

Complete-suite and platform CI receipts are pending; this local
record does not claim Windows or final desktop/release acceptance. Exact-SHA CI
and delivery checkpoints belong to [#79](https://github.com/kornouhovas/workspace/issues/79).
