# Root-thread CUA observation — 2026-09-23

Observer: coordinator `/root`.

- `cua.getState()` listed the isolated Electron process as running.
- `cua.getApp()` was then called with the exact Electron.app path:
  `/Users/aleksandersk/Documents/programming/Projects/project_folder/node_modules/electron/dist/Electron.app`.
- The provider failed before application binding or raise with ScreenCaptureKit error `-3811`.
- No AX tree, full-window screenshot or successful foreground transition was returned.
- The same exact-path method was not retried after this result.

At the time of the observation, executor-side provenance identified Electron main PID `13188`, renderer PID `13194`, and CoreGraphics window id `6374` (`Workspace`). CoreGraphics still exposed only a 148×151 Stage Manager thumbnail at x=-271/y=519.

The published CUA selector documented for macOS app binding accepts application name, bundle identifier or path. Direct selection by a macOS CoreGraphics window id is not a supported `getApp` selector; Windows/Linux window-id selection does not establish a macOS route. Per coordinator instruction, no schema-invalid `getApp("6374")` call was made.

This file records the coordinator-reported observation. It is not a raw provider JSON response, because the executor did not own that CUA call. The native full-window after-capture criterion therefore remains inconclusive.
