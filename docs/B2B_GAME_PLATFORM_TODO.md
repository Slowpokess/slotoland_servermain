# B2B Game Platform — полный план работ

Обновлено: 2026-09-23

## 1. Цель релиза

Довести текущий Slotopol server до состояния B2B game provider, в котором:

- партнер получает каталог доступных игр через API;
- партнер создает игровую сессию для своего игрока;
- API возвращает короткоживущий launch URL;
- игра открывается в iframe или webview платформы партнера;
- игровой результат рассчитывается только сервером;
- ставки, выигрыши, возвраты и rollback идемпотентны;
- партнер может использовать внутренний demo-wallet или свой seamless wallet;
- существует минимум одна полностью оформленная оригинальная slot-игра;
- оператор видит партнеров, сессии, раунды, транзакции и ошибки;
- deployment, мониторинг, backup и rollback проверены на staging.

Первый релиз является social/free-play B2B-релизом. Real-money не входит в его scope без отдельного compliance, licensing и certification проекта.

## 2. Текущее состояние

### Уже есть

- [x] Go game engine с slot и keno алгоритмами.
- [x] Каталог игровых алгоритмов и aliases.
- [x] Пользователи, клубы, игровые сессии и внутренний wallet.
- [x] Slot spin, double-up, collect и keno spin API.
- [x] Wallet ledger для основных gameplay-операций.
- [x] Access/refresh authentication и ownership checks.
- [x] PostgreSQL migrations и SQLite dev/demo режим.
- [x] Health, readiness, metrics и request ID.
- [x] Docker, Nginx и базовый CI.
- [x] React/Vite scaffold с lobby, auth, game board и backoffice surface.
- [x] Текущие Go tests, frontend typecheck и frontend build проходят.

### Еще нет

- [ ] B2B operator/partner domain.
- [ ] Partner authentication и API credentials.
- [ ] Launch API и одноразовые launch tokens.
- [ ] Внешний player identity mapping.
- [ ] Seamless wallet protocol.
- [ ] Idempotency для spin/bet/win/rollback.
- [ ] Нормализованный game result protocol.
- [ ] OpenAPI и partner integration documentation.
- [ ] Настоящий игровой renderer, assets, animation и audio.
- [ ] Отдельные player, game и backoffice приложения.
- [ ] Frontend unit/component/E2E tests.
- [ ] Проверенный staging runtime с PostgreSQL и TLS.
- [ ] Production reconciliation и incident tooling.

## 3. Обозначения

- `[ ]` — не начато.
- `[-]` — выполняется.
- `[x]` — завершено и проверено.
- `P0` — блокирует первый интегрируемый релиз.
- `P1` — обязательно до подключения первого внешнего партнера.
- `P2` — можно выполнить после первого partner pilot.

Задача считается завершенной только после выполнения ее Definition of Done, а не после написания кода.

## 4. Milestone 0 — фиксация продукта и границ

### P0.0.1. Зафиксировать B2B-направление

- [ ] Обновить `DEVELOPMENT_DIRECTION.md`: основной результат — B2B Game Provider API и game client.
- [ ] Обновить `BLOCK_BACKLOG.md`, подняв B2B packaging из post-MVP в текущий roadmap.
- [ ] Зафиксировать, что первый релиз работает только с social/free-play currency.
- [ ] Зафиксировать, что real-money требует отдельного go/no-go решения.
- [ ] Определить владельца product decisions и владельца API contract.

### P0.0.2. Определить модель интеграции

- [ ] Выбрать основной способ запуска: iframe с короткоживущим launch URL.
- [ ] Поддержать webview как совместимый режим.
- [ ] Выбрать REST/JSON для Partner API v1.
- [ ] Зафиксировать server-authoritative gameplay.
- [ ] Зафиксировать, что клиент только воспроизводит полученный результат.
- [ ] Выбрать integer minor units для всех денежных значений.
- [ ] Зафиксировать UTC для всех timestamps.
- [ ] Определить поддерживаемые locale и currency первого релиза.

### P0.0.3. Решить вопрос контента

- [ ] Провести inventory названий существующих provider/game aliases.
- [ ] Не публиковать сторонние trademarks и artwork без подтвержденных прав.
- [ ] Выбрать оригинальную тему первой игры.
- [ ] Определить правила именования `game_id`, `slug`, release и asset versions.
- [ ] Подготовить content acceptance checklist.

Definition of Done:

- [ ] Архитектурные решения записаны в ADR.
- [ ] Scope первого релиза не содержит неявных real-money требований.
- [ ] Команда одинаково понимает player, partner, operator, round и transaction.

## 5. Milestone 1 — очистка текущего baseline

### P0.1.1. Зафиксировать чистую исходную точку

