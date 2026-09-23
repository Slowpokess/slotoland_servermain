#!/usr/bin/env bash
set -euo pipefail

base_url="${1:?usage: $0 https://example.org}"
base_url="${base_url%/}"

health="$(curl --fail --silent --show-error --location --retry 3 "$base_url/healthz")"
case "$health" in
	*'"status":"ok"'*) ;;
	*)
		echo "health check returned an unexpected status" >&2
		exit 1
		;;
esac

ready="$(curl --fail --silent --show-error --location --retry 3 "$base_url/readyz")"
case "$ready" in
	*'"status":"ready"'*) ;;
	*)
		echo "readiness check did not report ready" >&2
		exit 1
		;;
esac

index="$(curl --fail --silent --show-error --location --retry 3 "$base_url/")"
case "$index" in
	*'id="root"'*) ;;
	*)
		echo "frontend index was not served by the configured origin" >&2
		exit 1
		;;
esac

echo "production smoke checks passed"
