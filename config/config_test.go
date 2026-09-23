package cfg

import "testing"

func TestValidatePersistentSecrets(t *testing.T) {
	originalDriver := Cfg.DriverName
	originalAccess := Cfg.AccessKey
	originalRefresh := Cfg.RefreshKey
	originalDevMode := DevMode
	t.Cleanup(func() {
		Cfg.DriverName = originalDriver
		Cfg.AccessKey = originalAccess
		Cfg.RefreshKey = originalRefresh
		DevMode = originalDevMode
	})

	Cfg.DriverName = "postgres"
	DevMode = false
	for name, keys := range map[string][2]string{
		"missing access":   {"", "refresh-key-with-more-than-32-characters"},
		"missing refresh":  {"access-key-with-more-than-32-characters", ""},
		"same keys":        {"same-key-with-more-than-32-characters", "same-key-with-more-than-32-characters"},
		"template access":  {"change-me-access-key", "refresh-key-with-more-than-32-characters"},
		"template refresh": {"access-key-with-more-than-32-characters", "change-me-refresh-key"},
		"short keys":       {"short", "also-short"},
	} {
		t.Run(name, func(t *testing.T) {
			Cfg.AccessKey, Cfg.RefreshKey = keys[0], keys[1]
			if err := ValidatePersistentSecrets(); err == nil {
				t.Fatal("invalid persistent secrets unexpectedly accepted")
			}
		})
	}

	Cfg.AccessKey, Cfg.RefreshKey = "access-key-with-more-than-32-characters", "refresh-key-with-more-than-32-characters"
	if err := ValidatePersistentSecrets(); err != nil {
		t.Fatalf("valid persistent secrets rejected: %v", err)
	}

	DevMode = true
	Cfg.AccessKey, Cfg.RefreshKey = "", ""
	if err := ValidatePersistentSecrets(); err != nil {
		t.Fatalf("dev mode must not require persistent secrets: %v", err)
	}
}
