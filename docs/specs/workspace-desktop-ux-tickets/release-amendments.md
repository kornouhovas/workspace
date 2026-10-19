# Prepared release amendments

Status: publication preparation only. No remote body, comment or dependency has
been changed. Replace `DESKTOP_SPEC_NUMBER` with the actual newly published issue
number. Re-read current issue bodies immediately before applying these additive
amendments; preserve concurrent changes and existing acceptance/dependencies.

## Addition to specification 7

<!-- workspace-desktop-ux:release-amendment -->

### Mandatory desktop experience acceptance

The separately tracked **Workspace desktop experience** specification
(`#DESKTOP_SPEC_NUMBER`) is a required part of the first local 0.1.0 release.
Restore main's daily workflows on the new runtime using Radix Primitives and
Tailwind CSS, with bb's visual language and categorized settings. Its UX01–UX20
acceptance matrix supplements this specification; it does not replace existing
source ownership, identity, filesystem safety, recovery or platform requirements.

The accepted deliberate differences from main include one project area with
expanded mode, no nested splits or duplicate project tabs, automatic workspace
name **Workspace** with later rename, predictable draft commit/cancel/navigation
rules, result-only Number persistence, and external file Open distinct from
Reveal. Embedded content viewers/editors remain out of scope.

The desktop specification owns its implementation sub-issues. Performance #41
can continue independently. Repeat its agreed measurements against the completed
UI, and require desktop UX acceptance before final release integration #42.
Keep this release specification open until the combined acceptance passes.

## Addition to release integration 42

<!-- workspace-desktop-ux:integration-gate -->

### Desktop experience prerequisite

Blocked by: #DESKTOP_SPEC_NUMBER (Workspace desktop experience), in addition to
all existing native and textual blockers. Do not remove or weaken #41 or existing
platform/recovery requirements.

- [ ] Complete the desktop specification's UX01–UX20 acceptance on the release
  candidate, with linked implementation issues and observed evidence.
- [ ] Inspect Table, Board, project preview, expanded project and settings at
  1024x720 and 1440x960 in EN/RU and light/dark, including keyboard/focus,
  independent scroll, menus, long content and System-theme switching.
- [ ] Verify session restart and backup/restore, ordinary-editor navigation
  guards, unique-tab transitions, native file Open versus Reveal and contextual
  operation recovery without weakening source/identity/filesystem guarantees.
- [ ] Renew the agreed #41 scale/performance evidence against the completed UI
  on the same candidate. Preserve raw samples and actual platform limitations.

This adds acceptance work, not authorization to publish artifacts, create a
stable tag, start another executor or close release issues without evidence.

## Relationship changes

- Attach the new desktop specification as a native sub-issue of #7.
- Add the desktop specification as a native blocker of #42. Retain the textual
  blocker above as well as all existing blockers.
- Attach approved U01–U20 as children of the desktop specification and publish
  their approved internal edges; U20 also depends on existing #41.
- Do not make #41 depend on desktop UI work or alter its active ownership.
- Keep the desktop specification open until all its implementation and composed
  acceptance criteria pass. Parent membership alone does not establish readiness.

Body additions and the #42 prerequisite are part of spec publication. The
to-tickets phase only creates approved children and their relationships; it does
not rewrite or close parent issues.