- [x] Разобрать существующие незакоммиченные изменения и сохранить полный baseline отдельным root commit.
- [x] Разделить последующие изменения на логические commits.
- [x] Проверить, что generated artifacts, `.env`, caches, logs и binaries не попадают в commits.
- [x] Принять `main` нового репозитория как trunk и вести локальную рабочую ветку `slotoland-main` с прямой публикацией законченных срезов.
- [ ] Добавить PR template с security, migrations и API checklist.

### P0.1.2. Исправить текущие frontend-дефекты

- [x] Устранить runtime-зависимость от отсутствующих `logo.webp` и `slotopol.webp`: заменить scaffold-графику на встроенные CSS brand surfaces.
- [x] Проверить production `dist` на отсутствие ссылок на отсутствующие изображения.
- [x] Удалить demo password из React default state.
- [x] Не сохранять пароль в localStorage и удалять legacy password key при старте клиента.
- [x] Определить целевую browser-session стратегию в `docs/adr/0001-browser-session-authentication.md`; реализация server sessions остается отдельной задачей.
- [x] Перевести access/refresh tokens из persistent localStorage в sessionStorage как промежуточное усиление до browser-session API.
- [x] Исправить keno UI: отправлять массив уникальных выбранных номеров и закрепить тип игры за активной сессией.
- [x] Добавить единый duplicate-safe pending/loading state для auth, game и backoffice async actions.
- [x] Добавить global error boundary с безопасным recovery state.
- [x] Убрать ввод произвольного API base из production player UI, сохранив его только для Vite dev mode.

### P0.1.3. Разделить текущий React-монолит

- [x] Вынести auth hooks/service.
- [x] Вынести catalog hooks/service.
- [x] Вынести game session hooks/service.
- [x] Вынести backoffice hooks/service.
- [x] Разделить Account, Lobby, Game, Activity, catalog helpers и Backoffice presentation components.
- [x] Добавить минимальный pathname application router без новой runtime-зависимости.
- [x] Отделить player route `/` от operator route `/backoffice`; поверхности больше не присутствуют в DOM одновременно.
- [ ] Ввести единый query/cache слой или четкий собственный data layer.

### P0.1.4. Перевести browser authentication на server sessions

- [x] Добавить persistent `browser_session` storage model и PostgreSQL migration.
- [x] Хранить только SHA-256 fingerprints session и CSRF secrets.
- [x] Реализовать expiry, точечный revoke, revoke-all для пользователя и cleanup primitives.
- [x] Отзывать sessions при анонимизации пользователя и удалять при hard-delete.
- [ ] Добавить browser sign-in, session check/refresh и logout endpoints.
- [ ] Передавать session ID только в `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` cookie.
- [ ] Добавить CSRF token и same-origin validation для изменяющих cookie-auth запросов.
- [ ] Отзывать активные sessions при смене пароля и блокировке account.
- [ ] Перевести player/backoffice frontend на cookie flow и удалить account JWT из browser storage.

### P1.1.4. Усилить HTTP baseline

- [ ] Добавить rate limiting policy.
- [ ] Добавить Content-Security-Policy.
- [ ] Настроить `frame-ancestors` по allowed origins партнеров.
- [ ] Добавить `X-Content-Type-Options` и `Referrer-Policy`.
- [ ] Определить CORS отдельно для Partner API и game client.
- [ ] Ограничить body size по группам endpoints.
- [ ] Проверить trusted proxy configuration в реальном deployment.

Definition of Done:

- [ ] `go test ./...` проходит.
- [ ] Frontend typecheck и build проходят.
- [x] Production frontend не содержит ссылок на отсутствующие обязательные assets.
- [x] Пароль не пишется в browser storage.
- [x] Player и backoffice presentation больше не находятся в одном компоненте.

## 6. Milestone 2 — B2B data model

### P0.2.1. Operator model

- [ ] Добавить таблицу `operator`.
- [ ] Добавить стабильный public `operator_id`.
- [ ] Добавить name, status, environment и timestamps.
- [ ] Добавить allowed currencies/locales.
- [ ] Добавить список включенных игр.
- [ ] Добавить default wallet mode.
- [ ] Добавить rate limit profile.
- [ ] Добавить audit trail изменений оператора.

### P0.2.2. Partner credentials

- [ ] Добавить таблицу `operator_credential`.
- [ ] Хранить только hash API secret, если протокол это допускает.
- [ ] Поддержать несколько ключей для безопасной rotation.
- [ ] Добавить `key_id`, created time, expiry и revoked time.
- [ ] Добавить allowed IP/CIDR.
- [ ] Добавить allowed iframe origins.
- [ ] Добавить last-used metadata без записи секретов в logs.

### P0.2.3. External player mapping

