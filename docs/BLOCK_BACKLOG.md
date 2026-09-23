# Block Backlog

Обновлено: 2026-07-09

Связанные документы:
- [DEVELOPMENT_DIRECTION.md](DEVELOPMENT_DIRECTION.md)
- [REAL_MONEY_TRANSITION.md](REAL_MONEY_TRANSITION.md)
- [TECH_AUDIT.md](TECH_AUDIT.md)
- [MVP_ROADMAP.md](MVP_ROADMAP.md)
- [WORKLOG.md](WORKLOG.md)
- [API_CONTRACT.md](API_CONTRACT.md)

## Как мы работаем

Правила исполнения:

1. Двигаемся по блокам сверху вниз.
2. В один момент времени активен один основной блок.
3. Внутри блока есть главные задачи и подзадачи.
4. Блок считается завершенным только по критериям готовности, а не по ощущению.
5. При завершении блока обновляем `WORKLOG.md`.

Статусы:

- `done` - блок завершен;
- `next` - следующий целевой блок;
- `in progress` - блок в активной разработке;
- `completed` - блок закрыт по критериям готовности;
- `planned` - запланирован, но не активен;
- `deferred` - сознательно отложен.

Текущий целевой блок:

- `Block 5 - Backoffice`

## Block 0 - Strategy And Documentation

Статус: `done`

Главная цель:

- зафиксировать, что именно мы строим и как будем этим управлять.

Главные задачи:

### 0.1. Аудит текущего состояния

Подзадачи:

- исследовать структуру проекта;
- проверить запуск и базовую валидность проекта;
- выявить риски и блокеры.

### 0.2. Принятие направления

Подзадачи:

- сравнить `social/free-play`, `B2B`, `real-money`;
- выбрать первичный путь;
- зафиксировать допущения и ограничения.

### 0.3. Базовая проектная документация

Подзадачи:

- создать документы по состоянию, аудиту и roadmap;
- создать направление разработки и блоковый backlog;
- определить правила фиксации прогресса.

Критерий готовности:

- есть набор документов, позволяющий продолжать работу без потери контекста.

## Block 1 - Security Foundation

Статус: `done`

Главная цель:

- убрать критические security/auth блокеры и довести backend до безопасной базы для дальнейшей разработки.

Главные задачи:

### 1.1. Secrets And Config Hardening

Подзадачи:

- убрать hardcoded JWT secrets из кода и yaml;
- вынести секреты в переменные окружения;
- разделить `dev`, `demo`, `prod` конфигурации;
- убрать долговечные токены и тестовые креды из публичных материалов;
- подготовить безопасные примеры конфигов.

Результат:

- в репозитории нет боевых секретов и опасных дефолтов.

### 1.2. Auth Model Repair

Подзадачи:

- разделить access и refresh токены по ключам и типам;
- исправить выпуск refresh токена;
- ограничить refresh-flow отдельной проверкой;
- пересмотреть claims и срок жизни токенов;
- покрыть auth сценарии тестами.

Результат:

- auth больше не имеет критической путаницы в токенах.

### 1.3. Password Security

Подзадачи:

- перейти на безопасное хэширование паролей;
- обновить signup/signin/change-secret flow;
- продумать миграцию существующих пользователей;
- убрать хранение и сравнение секретов в открытом виде.

Результат:

- база пользователей не хранит пароли как plain text.

### 1.4. Session Access Control

Подзадачи:

- закрыть ownership-проверки игровых сессий;
- убрать доверие к `uid/cid`, если пользователь уже аутентифицирован;
- проверить все endpoint'ы, которые работают с `gid`, `uid`, `cid`;
- покрыть негативными тестами доступ к чужому ресурсу.

Результат:

- игрок не может получать доступ к чужой игровой сессии или данным.

### 1.5. Safety Middleware And Error Handling

Подзадачи:

- добавить `gin.Recovery()`;
- починить разбор `Basic Auth` без panic;
- унифицировать безопасную обработку ошибок;
- добавить базовый rate limiting;
- ограничить debug/system endpoints.

Результат:

- сервис устойчивее к malformed input и не светит лишние внутренности.

Критерий готовности:

- закрыты P0-пункты из `TECH_AUDIT.md`;
- auth и access control покрыты базовыми тестами;
- новые локальные инструкции запуска не требуют небезопасных дефолтов.

