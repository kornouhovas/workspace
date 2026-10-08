# Domain docs

Workspace currently has one domain context. Before code exploration, specification synthesis, or issue drafting, read [GLOSSARY.md](../../GLOSSARY.md), relevant [ADRs](../adr/), and the [source map](../development/README.md).

The glossary defines product concepts; runtime, transport, and storage details belong in architecture and API contracts. Record a new concept once its meaning is agreed. Check ADR status: Proposed is not implementation authorization. Surface concrete conflicts with accepted ADRs and resolve only the dependent scope.

Use `domain-modeling` when changing the model and `grill-with-docs` for interviews that retain terminology and decisions. Preserve the existing `docs/adr/` layout and numbering. Add an ADR for a genuine trade-off that is costly to reverse, rather than for every issue.
