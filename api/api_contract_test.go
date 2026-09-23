package api_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
)

func assertErrorEnvelope(t *testing.T, ret map[string]any, code int, want string) {
	t.Helper()
	if ret["code"] != float64(code) {
		t.Fatalf("expected error code %d, got %+v", code, ret)
	}
	if ret["what"] != want {
		t.Fatalf("expected error message %q, got %+v", want, ret)
	}
	if _, ok := ret["uid"]; ok {
		t.Fatalf("anonymous error response must not include uid: %+v", ret)
	}
}

func TestAPIErrorEnvelopeContract(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := getStatus(t, r, "/servinfo", "")
	if status != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthorized system endpoint, got %d: %+v", status, ret)
	}
	assertErrorEnvelope(t, ret, api.AEC_auth_absent, api.ErrNoAuth.Error())

	status, ret = getStatus(t, r, "/does-not-exist", "")
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown endpoint, got %d: %+v", status, ret)
	}
	assertErrorEnvelope(t, ret, api.AEC_nourl, api.Err404.Error())

	status, ret = getStatus(t, r, "/game/new", "")
	if status != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405 for unsupported method, got %d: %+v", status, ret)
	}
	assertErrorEnvelope(t, ret, api.AEC_nomethod, api.Err405.Error())
}

func TestGameplayResponseContract(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	status, ret = postStatus(t, r, "/game/new", token, gin.H{
		"cid":   1,
		"uid":   3,
		"alias": "Novomatic / Dolphins Pearl",
	})
	if status != http.StatusOK {
		t.Fatalf("game/new failed with status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateOpened) {
		t.Fatalf("game/new must expose opened state, got %+v", ret)
	}
	if ret["wallet"] == nil {
		t.Fatalf("game/new must expose wallet, got %+v", ret)
	}
	gid := uint64(ret["gid"].(float64))

	status, ret = postStatus(t, r, "/slot/spin", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("slot/spin failed with status %d: %+v", status, ret)
	}
	if ret["state"] == nil {
		t.Fatalf("slot/spin must expose state, got %+v", ret)
	}
	if ret["wallet"] == nil {
		t.Fatalf("slot/spin must expose wallet, got %+v", ret)
	}
	if ret["sid"] == nil {
		t.Fatalf("slot/spin must expose sid, got %+v", ret)
	}
}

func TestPropertyAndUserResponseContract(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("player signin failed with status %d: %+v", status, ret)
	}
	playerToken := ret["access"].(string)

	status, ret = postStatus(t, r, "/prop/get", playerToken, gin.H{
		"cid": 1,
		"uid": 3,
	})
	if status != http.StatusOK {
		t.Fatalf("prop/get failed with status %d: %+v", status, ret)
	}
	if ret["wallet"] == nil || ret["access"] == nil || ret["mrtp"] == nil {
		t.Fatalf("prop/get must expose wallet/access/mrtp, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/prop/wallet/get", playerToken, gin.H{
		"cid": 1,
		"uid": 3,
	})
	if status != http.StatusOK {
		t.Fatalf("prop/wallet/get failed with status %d: %+v", status, ret)
	}
	if ret["wallet"] == nil {
		t.Fatalf("prop/wallet/get must expose wallet, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/user/is", playerToken, gin.H{
		"list": []gin.H{
			{"uid": 3},
			{"email": "missing@example.org"},
		},
	})
	if status != http.StatusOK {
		t.Fatalf("user/is failed with status %d: %+v", status, ret)
	}
	list, ok := ret["list"].([]any)
	if !ok || len(list) != 2 {
		t.Fatalf("user/is must return list with the same size as input, got %+v", ret)
	}
	first, ok := list[0].(map[string]any)
	if !ok || first["uid"] == nil || first["email"] == nil || first["name"] == nil {
		t.Fatalf("user/is must expose uid/email/name for resolved users, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed with status %d: %+v", status, ret)
	}
	adminToken := ret["access"].(string)

	status, ret = postStatus(t, r, "/user/delete", adminToken, gin.H{
		"uid": 3,
	})
	if status != http.StatusOK {
		t.Fatalf("user/delete failed with status %d: %+v", status, ret)
	}
	wallets, ok := ret["wallets"].(map[string]any)
	if !ok || len(wallets) == 0 {
		t.Fatalf("user/delete must return wallets map, got %+v", ret)
	}
	if wallets["1"] == nil {
		t.Fatalf("user/delete must include club wallet balances, got %+v", ret)
	}
}
