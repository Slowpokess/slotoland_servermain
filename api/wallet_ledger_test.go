package api_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
)

func TestWalletAdjustmentWritesLedgerEntry(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	status, ret = postStatus(t, r, "/prop/wallet/add", token, gin.H{
		"cid": 1,
		"uid": 3,
		"sum": 25,
	})
	if status != http.StatusOK {
		t.Fatalf("wallet add failed with status %d: %+v", status, ret)
	}
	if ret["wallet"] != float64(1025) {
		t.Fatalf("unexpected wallet after adjustment: %+v", ret)
	}

	var entry api.WalletLedgerEntry
	ok, err := cfg.XormStorage.Where("uid=? AND cid=?", 3, 1).Get(&entry)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("wallet adjustment must write ledger entry")
	}
	if entry.Op != api.WalletLedgerOpAdjustment {
		t.Fatalf("unexpected ledger op: %q", entry.Op)
	}
	if entry.Amount != 25 || entry.BalanceBefore != 1000 || entry.BalanceAfter != 1025 {
		t.Fatalf("unexpected ledger balances: %+v", entry)
	}
	if entry.ActorUID != 1 || entry.BalanceType != api.WalletBalanceTypeCoins {
		t.Fatalf("unexpected ledger metadata: %+v", entry)
	}
}

func TestRejectedWalletAdjustmentDoesNotWriteLedgerEntry(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	status, ret = postStatus(t, r, "/prop/wallet/add", token, gin.H{
		"cid": 1,
		"uid": 3,
		"sum": -1001,
	})
	if status != http.StatusForbidden {
		t.Fatalf("wallet debit must be rejected, got status %d: %+v", status, ret)
	}

	count, err := cfg.XormStorage.Where("uid=? AND cid=?", 3, 1).Count(&api.WalletLedgerEntry{})
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("rejected wallet adjustment must not write ledger entries, got %d", count)
	}
}

func TestGameplaySettlementWritesBetAndWinLedgerEntries(t *testing.T) {
	setupAuthRouter(t)

	wallet, err := api.ApplyGameplayWalletSettlement(cfg.XormStorage, api.GameplayWalletSettlement{
		CID:  1,
		UID:  3,
		GID:  77,
		SID:  88,
		Bet:  10,
		Win:  4,
		Bank: 6,
	})
	if err != nil {
		t.Fatal(err)
	}
	if wallet != 994 {
		t.Fatalf("unexpected wallet after settlement: %v", wallet)
	}

	var entries []api.WalletLedgerEntry
	if err = cfg.XormStorage.Where("uid=? AND cid=?", 3, 1).Asc("id").Find(&entries); err != nil {
		t.Fatal(err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected bet and win ledger entries, got %d: %+v", len(entries), entries)
	}
	if entries[0].Op != api.WalletLedgerOpBet || entries[0].Amount != -10 || entries[0].BalanceBefore != 1000 || entries[0].BalanceAfter != 990 {
		t.Fatalf("unexpected bet entry: %+v", entries[0])
	}
	if entries[1].Op != api.WalletLedgerOpWin || entries[1].Amount != 4 || entries[1].BalanceBefore != 990 || entries[1].BalanceAfter != 994 {
		t.Fatalf("unexpected win entry: %+v", entries[1])
	}
	if entries[0].GID != 77 || entries[0].SID != 88 || entries[1].GID != 77 || entries[1].SID != 88 {
		t.Fatalf("ledger entries must be linked to gameplay identifiers: %+v", entries)
	}

	var club api.ClubData
	ok, err := cfg.XormStorage.ID(1).Get(&club)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("club 1 not found")
	}
	if club.Bank != 10006 {
		t.Fatalf("unexpected club bank after settlement: %+v", club)
	}
}

func TestRejectedGameplaySettlementRollsBackLedgerAndBank(t *testing.T) {
	setupAuthRouter(t)

	_, err := api.ApplyGameplayWalletSettlement(cfg.XormStorage, api.GameplayWalletSettlement{
		CID:  1,
		UID:  3,
		GID:  77,
		SID:  88,
		Bet:  1001,
		Bank: 1001,
	})
	if err != api.ErrNoMoney {
		t.Fatalf("expected ErrNoMoney, got %v", err)
	}

	count, err := cfg.XormStorage.Where("uid=? AND cid=?", 3, 1).Count(&api.WalletLedgerEntry{})
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("rejected gameplay settlement must not write ledger entries, got %d", count)
	}

	var props api.Props
	ok, err := cfg.XormStorage.Where("uid=? AND cid=?", 3, 1).Get(&props)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("props not found")
	}
	if props.Wallet != 1000 {
		t.Fatalf("wallet must stay unchanged after rejected settlement: %+v", props)
	}

	var club api.ClubData
	ok, err = cfg.XormStorage.ID(1).Get(&club)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("club 1 not found")
	}
	if club.Bank != 10000 {
		t.Fatalf("club bank must stay unchanged after rejected settlement: %+v", club)
	}
}
