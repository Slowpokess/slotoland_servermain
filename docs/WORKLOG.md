# Worklog

Назначение документа: фиксировать ключевые решения, текущее состояние, риски и следующий шаг без потери контекста между сессиями.

Связанные документы:
- [DEVELOPMENT_DIRECTION.md](DEVELOPMENT_DIRECTION.md)
- [BLOCK_BACKLOG.md](BLOCK_BACKLOG.md)
- [REAL_MONEY_TRANSITION.md](REAL_MONEY_TRANSITION.md)
- [PROJECT_STATUS.md](PROJECT_STATUS.md)
- [TECH_AUDIT.md](TECH_AUDIT.md)
- [MVP_ROADMAP.md](MVP_ROADMAP.md)

## Текущее состояние

- Этап: завершен первичный аудит, закрыты `Block 1`, `Block 2`, `Block 3` и `Block 4`; `Block 5 - Backoffice` начат.
- Основной вывод: проект является серверным ядром игровой платформы; кодовый regression baseline проходит, но внешний deployment runtime ещё не подтверждён.
- Рекомендуемое направление: social/free-play MVP как первый запуск.
- Текущий технический блокер: отсутствует доступный Docker Engine/staging PostgreSQL для фактической container и release validation.

## Текущий фокус

Ближайший фокус работ:

1. Начать `Block 5 - Backoffice`.
2. Поднять admin/support UI поверх существующего backend core.
3. Сделать user operations, wallet/bonus operations и support visibility как цельный UX.
4. Вести изменения по блокам без возврата к небезопасным дефолтам.

## Журнал

### 2026-07-31

Сделано:

- исправлен `/game/list` и добавлены regression tests;
- добавлен отдельный одноразовый PostgreSQL bootstrap с транзакцией, advisory lock,
  protected password file и отказом при повторном запуске;
- production secrets/config, auth boundary, CORS, TLS/Nginx, migrations и ledger
  cleanup hardening доведены до проверяемого baseline;
- frontend переведён на same-origin production path;
- production Dockerfile/Compose hardening: non-root runtime, исключение секретов
  из build context, Compose/Nginx CI validation;
- добавлены env/TLS preflight, PostgreSQL backup/restore и production smoke scripts;
- `go test ./...`, `go vet ./...`, `go build`, frontend build и статические deployment
  проверки прошли.

Ограничения:

- Docker build заблокирован отсутствием Docker Engine;
- staging runtime и реальный backup/restore не выполнялись.

Следующий шаг:

- выполнить staging validation в окружении с Docker Engine и PostgreSQL;
- после PASS провести release smoke и только затем рассматривать production traffic.

### 2026-07-14

Сделано:

- начат `Block 5 - Backoffice`;
- добавлены новые product-facing backoffice-права `support` и `operator`; существующие значения `member/dealer/booker/master/admin` сохранены совместимыми;
- добавлен role-gated endpoint `GET /backoffice/me` для безопасного входа в будущий admin/support UI;
- добавлены support-only endpoints поиска пользователя, безопасной карточки, wallet ledger и списка игровых сессий;
- backoffice API не выдает password, activation code или другие секреты;
- добавлены интеграционные тесты: player получает `403`, support имеет read-only access, admin получает роль `admin`;
- admin получил отдельный audit-logged API назначения и снятия `support`/`operator` роли без изменения legacy club permissions;
- operator получил API блокировки/разблокировки аккаунта: статус меняется вместе с audit record, а auth отклоняет новые и уже выданные tokens заблокированного пользователя;
- operator получил `wallet/bonus` и `wallet/adjust` с обязательной причиной; ledger и operator audit записываются в одной транзакции;
- добавлена PostgreSQL migration `0002_backoffice_audit.sql` и dev/demo auto-sync модели audit journal;
- проверка `go test ./api` проходит.

Следующий шаг:

- добавить backoffice UI к готовому API и расширить support investigation фильтрами по игре и периоду.

### 2026-07-06

Сделано:

