#!/usr/bin/env bash

# Slotopol API smoke test.
# Requires a running server with seed data loaded.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
EMAIL="${EMAIL:-player@example.org}"
SECRET="${SECRET:-iVI05M}"
CID="${CID:-1}"
ALIAS="${ALIAS:-Novomatic/Joker Dolphin}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

need() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo -e "${RED}missing required command: $1${NC}" >&2
		exit 1
	fi
}

json_post() {
	local path="$1"
	local token="$2"
	local body="$3"
	if [ -n "$token" ]; then
		curl -fsS -H "Content-Type: application/json" -H "Accept: application/json" \
			-H "Authorization: Bearer $token" -d "$body" -X POST "$BASE_URL$path"
	else
		curl -fsS -H "Content-Type: application/json" -H "Accept: application/json" \
			-d "$body" -X POST "$BASE_URL$path"
	fi
}

assert_json_field() {
	local response="$1"
	local filter="$2"
	local message="$3"
	if ! jq -e "$filter" >/dev/null <<<"$response"; then
		echo -e "${RED}$message${NC}" >&2
		echo "$response" >&2
		exit 1
	fi
}

need curl
need jq

echo -e "${BLUE}Slotopol API smoke test${NC}"
echo "BASE_URL=$BASE_URL"

echo -e "${BLUE}1. ping${NC}"
curl -fsS -H "Accept: application/json" "$BASE_URL/ping" >/dev/null
echo -e "${GREEN}ok${NC}"

echo -e "${BLUE}2. public game list${NC}"
games_resp="$(curl -fsS -H "Accept: application/json" "$BASE_URL/game/list?inc=novomatic")"
assert_json_field "$games_resp" '.list | type == "array"' "game/list response must contain list array"
echo -e "${GREEN}ok: $(jq '.list | length' <<<"$games_resp") games${NC}"

echo -e "${BLUE}3. sign in${NC}"
signin_resp="$(json_post /signin "" "{\"email\":\"$EMAIL\",\"secret\":\"$SECRET\"}")"
assert_json_field "$signin_resp" '.access | type == "string" and length > 0' "signin response must contain access token"
assert_json_field "$signin_resp" '.refresh | type == "string" and length > 0' "signin response must contain refresh token"
uid="$(jq -r '.uid' <<<"$signin_resp")"
token="$(jq -r '.access' <<<"$signin_resp")"
echo -e "${GREEN}ok: uid=$uid${NC}"

echo -e "${BLUE}4. create game${NC}"
game_resp="$(json_post /game/new "$token" "{\"cid\":$CID,\"uid\":$uid,\"alias\":\"$ALIAS\"}")"
assert_json_field "$game_resp" '.gid | type == "number"' "game/new response must contain gid"
assert_json_field "$game_resp" '.state | type == "string"' "game/new response must contain state"
gid="$(jq -r '.gid' <<<"$game_resp")"
echo -e "${GREEN}ok: gid=$gid state=$(jq -r '.state' <<<"$game_resp")${NC}"

echo -e "${BLUE}5. game info${NC}"
info_resp="$(json_post /game/info "$token" "{\"gid\":$gid}")"
assert_json_field "$info_resp" ".gid == $gid" "game/info gid must match created game"
assert_json_field "$info_resp" '.state | type == "string"' "game/info response must contain state"
echo -e "${GREEN}ok: state=$(jq -r '.state' <<<"$info_resp")${NC}"

echo -e "${BLUE}6. slot spin${NC}"
spin_resp="$(json_post /slot/spin "$token" "{\"gid\":$gid}")"
assert_json_field "$spin_resp" '.sid | type == "number"' "slot/spin response must contain sid"
assert_json_field "$spin_resp" '.wallet | type == "number"' "slot/spin response must contain wallet"
assert_json_field "$spin_resp" '.state | type == "string"' "slot/spin response must contain state"
echo -e "${GREEN}ok: sid=$(jq -r '.sid' <<<"$spin_resp") wallet=$(jq -r '.wallet' <<<"$spin_resp") state=$(jq -r '.state' <<<"$spin_resp")${NC}"

echo -e "${BLUE}7. wallet read model${NC}"
wallet_resp="$(json_post /prop/wallet/get "$token" "{\"cid\":$CID,\"uid\":$uid}")"
assert_json_field "$wallet_resp" '.wallet | type == "number"' "prop/wallet/get response must contain wallet"
echo -e "${GREEN}ok: wallet=$(jq -r '.wallet' <<<"$wallet_resp")${NC}"

echo -e "${BLUE}8. close game${NC}"
close_resp="$(json_post /game/close "$token" "{\"gid\":$gid}")"
assert_json_field "$close_resp" ".gid == $gid" "game/close gid must match created game"
assert_json_field "$close_resp" '.state == "closed"' "game/close response must return closed state"
echo -e "${GREEN}ok: state=$(jq -r '.state' <<<"$close_resp")${NC}"

echo -e "${GREEN}smoke test completed${NC}"