- [ ] Добавить `operator_player`.
- [ ] Связать internal UID с `operator_id + external_player_id`.
- [ ] Запретить collision игроков между операторами.
- [ ] Хранить locale, currency и status.
- [ ] Не требовать email для partner-created player.
- [ ] Определить anonymization и retention behavior.

### P0.2.4. Launch session

- [ ] Добавить `launch_session`.
- [ ] Использовать непредсказуемый public session ID.
- [ ] Хранить hash одноразового launch token.
- [ ] Добавить expiry, consumed time и closed time.
- [ ] Связать session с operator, player, game release и mode.
- [ ] Хранить locale, currency, return URL и client metadata.
- [ ] Ограничить повторное использование launch token.

### P0.2.5. Round и transaction model

- [ ] Добавить `game_round` со стабильным public round ID.
- [ ] Добавить `game_transaction` со стабильным transaction ID.
- [ ] Разделить `bet`, `win`, `refund`, `rollback`, `bonus`.
- [ ] Хранить amount только в integer minor units.
- [ ] Хранить balance before/after в minor units.
- [ ] Добавить уникальность `operator_id + transaction_id`.
- [ ] Хранить status machine транзакции.
- [ ] Хранить request fingerprint для конфликтующих idempotency retries.
- [ ] Связать все операции с game release/version.

### P0.2.6. Миграция денежных типов

- [ ] Провести inventory всех `float64` денежных полей.
- [ ] Ввести доменный тип `Money`/`Amount` на базе `int64`.
- [ ] Определить rounding rules на внешних границах.
- [ ] Создать PostgreSQL migration на `BIGINT` minor units.
- [ ] Написать migration verification report.
- [ ] Запретить неявное преобразование float в gameplay settlement.

Definition of Done:

- [ ] PostgreSQL migrations применяются на пустой и существующей тестовой БД.
- [ ] Повторная миграция безопасно отклоняется или является no-op.
- [ ] Все новые transaction amounts представлены целыми числами.
- [ ] Tenant isolation покрыта integration tests.

## 7. Milestone 3 — Partner authentication и Launch API

### P0.3.1. Server-to-server authentication

- [ ] Выбрать HMAC SHA-256 request signing для v1.
- [ ] Подписывать method, path, timestamp, nonce и body digest.
- [ ] Ограничить допустимый clock skew.
- [ ] Хранить использованные nonce на время replay window.
- [ ] Использовать constant-time signature comparison.
- [ ] Возвращать безопасные versioned auth errors.
- [ ] Не логировать secrets, raw signatures и launch tokens.
- [ ] Подготовить key rotation flow.
- [ ] Рассмотреть mTLS как P2 option.

### P0.3.2. Catalog API

- [ ] Создать `GET /api/v1/games`.
- [ ] Создать `GET /api/v1/games/{game_id}`.
- [ ] Возвращать только игры, включенные для оператора.
- [ ] Добавить pagination/filtering.
- [ ] Добавить immutable game release version.
- [ ] Добавить thumbnail, orientation, min/max/default bet.
- [ ] Добавить RTP profile, volatility и supported features.
- [ ] Добавить locale и asset manifest URLs.

### P0.3.3. Launch API

- [ ] Создать `POST /api/v1/sessions`.
- [ ] Валидировать operator, game, player, currency и locale.
- [ ] Создавать или находить operator player mapping.
- [ ] Выпускать одноразовый короткоживущий launch token.
- [ ] Возвращать `session_id`, `launch_url`, `expires_at`.
- [ ] Создать session info endpoint.
- [ ] Создать idempotent session close endpoint.
- [ ] Добавить allowlist return URLs.
- [ ] Добавить integration tests на cross-tenant access.

### P0.3.4. Game bootstrap

- [ ] Создать endpoint обмена launch token на game session.
- [ ] Не передавать partner API secret в браузер.
- [ ] Выдать browser session credential минимального scope.
- [ ] Вернуть game manifest, player display data и balance.
- [ ] Поддержать refresh/reconnect без повторного launch.
- [ ] Инвалидировать credential при закрытии session.

Definition of Done:

- [ ] Партнер может получить каталог и создать launch URL только server-to-server.
- [ ] Launch token нельзя использовать повторно после успешного exchange.
- [ ] Один оператор не может открыть player/session другого оператора.
- [ ] Все negative auth cases покрыты тестами.

## 8. Milestone 4 — нормализованный Game Protocol

### P0.4.1. Стабильные DTO

- [ ] Создать versioned `GameManifest`.
- [ ] Создать `GameState`.
- [ ] Создать `SpinRequest` и `SpinResult`.
- [ ] Создать `GameActionRequest` для bonus choices.
- [ ] Создать `RoundSummary`.
- [ ] Создать `WinPresentation`.
- [ ] Создать `VisualEvent` union.
- [ ] Создать единый error envelope с stable error codes.
- [ ] Запретить сериализацию внутренних Go game structs во внешний API v1.

