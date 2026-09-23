# API Contract

This document captures the stable HTTP contract expected by clients and smoke tests.

## Response Negotiation

API responses use content negotiation through the `Accept` header. JSON is the default and primary client format.

Supported response formats:

- `application/json`
- `application/xml`
- `application/x-yaml`
- `application/toml`

Every negotiated response includes a `Server` header with the `slotopol/` prefix.

Requests also receive an `X-Request-ID` header for log correlation.

## Success Responses

Successful responses return HTTP `200` with endpoint-specific payloads, or HTTP `204` where the endpoint has no body.

Gameplay session endpoints that expose session state return a `state` field. Current values are:

- `opened`
- `active`
- `pending_win`
- `free_spins`
- `closed`

## Error Responses

Every API error response uses the same envelope:

```json
{
  "what": "human readable error",
  "code": 123,
  "uid": 3
}
```

Fields:

- `what` is a stable human-readable error message.
- `code` is the numeric API error code from `api/errcodes.go`.
- `uid` is present only when the request was authenticated.

HTTP status carries the error class:

- `400` for invalid request payload or validation failure.
- `401` for missing, malformed, expired, or wrong-use credentials.
- `403` for authenticated requests without required access or with denied domain action.
- `404` for missing routes or missing addressable resources.
- `405` for unsupported HTTP methods.
- `500` for server-side storage or invariant failures.

## Authentication Tokens

`/signin` returns separate `access` and `refresh` tokens.

- Use `access` for normal protected endpoints.
- Use `refresh` only with `/refresh`.
- A refresh token must not be accepted as a normal bearer token.
- `refrsh` is currently emitted as a deprecated compatibility alias for older clients.

## Money And State

`props.wallet` is the read model for the current balance. New balance-changing admin and gameplay operations are recorded through `wallet_ledger`.

Current `slot/collect` behavior is session-state only: it clears pending gain and does not create a wallet ledger entry.

`prop/get` returns `wallet`, `access`, and `mrtp`.

`prop/wallet/get` returns `wallet`.

`user/is` returns `list` with resolved `uid`, `email`, and `name` entries.

`user/delete` returns `wallets`, a map of club IDs to wallet balances that were present at deletion time. The operation anonymizes and blocks the account, removes active `props` and `story` rows, and preserves `wallet_ledger` history.

## Backoffice

`GET /backoffice/me` requires a normal access token with `support`, `operator`, or `admin` access and returns the caller's `uid` and derived role. It is intended for the client to gate the backoffice surface; authorization is still enforced by every server endpoint.

Support-readable endpoints:

- `POST /backoffice/users/search` accepts optional `query` and bounded `limit`.
- `POST /backoffice/users/get` accepts `uid` and `cid` and returns account and club read-model fields, never secrets.
- `POST /backoffice/wallet/ledger` accepts `uid`, `cid`, and bounded `limit`.
- `POST /backoffice/sessions/list` accepts `uid`, optional `cid`, and bounded `limit`.
- `POST /backoffice/audit/list` accepts `uid` and bounded `limit`.

Operator-only endpoints require a `operator` or `admin` role and a non-empty human-readable `reason`:

- `POST /backoffice/users/status` accepts `uid`, `blocked`, and `reason`. A blocked account cannot sign in and any previously issued token is rejected.
- `POST /backoffice/wallet/adjust` accepts `uid`, `cid`, `amount`, and `reason`; it emits a `wallet_ledger` adjustment and a backoffice audit record atomically.
- `POST /backoffice/wallet/bonus` accepts the same payload and emits a `bonus` ledger operation.

`POST /backoffice/users/role` is admin-only. It accepts `uid`, `role` (`support`, `operator`, or `none`), and `reason`; it only changes the explicit backoffice role flags, leaving legacy club permissions untouched.

## Smoke Test

The repository smoke script checks the minimum public MVP flow against a running server:

```sh
./test-api.sh
```

Optional environment variables:

- `BASE_URL`, default `http://localhost:8080`.
- `EMAIL`, default `player@example.org`.
- `SECRET`, default seed player password.
- `CID`, default `1`.
- `ALIAS`, default `Novomatic/Joker Dolphin`.

## Observability

Public endpoints:

- `GET /healthz` returns basic liveness information.
- `GET /readyz` returns readiness information for the database engines.

Admin endpoint:

- `GET /metrics` returns runtime and database pool metrics.
