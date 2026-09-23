package cmd

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateBootstrapInput(t *testing.T) {
	if err := validateBootstrapInput("Main", "Admin@Example.org", "admin", "secret123"); err != nil {
		t.Fatalf("valid bootstrap input rejected: %v", err)
	}
	for name, input := range map[string]struct {
		club   string
		email  string
		admin  string
		secret string
	}{
		"missing club": {email: "admin@example.org", admin: "admin", secret: "secret123"},
		"bad email":    {club: "Main", email: "admin", admin: "admin", secret: "secret123"},
		"missing name": {club: "Main", email: "admin@example.org", secret: "secret123"},
		"short secret": {club: "Main", email: "admin@example.org", admin: "admin", secret: "short"},
	} {
		t.Run(name, func(t *testing.T) {
			if err := validateBootstrapInput(input.club, input.email, input.admin, input.secret); err == nil {
				t.Fatal("invalid bootstrap input unexpectedly accepted")
			}
		})
	}
}

func TestReadBootstrapSecret(t *testing.T) {
	path := filepath.Join(t.TempDir(), "admin-password")
	if err := os.WriteFile(path, []byte("secret123\n"), 0600); err != nil {
		t.Fatal(err)
	}
	secret, err := readBootstrapSecret(path)
	if err != nil {
		t.Fatalf("readBootstrapSecret returned error: %v", err)
	}
	if secret != "secret123" {
		t.Fatalf("unexpected secret content length/value normalization")
	}

	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := readBootstrapSecret(path); err == nil {
		t.Fatal("group/world-readable secret file unexpectedly accepted")
	}
}