### P0.4.2. Visual events

- [ ] Описать reel stops.
- [ ] Описать line/ways/cluster wins.
- [ ] Описать wild/scatter transformations.
- [ ] Описать cascade sequence.
- [ ] Описать multiplier changes.
- [ ] Описать free-spin trigger/retrigger/end.
- [ ] Описать jackpot/big-win presentation.
- [ ] Описать bonus choice/result.
- [ ] Добавить event schema version.

### P0.4.3. Адаптер существующего engine

- [ ] Создать внутренний интерфейс `GameAdapter`.
- [ ] Реализовать adapter для первой slot-игры.
- [ ] Преобразовывать internal screen в normalized grid.
- [ ] Преобразовывать internal wins в presentation events.
- [ ] Проверять инварианты bet/win/balance до ответа клиенту.
- [ ] Сохранять normalized round result для replay/support.
- [ ] Не включать скрытые RNG/reel данные в public response.

### P0.4.4. Idempotent gameplay

- [ ] Требовать `transaction_id` или `Idempotency-Key` для spin.
- [ ] Создавать round и bet transaction атомарно.
- [ ] Возвращать сохраненный ответ при точном retry.
- [ ] Возвращать conflict при том же ключе и другом payload.
- [ ] Не выполнять повторный RNG call при retry.
- [ ] Добавить timeout/retry integration tests.
- [ ] Добавить concurrent duplicate request tests.

Definition of Done:

- [ ] Сохраненный SpinResult воспроизводится без internal Go object.
- [ ] Повтор одного spin request никогда не создает второй round или debit.
- [ ] Контракт опубликован в OpenAPI и JSON Schema.

## 9. Milestone 5 — Wallet adapters

### P0.5.1. Общий wallet interface

- [ ] Определить `GetBalance`.
- [ ] Определить `Bet`.
- [ ] Определить `Win`.
- [ ] Определить `Refund`.
- [ ] Определить `Rollback`.
- [ ] Определить error taxonomy: insufficient funds, timeout, rejected, unknown.
- [ ] Передавать operator, player, session, round и transaction IDs.
- [ ] Гарантировать integer amounts и currency match.

### P0.5.2. Internal wallet adapter

- [ ] Перевести существующий wallet settlement на общий interface.
- [ ] Обеспечить атомарность round + wallet ledger.
- [ ] Добавить idempotency records.
- [ ] Добавить refund/rollback.
- [ ] Сверять ledger balance с wallet read model.
- [ ] Покрыть insufficient funds и rollback тестами.

### P1.5.3. Seamless wallet adapter

- [ ] Описать callback API, которое реализует партнер.
- [ ] Добавить per-operator callback URL.
- [ ] Подписывать callback запросы.
- [ ] Добавить connect/read/total timeouts.
- [ ] Добавить bounded retry с backoff.
- [ ] Не повторять permanent rejection.
- [ ] Добавить circuit breaker.
- [ ] Хранить delivery attempts и безопасные response snapshots.
- [ ] Реализовать balance/bet/win/refund/rollback callbacks.

### P1.5.4. Reconciliation

- [ ] Создать job сверки rounds и transactions.
- [ ] Находить pending/unknown операции.
- [ ] Добавить ручной retry только с audit reason.
- [ ] Добавить daily operator report.
- [ ] Добавить discrepancy status и resolution notes.
- [ ] Не позволять ручному retry создать duplicate settlement.

Definition of Done:

- [ ] Одинаковый gameplay flow работает с internal и seamless wallet.
- [ ] Timeout после принятого партнером bet не приводит к повторному списанию.
- [ ] Любая wallet operation находится по transaction ID.
- [ ] Reconciliation обнаруживает искусственно созданное расхождение.

## 10. Milestone 6 — frontend platform architecture

### P0.6.1. Разделить приложения

- [ ] Создать `game-client`.
- [ ] Создать `demo-lobby`.
- [ ] Создать отдельный `backoffice` route/app boundary.
- [ ] Создать общий `api-client` package.
- [ ] Создать общий `game-protocol` package.
- [ ] Создать общий `ui` package.
- [ ] Настроить независимые build targets.

### P0.6.2. Design system

- [ ] Определить color tokens.
- [ ] Определить typography scale.
- [ ] Определить spacing, radius, elevation и motion tokens.
- [ ] Реализовать button/input/select/checkbox.
- [ ] Реализовать modal/drawer/toast/tooltip.
- [ ] Реализовать balance и bet controls.
- [ ] Реализовать game card и catalog filters.
- [ ] Реализовать loading, empty, offline и error states.
- [ ] Добавить visible focus states.
- [ ] Добавить reduced-motion mode.
- [ ] Добавить mobile safe-area support.

