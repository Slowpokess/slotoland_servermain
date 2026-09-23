# Project Progress

Этот документ является единым журналом фактического прогресса проекта Slotoland.

## Правила ведения

Каждая запись должна содержать:

- дату и название рабочего блока;
- фактически выполненные изменения;
- результаты проверок;
- известные ограничения и незакрытые задачи;
- следующий конкретный блок работ;
- ссылку на commit после его публикации.

План будущих работ хранится отдельно в [B2B_GAME_PLATFORM_TODO.md](B2B_GAME_PLATFORM_TODO.md). В этом журнале отмечается только реально выполненная и проверенная работа.

## Текущий статус

- Направление: B2B Game Provider для social/free-play первого релиза.
- Текущий milestone: `Milestone 1 — очистка текущего baseline`.
- Текущий блок: domain services завершены; следующий блок — backend browser-session storage model.
- Production deployment: не готов.
- Real-money: вне scope первого релиза.
- Browser authentication target: принят ADR 0001; backend implementation еще не начата.

---

## 2026-09-23 — начало реализации B2B roadmap

### Выполнено

- Проведен аудит backend, frontend, API, storage, deployment и документации.
- Создан полный план от текущего состояния до production deployment:
  [B2B_GAME_PLATFORM_TODO.md](B2B_GAME_PLATFORM_TODO.md).
- Удален встроенный demo-пароль из React-клиента.
- Пароль больше не сохраняется в `localStorage`.
- При запуске клиента удаляется legacy browser-storage key с паролем.
- Access и refresh tokens временно переведены из persistent `localStorage` в `sessionStorage`.
- Устранены ссылки production-клиента на отсутствующие `/logo.webp` и `/slotopol.webp`.
- Временные brand surfaces реализованы без внешних runtime assets.
- Исправлен формат keno selection: backend получает массив уникальных чисел.
- Тип активной игровой сессии `slot/keno` закреплен за самой сессией.
- Исправлена логика spin/double/collect: действия больше не зависят от карточки, выбранной в lobby после открытия сессии.
- Поле ручного API base скрыто в production и оставлено только в Vite dev mode.
- Добавлен глобальный React Error Boundary с безопасным recovery state.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.
- Production bundle проверен на отсутствие ссылок на удаленные runtime images.
- `go test ./api ./cmd ./config ./util` — успешно.
- Ранее полный `go test ./...` также завершился успешно.

### Известные ограничения

- `App.tsx` остается крупным монолитным компонентом.
- Для async-действий еще нет единой loading/disabled state model.
- `sessionStorage` является только промежуточным усилением; целевая browser-session authentication еще не реализована.
- Player UI и backoffice пока находятся в одном frontend-приложении.
- Нормализованный внешний Game Protocol отсутствует.
- Partner API, Launch API, operator model и seamless wallet отсутствуют.
- Денежные значения существующего storage все еще используют `float64`/`DOUBLE PRECISION`.

### Следующий блок

`Milestone 1 — frontend architecture cleanup`:

1. Добавить единый pending/loading state для пользовательских и операторских действий.
2. Разделить `App.tsx` на auth, lobby, game и backoffice модули.
3. Добавить routing и отделить player routes от operator routes.
4. Зафиксировать целевую browser-session authentication model.
5. Повторить frontend build и Go regression.

### Commit

- Первый snapshot нового репозитория: ветка `main`; точный SHA фиксируется историей GitHub.

---

## 2026-09-23 — единая модель асинхронных действий

### Выполнено

- Рабочая директория переведена на новую ветку `slotoland-main`, связанную с `slotoland/main`.
- Добавлен reusable hook `usePendingActions`.
- Hook не допускает повторный параллельный запуск действия с одинаковым ключом.
- Добавлены общие pending-группы для auth, gameplay и backoffice.
- Sign-in, sign-up, refresh и смена пароля получили loading labels и disabled state.
- Open game, spin, double и collect взаимно блокируются на время gameplay-запроса.
- Backoffice search, user loading и изменяющие операции защищены от повторного запуска.
- Интерактивные секции получили `aria-busy`.
- Disabled controls получили единое визуальное состояние.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.

### Следующий блок

Разделить `App.tsx` на самостоятельные presentation-модули, начиная с Game и Activity, затем вынести Account/Lobby и Backoffice.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — завершение presentation-декомпозиции

### Выполнено

- Account presentation вынесен в отдельный typed-компонент `AccountPanel`.
- Backoffice presentation вынесен в отдельный typed-компонент `BackofficePanel`.
- Форматирование денежных значений вынесено в общий модуль `format`.
- Ранее вынесенные `LobbyPanel`, `GamePanel` и `ActivityLedger` остаются независимыми presentation-компонентами.
- `App.tsx` теперь отвечает преимущественно за state и API orchestration.
- Размер `App.tsx` уменьшен с исходных 1210 до 880 строк.
- В todo отмечено завершение разделения presentation-компонентов и фиксация чистого baseline.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.

