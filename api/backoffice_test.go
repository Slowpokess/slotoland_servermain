package api_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
)

func TestBackofficeAccessRoles(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("player signin failed: %d %+v", status, ret)
	}
	playerToken := ret["access"].(string)

	status, _ = getStatus(t, r, "/backoffice/me", playerToken)
	if status != http.StatusForbidden {
		t.Fatalf("player must not access backoffice, got %d", status)
	}

	player, ok := api.Users.Get(3)
	if !ok {
		t.Fatal("seed player not found")
	}
	player.GAL = api.ALsupport

	status, ret = getStatus(t, r, "/backoffice/me", playerToken)
	if status != http.StatusOK || ret["role"] != string(api.BackofficeRoleSupport) {
		t.Fatalf("support role must access backoffice: %d %+v", status, ret)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed: %d %+v", status, ret)
	}
	status, ret = getStatus(t, r, "/backoffice/me", ret["access"].(string))
	if status != http.StatusOK || ret["role"] != string(api.BackofficeRoleAdmin) {
		t.Fatalf("admin role must access backoffice: %d %+v", status, ret)
	}
}

func TestSupportCanInvestigateButPlayerCannot(t *testing.T) {
	r := setupAuthRouter(t)
	player, ok := api.Users.Get(3)
	if !ok {
		t.Fatal("seed player not found")
	}
	player.GAL = api.ALsupport

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("support signin failed: %d %+v", status, ret)
	}
	supportToken := ret["access"].(string)

	status, ret = postStatus(t, r, "/backoffice/users/search", supportToken, gin.H{"query": "admin"})
	if status != http.StatusOK || len(ret["list"].([]any)) != 1 {
		t.Fatalf("support user search failed: %d %+v", status, ret)
	}
	user := ret["list"].([]any)[0].(map[string]any)
	if user["email"] != "admin@example.org" || user["uid"] != float64(1) {
		t.Fatalf("unexpected support search result: %+v", user)
	}

	status, ret = postStatus(t, r, "/backoffice/users/get", supportToken, gin.H{"uid": 3, "cid": 1})
	if status != http.StatusOK || ret["wallet"] != float64(1000) {
		t.Fatalf("support user detail failed: %d %+v", status, ret)
	}
	if _, found := ret["secret"]; found {
		t.Fatalf("backoffice user detail must never expose a secret: %+v", ret)
	}

	status, ret = postStatus(t, r, "/backoffice/wallet/ledger", supportToken, gin.H{"uid": 3, "cid": 1})
	if status != http.StatusOK || len(ret["list"].([]any)) != 0 {
		t.Fatalf("support ledger read failed: %d %+v", status, ret)
	}
	if _, err := cfg.XormStorage.Insert(&api.Story{GID: 777, UID: 3, CID: 1, Alias: "novomatic/test"}); err != nil {
		t.Fatal(err)
	}
	status, ret = postStatus(t, r, "/backoffice/sessions/list", supportToken, gin.H{"uid": 3, "cid": 1, "alias": "novomatic/test"})
	if status != http.StatusOK || len(ret["list"].([]any)) != 1 {
		t.Fatalf("support session filter failed: %d %+v", status, ret)
	}

	player.GAL = 0
	status, _ = postStatus(t, r, "/backoffice/users/search", supportToken, gin.H{"query": "admin"})
	if status != http.StatusForbidden {
		t.Fatalf("player must not retain support access after role removal, got %d", status)
	}
}

