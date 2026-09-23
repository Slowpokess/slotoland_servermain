package api_test

import (
	"net/http"
	"testing"
)

func TestGameListFilters(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := getStatus(t, r, "/game/list", "")
	if status != http.StatusOK {
		t.Fatalf("game/list without filters failed: %d %+v", status, ret)
	}
	allGames, ok := ret["list"].([]any)
	if !ok || len(allGames) == 0 {
		t.Fatalf("game/list without filters must return games: %+v", ret)
	}

	status, ret = getStatus(t, r, "/game/list?inc=novomatic", "")
	if status != http.StatusOK {
		t.Fatalf("game/list include filter failed: %d %+v", status, ret)
	}
	providerGames, ok := ret["list"].([]any)
	if !ok || len(providerGames) == 0 {
		t.Fatalf("game/list include filter must return games: %+v", ret)
	}
	for _, item := range providerGames {
		game, ok := item.(map[string]any)
		if !ok || game["prov"] != "Novomatic" {
			t.Fatalf("include filter returned unexpected game: %+v", item)
		}
	}

	status, ret = getStatus(t, r, "/game/list?inc=all&exc=novomatic", "")
	if status != http.StatusOK {
		t.Fatalf("game/list exclude filter failed: %d %+v", status, ret)
	}
	excludedGames, ok := ret["list"].([]any)
	if !ok || len(excludedGames) == 0 || len(excludedGames) >= len(allGames) {
		t.Fatalf("exclude filter did not reduce game list: all=%d excluded=%d", len(allGames), len(excludedGames))
	}
	for _, item := range excludedGames {
		game, ok := item.(map[string]any)
		if !ok || game["prov"] == "Novomatic" {
			t.Fatalf("exclude filter returned excluded game: %+v", item)
		}
	}
}
