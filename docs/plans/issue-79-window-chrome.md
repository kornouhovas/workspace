# Issue 79: native macOS top strip

Origin: [#79](https://github.com/kornouhovas/workspace/issues/79).
Baseline: verified `new-workspace` at `8cc3636f`.
No native/textual blockers or other coordinator checkpoint were present at start.
The owner selected implement, confirmed the actual Electron window as the TDD
seam and authorized publication. GitHub checkpoints own CI/integration status.

## Contract and scope

Main `080b416c57b2869024ac62363e96b68b40f499c0` supplies the composition:
`electron/main.js` uses hiddenInset and traffic-light position 18/18;
`src/App.tsx` places native controls, navigation at x84 and tabs in the same strip.
Keep the accepted single project area and existing bb semantic styling.
Only macOS adopts the hidden native title bar. Windows retains its normal frame.
No backend, storage, folder operation, dependency, resource or installer changes.

## Scenarios and retained coverage

| Requirement | Check |
| --- | --- |
| Remove the extra native title row | Actual Electron outer/content origins coincide on macOS; native buttons remain at 18/18 |
| Navigation and tabs clear the native buttons | Pointer collapse, keyboard restore/tab activation, bounds in all eight EN/RU/theme/size combinations |
| Native window operations and drag separation | Native input observations; automated minimize/restore/fullscreen return and normal shutdown |
| Actual native sizes | Verify1024x720/1440x960 outer bounds, restored minimum, renderer/native content equality and PNG pixel size; record host work area and any offscreen extent |
| Sidebar, settings and work area remain usable | Existing App regressions and shell/settings native journey; no document horizontal overflow |
| Windows behavior | Actual Windows latest/2022 DEV/package geometry and interaction receipts, retaining the native title row |
| Isolation/session guarantees | Retain App, session service, build isolation and readiness regressions without retiring requirements |

Public Electron geometry is the agreed TDD seam. The unmodified baseline failed
with content y257 versus outer y225 (32px redundant row). The same check passes
after hiddenInset. Renderer screenshots are appearance supplements, not native
window evidence. Existing CSS class locators identify controls; behavior, geometry
and accessible activation provide acceptance.

Adapt the inherited preload source guard to allow only the exact sandbox-provided
`process.platform === "darwin"` presentation check. Keep its other process, Node,
filesystem and database prohibitions and the actual Electron isolation assertions.
No security requirement is retired. The native-Close driver retains the original
child handle because Playwright disposes its application object on native exit.

## Execution

- [x] Resolve references, blockers, ownership and scope.
- [x] Reproduce the extra title row in actual Electron before implementation.
- [x] Implement macOS native chrome and reserve native/navigation/tab space.
- [x] Verify actual Electron geometry, EN/RU, themes/sizes and window lifecycle.
- [x] Complete independent standards/spec review and affected repairs.
- [ ] Run final full local suite and affected platform DEV/package acceptance.
- [ ] Commit, publish and integrate the accepted candidate; record delivered SHA.

Follow [requirement retention](../development.md#inherited-test-coverage),
[CI evidence reuse](../ci.md#evidence-reuse-after-test-only-repairs) and the
[desktop matrix](../desktop-ux-verification.md). Observed local evidence belongs
in [verification](../verification/issue-79-window-chrome.md); later run URLs and
delivery belong to the issue checkpoint.
