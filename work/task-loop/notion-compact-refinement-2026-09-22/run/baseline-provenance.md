# Pre-change native baseline provenance

The four `native-before-*` files are copied byte-for-byte from the independently verified final native captures in the superseded run. They are reused rather than represented as fresh captures.

Source run: `/Users/aleksandersk/Documents/programming/Projects/project_folder/work/task-loop/compact-native-correction-2026-09-21/run`.

Source files:

- `native-attempt2-final-board-window-1440x960.png`
- `native-attempt2-final-expanded-window-1440x960.png`
- `native-attempt2-final-board-window-1024x720.png`
- `native-attempt2-final-expanded-window-1024x720.png`

Why reuse is valid: implementation commit `02662e94b7521b2754fdceb650a07ba90a1a277a` produced those captures, and `git diff --quiet 02662e94..3ea0073 -- src test electron package.json package-lock.json` returned exit 0 at this run's intake. Later commits changed only task-loop evidence/checkpoint material. The previous verifier validated native dimensions, PNG magic and frozen source hashes in `compact-native-correction-2026-09-21/run/verifier-attempt-2/report.md` and its delivery audit.

The current attempt also launched a fresh isolated Electron process from this checkout and the same fixture (wrapper PID 7943, Electron PID 7951, CDP 9236, renderer `file:///Users/aleksandersk/Documents/programming/Projects/project_folder/dist/renderer/index.html`). Fresh capture attempts were not substituted for the reused files: temporary display mode returned `Could not enter temporary capture display mode`; AX sizing returned `Could not size Electron window`; CUA is unavailable to a child agent because the MCP server reserves elicitation for the root thread. These are capture-path limitations, not product results. Fresh post-change native evidence remains required.
