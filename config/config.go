package cfg

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"log"
	"strings"
	"time"
)

var (
	// compiled binary version, sets by compiler with command
	//    go build -ldflags="-X 'github.com/slotopol/server/config.BuildVers=%buildvers%'"
	BuildVers string

	// compiled binary build date, sets by compiler with command
	//    go build -ldflags="-X 'github.com/slotopol/server/config.BuildTime=%buildtime%'"
	BuildTime string
)

func randomSecret() string {
	var raw [48]byte
	if _, err := rand.Read(raw[:]); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(raw[:])
}

func EnsureRuntimeSecrets() {
	if Cfg.DriverName == "postgres" && !DevMode {
		// Production must fail closed in the web command instead of silently
		// replacing persistent JWT keys with process-local values.
		return
	}
	if Cfg.AccessKey == "" {
		Cfg.AccessKey = randomSecret()
		log.Println("warning: SLOTOPOL_ACCESS_KEY is not set, generated ephemeral access key for this process")
	}
	if Cfg.RefreshKey == "" {
		Cfg.RefreshKey = randomSecret()
		log.Println("warning: SLOTOPOL_REFRESH_KEY is not set, generated ephemeral refresh key for this process")
	}
	if Cfg.AccessKey == Cfg.RefreshKey {
		Cfg.RefreshKey = randomSecret()
		log.Println("warning: refresh key matched access key, generated a separate refresh key")
	}
}

// ValidatePersistentSecrets verifies the JWT keys required by a production web
// process. Migrations and the one-time bootstrap command do not need JWT keys,
// so callers should enforce this check only before serving web traffic.
func ValidatePersistentSecrets() error {
	if Cfg.DriverName != "postgres" || DevMode {
		return nil
	}
	if Cfg.AccessKey == "" {
		return errors.New("SLOTOPOL_ACCESS_KEY is required for production")
	}
	if Cfg.RefreshKey == "" {
		return errors.New("SLOTOPOL_REFRESH_KEY is required for production")
	}
	if isTemplateSecret(Cfg.AccessKey) {
		return errors.New("SLOTOPOL_ACCESS_KEY must not use a template value")
	}
	if isTemplateSecret(Cfg.RefreshKey) {
		return errors.New("SLOTOPOL_REFRESH_KEY must not use a template value")
	}
	if len(Cfg.AccessKey) < 32 || len(Cfg.RefreshKey) < 32 {
		return errors.New("production JWT keys must be at least 32 characters")
	}
	if Cfg.AccessKey == Cfg.RefreshKey {
		return errors.New("SLOTOPOL_ACCESS_KEY and SLOTOPOL_REFRESH_KEY must be different")
	}
	return nil
}

func isTemplateSecret(secret string) bool {
	switch strings.ToLower(strings.TrimSpace(secret)) {
	case "change-me", "change-me-access-key", "change-me-refresh-key", "changeme", "replace-me", "example":
		return true
	default:
		return false
	}
}

// Default master RTP if no others found.
const DefMRTP = 92.5

type CfgJwtAuth struct {
	AccessTTL    time.Duration `json:"access-ttl" yaml:"access-ttl" mapstructure:"access-ttl"`
	RefreshTTL   time.Duration `json:"refresh-ttl" yaml:"refresh-ttl" mapstructure:"refresh-ttl"`
	AccessKey    string        `json:"access-key" yaml:"access-key" mapstructure:"access-key"`
	RefreshKey   string        `json:"refresh-key" yaml:"refresh-key" mapstructure:"refresh-key"`
	NonceTimeout time.Duration `json:"nonce-timeout" yaml:"nonce-timeout" mapstructure:"nonce-timeout"`
}

