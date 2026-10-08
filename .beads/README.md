# Beads execution tracking

GitHub Issues is the product tracker. Beads contains execution steps, dependencies and continuation notes linked to those issues; see [development](../docs/development.md).

This branch retains the repository's existing Beads configuration and metadata. Its local Dolt database is shared across Git worktrees and is not copied into this branch. Keep existing records intact and distinguish new-workspace work through its parent issue, epic and labels. A fresh clone needs a deliberate database provisioning/recovery procedure; tracked configuration alone does not contain task history.

Do not initialize a replacement database or copy a running database to create branch isolation. Inspect the installed `bd` help and actual database location before task operations.
