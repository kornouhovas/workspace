# Folder Kanban MVP

Локальное приложение для работы с workspace-папкой в браузере.

## Нужно ли поднимать backend отдельно?

Нет. Команда `npm run dev` поднимает один локальный Node-сервер:

- отдает frontend по адресу `http://127.0.0.1:4173/`;
- обслуживает backend endpoint `/api/reveal` для открытия папок и файлов в Finder на macOS.

Отдельный backend-процесс запускать не нужно.

## Быстрый запуск

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
npm run dev
```

После запуска открой:

```text
http://127.0.0.1:4173/
```

## Запуск с доступом к Finder

Чтобы клики по папкам и непредпросматриваемым файлам открывались в Finder, сервер должен знать абсолютный путь к выбранной workspace-папке.

Запускай сервер так:

```bash
cd /Users/aleksandersk/Documents/programming/node/project_folder
FOLDER_KANBAN_ROOT="/absolute/path/to/workspace-root" npm run dev
```

Пример:

```bash
FOLDER_KANBAN_ROOT="/Users/aleksandersk/Documents/Projects" npm run dev
```

В Settings внутри приложения выбери эту же папку как root.

## Как работает открытие файлов и папок

- Клик по шеврону папки в `card place` раскрывает вложенные файлы и папки.
- Клик по строке папки открывает эту папку в Finder.
- PDF, изображения, текстовые файлы, видео, аудио, JSON, HTML, CSS, Markdown и похожие preview-типы открываются в браузере.
- Остальные файлы показываются в Finder через `open -R`.

## Безопасность локального endpoint

Endpoint `/api/reveal` принимает только относительный путь внутри `FOLDER_KANBAN_ROOT`.

Запросы с абсолютным путем или `../` отклоняются. Это нужно, чтобы браузер не мог открыть произвольный файл вне выбранной workspace-папки.

## Если порт занят

По умолчанию используется порт `4173`.

Можно запустить на другом порту:

```bash
PORT=4174 FOLDER_KANBAN_ROOT="/absolute/path/to/workspace-root" npm run dev
```

Тогда открой:

```text
http://127.0.0.1:4174/
```

## Проверка

```bash
npm test
```

## Важное ограничение браузера

Браузерный `showDirectoryPicker()` дает приложению доступ к файлам, но не раскрывает абсолютный путь выбранной папки. Поэтому для открытия в Finder нужен локальный Node endpoint и переменная `FOLDER_KANBAN_ROOT`.
