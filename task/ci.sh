#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root_dir"

export GOCACHE="${GOCACHE:-$root_dir/.gocache}"
export GOTMPDIR="${GOTMPDIR:-$root_dir/.gotmp}"
mkdir -p "$GOCACHE" "$GOTMPDIR"

go test ./...
go vet ./...

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/slotopol-ci.XXXXXX")"
server_pid=""

cleanup() {
	if [ -n "$server_pid" ] && kill -0 "$server_pid" >/dev/null 2>&1; then
		kill "$server_pid" >/dev/null 2>&1 || true
		wait "$server_pid" >/dev/null 2>&1 || true
	fi
	rm -rf "$tmpdir"
}
trap cleanup EXIT

go build -o "$tmpdir/slot-server-ci" .
if [ "${SMOKE:-1}" = "1" ]; then
	"$tmpdir/slot-server-ci" web >"$tmpdir/server.log" 2>&1 &
	server_pid=$!

	ready=0
	for _ in $(seq 1 60); do
		if curl -fsS http://127.0.0.1:8080/readyz >/dev/null; then
			ready=1
			break
		fi
		sleep 1
	done

	if [ "$ready" -ne 1 ]; then
		echo "server did not become ready" >&2
		cat "$tmpdir/server.log" >&2
		exit 1
	fi

	BASE_URL=http://127.0.0.1:8080 ./test-api.sh
fi
