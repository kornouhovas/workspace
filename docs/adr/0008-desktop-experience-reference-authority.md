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
