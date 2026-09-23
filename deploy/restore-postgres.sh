#!/usr/bin/env bash
set -euo pipefail

backup_file="${1:-}"
env_file="${2:-deploy/prod.env}"
compose_file="${3:-docker-compose.prod.yml}"

if [[ -z "$backup_file" || "${4:-}" != "--confirm" ]]; then
	echo "usage: $0 BACKUP.dump [ENV_FILE] [COMPOSE_FILE] --confirm" >&2
	echo "restore is destructive and requires the explicit --confirm argument" >&2
	exit 2
fi
if [[ ! -s "$backup_file" ]]; then
	echo "backup file is missing or empty: $backup_file" >&2
	exit 1
fi
if [[ ! -r "$env_file" ]]; then
	echo "production env file is missing or unreadable: $env_file" >&2
	exit 1
fi

read_env() {
	local key="$1"
	awk -F= -v key="$key" '
		$0 !~ /^[[:space:]]*#/ && $1 == key {
			sub(/^[^=]*=/, "")
			print
			exit
		}
	' "$env_file"
}

pg_user="$(read_env SLOTOPOL_PG_USER || true)"
pg_db="$(read_env SLOTOPOL_PG_DB || true)"
pg_user="${pg_user:-slotopol}"
pg_db="${pg_db:-slotopol}"

echo "Restoring PostgreSQL database from: $backup_file"
echo "Stop application traffic before continuing and verify the backup target."
docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
	pg_restore --clean --if-exists --no-owner --no-privileges -U "$pg_user" -d "$pg_db" \
	<"$backup_file"
