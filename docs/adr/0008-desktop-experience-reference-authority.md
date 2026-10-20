# Desktop experience reference authority

Accepted during the desktop UX specification interview. Preserve the working
scenarios and principal workspace areas from `main`, while using Radix UI and
Tailwind CSS with bb's visual language and settings organization. The
`new-workspace` service, identity, ownership and filesystem-safety contracts remain
the runtime foundation.

This separates behavioral preservation from visual reuse: copying bb's whole
application would replace Workspace's workflows, while copying main's whole
implementation would reintroduce superseded architecture. Resolve concrete
behavior conflicts explicitly in the [desktop UX specification](../specs/workspace-desktop-ux.md).

The owner explicitly chose a simpler project presentation than main's nested
split layout: one right-hand project area that can expand into the work area,
without division inside the project. Preserve this deliberate exception when
adapting main's session behavior; split-tree restoration is not a parity target.

On 2026-10-20 the owner confirmed that main defines interface composition and
the way people work with sidebars, tabs, views and workspaces. bb defines fonts,
component design and the common visual language. This clarifies the existing
tradeoff rather than selecting a new design system. The owner also selected an
early coherent-interface milestone and verification by affected boundary and
integration milestone; their concrete acceptance lives in the specification
and development policy, not in this ADR.
