package api

import (
	"fmt"
	"time"

	"xorm.io/xorm"
)

func DeleteUserRecords(session *Session, uid uint64) (err error) {
	var ledgerCount int64
	if ledgerCount, err = session.Where("uid=?", uid).Count(&WalletLedgerEntry{}); err != nil {
		return
	}
	if ledgerCount != 0 {
		return fmt.Errorf("can not hard-delete user %d with %d wallet ledger record(s); anonymize the account instead", uid, ledgerCount)
	}
	if _, err = session.Where("uid=?", uid).Delete(&BrowserSession{}); err != nil {
		return
	}
	if _, err = session.Where("uid=?", uid).Delete(&Story{}); err != nil {
		return
	}
	if _, err = session.Where("uid=?", uid).Delete(&Props{}); err != nil {
		return
	}
	_, err = session.ID(uid).Delete(&User{})
	return
}

// AnonymizeUserRecords removes direct account data while retaining the user
// row as the stable foreign-key target for immutable financial history.
func AnonymizeUserRecords(session *Session, uid uint64) (err error) {
	if _, err = revokeBrowserSessionsForUser(session, uid, time.Now()); err != nil {
		return
	}
	if _, err = session.Where("uid=?", uid).Delete(&Story{}); err != nil {
		return
	}
	if _, err = session.Where("uid=?", uid).Delete(&Props{}); err != nil {
		return
	}
	var email = fmt.Sprintf("deleted+%d@invalid.local", uid)
	var name = fmt.Sprintf("deleted-%d", uid)
	var affected int64
	if affected, err = session.ID(uid).Cols("email", "name", "code", "status", "gal").Update(&User{
		Email:  email,
		Name:   name,
		Code:   0,
		Status: UFblocked,
		GAL:    0,
	}); err != nil {
		return
	}
	if affected != 1 {
		err = fmt.Errorf("user %d was not found for anonymization", uid)
	}
	return
}

func CleanupUnactivatedUsers(engine *xorm.Engine, before time.Time) (removed int64, err error) {
	var users []User
	if err = engine.Where("ctime<? AND status=0", before.Format(time.DateTime)).Find(&users); err != nil {
		return
	}
	if len(users) == 0 {
		return
	}

	err = SafeTransaction(engine, func(session *Session) (err error) {
		for i := range users {
			if err = AnonymizeUserRecords(session, users[i].UID); err != nil {
				return
			}
			removed++
		}
		return
	})
	return
}

func DeleteUserScenesFromMemory(uid uint64) {
	for gid, scene := range Scenes.Items() {
		if scene.UID == uid {
			Scenes.Delete(gid)
		}
	}
}