### Текущий архитектурный остаток

- Account, catalog, gameplay и backoffice API orchestration пока находятся в `App.tsx`.
- Player и operator presentation разделены компонентами, но еще используют один route shell.
- Целевая browser-session authentication model пока не зафиксирована.

### Следующий блок

Добавить route-level player/operator boundaries, затем вынести domain hooks/services из `App.tsx`.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — декомпозиция Lobby и каталога

### Выполнено

- Lobby presentation вынесен в typed-компонент `LobbyPanel`.
- Поиск, provider filters, quick filters, статистика и игровые карточки удалены из корневой JSX-разметки.
- Форматирование alias, type, shape и RTP вынесено в общий модуль `gameCatalog`.
- Одни и те же catalog helpers теперь используются контейнером и Lobby без дублирования.
- Размер `App.tsx` уменьшен до 1024 строк.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.

### Следующий блок

Вынести Account presentation, затем Backoffice. После этого определить route-level shell для player и operator зон.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — первый срез декомпозиции frontend

### Выполнено

- Игровая presentation-разметка вынесена из `App.tsx` в typed-компонент `GamePanel`.
- Журнал пользовательской активности вынесен в `ActivityLedger`.
- Таблица временных символов и форматирование относительного времени перенесены к компонентам-владельцам.
- `App.tsx` оставлен владельцем API orchestration и состояния; поведение запросов не изменено.
- Размер `App.tsx` уменьшен с 1210 до 1125 строк.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.

### Следующий блок

Вынести Account и Lobby presentation, после чего отделить Backoffice и перейти к route-level boundaries.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — route-level разделение player и operator

### Выполнено

- Добавлен минимальный pathname router с typed routes `player` и `backoffice`.
- Player product доступен на `/`.
- Operator surface доступен на `/backoffice`.
- Player и backoffice presentation больше не рендерятся одновременно.
- Для пользователя без backoffice-роли отображается отдельный access-denied state.
- Навигация между player и operator зонами использует самостоятельные URL.
- Добавлен отдельный одно-колоночный backoffice layout.
- Решение совместимо с существующим Nginx `try_files ... /index.html` fallback.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.
- `go test ./...` — успешно.

### Следующий блок

Вынести auth, catalog, gameplay и backoffice orchestration из `App.tsx` в domain hooks/services и зафиксировать browser-session authentication ADR.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — ADR browser-session authentication

### Выполнено

- Принят ADR 0001 для player, backoffice, B2B iframe и Partner API authentication.
- Player/backoffice target определен как server-managed HttpOnly session cookie с CSRF/origin protection.
- B2B game client target определен как одноразовый launch ticket и короткоживущий session-scoped credential.
- Partner API authentication отделена в HMAC server-to-server контур.
- `sessionStorage` явно зафиксирован только как переходное решение.

### Следующий блок

Вынести auth orchestration в отдельный domain hook/service, не расширяя зависимость от временного token storage; затем спроектировать backend browser-session storage model.

### Commit

- Заполняется историей Git после публикации этого среза.

---

## 2026-09-23 — frontend domain API services

### Выполнено

- Добавлен единый typed-контракт `ApiRequester` между transport и domain слоями.
- Auth/account orchestration вынесена в `authApi`: sign-in, sign-up, refresh, смена секрета и загрузка account snapshot.
- Загрузка каталога вынесена в `catalogApi`.
- Открытие игровой сессии, slot/keno spin, double-up и collect вынесены в `gameplayApi`.
- Backoffice role, поиск пользователя, агрегированная загрузка detail/ledger/sessions/audit и operator mutations вынесены в `backofficeApi`.
- `App.tsx` больше не знает endpoint paths доменов auth, account, catalog, gameplay и backoffice; в нем сохранены UI orchestration, token refresh retry и system health-check.
- Поведение и существующие HTTP-контракты не изменялись.

### Проверки

- `npm run typecheck` — успешно.
- `npm run build` — успешно.
- `go test ./...` — успешно.

### Известные ограничения

- Frontend unit/component tests пока отсутствуют; сервисный срез проверяется TypeScript и production build.
- Bearer access/refresh tokens остаются переходным механизмом до реализации ADR 0001.

### Следующий блок

Спроектировать и реализовать backend-модель server-managed browser sessions с HttpOnly cookie и CSRF/origin protection, сохранив отдельный authentication контур будущего Partner API.

### Commit

- Заполняется историей Git после публикации этого среза.