- проведен полный аудит структуры репозитория;
- подтверждено, что проект является серверной частью платформы, а не полной коммерческой системой;
- зафиксированы ключевые технические риски;
- определено рекомендуемое направление: сначала social/free-play MVP;
- создан комплект внутренних документов по состоянию, аудиту и roadmap;
- принято формальное направление разработки;
- создан блоковый backlog с главными задачами, подзадачами и критериями готовности;
- зафиксирована стратегия перехода `social MVP -> real-money` без переписывания ядра;
- директория изолирована в отдельный локальный `git`-репозиторий;
- очищен `.gitignore` под отдельный проект;
- установлен `gh` CLI для последующего создания GitHub-репозитория.
- создан private-репозиторий `Slowpokess/server-main` и подключен как `origin`;
- начат `Block 1 - Security Foundation`;
- убраны hardcoded JWT/Brevo секреты из runtime defaults и yaml-конфигов;
- добавлена загрузка auth/email секретов из `SLOTOPOL_*` env;
- добавлен безопасный ephemeral fallback для локального запуска без зашитых ключей;
- убран долговечный JWT-токен из публичной документации;
- разделены `access` и `refresh` JWT по ключам и token-use claims;
- `/refresh` переведен на отдельную auth-проверку refresh-токена;
- refresh-токен больше не принимается как обычный bearer на защищенных endpoint'ах;
- добавлен интеграционный тест на разделение access/refresh flow;
- парольный контур переведен на bcrypt с runtime-миграцией существующих пользователей;
- signup/signin/change-secret/delete/basic-auth больше не сравнивают пароли как plain text;
- seed-учетки в `appdata/slot-clubinit.sql` переведены на bcrypt hashes;
- `/servinfo` и `/memusage` закрыты admin-only доступом;
- в web router добавлен `gin.Recovery()`;
- добавлены тесты на password hashing, admin-only system endpoints и ownership mismatch в `game/join`;
- `Block 1 - Security Foundation` признан завершенным по критериям готовности.

Выводы:

- кодовая база сильна как доменное ядро игрового сервера;
- для публичного запуска в текущем виде проект не готов;
- реальный путь к запуску лежит через стабилизацию и продуктовую упаковку.

Следующий шаг:

- перейти к `Block 2`, начиная с wallet/state consistency и транзакционной модели изменений баланса.

### 2026-07-07

Сделано:

- начат `Block 2.1 - Wallet Ledger Model`;
- добавлена модель `wallet_ledger` с типами операций `bet`, `win`, `collect`, `bonus`, `adjustment`, `purchase`, `refund`;
- `props.wallet` зафиксирован как быстрый read model текущего баланса, а `wallet_ledger` - как audit trail изменений;
- `/prop/wallet/add` переведен с buffered wallet update на синхронную транзакцию `props.wallet + wallet_ledger`;
- добавлены тесты на ledger-запись admin adjustment и отсутствие ledger-записи при отклоненном списании;
- slot spin, slot doubleup и keno spin переведены на gameplay settlement, который в одной транзакции обновляет `club`, `props.wallet` и `wallet_ledger`;
- для игровых settlement добавлены тесты на пары `bet/win`, связь с `gid/sid` и rollback без ledger/bank изменений при недостатке средств;
- проверка прошла: `go test ./...`, `go vet ./...`.

Решения:

- `props.wallet` остается текущим read model, но все новые admin/gameplay изменения баланса проходят через ledger-backed транзакции;
- `collect` в текущей реализации сбрасывает pending gain в session state и не меняет wallet, поэтому его денежная проводка не добавлялась;
- миграции и сверку legacy `walletlog` оформить отдельно в storage baseline.

Следующий шаг:

- перейти к `Block 2.2 - Game Session Lifecycle`: определить idempotency/source-of-truth правила для session-state и collect/doubleup повторов.

Дополнение:

- локальная ветка переименована в `codex/block-2-money-state-consistency`;
- начат `Block 2.2 - Game Session Lifecycle`;
- в `Scene` добавлена per-scene serialization через mutex;
- `game/join`, `game/info`, slot controls, slot spin/doubleup/collect и keno controls/spin теперь сериализуют доступ к `scene.Game` и `scene.SID`;
- проверки прошли: `go test ./...`, `go vet ./...`, `go test -race ./api`.
- добавлены observable session states `opened`, `active`, `pending_win`, `free_spins`;
- ключевые lifecycle/gameplay endpoint'ы возвращают `state`;
- `slot/collect` теперь явно возвращает `state` и `gain=0`;
- добавлен тест на `pending_win -> collect -> cleared state`.
- добавлен runtime `closed` state и endpoint `/game/close`;
- закрытые сцены остаются видимыми через `game/join` и `game/info`, но блокируют slot/keno gameplay и control действия;
- добавлен тест на закрытие сессии и запрет `slot/spin` после close;
- зафиксирована idempotency policy для текущего MVP-ядра: `game/close` и `slot/collect` являются safe idempotent no-op при повторе, `spin` и `doubleup` остаются non-idempotent до ввода request idempotency keys;
- повторные `slot/collect` и `game/close` покрыты тестами.
- добавлен runtime cleanup helper для закрытых сцен старше TTL;
- runtime-only ограничение `closed` state зафиксировано до storage baseline/migrations.

