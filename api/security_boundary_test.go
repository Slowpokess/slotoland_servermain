package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/slotopol/server/api"
	cfg "github.com/slotopol/server/config"
)

func TestAuthDoesNotAcceptTokenFromQueryOrCookie(t *testing.T) {
	r := setupAuthRouter(t)
	status, ret := postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin sign-in failed with status %d: %+v", status, ret)
	}
	token := ret["access"].(string)

	for name, request := range map[string]func(*http.Request){
		"query":  func(req *http.Request) { req.URL.RawQuery = "token=" + token },
		"cookie": func(req *http.Request) { req.AddCookie(&http.Cookie{Name: "token", Value: token}) },
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/backoffice/me", nil)
			req.Header.Set("Accept", "application/json")
			request(req)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != http.StatusUnauthorized {
				t.Fatalf("token from %s was accepted with status %d", name, w.Code)
			}
		})
	}
}

func TestDevelopmentCORSAllowsOnlyLocalViteOrigins(t *testing.T) {
	previous := cfg.DevMode
	cfg.DevMode = true
	t.Cleanup(func() { cfg.DevMode = previous })

	gin.SetMode(gin.TestMode)
	r := gin.New()
	api.SetupRouter(r)

	allowed := httptest.NewRequest(http.MethodOptions, "/ping", nil)
	allowed.Header.Set("Origin", "http://localhost:5173")
	allowedResponse := httptest.NewRecorder()
	r.ServeHTTP(allowedResponse, allowed)
	if allowedResponse.Code != http.StatusNoContent {
		t.Fatalf("allowed development origin returned status %d", allowedResponse.Code)
	}
	if got := allowedResponse.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("unexpected allowed origin header %q", got)
	}

	denied := httptest.NewRequest(http.MethodOptions, "/ping", nil)
	denied.Header.Set("Origin", "https://attacker.example")
	deniedResponse := httptest.NewRecorder()
	r.ServeHTTP(deniedResponse, denied)
	if deniedResponse.Code != http.StatusForbidden {
		t.Fatalf("untrusted development origin returned status %d", deniedResponse.Code)
	}
	if got := deniedResponse.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("untrusted origin received CORS permission %q", got)
	}
}