### P0.6.3. Demo lobby UX

- [ ] Landing/loading screen.
- [ ] Sign-in/demo player flow.
- [ ] Responsive game catalog.
- [ ] Search, provider/category filters.
- [ ] Recently played и favorites.
- [ ] Wallet/history page.
- [ ] Game details dialog.
- [ ] Launch game в iframe.
- [ ] Fullscreen и exit behavior.
- [ ] Mobile bottom navigation.

### P1.6.4. Iframe bridge

- [ ] Определить versioned postMessage protocol.
- [ ] Проверять origin каждого сообщения.
- [ ] Реализовать `game.ready`.
- [ ] Реализовать `game.resize`.
- [ ] Реализовать `game.round.started/completed`.
- [ ] Реализовать `game.balance.changed`.
- [ ] Реализовать `game.error`.
- [ ] Реализовать `game.exit`.
- [ ] Подготовить маленький JS SDK для платформы партнера.

Definition of Done:

- [ ] Game client открывается отдельно от demo lobby.
- [ ] Backoffice bundle не загружается обычному игроку без необходимости.
- [ ] Mobile UX проверен минимум на 360×640 и современном desktop viewport.
- [ ] Все iframe messages имеют origin validation.

## 11. Milestone 7 — первая полноценная оригинальная игра

### P0.7.1. Game design

- [ ] Утвердить оригинальное название и тему.
- [ ] Утвердить 5×3 grid и payout model.
- [ ] Определить symbols, wild, scatter и bonus symbols.
- [ ] Определить paylines/ways.
- [ ] Определить free spins feature.
- [ ] Определить bet range и default bet.
- [ ] Подготовить rules и paytable.
- [ ] Провести математическую проверку RTP/volatility.

### P0.7.2. Visual production

- [ ] Создать background для portrait и landscape.
- [ ] Создать полный набор symbol assets.
- [ ] Создать wild/scatter animations.
- [ ] Создать reel frame и control panel.
- [ ] Создать thumbnail, splash и loading artwork.
- [ ] Создать win effects и particles.
- [ ] Оптимизировать textures/atlases.
- [ ] Подготовить WebP/AVIF fallbacks по необходимости.
- [ ] Зафиксировать asset license/provenance.

### P0.7.3. Audio production

- [ ] Background music loop.
- [ ] Reel spin/stop sounds.
- [ ] Symbol win sounds.
- [ ] Big win sounds.
- [ ] Free spins trigger/ambient sounds.
- [ ] UI sounds.
- [ ] Volume, mute и persisted settings.
- [ ] Останавливать/ослаблять audio при hidden tab.

### P0.7.4. Game renderer

- [ ] Выбрать PixiJS, Phaser или другой Canvas/WebGL renderer.
- [ ] Реализовать asset preloader.
- [ ] Реализовать deterministic reel animation из server stops.
- [ ] Реализовать anticipation.
- [ ] Реализовать winning line/symbol highlights.
- [ ] Реализовать count-up win presentation.
- [ ] Реализовать free spins transitions.
- [ ] Реализовать big-win presentation.
- [ ] Реализовать portrait/landscape layout.
- [ ] Реализовать pause/resume при visibility change.

### P0.7.5. Controls и player flow

- [ ] Spin button.
- [ ] Bet selector.
- [ ] Max bet с подтверждением при необходимости.
- [ ] Turbo mode.
- [ ] Autoplay для social mode с configurable limits.
- [ ] Stop/skip presentation без изменения server result.
- [ ] Balance, last win и current bet.
- [ ] Rules/paytable/help.
- [ ] Sound/settings.
- [ ] Exit/fullscreen.
- [ ] Недоступность spin во время неподходящего state.

### P0.7.6. Resilience

- [ ] Повтор bootstrap после временной ошибки.
- [ ] Reconnect к открытой session.
- [ ] Восстановление незавершенного presentation из сохраненного round result.
- [ ] Защита от двойного клика spin.
- [ ] Корректная обработка insufficient funds.
- [ ] Корректная обработка expired/closed session.
- [ ] Offline overlay.
- [ ] Safe exit после round completion.

Definition of Done:

- [ ] 100 последовательных раундов проходят без рассинхронизации UI и balance.
- [ ] Refresh во время/после spin восстанавливает правильный round state.
- [ ] Игра работает на mobile portrait, mobile landscape и desktop.
- [ ] Paytable соответствует серверной математике.
- [ ] В игре нет стороннего artwork или trademarks без подтвержденных прав.

## 12. Milestone 8 — Game SDK и content pipeline

### P1.8.1. Выделить Game SDK

