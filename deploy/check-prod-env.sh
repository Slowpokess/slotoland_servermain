#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-deploy/prod.env}"
tls_dir="${2:-deploy/tls}"

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

required_keys=(
	SLOTOPOL_PG_PASSWORD
	SLOTOPOL_ACCESS_KEY
	SLOTOPOL_REFRESH_KEY
)

for key in "${required_keys[@]}"; do
	value="$(read_env "$key" || true)"
	if [[ -z "$value" ]]; then
		echo "required production setting is missing: $key" >&2
		exit 1
	fi
	case "$key" in
		SLOTOPOL_PG_PASSWORD) pg_password="$value" ;;
		SLOTOPOL_ACCESS_KEY) access_key="$value" ;;
		SLOTOPOL_REFRESH_KEY) refresh_key="$value" ;;
	esac
done

case "$pg_password" in
	change-me|changeme|replace-me|example)
		echo "SLOTOPOL_PG_PASSWORD still contains a template value" >&2
		exit 1
	;;
esac

for key in SLOTOPOL_ACCESS_KEY SLOTOPOL_REFRESH_KEY; do
	value="$access_key"
	if [[ "$key" == SLOTOPOL_REFRESH_KEY ]]; then
		value="$refresh_key"
	fi
	case "$value" in
		change-me|change-me-access-key|change-me-refresh-key|changeme|replace-me|example)
			echo "$key still contains a template value" >&2
			exit 1
		;;
	esac
	if (( ${#value} < 32 )); then
		echo "$key must be at least 32 characters" >&2
		exit 1
	fi
done

if [[ "$access_key" == "$refresh_key" ]]; then
	echo "SLOTOPOL_ACCESS_KEY and SLOTOPOL_REFRESH_KEY must be different" >&2
	exit 1
fi

env_mode="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file")"
if (( 10#$env_mode & 0077 )); then
	echo "production env file must not be group/world readable: $env_file" >&2
	exit 1
fi

for tls_file in fullchain.pem privkey.pem; do
	path="$tls_dir/$tls_file"
	if [[ ! -r "$path" ]]; then
		echo "required TLS file is missing or unreadable: $path" >&2
		exit 1
	fi
done

echo "production env and TLS preflight passed"
