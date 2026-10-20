# From product design to a working desktop interface

Inspected: 2026-10-20. Scope: first-party practices for design/development collaboration and UI evidence. This is methodological research and a recommended Workspace adaptation, not evidence that the current application already meets its visual target.

## What the primary sources support

### Share intent and constraints before implementation

Figma's handoff guide describes involving developers while designs are evolving, identifying which designs are ready to build, and documenting component variants and states. Named styles help developers map design decisions to code. Handoff works as continuing collaboration with a shared source, rather than a final collection of images. This supports a compact, explicit implementation reference; it does not require Workspace to adopt Figma or add a new approval meeting. [Figma: developer handoff](https://www.figma.com/best-practices/guide-to-developer-handoff/)

GitLab's product-design workflow starts from the user's task and jointly defined success criteria. It involves engineering early, increases design fidelity as confidence grows, and identifies must-haves versus deferred work. Design reviews include engineering and product counterparts. This makes the intended user outcome visible before a backlog becomes a sequence of technical tasks. [GitLab: product designer workflow](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/)

### Use realistic examples and reusable decisions

GOV.UK recommends prototypes to explore and test ideas quickly, with the level of fidelity chosen for the question. Code prototypes can make realistic interactions easier to assess, but prototype code does not automatically meet production requirements. Its component guidance prefers research in an actual service, or a realistic prototype. These practices support realistic content and interaction examples; they do not justify replacing safe production services with throwaway code. [GOV.UK: making prototypes](https://www.gov.uk/service-manual/design/making-prototypes), [GOV.UK: developing a component or pattern](https://design-system.service.gov.uk/community/develop-a-component-or-pattern/)

USWDS defines a limited vocabulary of design tokens for attributes such as color, spacing and typography, then uses those tokens through settings and component styles. The relevant lesson is a shared, reusable vocabulary. Workspace can apply this to its existing bb-derived styling without adopting USWDS's visual appearance or technology. [USWDS: design tokens](https://designsystem.digital.gov/design-tokens/)

### Review the implemented interface

GitLab's design review guidance asks reviewers to preview changes in a live environment: images alone omit hover behavior, small-screen problems and accessibility. It recommends before/after evidence, annotated captures and direct implementation-versus-expected comparisons. Feedback follows the issue's UX requirements, with explicit follow-ups for deferred concerns. The useful practice for Workspace is inspectable implementation evidence and recorded discrepancies; GitLab's organizational approval policy is not imported. [GitLab: merge request reviews](https://handbook.gitlab.com/handbook/upstream-studios/product-design/workflow/mr-reviews/)

### Match the evidence to the question

Storybook treats component states as reusable test cases and distinguishes interaction, visual and accessibility testing. Its visual workflow establishes screenshot baselines, detects differences and requires deciding whether changes are intended. **Inference:** a screenshot regression suite can preserve an unsuitable baseline; passing it does not establish that the interface matches the product's desired composition. Reviewing the target and the implementation remains necessary. [Storybook: UI testing](https://storybook.js.org/docs/writing-tests), [Storybook: visual tests](https://storybook.js.org/docs/writing-tests/visual-testing)

W3C states that automated accessibility evaluation assists human judgment and cannot determine all accessibility aspects. A passing automated scan therefore needs complementary interaction and manual inspection where relevant. [W3C: selecting accessibility evaluation tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)

## Recommended Workspace contract

The following is a project-specific synthesis. The owner has already selected **main's composition and working model + bb's typography, styling and design code**, an early coherent interface milestone, and verification by change impact and milestone. External sources do not prescribe this combination or the exact test cadence.

### One reviewable reference per delivered outcome

Each UI issue should identify:

- The user task and visible result, with links to the governing specification and pinned reference revisions.
- The relevant main composition: sidebars, workspaces, tabs, saved views, Table/Board content and project area.
- The relevant bb styling: fonts, semantic colors, spacing, borders, control hierarchy and states.
- A target capture or annotated reference, plus intentional differences. Where references must be combined, show the intended composition instead of leaving that synthesis to the implementer's imagination.
- Representative fixture content and required states, including populated content, long labels, empty/error states, selected/focused items and EN/RU where affected.
- Observable acceptance criteria and the smallest checks that cover the changed behavior and boundaries.

This is the issue's practical definition of ready. It uses existing owner decisions and references; it adds no mandatory sign-off for routine implementation details. The implementer should resolve ordinary choices, document assumptions and escalate only a consequential unresolved product decision.

### Deliver the complete composition early

The first visual milestone after #52 should show the main working experience as one usable whole: shell/sidebar, workspace and view navigation, Table/Board, and a project area using coherent bb styling. Slice implementation into manageable issues, but make each contribution visible within that whole. A polished settings page or isolated component library cannot alone demonstrate the main working experience.

Prefer existing services and fixtures for early screen assembly. If an interaction is deliberately unavailable in a preview, label it and track its implementation; do not count a mock as production completion. Use the existing preview tooling where sufficient. This research does not establish a need for Storybook, Chromatic, Figma, or a new commercial service.

### Put visual feedback before repeated expensive verification

Recommended implementation loop:

1. Assemble the changed surface in its surrounding screen with representative data.
2. Inspect the running interface against the reference; capture current/expected comparisons and exercise the principal interaction.
3. Repair composition, density, typography, overflow and interaction problems while the scope is still small.
4. Run affected behavioral checks, relevant type/build checks and accessibility checks; include related consumers when shared components change.
5. At the agreed milestone, inspect the integrated journey and run the broader checks required by its affected boundaries and release promises.

Design inspection occurs early and again on the delivered candidate. It complements engineering verification. The exact selection of commands belongs in the project's development/CI policy and issue checkpoint.

### Keep distinct acceptance evidence

| Question | Appropriate evidence |
| --- | --- |
| Does it look and feel like the agreed interface? | Running whole-screen inspection and reference comparison: composition, density, fonts, controls, narrow layout and localization |
| Can the user complete the task? | Focused interaction tests and a representative integrated journey, including keyboard/focus behavior |
| Does information remain correct and safe? | Relevant service, persistence, identity, isolation and recovery checks |
| Does the supported application install and run? | Platform/package checks when those boundaries change and at the agreed integration/release milestones |

A UI-only change should not automatically trigger repeated installation and unrelated recovery runs. Conversely, a visual goal does not make data-safety tests disposable. For inherited tests, retain, adapt, replace or retire based on the current requirement and identified replacement coverage. Record why a broad run is needed and what changed since reusable passing evidence.

### Make completion and ownership explicit

The owner controls product direction and significant tradeoffs. The agent performing design work maintains references, states and discrepancies; the implementer maps them to reusable controls and existing services; the reviewer checks the running result and evidence. One person or agent may perform several roles, but the responsibilities remain explicit.

An issue is done when its visible outcome matches the agreed reference within recorded intentional differences, its required interactions and safety guarantees pass, and its checkpoint links the tested revision and evidence. The early milestone requires an explicit review of the coherent interface; this adds no new mandatory owner-approval gate. Remaining defects get concrete issue links and severity; a major composition gap cannot be relabeled as minor polish merely because automated tests pass.
