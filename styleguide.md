# Codex Product Styleguide

This styleguide describes the product experience to build toward: a Codex-like desktop app for software work. It is based on the Codex product docs and screenshots, not on the visual style of the documentation website.

## Product Position

Codex is a focused coding-agent command center. The product should feel like a quiet engineering workspace where users can run multiple agent threads, inspect changes, review diffs, and safely hand work between local, worktree, and cloud execution.

The core promise is: one agent for everywhere you code. The UI should make that promise concrete by keeping projects, threads, permissions, environment mode, model choice, Git state, review, and verification close to the composer.

## Experience Principles

1. Keep the thread as the primary unit of work.
   A thread contains the user prompt, agent output, tool calls, files changed, review state, and follow-up composer.

2. Treat Codex like a teammate, not a chatbot.
   The UI should emphasize goal, context, plan, changes, verification, and review over decorative conversation chrome.

3. Keep high-risk actions explicit.
   Permissions, sandbox mode, network access, browser use, computer use, commits, pushes, PRs, and destructive actions need visible state and clear confirmation points.

4. Make parallel work understandable.
   Users can run multiple project threads and worktree tasks. The interface must show which project, branch, mode, and environment each task belongs to.

5. Favor visible evidence over hidden automation.
   If Codex edits code, runs commands, reviews changes, or verifies UI, the result should be inspectable through diffs, logs, browser/artifact panes, terminal output, or concise summaries.

6. Keep routine actions fast.
   New thread, search, project switching, command menu, sidebar toggle, terminal toggle, review panel toggle, slash commands, and dictation should all feel immediately reachable.

## Information Architecture

Use a persistent three-level product model:

- Global app navigation: New chat, Search, Plugins, Automations, Settings.
- Project navigation: projects list, pinned threads, recent chats, project-specific actions.
- Thread workspace: active thread, composer, mode controls, review panel, browser/artifact/terminal surfaces.

Primary app objects:

- Project: a local folder or repository scope.
- Thread: a single Codex session with prompts, model/tool work, and results.
- Local checkout: the user's normal working directory.
- Worktree: an isolated Git worktree created for parallel changes.
- Cloud task: remote execution in a configured cloud environment.
- Automation: a scheduled or recurring Codex run, usually project-scoped.
- Skill: reusable instructions and resources for a workflow.
- Plugin: installable bundle of skills, apps, and MCP servers.

## App Shell

The product shell is a desktop app window with a restrained, native feel.

Use a left sidebar for durable navigation:

- Top utility actions: New chat, Search, Plugins, Automations.
- Pinned threads with age metadata.
- Projects grouped below pinned work.
- Chats or recent thread list.
- Settings anchored at the bottom.

Use a top thread bar for local context:

- Thread title.
- Current project name.
- Overflow actions.
- Editor or integration controls.
- Commit or review action.
- Diff stats when relevant.
- Panel toggles for terminal, review, browser, or split view.

The main workspace should support split panels:

- Thread content in the central column.
- Review/diff pane on the right when reviewing changes.
- Browser, artifact, or preview pane on the right when visual output is active.
- Terminal drawer below the thread when commands need direct inspection.

Avoid landing-page patterns inside the app. No hero copy, marketing cards, oversized decorative sections, or explanatory feature panels in the product surface.

## Composer

The composer is the main command surface.

Required elements:

- Large rounded input with prompt placeholder.
- Attachment/add button.
- Commands affordance, including slash command behavior.
- Permissions selector.
- Mode selector: Local, Worktree, Cloud.
- Model selector.
- Reasoning/effort selector.
- Dictation or voice input affordance where available.
- Send button with strong visual priority.
- Project, branch, and environment selectors near the composer.

Behavior:

- The placeholder should invite action, not chat: "Ask Codex anything..." or similar.
- Use `@` for file/context mentions and `/` for commands where supported.
- Keep selected mode and permissions visible after submission.
- Disable or de-emphasize controls that are unavailable for the current mode.
- Show loading/running state directly in the thread and composer region.

## Thread Content

Thread messages should read like engineering work, not social chat.

Use these patterns:

- User prompts appear as compact rounded bubbles.
- Assistant work appears as readable prose with file links, command snippets, changed-file summaries, and verification notes.
- Long prior context can collapse behind "previous messages".
- Tool output should be summarized by default, expandable when useful.
- Completed turns should show what changed and how it was verified.
- Follow-up composer remains available at the bottom of the thread.

Use inline monospace for commands, filenames, symbols, and short code identifiers. Keep code blocks practical and visually distinct.

## Review And Diff

The review pane is a first-class product surface, not an afterthought.

It should show Git repository state, including:

- Uncommitted changes.
- Staged and unstaged scopes for local work.
- All branch changes against a base branch.
- Last-turn changes.
- Files changed counts.
- Added and removed line counts.
- Expandable file diffs.
- Inline comments and findings.
- Stage, unstage, revert, commit, and review actions.

Diff styling:

- Green for additions.
- Red for deletions.
- Soft blue or gray for unchanged/collapsed regions.
- Line numbers visible and aligned.
- File rows compact, expandable, and scannable.
- Inline review comments appear as cards inside the diff, attached to exact lines.

Review feedback should be actionable. Comments need severity or priority when relevant, concise title, explanation, and line/file anchor.

## Modes And Execution

The app must make execution mode obvious:

- Local: work directly in the current project directory.
- Worktree: isolate changes in a Git worktree.
- Cloud: run remotely in a configured cloud environment.

Mode controls belong near the composer because mode changes where and how work happens.

Worktree UX:

- Show branch base and worktree details.
- Make handoff between Local and Worktree explicit.
- Use worktrees for parallel tasks and automations that should not interfere with current local work.
- Warn when a project is not a Git repository and worktree features are unavailable.

Cloud UX:

- Show repository/environment selection.
- Make internet access and setup behavior visible.
- Distinguish cloud tasks from local threads in thread lists and status labels.

## Permissions And Security

Permissions are core UI, not settings-only.

Expose a permission selector with at least:

- Default permissions.
- Full access.
- Custom configuration.

Security behavior:

- Default to constrained execution.
- Explain when the sandbox boundary allows the agent to proceed automatically.
- Ask before crossing boundaries such as network access, broader filesystem writes, or high-risk actions.
- Treat browser and computer-use page content as untrusted context.
- Keep secrets out of normal thread/browser flows.
- Make approval prompts specific: action, scope, risk, and destination.

The permission UI should be visually calm but persistent. Avoid alarmist styling except for truly destructive or irreversible actions.

## Browser, Artifacts, And Terminal

Use right-side or drawer surfaces for non-thread evidence.

In-app browser:

- Use for local development servers, file-backed previews, and public pages that do not require sign-in.
- Include navigation controls, current URL, reload, commenting mode, and visual comment markers.
- Use browser comments to attach visual feedback to rendered UI.
- Do not treat it as the user's normal browser profile; no extensions, existing cookies, or logged-in sessions.

Artifact viewer:

- Use for generated docs, slides, spreadsheets, images, or other produced artifacts.
- Keep artifact preview adjacent to thread reasoning and changed-file summaries.
- Provide export/open actions only when the artifact exists.

Terminal drawer:

- Use for command output that benefits from direct inspection.
- Keep it collapsible.
- Provide clear running, completed, and failed states.
- Do not let terminal output dominate the thread unless the user is debugging command output.

## Automations

Automations should feel like saved agent workflows.

Required structure:

- Name.
- Schedule or trigger.
- Prompt/task description.
- Project scope.
- Execution environment: local, worktree, or cloud.
- Run history and status.

Design rules:

- Worktree is the default mental model for Git-backed recurring work.
- Show whether an automation can modify local files.
- Make pause, edit, and delete separate controls.
- Surface failures with enough context to continue manually in a thread.

## Plugins, Skills, MCP, And Integrations

Plugins extend the app without crowding the base UI.

Product model:

- Skills are reusable workflow instructions and resources.
- Plugins are installable bundles that can include skills, apps, and MCP servers.
- MCP servers connect Codex to third-party tools and context.

UI rules:

- Plugins live in their own directory/browse surface.
- Installed plugin capabilities should appear contextually in the composer, command menu, or skills picker.
- Use explicit invocation patterns such as `@plugin`, `@skill`, or slash commands when the user wants precision.
- Keep plugin descriptions workflow-focused, not brand-heavy.
- Clearly distinguish read-only context access from actions that modify external systems.