Фактическое завершение:

- блок закрыт 2026-07-06;
- убраны hardcoded runtime-секреты и опасные auth-дефолты;
- access/refresh flow разделен и покрыт тестами;
- хранение паролей переведено на bcrypt с runtime-миграцией seed/legacy пользователей;
- закрыт `game/join` ownership mismatch и ограничены system endpoints;
- базовый rate limiting сознательно перенесен в следующий security/ops hardening проход и не блокирует переход к `Block 2`.

## Block 2 - Money And State Consistency

Статус: `completed`

Главная цель:

- сделать денежный и игровой контур предсказуемым, консистентным и пригодным для монетизации.

Главные задачи:

### 2.1. Wallet Ledger Model

Статус: `completed`

Подзадачи:

- определить источник истины для кошелька;
- перейти к транзакционной модели изменений баланса;
- разделить операции `bet`, `win`, `collect`, `bonus`, `admin adjustment`;
- сделать понятный audit trail.
- учесть, что модель должна оставаться нейтральной между `social` и потенциальным `real-money` режимом.

Текущий прогресс:

- добавлена таблица `wallet_ledger` как immutable audit trail для изменений кошелька;
- `props.wallet` оставлен как быстрый read model текущего баланса;
- `/prop/wallet/add` переведен на синхронную транзакцию `props.wallet + wallet_ledger`;
- slot spin, slot doubleup и keno spin переведены на синхронный gameplay settlement `club + props.wallet + wallet_ledger`;
- операции `admin adjustment`, `bet` и `win` покрыты тестами на успешную запись ledger и rollback при rejected debit.

Решения:

- текущий `collect` не меняет wallet и является session-state операцией, а не денежной проводкой;
- legacy `walletlog` оставлен как исторический журнал, новый источник аудита изменений баланса - `wallet_ledger`;
- production schema оформлена в `2.4 Storage Baseline`.

### 2.2. Game Session Lifecycle

Статус: `completed`

Подзадачи:

- описать lifecycle игровой сессии;
- нормализовать создание, join, spin, collect, close;
- уменьшить зависимость от незафиксированного in-memory состояния;
- проверить повторные запросы и idempotency-кейсы.

Текущий прогресс:

- добавлена per-scene serialization через mutex на `Scene`;
- операции `game/join`, `game/info`, slot controls, slot spin/doubleup/collect и keno controls/spin сериализованы вокруг состояния конкретной сцены;
- добавлены observable session states `opened`, `active`, `pending_win`, `free_spins`;
- `game/new`, `game/join`, `game/info`, `slot/spin`, `slot/doubleup`, `slot/collect`, `keno/spin` возвращают `state`;
- `slot/collect` явно возвращает состояние и очищенный pending gain;
- добавлен runtime `closed` state и endpoint `/game/close`;
- закрытая сцена остается доступной для `game/join` и `game/info`, но блокирует gameplay/control действия;
- idempotency policy зафиксирована для текущего MVP-ядра: `game/close` и `slot/collect` являются safe idempotent no-op при повторе, `spin` и `doubleup` остаются non-idempotent gameplay actions до ввода request idempotency keys;
- повторные `slot/collect` и `game/close` покрыты тестами;
- добавлен runtime cleanup helper для удаления закрытых сцен старше TTL из in-memory `Scenes`;
- `closed` state и `xtime` перенесены в storage model и PostgreSQL baseline;
- race-проверка `go test -race ./api` проходит.

Решения:

- cleanup закрытых сцен остается in-memory TTL policy; persistent факт закрытия хранится в `story.closed` / `story.xtime`.

### 2.3. Cleanup And Delete Logic

Статус: `completed`

Подзадачи:

- пересмотреть удаление пользователя и игровых сущностей;
- выровнять DB и in-memory cleanup;
- проверить фоновые процессы очистки;
- покрыть delete/cleanup тестами.

Текущий прогресс:

- `ApiUserDelete` переведен на общий cleanup path для `user`, `props`, `story`, `wallet_ledger`;
- исправлен cleanup игровых записей с `Scene` на storage-модель `Story`;
- in-memory сцены пользователя удаляются через общий helper;
- фоновая очистка неактивированных пользователей теперь удаляет связанные `props`, `story`, `wallet_ledger`, а не только строку `user`;
- добавлены тесты на ручное удаление пользователя и cleanup неактивированных пользователей.

