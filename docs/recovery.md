# Export and restore application data

Open **Settings → Backup and recovery → Application data** on the main screen. The workflow is available even when
there are no workspaces. Choose **Export application data** and save the JSON file
through the system download dialog. Keep it somewhere separate from the application's
working database. It contains local paths and metadata; treat it as private data.

This file includes all sources, workspaces, project records, property definitions
and values, workspace-specific views/layouts/filters/grouping, operation receipts
and device settings such as language. It contains **no project-file contents**.
Back up project folders separately with your usual file backup tool.

To restore:

1. Export current application data first if you may need it later.
2. Choose the exported JSON file under **Settings → Backup and recovery → Application data** (maximum 64 MiB).
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
export if validation fails.

## Automatic backups and updates

The desktop checks for a due automatic backup at service startup, then every 24 hours
while running. A successful automatic snapshot less than 24 hours old suppresses the
startup copy. Closing the application stops the timer; it does not run in the background.
The seven newest verified automatic copies are retained in `backups` beside the local
working database (including the separate development data directory). This destination
is local, outside selected project sources. These copies protect metadata against
application failures; use a separate disk backup against device loss. Files contain
private local paths and metadata and are neither encrypted nor signed.

Open **Settings → Backup and recovery → Automatic backups** to see the destination and the latest
verified snapshot, create a copy or retry, and select a saved copy. **Review restore
from backup** opens the same replacement confirmation as a manual export. Cancel or
Escape preserves current data. A damaged snapshot is excluded from selection and an
error remains visible; other verified copies remain available. If creation, verification
or retention fails, check free space, directory permissions and damaged files before
retrying. A partial write never displaces a good recovery point. Automatic retention
only removes older verified automatic files after publishing a new verified copy.

Before changing an existing schema, the service saves and reads back a separate
`pre-migration-*.json` snapshot. It uses the same consistent SQLite image/envelope,
including committed WAL data. Checksum, integrity and foreign keys are checked before
publication; migration cannot start if this protection fails. Pre-migration copies
are retained separately and are never deleted by automatic retention, including after
successful updates. Remove them manually only when you no longer need that version's
recovery point. Backup status is refreshed on screen every minute.

If an update fails, the startup screen reports recovery instructions. Drizzle rolls
back its migration transaction; the last pre-migration snapshot remains untouched.
Do not delete the database or WAL/SHM files. Correct a reported disk/permission failure
before restarting. For a migration failure, close the failed version and reopen with
the previous application version. If restoration is necessary, choose the corresponding
`pre-migration-*.json` in **Settings → Backup and recovery → Application data** and confirm replacement there. Reopening
and restoring with a matching older schema are tested with disposable real databases.
A snapshot from an older schema is deliberately rejected by the newer version's import;
there is no implicit downgrade or execution of SQL supplied by the snapshot.

Project-file contents remain outside every backup and restoration route.

## Workspace sessions

Application-data snapshots include each workspace's retained tab IDs/order,
expanded project, per-view preview context and allowed widths/sidebar collapse.
Selected saved views are included through their existing workspace-owned table.
Restore validates session shape and ownership before replacing application data.
On resuming, Workspace reads current project properties and checks current folder
availability; a retained tab does not recreate a missing folder or its contents.
Back/Forward navigation and closed-tab/scroll memory belong to the current app
run and are not restored from a backup.

## Durable source associations (issue 71)

The identity migration preserves the old folder observations and retained project
metadata without inferring a historical volume. In **Settings → Sources**, open a
source and choose **Review folder association**. Select each category/project
mapping explicitly, preview its impact, and confirm ownership of the retained
data. Root-only confirmation leaves descendants unverified. Cancel revokes the
backend review. Missing, excluded, archived and mode-inactive records are retained;
this flow does not move folders, merge sources or override enrolled volume/folder
mismatches. An interrupted operation retains its reservations and needs its own
supported recovery path.

A backend-owned installation anchor lives beside the working database and is
excluded from every SQLite export and backup. The optional `localAuthority`
envelope notice records this exclusion; older version-1 envelopes remain readable.
Restore does not replace that anchor. A copied database, missing/corrupt anchor or
another installation requires reviewed enrollment even when sufficient folder
and volume evidence still matches. Unknown evidence is blocked while retained
names and values remain readable; an unsupported or contradictory export is
rejected before replacement.

During the ADR 0009 rollout, identity-sensitive folder actions return
`identity_update_required` until their individual consumers are converted under
issue 72. Retained properties, views and operation history remain available.
Original terminal-operation retries validate their immutable request and return
the recorded receipt without filesystem/native effects. Source association does
not authorize an unfinished legacy operation or release its reservations.
