package api

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	cfg "github.com/slotopol/server/config"
	"github.com/slotopol/server/util"
)

const (
	backofficeActionUserBlock   = "user_block"
	backofficeActionUserUnblock = "user_unblock"
	backofficeActionAdjustment  = "wallet_adjustment"
	backofficeActionBonus       = "wallet_bonus"
)

func backofficeReason(reason string) string { return strings.TrimSpace(reason) }

func requireBackofficeReason(c *gin.Context, reason string) (string, bool) {
	reason = backofficeReason(reason)
	if reason == "" || len(reason) > 500 {
		Ret400(c, AEC_prop_walletadd_nobind, ErrBadReason)
		return "", false
	}
	return reason, true
}

// ApiBackofficeMe verifies that the current access token may enter the
// backoffice and gives the client only the role it needs for UI gating.
func ApiBackofficeMe(c *gin.Context) {
	user, al := MustAdmin(c, 0)
	RetOk(c, struct {
		UID  uint64         `json:"uid"`
		Role BackofficeRole `json:"role"`
	}{
		UID:  user.UID,
		Role: al.BackofficeRole(),
	})
}

type backofficeUserSummary struct {
	UID    uint64 `json:"uid"`
	Email  string `json:"email"`
	Name   string `json:"name,omitempty"`
	Status UF     `json:"status"`
}

func backofficeUser(user *User) backofficeUserSummary {
	return backofficeUserSummary{UID: user.UID, Email: user.Email, Name: user.Name, Status: user.Status}
}

// ApiBackofficeUserSearch returns a bounded support-only user directory.
func ApiBackofficeUserSearch(c *gin.Context) {
	var arg struct {
		Query string `json:"query" form:"query"`
		Limit int    `json:"limit" form:"limit"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}
	if arg.Limit <= 0 || arg.Limit > 100 {
		arg.Limit = 20
	}

	query := util.ToLower(strings.TrimSpace(arg.Query))
	uid, parseErr := strconv.ParseUint(query, 10, 64)
	isUID := parseErr == nil
	users := make([]backofficeUserSummary, 0, arg.Limit)
	for _, user := range Users.Items() {
		if query != "" && !(isUID && user.UID == uid) && !strings.Contains(user.Email, query) && !strings.Contains(util.ToLower(user.Name), query) {
			continue
		}
		users = append(users, backofficeUser(user))
	}
	sort.Slice(users, func(i, j int) bool { return users[i].UID < users[j].UID })
	if len(users) > arg.Limit {
		users = users[:arg.Limit]
	}
	RetOk(c, struct {
		List []backofficeUserSummary `json:"list"`
	}{List: users})
}

// ApiBackofficeUserGet returns the account and club-specific read model without secrets.
func ApiBackofficeUserGet(c *gin.Context) {
	var arg struct {
		UID uint64 `json:"uid" form:"uid" binding:"required"`
		CID uint64 `json:"cid" form:"cid" binding:"required"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}
	user, ok := Users.Get(arg.UID)
	if !ok {
		Ret404(c, AEC_user_is_nobind, ErrNoUser)
		return
	}
	ret := struct {
		backofficeUserSummary
		CID    uint64  `json:"cid"`
		Wallet float64 `json:"wallet"`
		Access AL      `json:"access"`
		MRTP   float64 `json:"mrtp"`
	}{backofficeUserSummary: backofficeUser(user), CID: arg.CID}
	if props, ok := user.props.Get(arg.CID); ok {
		ret.Wallet = props.Wallet
		ret.Access = props.Access
		ret.MRTP = props.MRTP
	}
	RetOk(c, ret)
}

