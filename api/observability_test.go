package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestObservabilityEndpoints(t *testing.T) {
	r := setupAuthRouter(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("Accept", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("healthz failed with status %d", w.Code)
	}
	if rid := w.Header().Get("X-Request-ID"); rid == "" {
		t.Fatal("healthz must return X-Request-ID header")
	}
	var health gin.H
	if err := json.Unmarshal(w.Body.Bytes(), &health); err != nil {
		t.Fatal(err)
	}
	if health["status"] != "ok" {
		t.Fatalf("unexpected healthz response: %+v", health)
	}

	status, ret := getStatus(t, r, "/readyz", "")
	if status != http.StatusOK {
		t.Fatalf("readyz failed with status %d: %+v", status, ret)
	}
	if ret["status"] != "ready" {
		t.Fatalf("unexpected readyz response: %+v", ret)
	}
	checks, ok := ret["checks"].(map[string]any)
	if !ok || checks["club_db"] != "ok" || checks["spin_db"] != "ok" {
		t.Fatalf("readyz must report healthy checks, got %+v", ret)
	}

	status, ret = postStatus(t, r, "/signin", "", gin.H{
		"email":  "admin@example.org",
		"secret": "0YBoaT",
	})
	if status != http.StatusOK {
		t.Fatalf("admin signin failed with status %d: %+v", status, ret)
	}
	adminToken := ret["access"].(string)

	status, ret = getStatus(t, r, "/metrics", adminToken)
	if status != http.StatusOK {
		t.Fatalf("metrics failed with status %d: %+v", status, ret)
	}
	if ret["goroutines"] == nil || ret["club_db"] == nil || ret["spin_db"] == nil {
		t.Fatalf("metrics must include runtime and db stats, got %+v", ret)
	}
}