Решения:

- cleanup закрытых runtime-сцен отделен от storage lifecycle;
- обычный hard-delete пользователя остается dev/admin maintenance path, а production retention/anonymization вынесен в pre-launch platform/ops block.

### 2.4. Storage Baseline

Статус: `completed`

Подзадачи:

- целевым production storage определить `PostgreSQL`;
- оформить migrations;
- сделать предсказуемый bootstrap данных;
- оставить `SQLite` только для dev/demo.

Текущий прогресс:

- production storage target зафиксирован как `PostgreSQL`;
- `SQLite` зафиксирован как dev/demo/test storage;
- добавлен PostgreSQL baseline migration `migrations/postgres/0001_baseline.sql`;
- добавлена CLI-команда `migrate` для применения PostgreSQL SQL migrations;
- добавлен `database.auto-sync`: dev/demo может использовать `xorm.Sync`, production после migrations должен ставить `false`;
- реализована persistence для `story.closed` / `story.xtime`;
- добавлен документ [STORAGE_BASELINE.md](STORAGE_BASELINE.md);
- retention policy для `wallet_ledger` зафиксирована как production follow-up: ledger нельзя физически удалять обычным пользовательским cleanup без отдельной anonymization/retention модели.

Решения:

- production retention/anonymization policy для ledger/history обязательна перед публичным запуском, но не блокирует закрытие Block 2: runtime consistency, audit trail, migrations и persistent session state уже зафиксированы.

Критерий готовности:

- операции с балансом и игровым состоянием воспроизводимы, журналируемы и не зависят от удачи.

## Block 3 - Platform Foundation

Статус: `completed`

Главная цель:

- подготовить backend и инфраструктуру к нормальной разработке и эксплуатации MVP.

Главные задачи:

### 3.1. API And Contract Cleanup

Статус: `completed`

Подзадачи:

- выровнять request/response схемы;
- почистить неактуальные или небезопасные endpoint'ы;
- сделать единый стиль ошибок;
- обновить примеры запросов и smoke-сценарии.
- не зашивать social-only допущения в доменные контракты.

Текущий прогресс:

- добавлен документ [API_CONTRACT.md](API_CONTRACT.md) с базовым HTTP/error/session/auth контрактом;
- добавлен contract test на единый error envelope для `401`, `404` и `405`;
- добавлен response-shape test на `game/new` и `slot/spin` для `state`, `wallet` и `sid`;
- добавлен response-shape test на `prop` и `user` contract surfaces (`wallet`, `access`, `mrtp`, `list`, `wallets`);
- обновлен `test-api.sh` как минимальный smoke flow для `ping`, public game list, `signin`, `game/new`, `game/info`, `slot/spin`, `prop/wallet/get`, `game/close`;
- auth response получил нормальное поле `refresh`, при этом старое `refrsh` оставлено как deprecated compatibility alias.

Решения:

- contract cleanup фиксирует фактический HTTP/API surface, а не старые quickstart-примеры;
- smoke-сценарий опирается на текущие seed credentials и проверяет цепочку sign-in -> game -> spin -> close;
- deprecated alias `refrsh` оставлен только как временная совместимость.

### 3.2. Observability

Статус: `completed`

Подзадачи:

- structured logs;
- health/readiness endpoints;
- базовые metrics;
- интеграция error tracking.

Текущий прогресс:

- добавлен `X-Request-ID` correlation header и structured request logging middleware;
- добавлены public `GET /healthz` и `GET /readyz` endpoints;
- добавлен admin `GET /metrics` endpoint с runtime и db pool stats;
- добавлены observability tests на health, readiness и metrics.

Решения:

- request correlation идет через `X-Request-ID` header и structured request logs;
- readiness проверяет живость основных database engines;
- metrics endpoint оставлен admin-only, чтобы не светить runtime internals наружу;
- gin error chain наполняется domain errors для последующего трекинга.

### 3.3. Deployment Baseline

Статус: `completed`

Подзадачи:

- собрать production-like `docker-compose`;
- добавить reverse proxy;
- оформить env templates;
- задокументировать backup/restore.

Текущий прогресс:

- добавлен `docker-compose.prod.yml` с PostgreSQL, app, migration helper и nginx reverse proxy;
- добавлен `deploy/slot-app.prod.yaml` с production defaults и `database.auto-sync: false`;
- добавлен `deploy/prod.env.example` как template для production secrets and DSNs;
- добавлен `deploy/nginx.conf` с reverse proxy и request header forwarding;
- добавлен [DEPLOYMENT_BASELINE.md](DEPLOYMENT_BASELINE.md) с запуском, migration, backup/restore.

Решения:

- production compose использует PostgreSQL и reverse proxy, а не sqlite-only runtime;
- migrations выполняются отдельным one-off шагом до запуска app;
- backup/restore для production считается PostgreSQL-задачей, SQLite остается dev/demo базой.

### 3.4. CI And Regression Safety

Статус: `completed`

Подзадачи:

- выделить smoke-набор;
- расширить тестовый минимум по критичным flows;
- зафиксировать запуск `go test` и `go vet`;
- подготовить минимальную CI-схему на проектные блокеры.

Текущий прогресс:

- добавлен `task/ci.sh`, который последовательно запускает `go test ./...`, `go vet ./...`, `go build` и smoke flow;
- обновлен [.github/workflows/go.yml](.github/workflows/go.yml) на полноценный regression job;
- smoke flow остался параметризуемым через `SMOKE=0` для локальной проверки build/test/vet без HTTP запуска;
- локально проверен режим `SMOKE=0` с успешным прохождением test/vet/build.

Решения:

- CI должен проверять не только compile, но и реальный HTTP smoke path;
- локальный режим без smoke оставлен для сред, где портовый bind недоступен;
- regression baseline опирается на один скрипт для CI и локальной проверки.

Критерий готовности:

- backend можно стабильно развернуть, проверить и поддерживать без ручного хаоса.

Итог Block 3:

- `Block 3 - Platform Foundation` закрыт по текущему baseline;
- API contracts выровнены, observability добавлена, deployment baseline оформлен, CI/regression safety зафиксирован;
- backend теперь имеет reproducible test/vet/build/smoke путь для базовой проверки изменений.

## Block 4 - Client Product

Статус: `completed`

Главная цель:

- превратить demo-страницы в нормальный пользовательский продукт.

Главные задачи:

### 4.1. Frontend Architecture

Статус: `completed`

Подзадачи:

- создать `frontend/` как отдельное приложение;
- принять стек `React + TypeScript + Vite`;
- определить routing, state и API layer;
- оформить дизайн-систему MVP уровня.

Текущий результат:

- добавлен первый client shell в [frontend/index.html](../frontend/index.html) с auth, lobby, game panel и activity log;
- добавлены [frontend/styles.css](../frontend/styles.css) и [frontend/app.js](../frontend/app.js) для usable product surface поверх backend API;
- поднят отдельный React/Vite scaffold в [frontend/app/](../frontend/app/) с [`frontend/package.json`](../frontend/package.json), [`frontend/vite.config.ts`](../frontend/vite.config.ts) и разделением на `src/lib` + `src/App.tsx`;
- текущий runnable shell сохранен как fallback, а `http-server.js` по-прежнему стартует с `frontend/index.html`;
- клиент умеет sign in / sign up / refresh, грузит game catalog, открывает session и запускает spin/doubleup/collect flow.

### 4.2. Public Product Flows

Статус: `completed`

Подзадачи:

- landing page;
- sign-up/sign-in/recovery;
- lobby со списком игр, фильтрами и поиском;
- профиль пользователя;
- кошелек и история операций.
- заложить возможность account states, eligibility flags и ограничений доступа.

### 4.3. Game Experience

Статус: `completed`

Подзадачи:

- экран игры;
- игровые controls;
- состояние спина/выигрыша/ошибок;
- mobile/desktop адаптация;
- аккуратная загрузка и пустые состояния.

### 4.4. Retention UX

Статус: `completed`

Подзадачи:

- onboarding;
- welcome bonus;
- daily reward surfaces;
- пустые состояния и подсказки;
- базовые промо-элементы.

Критерий готовности:

- обычный пользователь может пользоваться продуктом без `curl`, ручных JSON и html-демок.

Итог:

- `Block 4 - Client Product` закрыт по критерию готовности; следующий целевой блок - `Block 5 - Backoffice`.

## Block 5 - Backoffice

Статус: `in progress`

Главная цель:

- дать оператору и администратору инструменты управления продуктом.

Главные задачи:

### 5.1. Admin Access And Roles

Статус: `in progress`