// ApiBackofficeWalletLedger exposes the immutable wallet audit trail to support.
func ApiBackofficeWalletLedger(c *gin.Context) {
	var arg struct {
		UID   uint64 `json:"uid" form:"uid" binding:"required"`
		CID   uint64 `json:"cid" form:"cid" binding:"required"`
		Limit int    `json:"limit" form:"limit"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_prop_get_nobind, err)
		return
	}
	if arg.Limit <= 0 || arg.Limit > 200 {
		arg.Limit = 50
	}
	entries := make([]WalletLedgerEntry, 0, arg.Limit)
	if err := cfg.XormStorage.Where("uid=? AND cid=?", arg.UID, arg.CID).Desc("id").Limit(arg.Limit).Find(&entries); err != nil {
		Ret500(c, AEC_prop_get_nobind, err)
		return
	}
	RetOk(c, struct {
		List []WalletLedgerEntry `json:"list"`
	}{List: entries})
}

// ApiBackofficeSessionList provides the lightweight session context needed for support investigation.
func ApiBackofficeSessionList(c *gin.Context) {
	var arg struct {
		UID   uint64 `json:"uid" form:"uid" binding:"required"`
		CID   uint64 `json:"cid" form:"cid"`
		Alias string `json:"alias" form:"alias"`
		From  string `json:"from" form:"from"`
		To    string `json:"to" form:"to"`
		Limit int    `json:"limit" form:"limit"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_prop_get_nobind, err)
		return
	}
	if arg.Limit <= 0 || arg.Limit > 100 {
		arg.Limit = 20
	}
	query := cfg.XormStorage.Where("uid=?", arg.UID)
	if arg.CID != 0 {
		query = query.And("cid=?", arg.CID)
	}
	if arg.Alias = strings.TrimSpace(arg.Alias); arg.Alias != "" {
		query = query.And("alias=?", arg.Alias)
	}
	if arg.From != "" {
		from, err := time.Parse(time.RFC3339, arg.From)
		if err != nil {
			Ret400(c, AEC_prop_get_nobind, err)
			return
		}
		query = query.And("ctime>=?", from)
	}
	if arg.To != "" {
		to, err := time.Parse(time.RFC3339, arg.To)
		if err != nil {
			Ret400(c, AEC_prop_get_nobind, err)
			return
		}
		query = query.And("ctime<=?", to)
	}
	stories := make([]Story, 0, arg.Limit)
	if err := query.Desc("ctime").Limit(arg.Limit).Find(&stories); err != nil {
		Ret500(c, AEC_prop_get_nobind, err)
		return
	}
	RetOk(c, struct {
		List []Story `json:"list"`
	}{List: stories})
}

// ApiBackofficeUserStatus suspends or restores an account. Existing tokens are
// rejected by the auth middleware as soon as the status is changed.
func ApiBackofficeUserStatus(c *gin.Context) {
	var arg struct {
		UID     uint64 `json:"uid" binding:"required"`
		Blocked bool   `json:"blocked"`
		Reason  string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}
	reason, ok := requireBackofficeReason(c, arg.Reason)
	if !ok {
		return
	}
	user, ok := Users.Get(arg.UID)
	if !ok {
		Ret404(c, AEC_user_is_nobind, ErrNoUser)
		return
	}
	actor, _ := MustAdmin(c, 0)
	if user.UID == actor.UID || user.GAL&ALadmin != 0 {
		Ret403(c, AEC_auth_admin, ErrNoAccess)
		return
	}

	status := user.Status
	action := backofficeActionUserUnblock
	if arg.Blocked {
		status |= UFblocked
		action = backofficeActionUserBlock
	} else {
		status &^= UFblocked
	}
	meta, _ := json.Marshal(map[string]bool{"blocked": arg.Blocked})
	if err := SafeTransaction(cfg.XormStorage, func(session *Session) error {
		if _, err := session.ID(user.UID).Cols("status").Update(&User{Status: status}); err != nil {
			return err
		}
		_, err := session.Insert(&BackofficeAuditEntry{
			ActorUID: actor.UID, TargetUID: user.UID, Action: action, Reason: reason, Meta: string(meta),
		})
		return err
	}); err != nil {
		Ret500(c, AEC_user_rename_update, err)
		return
	}
	user.Status = status
	RetOk(c, struct {
		UID     uint64 `json:"uid"`
		Blocked bool   `json:"blocked"`
	}{UID: user.UID, Blocked: user.Status&UFblocked != 0})
}

