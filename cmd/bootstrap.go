package cmd

import (
	"fmt"
	"net/mail"
	"os"
	"strconv"
	"strings"

	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
	"github.com/slotopol/server/util"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"xorm.io/xorm"
)

const bootstrapShort = "Create the first production club and administrator"
const bootstrapLong = `Creates the initial production club, administrator account, and club properties.

The command is intentionally one-time: it refuses to modify a database that already
contains a club or user. Apply PostgreSQL migrations before running it. The admin
password is read from a file and is never accepted as a command-line argument.`
const bootstrapExmp = `
  %[1]s bootstrap --club-name "Main" --admin-email admin@example.org --admin-secret-file /run/secrets/slotopol-admin-password`

var bootstrapflags *pflag.FlagSet

var (
	bootstrapClubName        string
	bootstrapAdminEmail      string
	bootstrapAdminName       string
	bootstrapAdminSecretFile string
)

var bootstrapCmd = &cobra.Command{
	Use:     "bootstrap",
	Short:   bootstrapShort,
	Long:    bootstrapLong,
	Example: fmt.Sprintf(bootstrapExmp, cfg.AppName),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		if Cfg.DriverName != "postgres" {
			return fmt.Errorf("bootstrap is supported only for postgres, got %q", Cfg.DriverName)
		}
		if Cfg.ClubSourceName == "" {
			return fmt.Errorf("database.club-source-name is required")
		}

		var secret string
		if secret, err = readBootstrapSecret(bootstrapAdminSecretFile); err != nil {
			return
		}
		if err = validateBootstrapInput(bootstrapClubName, bootstrapAdminEmail, bootstrapAdminName, secret); err != nil {
			return
		}

		var engine *xorm.Engine
		if engine, err = xorm.NewEngine(Cfg.DriverName, Cfg.ClubSourceName); err != nil {
			return fmt.Errorf("open club database: %w", err)
		}
		defer engine.Close()

		var hashed string
		if hashed, err = api.HashSecret(secret); err != nil {
			return fmt.Errorf("hash administrator secret: %w", err)
		}
		if err = createBootstrapRecords(engine, bootstrapClubName, bootstrapAdminEmail, bootstrapAdminName, hashed); err != nil {
			return err
		}

		fmt.Fprintf(cmd.OutOrStdout(), "bootstrap completed for club %q and administrator %q\n", bootstrapClubName, util.ToLower(bootstrapAdminEmail))
		return nil
	},
}

func init() {
	bootstrapflags = bootstrapCmd.Flags()
	bootstrapflags.StringVar(&bootstrapClubName, "club-name", "", "initial club name")
	bootstrapflags.StringVar(&bootstrapAdminEmail, "admin-email", "", "initial administrator email")
	bootstrapflags.StringVar(&bootstrapAdminName, "admin-name", "admin", "initial administrator display name")
	bootstrapflags.StringVar(&bootstrapAdminSecretFile, "admin-secret-file", "", "file containing the initial administrator password")
	rootCmd.AddCommand(bootstrapCmd)
}

func readBootstrapSecret(path string) (string, error) {
	if path == "" {
		return "", fmt.Errorf("--admin-secret-file is required")
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("stat administrator secret file: %w", err)
	}
	if info.IsDir() {
		return "", fmt.Errorf("administrator secret file is a directory")
	}
	if info.Mode().Perm()&0077 != 0 {
		return "", fmt.Errorf("administrator secret file must not be group- or world-readable")
	}
	body, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read administrator secret file: %w", err)
	}
	secret := strings.TrimSpace(string(body))
	if secret == "" {
		return "", fmt.Errorf("administrator secret file is empty")
	}
	return secret, nil
}

func validateBootstrapInput(clubName, email, adminName, secret string) error {
	if strings.TrimSpace(clubName) == "" {
		return fmt.Errorf("--club-name is required")
	}
	if strings.TrimSpace(adminName) == "" {
		return fmt.Errorf("--admin-name must not be empty")
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || !strings.Contains(email, "@") {
		return fmt.Errorf("--admin-email must be a valid email address")
	}
	if len(secret) < 6 {
		return fmt.Errorf("administrator secret must contain at least 6 characters")
	}
	return nil
}

func createBootstrapRecords(engine *xorm.Engine, clubName, email, adminName, hashedSecret string) error {
	session := engine.NewSession()
	defer session.Close()
	if err := session.Begin(); err != nil {
		return fmt.Errorf("begin bootstrap transaction: %w", err)
	}
	rollback := func(err error) error {
		_ = session.Rollback()
		return err
	}

	// Serialize concurrent bootstrap attempts on the same PostgreSQL database.
	if _, err := session.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", "slotopol-bootstrap"); err != nil {
		return rollback(fmt.Errorf("lock bootstrap operation: %w", err))
	}

	clubs, err := countBootstrapRows(session, "club")
	if err != nil {
		return rollback(fmt.Errorf("check existing clubs: %w", err))
	}
	if clubs != 0 {
		return rollback(fmt.Errorf("bootstrap refused: database already contains %d club(s)", clubs))
	}
	users, err := countBootstrapRows(session, `"user"`)
	if err != nil {
		return rollback(fmt.Errorf("check existing users: %w", err))
	}
	if users != 0 {
		return rollback(fmt.Errorf("bootstrap refused: database already contains %d user(s)", users))
	}

	var rows []map[string]string
	if rows, err = session.QueryString("INSERT INTO club (name, rate) VALUES (?, ?) RETURNING cid", strings.TrimSpace(clubName), 2.5); err != nil {
		return rollback(fmt.Errorf("create initial club: %w", err))
	}
	if len(rows) != 1 {
		return rollback(fmt.Errorf("create initial club: expected one returned id, got %d", len(rows)))
	}
	clubID, err := strconv.ParseUint(rows[0]["cid"], 10, 64)
	if err != nil {
		return rollback(fmt.Errorf("parse initial club id: %w", err))
	}
	if rows, err = session.QueryString("INSERT INTO \"user\" (email, secret, name, status, gal) VALUES (?, ?, ?, ?, ?) RETURNING uid", util.ToLower(email), hashedSecret, strings.TrimSpace(adminName), api.UFactivated, api.ALmember|api.ALdealer|api.ALbooker|api.ALmaster|api.ALadmin); err != nil {
		return rollback(fmt.Errorf("create initial administrator: %w", err))
	}
	if len(rows) != 1 {
		return rollback(fmt.Errorf("create initial administrator: expected one returned id, got %d", len(rows)))
	}
	userID, err := strconv.ParseUint(rows[0]["uid"], 10, 64)
	if err != nil {
		return rollback(fmt.Errorf("parse initial administrator id: %w", err))
	}
	if _, err := session.Exec("INSERT INTO props (cid, uid, access) VALUES (?, ?, ?)", clubID, userID, api.ALmember); err != nil {
		return rollback(fmt.Errorf("create administrator club properties: %w", err))
	}
	if err := session.Commit(); err != nil {
		return fmt.Errorf("commit bootstrap transaction: %w", err)
	}
	return nil
}

func countBootstrapRows(session *xorm.Session, table string) (int64, error) {
	rows, err := session.QueryString("SELECT COUNT(*) AS count FROM " + table)
	if err != nil {
		return 0, err
	}
	if len(rows) != 1 {
		return 0, fmt.Errorf("expected one count row, got %d", len(rows))
	}
	return strconv.ParseInt(rows[0]["count"], 10, 64)
}