- [ ] Session bootstrap module.
- [ ] Typed API transport.
- [ ] State machine.
- [ ] Animation queue.
- [ ] Asset loader/cache.
- [ ] Audio manager.
- [ ] Localization.
- [ ] Responsive viewport.
- [ ] Settings persistence.
- [ ] Telemetry hooks.
- [ ] Iframe bridge.
- [ ] Error/reconnect policy.

### P1.8.2. Game manifest pipeline

- [ ] JSON Schema для manifest.
- [ ] Build-time validation.
- [ ] Asset existence validation.
- [ ] Hashing и immutable asset URLs.
- [ ] Game/client/protocol version compatibility check.
- [ ] Dev preview command.
- [ ] Release packaging command.
- [ ] Rollback на предыдущую game release.

### P1.8.3. Подключение второй игры

- [ ] Реализовать вторую игру через SDK без копирования первой.
- [ ] Зафиксировать missing abstractions.
- [ ] Устранить game-specific assumptions из SDK.
- [ ] Сравнить время и объем подключения первой и второй игры.

Definition of Done:

- [ ] Новая игра добавляется через adapter, manifest и assets.
- [ ] Game release immutable после публикации.
- [ ] Старые активные sessions продолжают работать с закрепленной версией.

## 13. Milestone 9 — полноценный backoffice

### P1.9.1. Operator management

- [ ] Список/поиск операторов.
- [ ] Создание и блокировка оператора.
- [ ] Управление currencies/locales.
- [ ] Управление enabled games.
- [ ] Управление allowed origins/IP.
- [ ] Создание, rotation и revoke API credentials.
- [ ] Отображение секрета только один раз при создании.

### P1.9.2. Gameplay investigation

- [ ] Поиск player/session/round/transaction.
- [ ] Timeline одного round.
- [ ] Просмотр normalized result.
- [ ] Просмотр wallet callbacks и попыток доставки.
- [ ] Фильтры по operator/game/status/time.
- [ ] Export ограниченного отчета.
- [ ] Маскирование чувствительных данных.

### P1.9.3. Operational actions

- [ ] Close session.
- [ ] Disable game release для новых launches.
- [ ] Retry допустимого callback.
- [ ] Resolve reconciliation discrepancy.
- [ ] Block/unblock player mapping.
- [ ] Требовать reason для каждого изменяющего действия.
- [ ] Записывать before/after и actor в audit log.

### P1.9.4. Role model

- [ ] Разделить support, operator, finance и admin.
- [ ] Применять least privilege.
- [ ] Добавить sensitive-action confirmation.
- [ ] Добавить session timeout.
- [ ] Покрыть permission matrix integration tests.

Definition of Done:

- [ ] Support расследует типовой спор без прямого SQL.
- [ ] Finance видит wallet/reconciliation, но не управляет API keys.
- [ ] Все ручные действия доступны в audit journal.

## 14. Milestone 10 — observability и analytics

### P1.10.1. Technical telemetry

- [ ] Structured logs с operator/session/round/transaction correlation.
- [ ] Не логировать secrets и персональные данные без необходимости.
- [ ] Метрики launch success/failure.
- [ ] Метрики spin latency и error rate.
- [ ] Метрики wallet callback latency/status.
- [ ] Метрики pending/unknown transactions.
- [ ] Метрики active sessions.
- [ ] Метрики reconciliation discrepancies.

### P1.10.2. Alerts

- [ ] Повышенный API 5xx rate.
- [ ] Повышенный wallet timeout rate.
- [ ] Рост pending transactions.
- [ ] Reconciliation mismatch.
- [ ] PostgreSQL unavailable/connection exhaustion.
- [ ] Disk/CPU/memory thresholds.
- [ ] Backup failure.
- [ ] Certificate expiration.

### P1.10.3. Product events

- [ ] Game launch.
- [ ] Game ready.
- [ ] Round started/completed/failed.
- [ ] Feature triggered.
- [ ] Session duration.
- [ ] Exit reason.
- [ ] Client performance и asset loading failures.
- [ ] Не использовать product analytics как финансовый источник истины.

Definition of Done:

- [ ] Любой проблемный round находится по request/round/transaction ID.
- [ ] Для критических wallet и database проблем существуют проверенные alerts.

## 15. Milestone 11 — тестовая стратегия

### P0.11.1. Backend tests

- [ ] Unit tests HMAC verification.
- [ ] Unit tests Money arithmetic/rounding.
- [ ] Migration tests.
- [ ] Tenant isolation tests.
- [ ] Launch token replay tests.
- [ ] Idempotent spin tests.
- [ ] Concurrent duplicate tests.
- [ ] Wallet timeout/retry tests.
- [ ] Refund/rollback tests.
- [ ] Golden tests normalized game results.
- [ ] Race tests для критических packages.

