package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	"github.com/slotopol/server/cmd"
	cfg "github.com/slotopol/server/config"
)

func postStatus(t *testing.T, r *gin.Engine, path string, token string, arg any) (int, gin.H) {
	t.Helper()

	var body io.Reader
	if arg != nil {
		b, err := json.Marshal(arg)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(b)
	}

	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var ret gin.H
	resp := w.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		if len(b) > 0 {
			if err = json.Unmarshal(b, &ret); err != nil {
				t.Fatal(err)
			}
		}
	}
	return resp.StatusCode, ret
}

func getStatus(t *testing.T, r *gin.Engine, path string, token string) (int, gin.H) {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var ret gin.H
	resp := w.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		b, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		if len(b) > 0 {
			if err = json.Unmarshal(b, &ret); err != nil {
				t.Fatal(err)
			}
		}
	}
	return resp.StatusCode, ret
}

func setupAuthRouter(t *testing.T) *gin.Engine {
	t.Helper()

	exitctx := context.Background()
	cmd.LoadInternalYaml(exitctx)
	cmd.UpdateAlgList()

	cfg.CfgPath = "../appdata"
	if err := cmd.InitSQL(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := cmd.DoneSQL(); err != nil {
			t.Fatal(err)
		}
	})

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.HandleMethodNotAllowed = true
	api.SetupRouter(r)
	return r
}

func TestRefreshTokensAreSeparatedFromAccessTokens(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}

	access := ret["access"].(string)
	refresh := ret["refresh"].(string)
	if ret["refrsh"] != refresh {
		t.Fatalf("deprecated refrsh alias must match refresh token")
	}

	status, _ = postStatus(t, r, "/prop/get", access, gin.H{
		"cid": 1,
		"uid": 3,
	})
	if status != http.StatusOK {
		t.Fatalf("access token must work on protected route, got status %d", status)
	}

	status, ret = postStatus(t, r, "/prop/get", refresh, gin.H{
		"cid": 1,
		"uid": 3,
	})
	if status != http.StatusUnauthorized {
		t.Fatalf("refresh token must be rejected on protected route, got status %d", status)
	}
	if ret["code"] != float64(api.AEC_token_badclaims) {
		t.Fatalf("unexpected error code for refresh token on protected route: %+v", ret)
	}

	status, ret = postStatus(t, r, "/refresh", refresh, nil)
	if status != http.StatusOK {
		t.Fatalf("refresh token must work on /refresh, got status %d: %+v", status, ret)
	}

	status, ret = postStatus(t, r, "/refresh", access, nil)
	if status != http.StatusUnauthorized {
		t.Fatalf("access token must be rejected on /refresh, got status %d", status)
	}
	if ret["code"] != float64(api.AEC_token_notsign) && ret["code"] != float64(api.AEC_token_badclaims) {
		t.Fatalf("unexpected error code for access token on /refresh: %+v", ret)
	}
}

func TestSeedUserSecretsAreHashed(t *testing.T) {
	setupAuthRouter(t)

	for _, uid := range []uint64{1, 2, 3} {
		user, ok := api.Users.Get(uid)
		if !ok {
			t.Fatalf("seed user %d not loaded", uid)
		}
		if !api.SecretIsHashed(user.Secret) {
			t.Fatalf("seed user %d secret must be hashed, got %q", uid, user.Secret)
		}
	}
}

func TestSignupStoresHashedSecret(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signup", "", gin.H{
		"email":  "signup@example.org",
		"secret": "secret123",
		"name":   "signup-user",
	})
	if status != http.StatusOK {
		t.Fatalf("signup failed with status %d: %+v", status, ret)
	}

	uid := uint64(ret["uid"].(float64))
	user, ok := api.Users.Get(uid)
	if !ok {
		t.Fatalf("signup user %d not loaded into runtime cache", uid)
	}
	if user.Secret == "secret123" {
		t.Fatal("signup secret stored in plain text")
	}
	if !api.SecretIsHashed(user.Secret) {
		t.Fatalf("signup secret must be hashed, got %q", user.Secret)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "signup@example.org",
		"secret": "secret123",
	})
	if status != http.StatusOK {
		t.Fatalf("signin with hashed secret failed with status %d: %+v", status, ret)
	}
}

func TestSystemEndpointsRequireAdmin(t *testing.T) {
	r := setupAuthRouter(t)

	status, _ := getStatus(t, r, "/servinfo", "")
	if status != http.StatusUnauthorized {
		t.Fatalf("servinfo must require auth, got status %d", status)
	}

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("player signin failed with status %d: %+v", status, ret)
	}
	playerAccess := ret["access"].(string)

	status, ret = getStatus(t, r, "/servinfo", playerAccess)
	if status != http.StatusForbidden {
		t.Fatalf("servinfo must reject non-admin token, got status %d", status)
	}
	if ret["code"] != float64(api.AEC_auth_admin) {
		t.Fatalf("unexpected servinfo error code for non-admin token: %+v", ret)
	}

	status, ret = getStatus(t, r, "/memusage", playerAccess)
	if status != http.StatusForbidden {
		t.Fatalf("memusage must reject non-admin token, got status %d", status)
	}
	if ret["code"] != float64(api.AEC_auth_admin) {
		t.Fatalf("unexpected memusage error code for non-admin token: %+v", ret)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed with status %d: %+v", status, ret)
	}
	adminAccess := ret["access"].(string)

	status, ret = getStatus(t, r, "/servinfo", adminAccess)
	if status != http.StatusOK {
		t.Fatalf("servinfo must allow admin token, got status %d: %+v", status, ret)
	}

	status, ret = getStatus(t, r, "/memusage", adminAccess)
	if status != http.StatusOK {
		t.Fatalf("memusage must allow admin token, got status %d: %+v", status, ret)
	}
}

func TestGameJoinRejectsSceneOwnershipMismatch(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed with status %d: %+v", status, ret)
	}
	adminAccess := ret["access"].(string)

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "dealer@example.org",
		"secret": "LtpkAr",
	})
	if status != http.StatusOK {
		t.Fatalf("dealer signin failed with status %d: %+v", status, ret)
	}
	dealerAccess := ret["access"].(string)

	status, ret = postStatus(t, r, "/game/new", adminAccess, gin.H{
		"cid":   1,
		"uid":   1,
		"alias": "Novomatic / Dolphins Pearl",
	})
	if status != http.StatusOK {
		t.Fatalf("game/new failed with status %d: %+v", status, ret)
	}
	gid := uint64(ret["gid"].(float64))

	status, ret = postStatus(t, r, "/game/join", dealerAccess, gin.H{
		"cid": 1,
		"uid": 3,
		"gid": gid,
	})
	if status != http.StatusForbidden {
		t.Fatalf("dealer must not join a scene through mismatched uid/cid, got status %d", status)
	}
	if ret["code"] != float64(api.AEC_game_join_noaccess) {
		t.Fatalf("unexpected game/join error code for mismatched ownership: %+v", ret)
	}
}
