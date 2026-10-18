# Export and restore application data

Open **Application data** on the main screen. The workflow is available even when
there are no workspaces. Choose **Export application data** and save the JSON file
through the system download dialog. Keep it somewhere separate from the application's
working database. It contains local paths and metadata; treat it as private data.

This file includes all sources, workspaces, project records, property definitions
and values, workspace-specific views/layouts/filters/grouping, operation receipts
and device settings such as language. It contains **no project-file contents**.
Back up project folders separately with your usual file backup tool.

To restore:

1. Export current application data first if you may need it later.
2. Choose the exported JSON file under **Application data** (maximum 64 MiB).
3. Review **Replace all application data?** and confirm, or cancel with the button
   or Escape. Confirmation replaces all application metadata; it does not merge.
4. After success the screen reloads. Check workspaces, views and language. A missing
   project folder remains a retained record: use its existing **Locate folder**
   action to reassociate it with a valid folder inside its source. Restore neither
   creates project folders nor replays journaled filesystem operations.

Malformed, damaged, unsupported-version/schema or internally inconsistent snapshots
are rejected before replacing data. A replacement runs in one SQLite transaction;
an error or process termination before commit rolls back the data and its triggers.
If the process exits after commit, reopening observes the complete restored state.
If communication is lost, the UI disables repeat confirmation: reload and inspect
current data before selecting another file. An unknown outcome is never retried.

Format version 1 is a JSON envelope identified as `workspace-application-data` with
a SHA-256 checksum and a base64 SQLite image. SQLite serialization captures a
consistent service-connection snapshot, including committed WAL pages, while normal
requests remain available. On restore the private image's WAL header flags are
normalized for in-memory validation. Only the application's trusted current schema
is used to copy rows; SQL from the file is never executed. The migration ledger and
schema must exactly match the running application. This version does not import
legacy data or automatically convert older/future schemas. Open an export with its
matching application version first; never delete current data to force an import.
The checksum detects corruption; it is not an authenticity signature or encryption.

The working database stays in the desktop's local application-data directory,
outside synchronized project sources. Do not manually replace a running SQLite
file or copy only its main file while ignoring WAL/SHM sidecars. Keep the original
export if validation fails. Automatic schedules, retention and pre-migration backups
belong to [issue #38](https://github.com/kornouhovas/workspace/issues/38); this manual
workflow does not claim those capabilities.