### P0.11.2. Frontend tests

- [ ] Unit tests state machine.
- [ ] Unit tests event/presentation mapping.
- [ ] Component tests controls и error states.
- [ ] API client contract tests.
- [ ] Iframe origin/security tests.
- [ ] Playwright launch-to-spin E2E.
- [ ] Refresh/reconnect E2E.
- [ ] Mobile viewport E2E.
- [ ] Visual regression ключевых states.
- [ ] Accessibility checks.

### P1.11.3. Performance tests

- [ ] Catalog API load test.
- [ ] Concurrent session launch test.
- [ ] Spin throughput test.
- [ ] Seamless wallet latency simulation.
- [ ] PostgreSQL connection pool test.
- [ ] 12–24 hour soak test.
- [ ] Frontend performance budget.
- [ ] Asset CDN/cache behavior test.

### P1.11.4. Failure drills

- [ ] API restart во время активных sessions.
- [ ] PostgreSQL temporary outage.
- [ ] Wallet provider timeout.
- [ ] Duplicate callback/request storm.
- [ ] Stale game client version.
- [ ] Partial deployment rollback.
- [ ] Expired TLS certificate warning path.

Definition of Done:

- [ ] CI блокирует merge при contract, test, typecheck или build failure.
- [ ] E2E проходит на production-like staging.
- [ ] Зафиксированы целевые latency/error budgets.

## 16. Milestone 12 — deployment и staging

### P1.12.1. Environments

- [ ] Разделить local, CI, staging и production configs.
- [ ] Создать отдельные secrets/credentials.
- [ ] Запретить production secrets в repository.
- [ ] Создать demo operator автоматически только в non-production.
- [ ] Настроить predictable migrations before deploy.

### P1.12.2. PostgreSQL

- [ ] Поднять staging PostgreSQL.
- [ ] Проверить migrations на clean database.
- [ ] Проверить upgrade с предыдущей schema.
- [ ] Настроить backup schedule.
- [ ] Выполнить реальный restore drill.
- [ ] Настроить connection pool limits.
- [ ] Проверить storage growth для round/results/logs.

### P1.12.3. Delivery

- [ ] Собрать versioned backend image.
- [ ] Собрать versioned frontend/game images или static bundles.
- [ ] Добавить SBOM/dependency scan.
- [ ] Добавить migration gate.
- [ ] Добавить post-deploy smoke.
- [ ] Добавить автоматический rollback критерий.
- [ ] Хранить предыдущую рабочую game release.

### P1.12.4. Edge/CDN

- [ ] Настроить TLS.
- [ ] Настроить immutable caching для versioned assets.
- [ ] Не кэшировать session/gameplay API responses.
- [ ] Настроить compression.
- [ ] Настроить CSP и partner frame origins.
- [ ] Проверить CDN invalidation/rollback.

Definition of Done:

- [ ] Полный launch-to-spin flow проходит на staging через публичный TLS endpoint.
- [ ] Backup восстановлен в отдельную БД и проверен.
- [ ] Предыдущая версия реально возвращается через rollback procedure.

## 17. Milestone 13 — документация и partner sandbox

### P1.13.1. OpenAPI

- [ ] Описать каждый Partner API endpoint.
- [ ] Описать authentication/signing.
- [ ] Описать errors и retry policy.
- [ ] Добавить request/response examples.
- [ ] Добавить idempotency guarantees.
- [ ] Версионировать spec вместе с backend.

### P1.13.2. Integration guide

- [ ] Quickstart от credentials до launch URL.
- [ ] HMAC code examples.
- [ ] iframe integration example.
- [ ] JS bridge documentation.
- [ ] Seamless wallet reference server.
- [ ] Timeout/retry/rollback guide.
- [ ] Certification checklist для партнера.

### P1.13.3. Sandbox

- [ ] Self-contained sandbox operator.
- [ ] Test player creation.
- [ ] Test balance controls.
- [ ] Предсказуемые insufficient-funds/error scenarios.
- [ ] Callback inspector.
- [ ] Credential rotation demo.
- [ ] Sandbox reset procedure.

Definition of Done:

- [ ] Новый интегратор запускает первую игру без доступа к исходному коду.
- [ ] Все примеры выполняются против текущего sandbox API.

## 18. Milestone 14 — security review и production deployment

### P1.14.1. Security review

- [ ] Threat model Partner API, launch token и iframe bridge.
- [ ] Dependency vulnerability scan.
- [ ] Secret leakage review.
- [ ] Authorization/tenant boundary review.
- [ ] Replay/idempotency review.
- [ ] XSS/CSP/frame security review.
- [ ] Abuse/rate-limit review.
- [ ] Проверка logs и exports на чувствительные данные.

### P1.14.2. Production go-live readiness