## Visual Language

The product visual language is quiet, utilitarian, and desktop-native.

Core palette:

- App background: white or very light neutral.
- Sidebar: pale blue-gray or cool translucent neutral.
- Primary text: near black.
- Secondary text: middle gray.
- Tertiary text: light gray.
- Dividers: very light neutral lines.
- Selected row: soft gray or blue-gray highlight.
- Accent blue: used sparingly for active browser/comment states, links, and focus.
- Success green and danger red: only for diffs, counts, and status.

Recommended tokens:

```css
:root {
  --codex-bg: #ffffff;
  --codex-sidebar: #eaf1fb;
  --codex-surface: #ffffff;
  --codex-surface-muted: #f4f4f4;
  --codex-surface-hover: #eeeeee;
  --codex-text: #0d0d0d;
  --codex-text-secondary: #5d5d5d;
  --codex-text-tertiary: #8f8f8f;
  --codex-border: rgba(0, 0, 0, 0.10);
  --codex-border-soft: rgba(0, 0, 0, 0.06);
  --codex-accent: #0169cc;
  --codex-add: #26904a;
  --codex-delete: #c13f3f;
  --codex-radius-sm: 8px;
  --codex-radius-md: 12px;
  --codex-radius-lg: 18px;
  --codex-radius-pill: 999px;
  --codex-shadow-popover: 0 10px 30px rgba(0, 0, 0, 0.14);
}
```

Use dark mode only as a true alternate product mode. Do not mix dark marketing backgrounds into the app shell unless a screenshot or artifact requires it.

## Typography

Use OpenAI Sans when available, with system fallbacks.

