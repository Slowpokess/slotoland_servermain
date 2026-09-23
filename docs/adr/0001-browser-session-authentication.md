# ADR 0001: Browser session authentication

- Статус: accepted
- Дата: 2026-09-23
- Scope: player web, backoffice и B2B iframe game client

## Контекст

Текущий React scaffold получает access/refresh JWT и временно хранит их в `sessionStorage`. Это лучше прежнего persistent `localStorage`, но доступный JavaScript token остается уязвимым при XSS. Одна схема также не подходит одновременно для same-origin player/backoffice и cross-origin iframe game client.

Partner API не является browser API и должен использовать отдельную server-to-server authentication model.

## Решение

### Player web и backoffice

- Использовать server-managed opaque browser session.
- Session identifier передавать только в cookie `__Host-slotoland_session`.
- Cookie: `Secure`, `HttpOnly`, `Path=/`, без `Domain`.
- `SameSite=Lax` для same-origin player/backoffice приложения.
- Browser не получает refresh token и не читает session identifier через JavaScript.
- Изменяющие запросы дополнительно защищать CSRF token/origin validation.
- Backoffice использует ту же session transport, но каждый endpoint продолжает независимо проверять роль.
- Logout, password change, account block и credential rotation инвалидируют server session.

### B2B iframe game client

- Partner backend создает launch session через подписанный server-to-server Partner API.
- Launch URL содержит одноразовый короткоживущий launch ticket, а не пользовательский access/refresh JWT.
- Game bootstrap атомарно обменивает ticket на scoped game-session credential.
- Credential разрешает только действия одной launch session, одного player и одной game release.
- Credential не дает доступ к account, backoffice или Partner API.
- Основной transport — короткоживущий bearer credential только в памяти game client.
- После bootstrap ticket удаляется из URL через `history.replaceState`.
- Hard reload требует нового launch/reconnect handshake; долговечный refresh token в iframe storage не используется.
- Поддержка partitioned/third-party cookie может быть добавлена отдельным ADR после browser compatibility testing.

### Partner API

- Не использует browser session или пользовательские JWT.
- Использует HMAC request signing с `key_id`, timestamp, nonce и body digest.
- Credential принадлежит operator environment и подлежит rotation/revocation.

## Переходный период

- Текущий scaffold продолжает использовать `sessionStorage` только до реализации server-managed browser sessions.
- Новые frontend-модули не должны усиливать зависимость от access/refresh token storage.
- Сначала добавляются backend session endpoints и cookie/CSRF middleware.
- После миграции удаляются access/refresh tokens из browser storage и frontend state.
- Bearer JWT endpoints можно временно сохранить для CLI, tests и обратной совместимости, но не использовать как целевой browser flow.

## Последствия

Плюсы:

- account и backoffice tokens недоступны JavaScript;
- game credential имеет минимальный scope;
- Partner API полностью отделен от browser authentication;
- компрометация одной game session не открывает account/backoffice API.

Стоимость:

- нужен persistent server session store;
- нужны CSRF controls;
- нужны отдельные bootstrap/reconnect flows для iframe;
- текущий auth frontend и часть backend middleware потребуется мигрировать.

## Критерии реализации

- [ ] Добавлена storage model browser sessions.
- [ ] Реализованы sign-in, session refresh/check и logout через HttpOnly cookie.
- [ ] Реализована CSRF/origin защита изменяющих browser endpoints.
- [ ] Account block/password change инвалидируют активные sessions.
- [ ] Frontend больше не хранит account access/refresh tokens.
- [ ] Добавлен одноразовый launch ticket exchange для game client.
- [ ] Game credential ограничен launch session scope.
- [ ] Добавлены replay, expiry, logout и cross-role integration tests.
