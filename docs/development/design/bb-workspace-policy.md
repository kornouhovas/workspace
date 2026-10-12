# bb adaptation policy

Read for UI implementation and review. The imported [DESIGN_RULES.md](../DESIGN_RULES.md) is an external reference; this policy controls its applicability to Workspace.

## Authority and scope

Apply [operational rules](../rules.md) and the current Workspace contracts selected by the [UI reading route](../README.md#ui-reading-route). Use the existing components and semantic tokens. Interface owns screen composition; UI guidelines own geometry and visual rules; flows and APIs own behavior and recovery. Imported values or a newer bb revision do not replace accepted Workspace contracts.

When sources disagree, compare the concrete screen, state and pinned revision. Preserve accepted behavior outside the authorized change; resolve only the dependent product, data, security or architecture decision under the operational rules. Importing a reference grants no additional feature or dependency scope.

## Reference access

Read only the imported sections required by the current question: tokens/theme/typography for foundation work; the relevant menu/form/pane family for a component change; accessibility/focus/motion for interaction constraints. The CSS appendix is evidence for comparison. Apply numerical values and CSS only after checking the current Workspace contract.

Composer, streaming, terminal, Git/diff, agents, IDE, cloud/auth and mobile sections apply only to a separately authorized feature. Keep the complete imported source and license unchanged; identify the pinned revision used for a comparison.

## Runtime and verification

For changes to runtime or filesystem actions, follow the [runtime guide](../architecture.md) and the affected API, including safety, identity, recovery and platform limits. A visual adaptation does not authorize file operations, metadata migration or storage replacement.

Verify the affected surfaces under [quality](../quality.md). Read [reference history](bb-reference-history.md) only for import provenance, revision comparison or continuation of its historical acceptance work; those reports do not replace verification of the current version.
