package api_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
)

func TestUserDeleteRemovesLinkedStorageAndMemoryState(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
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
	gid := uint64(ret["gid"].(float64))
	if err := api.JoinBuf.Flush(cfg.XormStorage, 0); err != nil {
		t.Fatal(err)
	}

	err := api.ApplyWalletLedgerEntry(cfg.XormStorage, &api.WalletLedgerEntry{
		CID:      1,
		UID:      3,
		ActorUID: 1,
		Op:       api.WalletLedgerOpAdjustment,
		Amount:   25,
	})
	if err != nil {
		t.Fatal(err)
	}

	status, ret = postStatus(t, r, "/user/delete", token, gin.H{
		"uid": 3,
	})
	if status != http.StatusOK {
		t.Fatalf("user/delete failed with status %d: %+v", status, ret)
	}

	if _, ok := api.Users.Get(3); ok {
		t.Fatal("anonymized user must be removed from active memory")
	}
	if _, ok := api.Scenes.Get(gid); ok {
		t.Fatal("deleted user's scene must be removed from memory")
	}

	assertAnonymizedUser(t, 3)
}

func TestCleanupUnactivatedUsersAnonymizesLinkedRecords(t *testing.T) {
	setupAuthRouter(t)

	user := &api.User{
		Email:  "stale@example.org",
		Secret: "hashed-placeholder",
		Name:   "stale",
		Status: 0,
	}
	if _, err := cfg.XormStorage.Insert(user); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.XormStorage.Exec("UPDATE user SET ctime=? WHERE uid=?", time.Now().Add(-4*24*time.Hour).Format(time.DateTime), user.UID); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.XormStorage.Insert(&api.Props{CID: 1, UID: user.UID, Wallet: 10}); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.XormStorage.Insert(&api.Story{GID: 99001, CID: 1, UID: user.UID, Alias: "test"}); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.XormStorage.Insert(&api.WalletLedgerEntry{
		CID:          1,
		UID:          user.UID,
		Op:           api.WalletLedgerOpBonus,
		Amount:       10,
		BalanceAfter: 10,
		BalanceType:  api.WalletBalanceTypeCoins,
	}); err != nil {
		t.Fatal(err)
	}

	removed, err := api.CleanupUnactivatedUsers(cfg.XormStorage, time.Now().Add(-3*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if removed != 1 {
		t.Fatalf("expected one stale user anonymized, got %d", removed)
	}

	assertAnonymizedUser(t, user.UID)
}

func assertAnonymizedUser(t *testing.T, uid uint64) {
	t.Helper()

	var user api.User
	ok, err := cfg.XormStorage.ID(uid).Get(&user)
	if err != nil {
		t.Fatalf("get anonymized user: %v", err)
	}
	if !ok || user.Email != fmt.Sprintf("deleted+%d@invalid.local", uid) || user.Status&api.UFblocked == 0 || user.GAL != 0 {
		t.Fatalf("unexpected anonymized user: uid=%d email=%q status=%d gal=%d", user.UID, user.Email, user.Status, user.GAL)
	}

	for name, table := range map[string]any{
		"props": &api.Props{},
		"story": &api.Story{},
	} {
		count, err := cfg.XormStorage.Where("uid=?", uid).Count(table)
		if err != nil {
			t.Fatalf("count %s: %v", name, err)
		}
		if count != 0 {
			t.Fatalf("expected no %s rows for uid %d, got %d", name, uid, count)
		}
	}
	ledgerCount, err := cfg.XormStorage.Where("uid=?", uid).Count(&api.WalletLedgerEntry{})
	if err != nil {
		t.Fatalf("count wallet ledger: %v", err)
	}
	if ledgerCount == 0 {
		t.Fatalf("wallet ledger must survive anonymization for uid %d", uid)
	}
}
