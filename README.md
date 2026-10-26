# VibeGallery

Полностью офлайн-галерея локальных видео для Windows в духе классического
медиаплеера: библиотека с миниатюрами, тегами, коллекциями, плейлистами,
умными фильтрами и поиском. Интерфейс на Electron.

## Основное

- Никакой телеметрии и сетевых запросов в рантайме: приложение работает
  только с локальными файлами.
- Библиотека в SQLite с автоматическим бэкапом при обновлении схемы.
- Видео открываются через внутренний протокол `media://`, доступ к файлам
  ограничен путями библиотеки.
- Удаление файлов только в корзину, с подтверждением.
- Интерфейс: русский и английский, темы светлая, тёмная, системная.
- Инкрементальный скан библиотек, наблюдение за папками, миниатюры через
  ffmpeg, метаданные через ffprobe.

## Чего нет в репозитории

Тяжёлое и локальное сознательно не хранится в git:

| Что | Почему | Как получить |
|---|---|---|
| `node_modules/` | зависимости ставятся на машине разработчика | `npm ci` |
| `resources/bin/` (~200 МБ) | ffmpeg/ffprobe — предсобранные бинарники | `npm run fetch:ffmpeg` |
| `tests/fixtures/videos/` | тестовые видео генерируются локально | `npm run fixtures:gen` |
| `release/`, `dist/`, `dist-electron/` | сборочные артефакты | `npm run build` / `npm run dist` |
| `docs/` | локальные отчёты и заметки вне гита | — |
| `*.db`, `*.log`, бэкапы | личные данные приложения | — |

Защита от случайного добавления тяжёлого: `npm run repo:check`
(падает, если в индексе или истории есть файлы больше 2 МБ или
запрещённые пути).

## Требования

- Windows 10/11 (основная платформа; код кроссплатформенный, бинарники
  ffmpeg скачиваются под текущую ОС, но сборки проверены только на Windows);
- Node.js 24+ и npm 11;
- Git (для `repo:check` и работы с репозиторием).

## Первый запуск

```powershell
git clone https://github.com/DarkDaro/VibeGallery.git
cd VibeGallery

npm ci                     # зависимости (postinstall проверит ABI better-sqlite3)
npm run fetch:ffmpeg       # скачает ffmpeg и ffprobe в resources/bin (вне гита)
npm run fixtures:gen       # создаст тестовые видео для разработки и тестов

npm run dev                # запуск приложения
```

Если `npm ci` недоступен (нет `package-lock.json`), используйте
`npm install`.

## Команды

| Команда | Назначение |
|---|---|
| `npm run dev` | режим разработки с HMR |
| `npm run build` | typecheck + production-сборка renderer/main/preload |
| `npm run dist` | NSIS-инсталлятор и portable (нужен `fetch:ffmpeg`) |
| `npm test` | unit-тесты (Vitest в Electron-рантайме) |
| `npm run e2e` | Playwright-тесты; перед первым прогоном нужен `npm run build` |
| `npm run lint` | ESLint (TS проверяет `tsc` в `typecheck`) |
| `npm run repo:check` | предохранитель от тяжёлых файлов в git |
| `npm run fixtures:gen` | пересоздать тестовые видео |
| `npm run fetch:ffmpeg` | скачать ffmpeg/ffprobe |

Особенности тестов: нативные модули собраны под ABI Electron, поэтому
Vitest запускается через `ELECTRON_RUN_AS_NODE=1 electron`, а не через
чистый Node. E2E-тесты поднимают production-сборку, поэтому сначала
`npm run build`, затем `npm run e2e` (или `npm run dist` для проверки
упакованного приложения).

## Данные приложения

Каталог профиля: `%APPDATA%\vibe-gallery`

```
library.db            библиотека (SQLite)
library.db.bak        бэкап перед обновлением схемы
backups/              бэкапы миграций
logs/app.log          журнал, ротация 10 файлов по 5 МБ
cache/thumbnails/     миниатюры
```

## Структура

```
electron/   main-процесс: окно, БД, IPC, протокол media://, сканер, сервисы
shared/     контракты, общие для main и renderer
src/        renderer: React + Tailwind + Zustand
tests/      unit (Vitest) и e2e (Playwright)
scripts/    установка зависимостей, фикстуры, проверка репозитория
```

## Публикация

Репозиторий ведётся локально, пуш выполняет владелец.

```powershell
git remote add origin https://github.com/DarkDaro/VibeGallery.git
git branch -M main
git push -u origin main
```

Перед первым пушем: `npm run repo:check` и чистый `git status`.

© 2026 DarkDaro. Все права защищены.