type CfgSendCode struct {
	UseActivation      bool          `json:"use-activation" yaml:"use-activation" mapstructure:"use-activation"`
	BrevoApiKey        string        `json:"brevo-api-key" yaml:"brevo-api-key" mapstructure:"brevo-api-key"`
	BrevoEmailEndpoint string        `json:"brevo-email-endpoint" yaml:"brevo-email-endpoint" mapstructure:"brevo-email-endpoint"`
	SenderName         string        `json:"sender-name" yaml:"sender-name" mapstructure:"sender-name"`
	SenderEmail        string        `json:"sender-email" yaml:"sender-email" mapstructure:"sender-email"`
	ReplytoEmail       string        `json:"replyto-email" yaml:"replyto-email" mapstructure:"replyto-email"`
	EmailSubject       string        `json:"email-subject" yaml:"email-subject" mapstructure:"email-subject"`
	EmailHtmlContent   string        `json:"email-html-content" yaml:"email-html-content" mapstructure:"email-html-content"`
	CodeTimeout        time.Duration `json:"code-timeout" yaml:"code-timeout" mapstructure:"code-timeout"`
}

// CfgWebServ is web server settings.
type CfgWebServ struct {
	// List of network origins (IPv4 addresses, IPv4 CIDRs, IPv6 addresses or IPv6 CIDRs) from which to trust request's headers that contain alternative client IP when `(*gin.Engine).ForwardedByClientIP` is `true`.
	TrustedProxies []string `json:"trusted-proxies" yaml:"trusted-proxies" mapstructure:"trusted-proxies"`
	// List of address:port values for non-encrypted connections. Address is skipped in most common cases, port only remains.
	PortHTTP []string `json:"port-http" yaml:"port-http" mapstructure:"port-http"`
	// Maximum duration for reading the entire request, including the body.
	ReadTimeout time.Duration `json:"read-timeout" yaml:"read-timeout" mapstructure:"read-timeout"`
	// Amount of time allowed to read request headers.
	ReadHeaderTimeout time.Duration `json:"read-header-timeout" yaml:"read-header-timeout" mapstructure:"read-header-timeout"`
	// Maximum duration before timing out writes of the response.
	WriteTimeout time.Duration `json:"write-timeout" yaml:"write-timeout" mapstructure:"write-timeout"`
	// Maximum amount of time to wait for the next request when keep-alives are enabled.
	IdleTimeout time.Duration `json:"idle-timeout" yaml:"idle-timeout" mapstructure:"idle-timeout"`
	// Controls the maximum number of bytes the server will read parsing the request header's keys and values, including the request line, in bytes.
	MaxHeaderBytes int `json:"max-header-bytes" yaml:"max-header-bytes" mapstructure:"max-header-bytes"`
	// Maximum duration to wait for graceful shutdown.
	ShutdownTimeout time.Duration `json:"shutdown-timeout" yaml:"shutdown-timeout" mapstructure:"shutdown-timeout"`
}

type CfgXormDrv struct {
	// Provides driver name to create XORM engine.
	// It can be "sqlite3", "mysql", or "postgres".
	// Production target is "postgres"; "sqlite3" is for dev/demo.
	DriverName string `json:"driver-name" yaml:"driver-name" mapstructure:"driver-name"`
	// Automatically synchronize tables through xorm.Sync at startup.
	// Keep true for dev/demo; set false in production after applying migrations.
	AutoSync bool `json:"auto-sync" yaml:"auto-sync" mapstructure:"auto-sync"`
	// Determines whether to write information about users spins to the log.
	UseSpinLog bool `json:"use-spin-log" yaml:"use-spin-log" mapstructure:"use-spin-log"`
	// Data source name for 'club' database to create XORM engine.
	// For sqlite3 it should be database file name (slot-club.sqlite),
	// for mysql it should match to pattern user:password@/slot_club,
	// for postgres it should match to pattern user=postgres password=password dbname=slot_club sslmode=disable.
	ClubSourceName string `json:"club-source-name" yaml:"club-source-name" mapstructure:"club-source-name"`
	// Data source name for 'spin' database to create XORM engine.
	// For sqlite3 it should be database file name (slot-spin.sqlite),
	// for mysql it should match to pattern user:password@/slot_spin,
	// for postgres it should match to pattern user=postgres password=password dbname=slot_spin sslmode=disable.
	SpinSourceName string `json:"spin-source-name" yaml:"spin-source-name" mapstructure:"spin-source-name"`
	// Duration between flushes of SQL batching buffers.
	SqlFlushTick time.Duration `json:"sql-flush-tick" yaml:"sql-flush-tick" mapstructure:"sql-flush-tick"`
	// Maximum size of buffer to group items to update across API-endpoints calls
	// at club database. If it is 1, update will be sequential with error code expecting.
	ClubUpdateBuffer int `json:"club-update-buffer" yaml:"club-update-buffer" mapstructure:"club-update-buffer"`
	// Maximum size of buffer to insert new items grouped across
	// API-endpoints calls at club database.
	ClubInsertBuffer int `json:"club-insert-buffer" yaml:"club-insert-buffer" mapstructure:"club-insert-buffer"`
	// Maximum size of buffer to insert new items grouped across
	// API-endpoints calls at spin database.
	SpinInsertBuffer int `json:"spin-insert-buffer" yaml:"spin-insert-buffer" mapstructure:"spin-insert-buffer"`
}

