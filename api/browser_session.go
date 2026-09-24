package api

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"xorm.io/xorm"
)

const browserSessionSecretBytes = 32

var ErrBrowserSessionInvalid = errors.New("browser session is invalid or expired")

// BrowserSession is the persistent server-side record for same-origin web
// authentication. Only irreversible fingerprints are stored; raw credentials
// exist only in the cookie/header returned to the browser.
type BrowserSession struct {
	ID        uint64     `xorm:"pk autoincr" json:"-"`
	UID       uint64     `xorm:"notnull index" json:"uid"`
	TokenHash string     `xorm:"char(64) notnull unique" json:"-"`
	CSRFHash  string     `xorm:"char(64) notnull" json:"-"`
	CTime     time.Time  `xorm:"created 'ctime' notnull default CURRENT_TIMESTAMP" json:"created_at"`
	LastSeen  time.Time  `xorm:"notnull 'last_seen'" json:"last_seen_at"`
	ExpiresAt time.Time  `xorm:"notnull index 'expires_at'" json:"expires_at"`
	RevokedAt *time.Time `xorm:"index 'revoked_at'" json:"revoked_at,omitempty"`
}

func (BrowserSession) TableName() string { return "browser_session" }

type BrowserSessionCredentials struct {
	Session *BrowserSession
	Token   string
	CSRF    string
}

func browserSessionSecret() (string, error) {
	raw := make([]byte, browserSessionSecretBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("generate browser session secret: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func browserSessionFingerprint(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func CreateBrowserSession(engine *xorm.Engine, uid uint64, ttl time.Duration, now time.Time) (*BrowserSessionCredentials, error) {
	if uid == 0 || ttl <= 0 {
		return nil, fmt.Errorf("create browser session: uid and positive ttl are required")
	}
	token, err := browserSessionSecret()
	if err != nil {
		return nil, err
	}
	csrf, err := browserSessionSecret()
	if err != nil {
		return nil, err
	}
	now = now.UTC()
	session := &BrowserSession{
		UID:       uid,
		TokenHash: browserSessionFingerprint(token),
		CSRFHash:  browserSessionFingerprint(csrf),
		LastSeen:  now,
		ExpiresAt: now.Add(ttl),
	}
	if _, err = engine.Insert(session); err != nil {
		return nil, fmt.Errorf("persist browser session: %w", err)
	}
	return &BrowserSessionCredentials{Session: session, Token: token, CSRF: csrf}, nil
}

func LookupBrowserSession(engine *xorm.Engine, token string, now time.Time) (*BrowserSession, error) {
	if token == "" {
		return nil, ErrBrowserSessionInvalid
	}
	session := new(BrowserSession)
	found, err := engine.Where(
		"token_hash=? AND revoked_at IS NULL AND expires_at>?",
		browserSessionFingerprint(token), now.UTC(),
	).Get(session)
	if err != nil {
		return nil, fmt.Errorf("lookup browser session: %w", err)
	}
	if !found {
		return nil, ErrBrowserSessionInvalid
	}
	return session, nil
}

func ValidateBrowserSessionCSRF(session *BrowserSession, csrf string) bool {
	if session == nil || csrf == "" || len(session.CSRFHash) != sha256.Size*2 {
		return false
	}
	want := []byte(session.CSRFHash)
	got := []byte(browserSessionFingerprint(csrf))
	return subtle.ConstantTimeCompare(want, got) == 1
}

func RevokeBrowserSession(engine *xorm.Engine, token string, now time.Time) error {
	if token == "" {
		return ErrBrowserSessionInvalid
	}
	stamp := now.UTC()
	affected, err := engine.Where("token_hash=? AND revoked_at IS NULL", browserSessionFingerprint(token)).
		Cols("revoked_at").Update(&BrowserSession{RevokedAt: &stamp})
	if err != nil {
		return fmt.Errorf("revoke browser session: %w", err)
	}
	if affected == 0 {
		return ErrBrowserSessionInvalid
	}
	return nil
}

func revokeBrowserSessionsForUser(session *Session, uid uint64, now time.Time) (int64, error) {
	stamp := now.UTC()
	return session.Where("uid=? AND revoked_at IS NULL", uid).
		Cols("revoked_at").Update(&BrowserSession{RevokedAt: &stamp})
}

func RevokeBrowserSessionsForUser(engine *xorm.Engine, uid uint64, now time.Time) (int64, error) {
	session := engine.NewSession()
	defer session.Close()
	affected, err := revokeBrowserSessionsForUser(session, uid, now)
	if err != nil {
		return 0, fmt.Errorf("revoke user browser sessions: %w", err)
	}
	return affected, nil
}

func CleanupBrowserSessions(engine *xorm.Engine, before time.Time) (int64, error) {
	affected, err := engine.Where(
		"expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)", before.UTC(), before.UTC(),
	).Delete(&BrowserSession{})
	if err != nil {
		return 0, fmt.Errorf("cleanup browser sessions: %w", err)
	}
	return affected, nil
}
