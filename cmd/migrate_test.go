package cmd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestListMigrationFiles(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{
		"0002_second.sql",
		"notes.txt",
		"0001_first.sql",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("-- test"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(dir, "0000_dir.sql"), 0o700); err != nil {
		t.Fatal(err)
	}

	files, err := listMigrationFiles(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 {
		t.Fatalf("expected 2 migration files, got %d: %+v", len(files), files)
	}
	if files[0].version != "0001_first" || files[1].version != "0002_second" {
		t.Fatalf("migration files are not sorted by version: %+v", files)
	}
}
