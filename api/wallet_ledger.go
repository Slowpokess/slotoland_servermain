package api

import (
	"database/sql"

	"xorm.io/xorm"
)

func ApplyWalletLedgerEntry(engine *xorm.Engine, entry *WalletLedgerEntry) (err error) {
	if entry.BalanceType == "" {
		entry.BalanceType = WalletBalanceTypeCoins
	}

	return SafeTransaction(engine, func(session *Session) (err error) {
		return applyWalletLedgerEntry(session, entry)
	})
}

func applyWalletLedgerEntry(session *Session, entry *WalletLedgerEntry) (err error) {
	var res sql.Result
	if res, err = session.Exec(sqlAddWalletNonnegative, entry.Amount, entry.UID, entry.CID, entry.Amount); err != nil {
		return
	}

	var affected int64
	if affected, err = res.RowsAffected(); err != nil {
		return
	}
	if affected == 0 {
		var props Props
		var ok bool
		if ok, err = session.Where("uid=? AND cid=?", entry.UID, entry.CID).Get(&props); err != nil {
			return
		}
		if !ok {
			return ErrNoProps
		}
		return ErrNoMoney
	}

	var props Props
	var ok bool
	if ok, err = session.Where("uid=? AND cid=?", entry.UID, entry.CID).Get(&props); err != nil {
		return
	}
	if !ok {
		return ErrNoProps
	}
	entry.BalanceAfter = props.Wallet
	entry.BalanceBefore = props.Wallet - entry.Amount

	_, err = session.Insert(entry)
	return
}

// ApplyBackofficeWalletOperation writes both the immutable wallet ledger entry
// and its human operator audit record in one database transaction.
func ApplyBackofficeWalletOperation(engine *xorm.Engine, entry *WalletLedgerEntry, audit *BackofficeAuditEntry) (err error) {
	if entry.BalanceType == "" {
		entry.BalanceType = WalletBalanceTypeCoins
	}
	return SafeTransaction(engine, func(session *Session) error {
		if err := applyWalletLedgerEntry(session, entry); err != nil {
			return err
		}
		audit.LedgerID = entry.ID
		_, err := session.Insert(audit)
		return err
	})
}

type GameplayWalletSettlement struct {
	CID      uint64
	UID      uint64
	ActorUID uint64
	GID      uint64
	SID      uint64
	Bet      float64
	Win      float64
	Bank     float64
	Fund     float64
	Lock     float64
}

func ApplyGameplayWalletSettlement(engine *xorm.Engine, st GameplayWalletSettlement) (wallet float64, err error) {
	return wallet, SafeTransaction(engine, func(session *Session) (err error) {
		if st.Bank != 0 || st.Fund != 0 || st.Lock != 0 {
			if _, err = session.Exec(sqlclub, st.Bank, st.Fund, st.Lock, st.CID); err != nil {
				return
			}
		}

		var props Props
		var ok bool
		if ok, err = session.Where("uid=? AND cid=?", st.UID, st.CID).Get(&props); err != nil {
			return
		}
		if !ok {
			return ErrNoProps
		}
		wallet = props.Wallet

		if st.Bet > 0 {
			if wallet, err = applyGameplayLedgerPart(session, st, WalletLedgerOpBet, -st.Bet, wallet); err != nil {
				return
			}
		}
		if st.Win > 0 {
			wallet, err = applyGameplayLedgerPart(session, st, WalletLedgerOpWin, st.Win, wallet)
		}
		return
	})
}

func applyGameplayLedgerPart(session *Session, st GameplayWalletSettlement, op WalletLedgerOp, amount, before float64) (after float64, err error) {
	after = before + amount
	if after < 0 {
		return 0, ErrNoMoney
	}

	var res sql.Result
	if res, err = session.Exec(sqlAddWalletNonnegative, amount, st.UID, st.CID, amount); err != nil {
		return
	}
	var affected int64
	if affected, err = res.RowsAffected(); err != nil {
		return
	}
	if affected == 0 {
		var props Props
		var ok bool
		if ok, err = session.Where("uid=? AND cid=?", st.UID, st.CID).Get(&props); err != nil {
			return
		}
		if !ok {
			return 0, ErrNoProps
		}
		return 0, ErrNoMoney
	}

	_, err = session.Insert(&WalletLedgerEntry{
		CID:           st.CID,
		UID:           st.UID,
		ActorUID:      st.ActorUID,
		GID:           st.GID,
		SID:           st.SID,
		BalanceType:   WalletBalanceTypeCoins,
		Op:            op,
		Amount:        amount,
		BalanceBefore: before,
		BalanceAfter:  after,
	})
	return
}
