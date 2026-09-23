package api

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	xorm "xorm.io/xorm"

	cfg "github.com/slotopol/server/config"
)

const requestIDHeader = "X-Request-ID"
const requestIDKey = "request_id"

func newRequestID() string {
	var buf [12]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf[:])
}

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		var rid = c.GetHeader(requestIDHeader)
		if rid == "" {
			rid = newRequestID()
		}
		c.Set(requestIDKey, rid)
		c.Writer.Header().Set(requestIDHeader, rid)
		c.Next()
	}
}

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		var started = time.Now()
		c.Next()

		var rid = c.GetString(requestIDKey)
		if rid == "" {
			rid = c.Writer.Header().Get(requestIDHeader)
		}
		var path = c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		var uid uint64
		if uv, ok := c.Get(userKey); ok {
			if user, ok := uv.(*User); ok && user != nil {
				uid = user.UID
			}
		}
		var level = "info"
		if c.Writer.Status() >= http.StatusInternalServerError {
			level = "error"
		}
		var msg string
		if last := c.Errors.Last(); last != nil {
			msg = last.Err.Error()
		}
		log.Printf("level=%s request_id=%s method=%s path=%s status=%d latency_ms=%d client_ip=%s user_id=%d error=%q", level, rid, c.Request.Method, path, c.Writer.Status(), time.Since(started)/time.Millisecond, c.ClientIP(), uid, msg)
	}
}

func ApiHealth(c *gin.Context) {
	RetOk(c, gin.H{
		"status":    "ok",
		"buildvers": cfg.BuildVers,
		"started":   starttime.Format(time.RFC3339),
	})
}

func readinessCheck(engine *xorm.Engine) string {
	if engine == nil {
		return "down"
	}
	if err := engine.Ping(); err != nil {
		return "down"
	}
	return "ok"
}

func ApiReady(c *gin.Context) {
	var checks = gin.H{
		"club_db": readinessCheck(cfg.XormStorage),
		"spin_db": readinessCheck(cfg.XormSpinlog),
	}
	var status = "ready"
	for _, v := range checks {
		if v != "ok" {
			status = "not_ready"
			break
		}
	}
	var code = http.StatusOK
	if status != "ready" {
		code = http.StatusServiceUnavailable
	}
	Negotiate(c, code, gin.H{
		"status": status,
		"checks": checks,
	})
}

func engineStats(engine *xorm.Engine) gin.H {
	if engine == nil {
		return gin.H{
			"status": "down",
		}
	}
	var s = engine.DB().Stats()
	return gin.H{
		"status":           "ok",
		"open_connections": s.OpenConnections,
		"in_use":           s.InUse,
		"idle":             s.Idle,
		"wait_count":       s.WaitCount,
		"wait_duration":    s.WaitDuration.String(),
		"max_idle_closed":  s.MaxIdleClosed,
		"max_idle_time":    s.MaxIdleTimeClosed,
		"max_lifetime":     s.MaxLifetimeClosed,
	}
}

func ApiMetrics(c *gin.Context) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	RetOk(c, gin.H{
		"status":      "ok",
		"running_ms":  time.Since(starttime) / time.Millisecond,
		"goroutines":  runtime.NumGoroutine(),
		"heap_alloc":  mem.HeapAlloc,
		"heap_sys":    mem.HeapSys,
		"total_alloc": mem.TotalAlloc,
		"next_gc":     mem.NextGC,
		"num_gc":      mem.NumGC,
		"pause_ns":    mem.PauseTotalNs,
		"gc_fraction": mem.GCCPUFraction,
		"club_db":     engineStats(cfg.XormStorage),
		"spin_db":     engineStats(cfg.XormSpinlog),
	})
}