Следующий шаг:

- перейти к `Block 2.3 - Cleanup And Delete Logic`.

Дополнение:

- начат `Block 2.3 - Cleanup And Delete Logic`;
- добавлен общий cleanup path для удаления `user`, `props`, `story`, `wallet_ledger`;
- `ApiUserDelete` теперь удаляет storage `Story`, а не runtime-only `Scene`;
- фоновая очистка неактивированных пользователей переведена на связанный cleanup, чтобы не оставлять сироты;
- добавлены тесты на DB и memory cleanup.

Следующий шаг:

- проверить retention/storage policy для ledger/history перед физическим удалением в `2.4 Storage Baseline`.

Дополнение:

- начат `Block 2.4 - Storage Baseline`;
- production storage target зафиксирован как `PostgreSQL`;
- `SQLite` оставлен для dev/demo/test;
- добавлен PostgreSQL baseline migration `migrations/postgres/0001_baseline.sql`;
- добавлена CLI-команда `migrate` для применения PostgreSQL SQL migrations;
- добавлен `database.auto-sync`, чтобы production мог запускаться без runtime `xorm.Sync` после применения migrations;
- реализована persistence для `story.closed` / `story.xtime`;
- добавлен [STORAGE_BASELINE.md](STORAGE_BASELINE.md);
- зафиксировано, что `wallet_ledger` в production не должен удаляться обычным user cleanup без отдельной retention/anonymization модели.

Следующий шаг:

- закрыть `Block 2` по критерию готовности и перейти к `Block 3 - Platform Foundation`.

Итог Block 2:

- `Block 2 - Money And State Consistency` закрыт по MVP/runtime-критерию;
- изменения баланса проходят через ledger-backed транзакции для admin adjustment и основных gameplay settlement;
- session lifecycle получил сериализацию, observable states, idempotent close/collect policy и persistent `closed/xtime`;
- cleanup user/story/props/wallet_ledger выровнен для ручного удаления и фоновой очистки неактивированных пользователей;
- PostgreSQL baseline migration, `migrate` command и `database.auto-sync` зафиксировали production storage path;
- retention/anonymization policy для ledger/history оставлена как обязательный pre-launch пункт Block 3/ops, а не как blocker runtime consistency.

Следующий шаг:

- начать `Block 3.1 - API And Contract Cleanup`.

Дополнение:

- начат `Block 3.1 - API And Contract Cleanup`;
- добавлен [API_CONTRACT.md](API_CONTRACT.md) с базовым HTTP/error/session/auth контрактом;
- добавлен contract test на единый error envelope для `401`, `404` и `405`;
- добавлен response-shape test на `game/new` и `slot/spin` для `state`, `wallet` и `sid`;
- добавлен response-shape test на `prop` и `user` contract surfaces (`wallet`, `access`, `mrtp`, `list`, `wallets`);
- обновлен `test-api.sh` как минимальный smoke flow для текущих auth/game/slot/wallet/close контрактов;
- auth response получил нормальное поле `refresh`, старое `refrsh` оставлено как deprecated compatibility alias;
- README/QUICKSTART синхронизированы с фактическими полями `refresh` и session-state ответов;
- верхний целевой блок в [BLOCK_BACKLOG.md](BLOCK_BACKLOG.md) переведен на `Block 3 - Platform Foundation`.

Следующий шаг:

- перейти к `Block 3.2 - Observability`.

Дополнение:

- начат `Block 3.2 - Observability`;
- добавлены `X-Request-ID` correlation header и structured request logging middleware;
- добавлены public `GET /healthz` и `GET /readyz` endpoints;
- добавлен admin `GET /metrics` endpoint с runtime и db pool stats;
- добавлены observability tests на health, readiness и metrics.

Итог Block 3.2:

- `Block 3.2 - Observability` закрыт по текущему минимальному production baseline;
- добавлены request correlation headers и structured request logs;
- health, readiness и metrics endpoints доступны в контракте;
- ошибки попадают в gin error chain и логируются с `request_id`.

Следующий шаг:

- начать `Block 3.3 - Deployment Baseline`.