// ApiBackofficeUserRoleSet assigns only the explicit backoffice role flags.
// It preserves legacy club permissions and never permits an admin to alter itself.
func ApiBackofficeUserRoleSet(c *gin.Context) {
	var arg struct {
		UID    uint64         `json:"uid" binding:"required"`
		Role   BackofficeRole `json:"role" binding:"required"`
		Reason string         `json:"reason" binding:"required"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}
	reason, ok := requireBackofficeReason(c, arg.Reason)
	if !ok {
		return
	}
	if arg.Role != BackofficeRoleNone && arg.Role != BackofficeRoleSupport && arg.Role != BackofficeRoleOperator {
		Ret400(c, AEC_user_is_nobind, ErrNoAccess)
		return
	}
	user, ok := Users.Get(arg.UID)
	if !ok {
		Ret404(c, AEC_user_is_nobind, ErrNoUser)
		return
	}
	actor, _ := MustAdmin(c, 0)
	if user.UID == actor.UID || user.GAL&ALadmin != 0 {
		Ret403(c, AEC_auth_admin, ErrNoAccess)
		return
	}
	gal := user.GAL &^ (ALsupport | ALoperator)
	switch arg.Role {
	case BackofficeRoleSupport:
		gal |= ALsupport
	case BackofficeRoleOperator:
		gal |= ALoperator
	}
	meta, _ := json.Marshal(map[string]BackofficeRole{"role": arg.Role})
	if err := SafeTransaction(cfg.XormStorage, func(session *Session) error {
		if _, err := session.ID(user.UID).Cols("gal").Update(&User{GAL: gal}); err != nil {
			return err
		}
		_, err := session.Insert(&BackofficeAuditEntry{
			ActorUID: actor.UID, TargetUID: user.UID, Action: "backoffice_role", Reason: reason, Meta: string(meta),
		})
		return err
	}); err != nil {
		Ret500(c, AEC_user_rename_update, err)
		return
	}
	user.GAL = gal
	RetOk(c, struct {
		UID  uint64         `json:"uid"`
		Role BackofficeRole `json:"role"`
	}{UID: user.UID, Role: user.GAL.BackofficeRole()})
}

func apiBackofficeWalletChange(c *gin.Context, op WalletLedgerOp, action string) {
	var arg struct {
		UID    uint64  `json:"uid" binding:"required"`
		CID    uint64  `json:"cid" binding:"required"`
		Amount float64 `json:"amount" binding:"required"`
		Reason string  `json:"reason" binding:"required"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_prop_walletadd_nobind, err)
		return
	}
	if arg.Amount == 0 || arg.Amount > cfg.Cfg.AdjunctLimit || arg.Amount < -cfg.Cfg.AdjunctLimit {
		Ret400(c, AEC_prop_walletadd_limit, ErrTooBig)
		return
	}
	reason, ok := requireBackofficeReason(c, arg.Reason)
	if !ok {
		return
	}
	user, ok := Users.Get(arg.UID)
	if !ok {
		Ret404(c, AEC_prop_walletadd_nouser, ErrNoUser)
		return
	}
	props, ok := user.props.Get(arg.CID)
	if !ok {
		Ret404(c, AEC_prop_walletadd_noprops, ErrNoProps)
		return
	}
	actor, _ := MustAdmin(c, 0)
	entry := &WalletLedgerEntry{CID: arg.CID, UID: user.UID, ActorUID: actor.UID, Op: op, Amount: arg.Amount}
	audit := &BackofficeAuditEntry{ActorUID: actor.UID, TargetUID: user.UID, CID: arg.CID, Action: action, Reason: reason}
	if err := ApplyBackofficeWalletOperation(cfg.XormStorage, entry, audit); err != nil {
		if err == ErrNoMoney {
			Ret403(c, AEC_prop_walletadd_nomoney, err)
			return
		}
		Ret500(c, AEC_prop_walletadd_sql, err)
		return
	}
	props.Wallet = entry.BalanceAfter
	RetOk(c, struct {
		Wallet   float64 `json:"wallet"`
		LedgerID uint64  `json:"ledger_id"`
		AuditID  uint64  `json:"audit_id"`
	}{Wallet: props.Wallet, LedgerID: entry.ID, AuditID: audit.ID})
}

func ApiBackofficeWalletAdjust(c *gin.Context) {
	apiBackofficeWalletChange(c, WalletLedgerOpAdjustment, backofficeActionAdjustment)
}

func ApiBackofficeWalletBonus(c *gin.Context) {
	apiBackofficeWalletChange(c, WalletLedgerOpBonus, backofficeActionBonus)
}

func ApiBackofficeAuditList(c *gin.Context) {
	var arg struct {
		UID   uint64 `json:"uid" binding:"required"`
		Limit int    `json:"limit"`
	}
	if err := c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}
	if arg.Limit <= 0 || arg.Limit > 200 {
		arg.Limit = 50
	}
	entries := make([]BackofficeAuditEntry, 0, arg.Limit)
	if err := cfg.XormStorage.Where("target_uid=?", arg.UID).Desc("id").Limit(arg.Limit).Find(&entries); err != nil {
		Ret500(c, AEC_prop_get_nobind, err)
		return
	}
	RetOk(c, struct {
		List []BackofficeAuditEntry `json:"list"`
	}{List: entries})
}
