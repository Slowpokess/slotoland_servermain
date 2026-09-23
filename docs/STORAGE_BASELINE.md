# Storage Baseline

## Decision

Production storage target is PostgreSQL.

SQLite remains supported for local development, tests, demos, and single-process evaluation. MySQL remains a legacy-supported driver, but new storage hardening work should target PostgreSQL first.

## Current Runtime Behavior

The server can still use `xorm.Sync` at startup to create or adjust tables when `database.auto-sync: true`. This is acceptable for dev/demo, but it is not the production migration mechanism.

Production deployments should apply SQL migrations explicitly before starting the application.

Initial PostgreSQL baseline:

- `migrations/postgres/0001_baseline.sql`

Apply migrations with:

```sh
slotopol migrate --config /path/to/slot-app.yaml --path migrations/postgres
```

The command uses `database.driver-name` and `database.club-source-name` from config and currently supports only `postgres`.

After applying production migrations, set:

```yaml
database:
  driver-name: postgres
  auto-sync: false
```

## Bootstrap

Current bootstrap files remain:

- `appdata/slot-clubinit.sql` for seed clubs/users/props when the club table is empty.
- `appdata/slot-newuser.yaml` for default props on signup.

The production path is the separate `slotopol bootstrap` command. It must run after
PostgreSQL migrations and reads the initial administrator password from a protected
file (`--admin-secret-file`). It creates one named club, one activated administrator,
and that administrator's club properties in one transaction. It refuses a database
that already contains a club or user, so the demo seed file is not used for production
initialization.

The demo seed files remain available only for dev/demo startup behavior.

Normal user cleanup now keeps the user row as the foreign-key target for
`wallet_ledger`, replaces direct identity fields with an invalid-address marker,
blocks the account, and removes active props and stories. The legacy
`DeleteUserRecords` helper is a maintenance-only hard-delete path and refuses to
delete an account that has ledger history.

## Ledger And Cleanup Retention

`wallet_ledger` is the audit source for wallet mutations and should not be physically deleted in normal player cleanup.

The normal user-removal API no longer deletes ledger rows. The legacy
`DeleteUserRecords` helper remains a maintenance-only hard-delete path and
refuses accounts that have ledger history. Before public production use,
deletion policy must be split into:

- account disable/anonymization for normal user removal;
- physical deletion only for dev/test/admin maintenance;
- ledger retention policy aligned with product/legal requirements.

Closed session state is represented as `story.closed` and `story.xtime`.

## Follow-Up

- Define the retention period and access policy for anonymized ledger/history before production launch as part of platform/ops hardening.
- PostgreSQL migrations currently have no down-migration files. Take a verified backup before applying a new migration; rollback requires restoring that backup or applying a corrective forward migration.
