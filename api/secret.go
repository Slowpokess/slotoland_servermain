package api

import (
	"strings"

	cfg "github.com/slotopol/server/config"
	"golang.org/x/crypto/bcrypt"
)

const bcryptCost = 12

func SecretIsHashed(secret string) bool {
	return strings.HasPrefix(secret, "$2a$") ||
		strings.HasPrefix(secret, "$2b$") ||
		strings.HasPrefix(secret, "$2y$")
}

func HashSecret(secret string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(secret), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func VerifySecret(stored, provided string) bool {
	if SecretIsHashed(stored) {
		return bcrypt.CompareHashAndPassword([]byte(stored), []byte(provided)) == nil
	}
	return stored == provided
}

func EnsureUserSecretHash(user *User) error {
	if SecretIsHashed(user.Secret) {
		return nil
	}
	hash, err := HashSecret(user.Secret)
	if err != nil {
		return err
	}
	if _, err = cfg.XormStorage.ID(user.UID).Cols("secret").Update(&User{Secret: hash}); err != nil {
		return err
	}
	user.Secret = hash
	return nil
}
