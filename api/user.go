package api

import (
	"encoding/xml"

	"github.com/gin-gonic/gin"
	cfg "github.com/slotopol/server/config"
	"github.com/slotopol/server/util"
)

const (
	sqllock = "UPDATE club SET `lock`=`lock`+?, `utime`=CURRENT_TIMESTAMP WHERE `cid`=?"
)

func ApiUserIs(c *gin.Context) {
	var err error
	type item struct {
		XMLName xml.Name `json:"-" yaml:"-" xml:"user"`
		UID     uint64   `json:"uid,omitempty" yaml:"uid,omitempty" xml:"uid,attr,omitempty"`
		Email   string   `json:"email,omitempty" yaml:"email,omitempty" xml:"email,attr,omitempty"`
		Name    string   `json:"name,omitempty" yaml:"name,omitempty" xml:"name,attr,omitempty"`
	}
	var arg struct {
		XMLName xml.Name `json:"-" yaml:"-" xml:"arg"`
		List    []item   `json:"list" yaml:"list" xml:"list>user" form:"list" binding:"required"`
	}
	var ret struct {
		XMLName xml.Name `json:"-" yaml:"-" xml:"ret"`
		List    []item   `json:"list" yaml:"list" xml:"list>user"`
	}

	if err = c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_is_nobind, err)
		return
	}

	ret.List = make([]item, len(arg.List))
	for i, ai := range arg.List {
		var ri item
		if ai.UID != 0 {
			if user, ok := Users.Get(ai.UID); ok {
				ri.UID = user.UID
				ri.Email = user.Email
				ri.Name = user.Name
			}
		} else {
			var email = util.ToLower(ai.Email)
			for _, user := range Users.Items() {
				if user.Email == email {
					ri.UID = user.UID
					ri.Email = user.Email
					ri.Name = user.Name
					break
				}
			}
		}
		ret.List[i] = ri
	}

	RetOk(c, ret)
}

// Changes 'Name' of given user.
func ApiUserRename(c *gin.Context) {
	var err error
	var ok bool
	var arg struct {
		XMLName xml.Name `json:"-" yaml:"-" xml:"arg"`
		UID     uint64   `json:"uid" yaml:"uid" xml:"uid,attr" form:"uid" binding:"required"`
		Name    string   `json:"name" yaml:"name" xml:"name" form:"name" binding:"required"`
	}

	if err = c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_rename_nobind, err)
		return
	}

	var user *User
	if user, ok = Users.Get(arg.UID); !ok {
		Ret404(c, AEC_user_rename_nouser, ErrNoUser)
		return
	}

	var admin, al = MustAdmin(c, 0)
	if admin != user && al&ALbooker == 0 {
		Ret403(c, AEC_user_rename_noaccess, ErrNoAccess)
		return
	}

	if _, err = cfg.XormStorage.ID(user.UID).Cols("name").Update(&User{Name: arg.Name}); err != nil {
		Ret500(c, AEC_user_rename_update, err)
		return
	}
	user.Name = arg.Name

	Ret204(c)
}

func ApiUserSecret(c *gin.Context) {
	var err error
	var ok bool
	var arg struct {
		XMLName   xml.Name `json:"-" yaml:"-" xml:"arg"`
		UID       uint64   `json:"uid" yaml:"uid" xml:"uid,attr" form:"uid" binding:"required"`
		OldSecret string   `json:"oldsecret" yaml:"oldsecret" xml:"oldsecret" form:"oldsecret" binding:"required"`
		NewSecret string   `json:"newsecret" yaml:"newsecret" xml:"newsecret" form:"newsecret" binding:"required"`
	}

	if err = c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_secret_nobind, err)
		return
	}
	if len(arg.NewSecret) < 6 {
		Ret400(c, AEC_user_secret_smallsec, ErrSmallKey)
		return
	}

	var user *User
	if user, ok = Users.Get(arg.UID); !ok {
		Ret404(c, AEC_user_secret_nouser, ErrNoUser)
		return
	}

	var admin, al = MustAdmin(c, 0)
	if admin != user && al&(ALbooker+ALadmin) == 0 {
		Ret403(c, AEC_user_secret_noaccess, ErrNoAccess)
		return
	}

	if !VerifySecret(user.Secret, arg.OldSecret) && al&ALadmin == 0 {
		Ret403(c, AEC_user_secret_notequ, ErrNotConf)
		return
	}

	var hashed string
	if hashed, err = HashSecret(arg.NewSecret); err != nil {
		Ret500(c, AEC_user_secret_update, err)
		return
	}
	if _, err = cfg.XormStorage.ID(user.UID).Cols("secret").Update(&User{Secret: hashed}); err != nil {
		Ret500(c, AEC_user_secret_update, err)
		return
	}
	user.Secret = hashed

	Ret204(c)
}

// Anonymizes the registration, removes active linked records, preserves the
// wallet ledger, and moves all remaining wallet coins to club deposits.
func ApiUserDelete(c *gin.Context) {
	var err error
	var ok bool
	var arg struct {
		XMLName xml.Name `json:"-" yaml:"-" xml:"arg"`
		UID     uint64   `json:"uid" yaml:"uid" xml:"uid,attr" form:"uid" binding:"required"`
		Secret  string   `json:"secret" yaml:"secret" xml:"secret" form:"secret"`
	}
	var ret struct {
		XMLName xml.Name           `json:"-" yaml:"-" xml:"ret"`
		Wallets map[uint64]float64 `json:"wallets" yaml:"wallets" xml:"wallets"`
	}
	ret.Wallets = map[uint64]float64{}

	if err = c.ShouldBind(&arg); err != nil {
		Ret400(c, AEC_user_delete_nobind, err)
		return
	}

	var user *User
	if user, ok = Users.Get(arg.UID); !ok {
		Ret404(c, AEC_user_delete_nouser, ErrNoUser)
		return
	}

	var admin, al = MustAdmin(c, 0)
	if admin != user && al&ALbooker == 0 {
		Ret403(c, AEC_user_delete_noaccess, ErrNoAccess)
		return
	}

	if !VerifySecret(user.Secret, arg.Secret) && al&ALadmin == 0 {
		Ret403(c, AEC_user_delete_nosecret, ErrNotConf)
		return
	}

	// write gain and total bet as transaction
	if err = SafeTransaction(cfg.XormStorage, func(session *Session) (err error) {
		for cid, props := range user.props.Items() {
			if props.Wallet != 0 {
				if _, err = session.Exec(sqllock, props.Wallet, cid); err != nil {
					Ret500(c, AEC_user_delete_sqllock, err)
					return
				}
			}
		}

		if err = AnonymizeUserRecords(session, arg.UID); err != nil {
			Ret500(c, AEC_user_delete_sqluser, err)
			return
		}

		return
	}); err != nil {
		return
	}

	Users.Delete(arg.UID)
	for cid, props := range user.props.Items() {
		ret.Wallets[cid] = props.Wallet
		if club, ok := Clubs.Get(cid); ok && props.Wallet != 0 {
			club.AddDeposit(props.Wallet)
			ret.Wallets[cid] = props.Wallet
		}
	}
	DeleteUserScenesFromMemory(arg.UID)

	RetOk(c, ret)
}
