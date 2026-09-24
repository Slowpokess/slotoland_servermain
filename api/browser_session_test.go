package api_test

import (
	"errors"
	"testing"
	"time"

	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
)

func TestBrowserSessionLifecycle(t *testing.T) {
	setupAuthRouter(t)
	now := time.Now().UTC().Truncate(time.Second)

	credentials, err := api.CreateBrowserSession(cfg.XormStorage, 3, time.Hour, now)
	if err != nil {
		t.Fatal(err)
	}
	if credentials.Token == "" || credentials.CSRF == "" {
		t.Fatal("raw session and CSRF credentials must be returned once")
	}
	if credentials.Session.TokenHash == credentials.Token || credentials.Session.CSRFHash == credentials.CSRF {
		t.Fatal("raw browser credentials must not be persisted")
	}

	stored, err := api.LookupBrowserSession(cfg.XormStorage, credentials.Token, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if stored.UID != 3 {
		t.Fatalf("unexpected session uid %d", stored.UID)
	}
	if !api.ValidateBrowserSessionCSRF(stored, credentials.CSRF) {
		t.Fatal("valid CSRF credential rejected")
	}
	if api.ValidateBrowserSessionCSRF(stored, credentials.CSRF+"tampered") {
		t.Fatal("tampered CSRF credential accepted")
	}

	if err = api.RevokeBrowserSession(cfg.XormStorage, credentials.Token, now.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err = api.LookupBrowserSession(cfg.XormStorage, credentials.Token, now.Add(3*time.Minute)); !errors.Is(err, api.ErrBrowserSessionInvalid) {
		t.Fatalf("revoked session must be invalid, got %v", err)
	}
}

func TestBrowserSessionExpiryRevokeAllAndCleanup(t *testing.T) {
	setupAuthRouter(t)
	now := time.Now().UTC().Truncate(time.Second)

	expired, err := api.CreateBrowserSession(cfg.XormStorage, 3, time.Minute, now.Add(-2*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = api.LookupBrowserSession(cfg.XormStorage, expired.Token, now); !errors.Is(err, api.ErrBrowserSessionInvalid) {
		t.Fatalf("expired session must be invalid, got %v", err)
	}

	first, err := api.CreateBrowserSession(cfg.XormStorage, 3, time.Hour, now)
	if err != nil {
		t.Fatal(err)
	}
	second, err := api.CreateBrowserSession(cfg.XormStorage, 3, time.Hour, now)
	if err != nil {
		t.Fatal(err)
	}
	affected, err := api.RevokeBrowserSessionsForUser(cfg.XormStorage, 3, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if affected < 2 {
		t.Fatalf("expected at least two active sessions revoked, got %d", affected)
	}
	for _, token := range []string{first.Token, second.Token} {
		if _, err = api.LookupBrowserSession(cfg.XormStorage, token, now.Add(2*time.Minute)); !errors.Is(err, api.ErrBrowserSessionInvalid) {
			t.Fatalf("user session must be invalid after revoke-all, got %v", err)
		}
	}

	removed, err := api.CleanupBrowserSessions(cfg.XormStorage, now.Add(2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if removed < 3 {
		t.Fatalf("expected expired and revoked sessions to be removed, got %d", removed)
	}
}
