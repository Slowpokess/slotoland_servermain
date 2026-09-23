#!/usr/bin/env bash
set -euo pipefail
umask 077

env_file="${1:-deploy/prod.env}"
compose_file="${2:-docker-compose.prod.yml}"
output_dir="${3:-backups}"

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

mkdir -p "$output_dir"
backup_file="$output_dir/slotopol-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose --env-file "$env_file" -f "$compose_file" exec -T postgres \
	pg_dump --format=custom --no-owner --no-privileges -U "$pg_user" -d "$pg_db" \
	>"$backup_file"

if [[ ! -s "$backup_file" ]]; then
	echo "backup file is empty: $backup_file" >&2
	rm -f "$backup_file"
	exit 1
fi

echo "PostgreSQL backup created: $backup_file"
