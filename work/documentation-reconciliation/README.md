# Documentation reconciliation evidence

These are frozen evidence, not active implementation instructions. [Cleanup delivery](../../docs/specs/documentation-cleanup.md) owns the documentation task and integration exceptions.

- requirements-ownership.json maps the 20 baseline repeated paragraphs to their retained canonical text/owner or corrected introductory source rules.
- original-checkout-manifest.json records the branch/original baselines, original document hashes, five modified variants, one untracked rename contract and seven external deletions.
- [original-docs.patch](original-docs.patch.gz) preserves the five documentation diffs against the recorded original HEAD. Decompress the gzip data to recover the exact diff; the manifest records both compressed and uncompressed SHA-256 values.
- [rename contract snapshot](workspace-project-rename.md.txt) preserves the exact original-only contract; its instructions/claims apply to the pending rename change set, not the current branch.

No original code/document is modified or staged by this preservation. Before integration, review native-header/property/rename contracts with their matching product implementation; reconcile deleted compatibility paths explicitly. A hash/diff snapshot is preservation evidence, not product acceptance or a merged implementation.
