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
- Текущий блок: стабилизация frontend baseline.
- Production deployment: не готов.
- Real-money: вне scope первого релиза.

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
