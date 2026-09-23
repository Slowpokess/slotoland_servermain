package api_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	"github.com/slotopol/server/game/slot"
)

func TestSlotSessionStateReportsPendingWinAndCollect(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	status, ret = postStatus(t, r, "/game/new", token, gin.H{
		"cid":   1,
		"uid":   3,
		"alias": "Novomatic / Dolphins Pearl",
	})
	if status != http.StatusOK {
		t.Fatalf("game/new failed with status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateOpened) {
		t.Fatalf("new scene must start as opened, got %+v", ret)
	}
	gid := uint64(ret["gid"].(float64))

	scene, ok := api.Scenes.Get(gid)
	if !ok {
		t.Fatalf("scene %d not found", gid)
	}
	scene.Lock()
	game, ok := scene.Game.(slot.SlotGame)
	if !ok {
		scene.Unlock()
		t.Fatal("scene game is not a slot")
	}
	if err := game.SetGain(10); err != nil {
		scene.Unlock()
		t.Fatal(err)
	}
	scene.Unlock()

	status, ret = postStatus(t, r, "/game/info", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("game/info failed with status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStatePendingWin) {
		t.Fatalf("scene with gain must report pending_win, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/slot/collect", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("slot/collect failed with status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateOpened) && ret["state"] != string(api.SceneStateActive) {
		t.Fatalf("collect must clear pending win state, got %+v", ret)
	}
	if ret["gain"] != float64(0) {
		t.Fatalf("collect must clear pending gain, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/slot/collect", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("repeated slot/collect must be idempotent, got status %d: %+v", status, ret)
	}
	if ret["gain"] != float64(0) {
		t.Fatalf("repeated collect must keep pending gain cleared, got %+v", ret)
	}
	if ret["state"] == string(api.SceneStatePendingWin) {
		t.Fatalf("repeated collect must not restore pending win state, got %+v", ret)
	}
}

func TestClosedSessionBlocksGameplayActions(t *testing.T) {
	r := setupAuthRouter(t)

	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "player@example.org",
		"secret": "iVI05M",
	})
	if status != http.StatusOK {
		t.Fatalf("signin failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	status, ret = postStatus(t, r, "/game/new", token, gin.H{
		"cid":   1,
		"uid":   3,
		"alias": "Novomatic / Dolphins Pearl",
	})
	if status != http.StatusOK {
		t.Fatalf("game/new failed with status %d: %+v", status, ret)
	}
	gid := uint64(ret["gid"].(float64))

	status, ret = postStatus(t, r, "/game/close", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("game/close failed with status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateClosed) {
		t.Fatalf("closed scene must report closed state, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/game/close", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("repeated game/close must be idempotent, got status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateClosed) {
		t.Fatalf("repeated close must keep closed state, got %+v", ret)
	}

	api.Scenes.Delete(gid)
	scene, err := api.GetScene(gid)
	if err != nil {
		t.Fatal(err)
	}
	if scene.State() != api.SceneStateClosed {
		t.Fatalf("closed state must be restored from storage, got %s", scene.State())
	}

	status, ret = postStatus(t, r, "/game/join", token, gin.H{
		"cid": 1,
		"uid": 3,
		"gid": gid,
	})
	if status != http.StatusOK {
		t.Fatalf("game/join must expose closed scene, got status %d: %+v", status, ret)
	}
	if ret["state"] != string(api.SceneStateClosed) {
		t.Fatalf("join on closed scene must report closed state, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/slot/spin", token, gin.H{
		"gid": gid,
	})
	if status != http.StatusForbidden {
		t.Fatalf("spin on closed scene must be forbidden, got status %d: %+v", status, ret)
	}
	if ret["what"] != api.ErrClosed.Error() {
		t.Fatalf("unexpected closed scene error: %+v", ret)
	}
}

func TestCleanupClosedScenesRemovesOnlyExpiredClosedScenes(t *testing.T) {
	setupAuthRouter(t)

	now := time.Now()
	expired := &api.Scene{
		Story: api.Story{GID: 9001, CID: 1, UID: 3, Closed: true, XTime: now.Add(-2 * time.Hour)},
	}
	fresh := &api.Scene{
		Story: api.Story{GID: 9002, CID: 1, UID: 3, Closed: true, XTime: now.Add(-5 * time.Minute)},
	}
	open := &api.Scene{
		Story: api.Story{GID: 9003, CID: 1, UID: 3},
	}

	api.Scenes.Set(expired.GID, expired)
	api.Scenes.Set(fresh.GID, fresh)
	api.Scenes.Set(open.GID, open)

	removed := api.CleanupClosedScenes(time.Hour, now)
	if removed != 1 {
		t.Fatalf("expected one expired closed scene to be removed, got %d", removed)
	}
	if _, ok := api.Scenes.Get(expired.GID); ok {
		t.Fatal("expired closed scene must be removed")
	}
	if _, ok := api.Scenes.Get(fresh.GID); !ok {
		t.Fatal("fresh closed scene must stay")
	}
	if _, ok := api.Scenes.Get(open.GID); !ok {
		t.Fatal("open scene must stay")
	}
}