type CfgGameplay struct {
	// Maximum value to add to wallet by one transaction.
	AdjunctLimit float64 `json:"adjunct-limit" yaml:"adjunct-limit" mapstructure:"adjunct-limit"`
	// Jackpot fund minimum. If spin gets jackpot with less value, that spin will be skipped.
	MinJackpot float64 `json:"min-jackpot" yaml:"min-jackpot" mapstructure:"min-jackpot"`
	// Maximum number of spin attempts at bad bank balance.
	MaxSpinAttempts int `json:"max-spin-attempts" yaml:"max-spin-attempts" mapstructure:"max-spin-attempts"`
}

// Config is common service settings.
type Config struct {
	CfgJwtAuth  `json:"authentication" yaml:"authentication" mapstructure:"authentication"`
	CfgSendCode `json:"activation" yaml:"activation" mapstructure:"activation"`
	CfgWebServ  `json:"web-server" yaml:"web-server" mapstructure:"web-server"`
	CfgXormDrv  `json:"database" yaml:"database" mapstructure:"database"`
	CfgGameplay `json:"gameplay" yaml:"xorm" mapstructure:"gameplay"`
}

// Instance of common service settings.
// Inits default values if config is not found.
var Cfg = &Config{
	CfgJwtAuth: CfgJwtAuth{
		AccessTTL:    1 * 24 * time.Hour,
		RefreshTTL:   3 * 24 * time.Hour,
		AccessKey:    "",
		RefreshKey:   "",
		NonceTimeout: 150 * time.Second,
	},
	CfgSendCode: CfgSendCode{
		UseActivation:      false,
		BrevoApiKey:        "",
		BrevoEmailEndpoint: "https://api.brevo.com/v3/smtp/email",
		SenderName:         "Slotopol server",
		SenderEmail:        "slotopol.dev@gmail.com",
		ReplytoEmail:       "noreply@gmail.com",
		EmailSubject:       "Slotopol verification code",
		EmailHtmlContent:   "<html><head></head><body><p>Your Slotopol verification code is: <b>%06d</b></p></body></html>",
		CodeTimeout:        15 * time.Minute,
	},
	CfgWebServ: CfgWebServ{
		TrustedProxies:    []string{"127.0.0.0/8"},
		PortHTTP:          []string{":8080"},
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ShutdownTimeout:   15 * time.Second,
	},
	CfgXormDrv: CfgXormDrv{
		DriverName:       "sqlite3",
		AutoSync:         true,
		UseSpinLog:       true,
		ClubSourceName:   ":memory:",
		SpinSourceName:   ":memory:",
		SqlFlushTick:     2500 * time.Millisecond,
		ClubUpdateBuffer: 1,
		ClubInsertBuffer: 1,
		SpinInsertBuffer: 1,
	},
	CfgGameplay: CfgGameplay{
		AdjunctLimit:    100000,
		MinJackpot:      10000,
		MaxSpinAttempts: 300,
	},
}
