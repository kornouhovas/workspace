# Backlog Folder

> Рекомендации для задач, которым нужен отдельный backlog-файл. Текущие [rules.md](../development/rules.md) допускают ясный запрос без шаблона. Required Sections ниже относятся к выбранному шаблону; Beads/новый файл не обязательны для каждого запроса.

Backlog items describe work before implementation.

Use one file per feature, bug, or technical task.

Recommended naming:

```text
docs/backlog/<short-kebab-name>.md
```

Examples:

```text
docs/backlog/export-table-view-csv.md
docs/backlog/fix-settings-sidebar-open.md
docs/backlog/workspace-custom-properties.md
```

## Lifecycle

Backlog files should move through:

```text
Backlog -> Ready -> Agent Working -> Agent Review -> Human Review -> Done
```

Use `Status:` near the top of each backlog file.

## Required Sections

- Status
- Goal
- Context
- User Value or Bug Impact
- Scope
- Out Of Scope
- Acceptance Criteria
- Relevant Docs
- Test Plan
- Quality Gates
- Risks

Use `docs/templates/backlog-item.md` as the default template.
