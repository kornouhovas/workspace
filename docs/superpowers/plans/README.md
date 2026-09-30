# Plans Folder

> Применяйте [rules.md](../../development/rules.md) и [workflow](../../development/workflow.md). План нужен по сложности задачи; уже одобренный план разрешает весь описанный объём без approvals каждого шага. Существующие планы сохраняют исторические решения, а процессные defaults заменены rules.md.

Use this folder for implementation plans.

Recommended naming:

```text
docs/superpowers/plans/YYYY-MM-DD-<topic>.md
```

Plans should break work into small tasks with:

- exact files to inspect/create/modify;
- failing tests before implementation where practical;
- focused commands;
- expected outcomes;
- commit/checkpoint guidance;
- final verification.

Use a plan when implementation spans multiple boundaries, such as:

- backend and sidecar;
- Electron IPC and renderer;
- UI and visual verification;
- data model and migration;
- API contract and service implementation.
