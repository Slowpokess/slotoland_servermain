package cmd

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	cfg "github.com/slotopol/server/config"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"xorm.io/xorm"
)

const migrateShort = "Apply SQL database migrations"
const migrateLong = `Applies SQL migrations to the configured storage database.

Only PostgreSQL migrations are supported by this command. SQLite remains a dev/demo storage and is still managed by xorm.Sync at runtime.`
const migrateExmp = `
  %[1]s migrate --path migrations/postgres`

var migrateflags *pflag.FlagSet

var migratePath string

var migrateCmd = &cobra.Command{
	Use:     "migrate",
	Short:   migrateShort,
	Long:    migrateLong,
	Example: fmt.Sprintf(migrateExmp, cfg.AppName),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		if Cfg.DriverName != "postgres" {
			return fmt.Errorf("migrations are supported only for postgres, got %q", Cfg.DriverName)
		}
		if Cfg.ClubSourceName == "" {
			return fmt.Errorf("database.club-source-name is required")
		}

		var engine *xorm.Engine
		if engine, err = xorm.NewEngine(Cfg.DriverName, Cfg.ClubSourceName); err != nil {
			return
		}
		defer engine.Close()
		var session = engine.NewSession()
		defer session.Close()
		// Keep the advisory lock and all migration checks on one PostgreSQL
		// connection. An Engine-level call may use another pooled connection
		// for the unlock and would not serialize concurrent runners.
		if _, err = session.Exec("SELECT pg_advisory_lock(hashtext(?))", "slotopol-migrations"); err != nil {
			return fmt.Errorf("lock migration operation: %w", err)
		}
		defer session.Exec("SELECT pg_advisory_unlock(hashtext(?))", "slotopol-migrations")

		var files []migrationFile
		if files, err = listMigrationFiles(migratePath); err != nil {
			return
		}
		if len(files) == 0 {
			log.Printf("no migration files found in %s", migratePath)
			return nil
		}

		if err = ensureSchemaMigrations(session); err != nil {
			return
		}
		for _, file := range files {
			var applied bool
			if applied, err = migrationApplied(session, file.version); err != nil {
				return
			}
			if applied {
				log.Printf("migration %s already applied", file.version)
				continue
			}
			if err = applyMigration(session, file); err != nil {
				return
			}
			log.Printf("applied migration %s", file.version)
		}
		return nil
	},
}

func init() {
	migrateflags = migrateCmd.Flags()
	migrateflags.StringVar(&migratePath, "path", "migrations/postgres", "path to PostgreSQL migration SQL files")
	rootCmd.AddCommand(migrateCmd)
}

type migrationDB interface {
	Exec(sqlOrArgs ...interface{}) (sql.Result, error)
	QueryString(sqlOrArgs ...interface{}) ([]map[string]string, error)
}

type migrationFile struct {
	version string
	path    string
}

func listMigrationFiles(dir string) (files []migrationFile, err error) {
	var entries []os.DirEntry
	if entries, err = os.ReadDir(dir); err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		var version = strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name()))
		if version == "" {
			continue
		}
		files = append(files, migrationFile{
			version: version,
			path:    filepath.Join(dir, entry.Name()),
		})
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].version < files[j].version
	})
	return
}

func ensureSchemaMigrations(db migrationDB) (err error) {
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	return
}

func migrationApplied(db migrationDB, version string) (applied bool, err error) {
	var rows []map[string]string
	if rows, err = db.QueryString("SELECT version FROM schema_migrations WHERE version = ?", version); err != nil {
		return
	}
	applied = len(rows) > 0
	return
}

func applyMigration(db migrationDB, file migrationFile) (err error) {
	var body []byte
	if body, err = os.ReadFile(file.path); err != nil {
		return
	}
	if _, err = db.Exec(string(body)); err != nil {
		return fmt.Errorf("migration %s failed: %w", file.version, err)
	}
	_, err = db.Exec("INSERT INTO schema_migrations(version) VALUES (?) ON CONFLICT (version) DO NOTHING", file.version)
	return
}