Текущий результат:

- добавлены продуктовые backoffice-права `support` и `operator`, без изменения значений существующих прав в БД;
- добавлен защищенный `GET /backoffice/me`, который возвращает только `uid` и производную роль `support`, `operator` или `admin`;
- admin может назначать и снимать только explicit backoffice-роли через отдельный audit-logged endpoint, не изменяя legacy club permissions;
- обычный пользователь не может получить доступ к backoffice; это покрыто интеграционным тестом.

Подзадачи:

- выделить роли `admin`, `support`, при необходимости `operator`;
- ограничить чувствительные действия по ролям;
- оформить безопасный admin sign-in flow.

### 5.2. User Operations

Статус: `in progress`

Текущий результат:

- support API получил поиск пользователя, безопасную карточку пользователя в рамках клуба, просмотр wallet ledger и список игровых сессий;
- support-ответы не содержат password, activation code или иных секретов.
- operator может блокировать/разблокировать аккаунт; заблокированный аккаунт не может войти и его уже выданные tokens отклоняются на следующем запросе.

Подзадачи:

- поиск и просмотр пользователя;
- блокировка/разблокировка;
- просмотр кошелька и истории;
- ручные служебные действия.

### 5.3. Wallet And Bonus Operations

Статус: `in progress`

Текущий результат:

- добавлены operator-only `wallet/bonus` и `wallet/adjust` действия с обязательной причиной;
- wallet ledger entry и отдельная backoffice audit entry создаются в одной транзакции;
- добавлена PostgreSQL migration `0002_backoffice_audit.sql` и auto-sync модель для dev/demo.

Подзадачи:

- начисление бонусов;
- ручные корректировки баланса с audit trail;
- просмотр причин изменений;
- журнал админских действий.

### 5.4. Support Visibility

Статус: `in progress`

Текущий результат:

- support может просмотреть operator audit journal выбранного пользователя.

Подзадачи:

- список игровых сессий;
- просмотр ключевых событий и ошибок;
- фильтры по пользователю/игре/периоду;
- инструменты для первичного расследования проблем.

Критерий готовности:

- базовые операционные действия больше не требуют прямого вмешательства в БД или код.

## Block 6 - Monetization And Analytics

Статус: `planned`

Главная цель:

- сделать MVP способным не только работать, но и приносить деньги.

Главные задачи:

### 6.1. Virtual Currency Store

Подзадачи:

- определить пакеты монет;
- оформить витрину покупки;
- подготовить платежный или pseudo-payment flow для MVP;
- логировать все purchase-события.

### 6.2. Bonuses And Offers

Подзадачи:

- welcome bonus;
- daily rewards;
- ограниченные офферы;
- VIP/premium задел.

### 6.3. Product Analytics

Подзадачи:

- события регистрации, входа, старта игры, спина, покупки;
- базовые retention/engagement метрики;
- дашборд первого уровня;
- мониторинг воронки.

### 6.4. Legal And Support Surface

Подзадачи:

- privacy;
- terms;
- responsible play notice для social-mode;
- support/FAQ страницы.

Критерий готовности:

- в продукте есть понятный monetization flow и измеримая воронка.

## Block 7 - Launch Readiness

Статус: `planned`

Главная цель:

- довести MVP до состояния soft launch.

Главные задачи:

### 7.1. QA And Stabilization

Подзадачи:

- smoke;
- e2e на ключевые сценарии;
- regression checklist;
- устранение launch-blocker дефектов.

### 7.2. Production Runbook

Подзадачи:

- инструкции запуска;
- инструкции rollback;
- backup/restore;
- алерты и on-call минимального уровня.

### 7.3. Soft Launch

Подзадачи:

- ограниченный трафик;
- сбор продуктовых и технических метрик;
- support loop;
- фиксация post-launch проблем.

Критерий готовности:

- продукт можно дать первым реальным пользователям без ощущения, что это внутренний прототип.

## Post-MVP Block 8 - B2B Packaging

Статус: `deferred`

Главная цель:

- упаковать backend и продукт в демонстрируемое партнерское предложение.

Главные задачи:

- developer-friendly API docs;
- white-label narrative;
- demo environment;
- partner admin tooling;
- pricing and packaging.

Причина отложенного статуса:

- сначала нужен собственный устойчивый MVP, иначе B2B упаковка будет продавать нестабильную основу.
