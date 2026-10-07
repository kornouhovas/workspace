# Issue tracker: GitHub

Основной трекер Workspace — Issues приватного [kornouhovas/workspace](https://github.com/kornouhovas/workspace). Спецификации, критерии готовности, зависимости задач и итоговый статус принадлежат GitHub. Используйте `gh`; проверяйте `isPrivate` перед первой записью в новом репозитории. Исходники приложения и будущего сайта остаются приватными; публичность маркетингового сайта не меняет эту настройку.

## Операции

- Читать задачу: `gh issue view <number> --repo kornouhovas/workspace --json number,title,body,labels,comments`.
- Создать задачу или спецификацию: `gh issue create --repo kornouhovas/workspace --title "..." --body-file <file>`.
- Найти готовые задачи: `gh issue list --repo kornouhovas/workspace --label ready-for-agent --state open`.
- Для утверждённой дочерней задачи создайте native sub-issue через `gh api --method POST repos/kornouhovas/workspace/issues/<parent>/sub_issues -F sub_issue_id=<child-database-id>`. Если операция недоступна, запишите `Part of #<parent>` в её body и ссылку в родительской задаче.
- Зависимость: `gh api --method POST repos/kornouhovas/workspace/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Database ID получите через `gh api repos/kornouhovas/workspace/issues/<number> --jq .id`. При недоступности native dependencies используйте `Blocked by: #<number>`; готовность требует завершения каждого blocker.
- PR связывает реализацию с GitHub Issue. Закрывайте её после выполнения критериев и реально завершённых проверок. При реализации дочерней задачи статус родительской спецификации сохраняется до интеграционной проверки.

PRs as a request surface: no.

## Вспомогательная роль Beads

Beads хранит локальные шаги, зависимости выполнения и точку продолжения выбранной GitHub-задачи. У новой записи должна быть ссылка на её Issue; создавайте её при начале выполнения, когда локальная детализация полезна. Готовность продукта и backlog читаются из GitHub, а закрытие локального шага само по себе не закрывает Issue. Полная двусторонняя синхронизация не настроена.

Существующие записи Beads сохраняют историю прежнего процесса. Перед изменением прочитайте статус, владельца, критерии и зависимости. Перенос незавершённых старых задач в GitHub требует сверки, чтобы не создать дубликаты или потерять критерии. База Beads остаётся существующей локальной Dolt-базой; кодовая ветка не является отдельной копией её состояния.

## Работа с навыками Matt

`to-spec` публикует спецификацию в GitHub; `to-tickets` публикует согласованные задачи и связи; `implement` читает Issue и выполняет её критерии. Тестирование и code review используют текущие правила [разработки](../development/rules.md) и [проверок](../development/quality.md). Для программы адаптации bb используется отдельная ветка `codex/bb-architecture-workflow`; следующие независимые функции получают свои ветки.