```css
font-family: "OpenAI Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Type scale:

- Sidebar item: 15-16px, medium or regular.
- Metadata and labels: 12-13px.
- Body/thread text: 16px with 1.45-1.6 line-height.
- Thread title: 16-18px semibold.
- Composer placeholder: 18-22px on new-thread screen, 16-18px in compact follow-up state.
- Large empty-state prompt: 32-44px, regular to medium, never heavy.
- Code/diff: SF Mono or equivalent at 12-14px.

Do not use display typography for dense panels, sidebars, review panes, or command menus.

## Components

Buttons:

- Icon buttons are square or circular with subtle hover fill.
- Primary send button is circular, dark or high-contrast.
- Text buttons use medium weight and minimal chrome.
- Avoid large marketing CTAs inside the product app.

Menus:

- Rounded popovers with white surface, soft border, and shadow.
- Rows use icons, label, optional description, and selected checkmark.
- Keep menu items 36-44px high.

Segmented controls:

- Use for mode selection and panel tabs.
- Active segment uses soft filled background.
- Inactive labels remain readable but secondary.

Panels:

- Prefer split panes over nested cards.
- Use borders for pane separation.
- Keep scroll areas independent.

Cards:

- Use sparingly for prompts, inline comments, automations, plugin entries, and generated artifacts.
- Keep radius restrained and content dense.

Diff rows:

- Stable monospace columns.
- Add/delete colors only where semantically meaningful.
- Collapsed sections should look quiet and clickable.

## Icons

Use simple line icons with consistent stroke weight.

Required icon categories:

- New chat/edit.
- Search.
- Plugins.
- Automations/clock.
- Settings.
- Folder/project.
- Pin.
- Branch.
- Terminal.
- Browser/globe.
- Review/comment.
- Add/plus.
- Microphone.
- Send/up arrow.
- Permissions/shield or hand.
- Model/compute lightning.
- Chevron/down.

Icon rules:

- Stroke should be optically consistent, around 1.5-2px.
- Icons should align to a 16, 18, or 20px grid.
- Do not mix filled, emoji-like, and outline icons in the same control family.
- Use color only for active/semantic states.

## Motion

Motion should clarify state, not entertain.

Use:

- 120-180ms hover/focus transitions.
- Short popover scale/fade.
- Smooth panel open/close.
- Subtle active press scale on buttons.
- Running indicators for agent work.

Avoid:

- Decorative background animation.
- Springy marketing transitions.
- Motion that moves code or diffs while the user is reading.

## Empty, Loading, And Error States

Empty new-thread state:

- Center a concise task prompt.
- Show composer as the main object.
- Keep project/mode controls visible.

Loading/running state:

- Show that Codex is working in the thread.
- Surface elapsed time when useful.
- Keep cancellation or interruption reachable.

Needs input:

- Ask a concrete question.
- Keep the blocking action visually close to the relevant thread section.

Error:

- State what failed.
- Show the command, tool, or surface involved.
- Offer retry, inspect logs, change permissions, or continue manually.

## Copy And Terminology

Use product terms consistently:

- Codex, not "bot".
- Thread, not "conversation" in product UI.
- Project, not "workspace", unless referring to a code workspace explicitly.
- Local, Worktree, Cloud as execution modes.
- Review pane, diff panel, terminal drawer, in-app browser, artifact viewer.
- Permissions, sandbox, approval policy.
- Skill, plugin, MCP server, automation.

Voice:

- Direct, practical, engineering-focused.
- Prefer verbs: Review, Commit, Stage, Handoff, Open, Run, Verify.
- Avoid marketing claims in the app.
- Avoid anthropomorphic or playful copy for core engineering actions.

Examples:

- Good: "Review uncommitted changes"
- Good: "Run in a worktree"
- Good: "Default permissions"
- Avoid: "Let magic happen"
- Avoid: "Supercharge your coding"

## Accessibility

- Keyboard shortcuts are first-class: command menu, settings, open folder, sidebar, diff panel, terminal, thread navigation, dictation.
- Every icon-only control needs an accessible name and tooltip.
- Focus rings should be visible and use the accent blue.
- Diff colors must not be the only signal; keep plus/minus counts and line markers.
- Panels must be reachable by keyboard.
- Composer controls must preserve tab order: input, attachment, permissions, model, effort, voice, send.

## Responsive And Platform Behavior

Desktop is the primary surface.

Minimum responsive expectations:

- Sidebar can collapse.
- Right panels can hide behind toggles.
- Composer remains usable at narrow widths.
- Review and browser panes should not crush thread text below readable width.

Platform notes:

- macOS and Windows should share the same product model.
- Platform-specific sandbox, permissions, and setup differences should appear in context.
- Keyboard shortcuts must follow platform conventions.

## Do Not Do

- Do not build a marketing landing page inside the app.
- Do not make the app card-heavy when a split-pane workflow is clearer.
- Do not hide mode, permissions, model, branch, or project context.
- Do not use colorful gradients as the app background.
- Do not make destructive or external actions one-click without confirmation.
- Do not let multiple threads edit the same files without warning.
- Do not rely on screenshots as the actual UI; product UI text and controls must be native.
- Do not mix unrelated metaphors such as kanban boards, CRM cards, or generic dashboard widgets unless the workflow requires them.

## Implementation Checklist

Before building a Codex-like screen, verify:

- The screen has a clear project/thread/mode context.
- The composer exposes permissions, mode, model, and send controls.
- Git state is visible when changes exist.
- Review/diff can be opened without leaving the thread.
- Browser/artifact/terminal surfaces are adjacent, not separate apps.
- High-risk actions have explicit confirmation.
- Empty/running/error states are designed.
- Copy uses Codex product terminology.
- Visual density is appropriate for repeated engineering work.

## Source Pages

- https://developers.openai.com/codex
- https://developers.openai.com/codex/app
- https://developers.openai.com/codex/app/features
- https://developers.openai.com/codex/app/review
- https://developers.openai.com/codex/app/worktrees
- https://developers.openai.com/codex/app/browser
- https://developers.openai.com/codex/app/computer-use
- https://developers.openai.com/codex/app/automations
- https://developers.openai.com/codex/app/commands
- https://developers.openai.com/codex/app/settings
- https://developers.openai.com/codex/ide
- https://developers.openai.com/codex/cli
- https://developers.openai.com/codex/cloud
- https://developers.openai.com/codex/workflows
- https://developers.openai.com/codex/prompting
- https://developers.openai.com/codex/agent-approvals-security
- https://developers.openai.com/codex/concepts/sandboxing
- https://developers.openai.com/codex/plugins
- https://developers.openai.com/codex/skills
- https://developers.openai.com/codex/subagents
- https://developers.openai.com/codex/mcp
- https://developers.openai.com/codex/learn/best-practices