- [ ] Зафиксировать release candidate и версии backend/frontend/game assets.
- [ ] Применить migrations на production по утвержденному runbook.
- [ ] Создать production operator configuration без demo credentials.
- [ ] Проверить production secrets, key rotation и доступы команды.
- [ ] Пройти полный pre-deploy smoke/E2E checklist на staging.
- [ ] Выполнить controlled load test с целевым профилем нагрузки.
- [ ] Согласовать окно deployment и ответственных за go/no-go.
- [ ] Подготовить rollback и emergency game-disable switch.
- [ ] Подтвердить актуальность backup перед deployment.

### P1.14.3. Production deployment

- [ ] Включить maintenance/deployment procedure при необходимости.
- [ ] Применить production migrations.
- [ ] Развернуть versioned backend image.
- [ ] Развернуть versioned frontend и game assets.
- [ ] Проверить health/readiness и database connectivity.
- [ ] Выполнить production smoke: catalog → launch → bootstrap → spin → wallet → close.
- [ ] Проверить TLS, CSP, iframe origin и security headers.
- [ ] Проверить metrics, logs, alerts и error tracking.
- [ ] Проверить создание backup после deployment.
- [ ] Зафиксировать release version, время и результаты smoke.
- [ ] Выполнить rollback при нарушении go/no-go критериев.

Definition of Done production deployment:

- [ ] Партнер получает каталог через authenticated API.
- [ ] Партнер создает session и получает launch URL.
- [ ] Игра работает внутри iframe партнера.
- [ ] Минимум одна оригинальная игра имеет законченные graphics, animation, sound и rules.
- [ ] Spin, bet, win, refund и rollback идемпотентны.
- [ ] Internal и seamless wallet flows покрыты тестами.
- [ ] Support видит полный round/transaction timeline.
- [ ] Reconciliation не показывает необъясненных расхождений.
- [ ] Staging backup/restore и deployment rollback проверены.
- [ ] OpenAPI, SDK example и sandbox доступны интегратору.
- [ ] Нет открытых P0 defects.
- [ ] Production smoke завершен успешно.
- [ ] Мониторинг и alerts принимают реальные production-события.
- [ ] Rollback path проверен и доступен дежурному инженеру.

## 19. Post-release backlog

### P2. Pilot partner

- [ ] Выбрать первого pilot partner.
- [ ] Выпустить отдельные partner credentials.
- [ ] Пройти partner integration certification checklist.
- [ ] Ограничить начальный трафик и доступные игры.
- [ ] Ежедневно проверять reconciliation в период пилота.
- [ ] Собирать UX и integration feedback.
- [ ] Провести post-pilot review.

### P2. Content growth

- [ ] Подключить 3–5 оригинальных игр через Game SDK.
- [ ] Добавить keno-specific renderer.
- [ ] Добавить tournaments/leaderboards для social mode.
- [ ] Добавить promotions/free-round grants.
- [ ] Добавить локализации.

### P2. Platform scale

- [ ] Per-operator themes и white label settings.
- [ ] Regional/CDN deployment.
- [ ] Advanced partner analytics.
- [ ] Automated operator billing reports.
- [ ] Webhook/event subscriptions.
- [ ] mTLS option.

### Отдельный проект: real-money readiness

- [ ] Выбрать юрисдикцию и лицензионную модель.
- [ ] KYC/AML и sanctions screening.
- [ ] Responsible gaming limits/self-exclusion.
- [ ] Геофенсинг.
- [ ] Certified RNG/game math/release process.
- [ ] Регуляторный audit trail и retention.
- [ ] Пенетрационный тест и независимый security review.
- [ ] Payment/PSP integration, если wallet находится внутри продукта.

Ни один пункт этого раздела нельзя считать автоматически закрытым существующей social/free-play реализацией.

## 20. Рекомендуемый порядок первых задач

Не начинать одновременно все milestones. Первый рабочий поток:

1. Разобрать текущий dirty worktree и зафиксировать baseline.
2. Обновить product direction на B2B Game Provider.
3. Принять ADR по wallet, minor units, launch flow и API authentication.
4. Создать operator/player/session/round/transaction migrations.
5. Реализовать HMAC authentication и Catalog API.
6. Реализовать Launch API и browser session exchange.
7. Ввести normalized SpinResult и idempotent spin.
8. Перевести internal wallet на общий adapter.
9. Разделить frontend на demo lobby, game client и backoffice.
10. Сделать первую оригинальную игру как end-to-end vertical slice.
11. Добавить iframe SDK, E2E и staging deployment.
12. После стабильного internal-wallet flow реализовать seamless wallet и reconciliation.

Правило приоритета: сначала один полностью законченный и интегрируемый игровой vertical slice, затем Game SDK и расширение каталога.