Дополнение:

- начат `Block 3.3 - Deployment Baseline`;
- добавлен `docker-compose.prod.yml` с PostgreSQL, migration helper и nginx reverse proxy;
- добавлен `deploy/slot-app.prod.yaml` с production defaults, включая `database.auto-sync: false`;
- добавлен `deploy/prod.env.example` как template для production secrets и DSNs;
- добавлен `deploy/nginx.conf` с reverse proxy и forwarding of request headers;
- добавлен [DEPLOYMENT_BASELINE.md](DEPLOYMENT_BASELINE.md) с migration, backup и restore flow.

Решения:

- production запуск зафиксирован как PostgreSQL + reverse proxy + explicit migrations;
- `sqlite3` остается для dev/demo, а не для публичного deployment baseline;
- health/readiness/metrics уже встроены в рабочий contract, поэтому deployment baseline опирается на них напрямую.

Итог Block 3.3:

- `Block 3.3 - Deployment Baseline` закрыт по базовому production-like сценарию;
- контейнерный runtime теперь содержит `curl`, `deploy` и `migrations`;
- compose-конфигурация разделяет app, database, migration helper и reverse proxy;
- backup/restore для production задокументированы вокруг PostgreSQL.

Следующий шаг:

- начать `Block 3.4 - CI And Regression Safety`.

### 2026-07-08

Сделано:

- начат и закрыт `Block 3.4 - CI And Regression Safety`;
- добавлен `task/ci.sh`, который объединяет `go test ./...`, `go vet ./...`, `go build` и smoke flow;
- обновлен [.github/workflows/go.yml](../.github/workflows/go.yml) на единый regression job;
- smoke flow параметризован через `SMOKE=0` для локальной проверки без HTTP запуска;
- локально проверен `SMOKE=0` режим с успешным прохождением test/vet/build;
- `Block 3 - Platform Foundation` закрыт по суммарному baseline;
- target block переведен на `Block 4 - Client Product`.

Решения:

- CI/regression safety должен проверять и compile, и реальный HTTP smoke path;
- один и тот же `task/ci.sh` используется как локальный, так и CI entrypoint;
- transition к Block 4 делается только после фиксации reproducible regression baseline.

Следующий шаг:

- начать `Block 4 - Client Product`.

### 2026-07-09

Сделано:

- начат `Block 4 - Client Product`;
- добавлен первый client shell в [frontend/index.html](../frontend/index.html) с account, lobby, game panel и activity log;
- добавлены [frontend/styles.css](../frontend/styles.css) и [frontend/app.js](../frontend/app.js) для usable product surface поверх backend API;
- поднят отдельный React/Vite scaffold в [frontend/app/](../frontend/app/) с [`frontend/package.json`](../frontend/package.json), [`frontend/tsconfig.json`](../frontend/tsconfig.json) и [`frontend/vite.config.ts`](../frontend/vite.config.ts);
- state, API и UI разнесены по `src/lib` и `src/App.tsx`, чтобы уйти от однофайлового shell;
- текущий runnable shell сохранен как fallback, а `http-server.js` продолжает стартовать с `frontend/index.html`;
- клиентский shell умеет sign in / sign up / refresh, грузит game catalog, открывает session и запускает spin/doubleup/collect flow;
- `http-server.js` log очищен от старого demo URL;
- проверены `node --check http-server.js`, `node --check frontend/app.js` и `git diff --check`.
- расширен React/Vite frontend: landing band, onboarding, rewards surfaces, recovery/change-secret flow, access flags и section routing;
- установлены зависимости `frontend/` и проверены `npm run typecheck` и `npm run build` в успешном состоянии;
- `Block 4 - Client Product` закрыт по критерию готовности.

Решения:

- первый шаг Block 4 делаем как usable product shell, а не как пустой каркас;
- второй слой фронтенда строим как отдельный React/Vite app, не ломая текущий runnable fallback;
- backend API уже достаточно стабилен, чтобы фронт мог опираться на реальные auth/game/wallet endpoints;
- визуальный слой стартует с одного рабочего экрана, а не с маркетинговой страницы.
- Block 4 закрываем только после реальной сборки и typecheck нового frontend app, а не по факту наличия файлов.

Следующий шаг:

- перейти к `Block 5 - Backoffice`.

## Шаблон новых записей

### YYYY-MM-DD

Сделано:

- ...

Решения:

- ...

Риски:

- ...

Следующий шаг:

- ...