func TestOperatorWalletOperationsAndAccountBlock(t *testing.T) {
	r := setupAuthRouter(t)
	operator, ok := api.Users.Get(3)
	if !ok {
		t.Fatal("seed player not found")
	}
	operator.GAL = api.ALoperator

	status, ret := postStatus(t, r, "/signin", "", gin.H{"email": "player@example.org", "secret": "iVI05M"})
	if status != http.StatusOK {
		t.Fatalf("operator signin failed: %d %+v", status, ret)
	}
	operatorToken := ret["access"].(string)

	status, ret = postStatus(t, r, "/backoffice/wallet/bonus", operatorToken, gin.H{
		"uid": 2, "cid": 1, "amount": 25, "reason": "support recovery",
	})
	if status != http.StatusOK || ret["wallet"] != float64(10025) || ret["ledger_id"] == float64(0) || ret["audit_id"] == float64(0) {
		t.Fatalf("operator bonus failed: %d %+v", status, ret)
	}
	var ledger api.WalletLedgerEntry
	found, err := cfg.XormStorage.Where("uid=? AND cid=?", 2, 1).Get(&ledger)
	if err != nil || !found || ledger.Op != api.WalletLedgerOpBonus || ledger.ActorUID != 3 {
		t.Fatalf("bonus ledger was not persisted: found=%v err=%v entry=%+v", found, err, ledger)
	}
	var audit api.BackofficeAuditEntry
	found, err = cfg.XormStorage.Where("target_uid=?", 2).Get(&audit)
	if err != nil || !found || audit.Action != "wallet_bonus" || audit.Reason != "support recovery" || audit.LedgerID != ledger.ID {
		t.Fatalf("bonus audit was not persisted: found=%v err=%v entry=%+v", found, err, audit)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{"email": "dealer@example.org", "secret": "LtpkAr"})
	if status != http.StatusOK {
		t.Fatalf("dealer signin failed: %d %+v", status, ret)
	}
	dealerToken := ret["access"].(string)
	status, ret = postStatus(t, r, "/backoffice/users/status", operatorToken, gin.H{
		"uid": 2, "blocked": true, "reason": "requested suspension",
	})
	if status != http.StatusOK || ret["blocked"] != true {
		t.Fatalf("block failed: %d %+v", status, ret)
	}
	status, _ = postStatus(t, r, "/prop/get", dealerToken, gin.H{"uid": 2, "cid": 1})
	if status != http.StatusUnauthorized {
		t.Fatalf("existing token must be rejected after block, got %d", status)
	}
	status, _ = postStatus(t, r, "/signin", "", gin.H{"email": "dealer@example.org", "secret": "LtpkAr"})
	if status != http.StatusForbidden {
		t.Fatalf("blocked user must not sign in, got %d", status)
	}

	status, ret = postStatus(t, r, "/backoffice/users/status", operatorToken, gin.H{
		"uid": 2, "blocked": false, "reason": "review completed",
	})
	if status != http.StatusOK || ret["blocked"] != false {
		t.Fatalf("unblock failed: %d %+v", status, ret)
	}
	status, _ = postStatus(t, r, "/signin", "", gin.H{"email": "dealer@example.org", "secret": "LtpkAr"})
	if status != http.StatusOK {
		t.Fatalf("unblocked user must sign in, got %d", status)
	}
}

func TestOnlyAdminCanAssignBackofficeRole(t *testing.T) {
	r := setupAuthRouter(t)
	status, ret := postStatus(t, r, "/signin", "", gin.H{"email": "admin@example.org", "secret": "0YBoaT"})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed: %d %+v", status, ret)
	}
	adminToken := ret["access"].(string)
	status, ret = postStatus(t, r, "/backoffice/users/role", adminToken, gin.H{
		"uid": 3, "role": "support", "reason": "support onboarding",
	})
	if status != http.StatusOK || ret["role"] != "support" {
		t.Fatalf("admin role assignment failed: %d %+v", status, ret)
	}
	player, _ := api.Users.Get(3)
	if player.GAL&api.ALsupport == 0 {
		t.Fatalf("support flag was not assigned: %d", player.GAL)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{"email": "player@example.org", "secret": "iVI05M"})
	if status != http.StatusOK {
		t.Fatalf("support signin failed: %d %+v", status, ret)
	}
	status, _ = postStatus(t, r, "/backoffice/users/role", ret["access"].(string), gin.H{
		"uid": 2, "role": "operator", "reason": "unauthorized escalation",
	})
	if status != http.StatusForbidden {
		t.Fatalf("support must not assign roles, got %d", status)
	}
}
