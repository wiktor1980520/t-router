package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

func TestRequestIDMiddleware_SetsAndPreservesHeader(t *testing.T) {
	setupTestDB(t)
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(RequestIDMiddleware())
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"request_id": c.GetString("request_id")})
	})

	w1 := httptest.NewRecorder()
	req1 := httptest.NewRequest("GET", "/ping", nil)
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w1.Code)
	}
	if strings.TrimSpace(w1.Header().Get("X-Request-ID")) == "" {
		t.Fatalf("expected X-Request-ID header")
	}

	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest("GET", "/ping", nil)
	req2.Header.Set("X-Request-ID", "req-custom-1")
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w2.Code)
	}
	if w2.Header().Get("X-Request-ID") != "req-custom-1" {
		t.Fatalf("expected X-Request-ID preserved, got %q", w2.Header().Get("X-Request-ID"))
	}
}

func TestAuthMiddleware_MigratesLegacyApiKeyHash(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	user := models.User{Email: "u@example.com", PasswordHash: "x", Balance: 1, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	raw := "sk-legacy-1"
	apiKey := models.ApiKey{UserID: user.ID, KeyHash: raw, KeyPrefix: "sk-lega", Label: "k", IsActive: true}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("create key: %v", err)
	}

	r := gin.New()
	r.GET("/v1/ping", AuthMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/v1/ping", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%q", w.Code, w.Body.String())
	}

	var saved models.ApiKey
	if err := db.First(&saved, "id = ?", apiKey.ID).Error; err != nil {
		t.Fatalf("fetch key: %v", err)
	}
	if !strings.HasPrefix(saved.KeyHash, "sha256:") {
		t.Fatalf("expected sha256 keyhash, got %q", saved.KeyHash)
	}
	if saved.KeyHash == raw {
		t.Fatalf("expected keyhash to change from raw")
	}
}

func TestAuthMiddleware_RejectsExpiredKey(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	user := models.User{Email: "u2@example.com", PasswordHash: "x", Balance: 1, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	raw := "sk-expired-1"
	exp := time.Now().Add(-time.Hour)
	apiKey := models.ApiKey{UserID: user.ID, KeyHash: hashApiKey(raw), KeyPrefix: "sk-expi", Label: "k", IsActive: true, ExpiresAt: &exp}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("create key: %v", err)
	}

	r := gin.New()
	r.GET("/v1/ping", AuthMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/v1/ping", nil)
	req.Header.Set("Authorization", "Bearer "+raw)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%q", w.Code, w.Body.String())
	}
}

func TestAuthMiddleware_RateLimit(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	user := models.User{Email: "u3@example.com", PasswordHash: "x", Balance: 1, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	raw := "sk-rl-1"
	apiKey := models.ApiKey{UserID: user.ID, KeyHash: hashApiKey(raw), KeyPrefix: "sk-rl-1", Label: "k", IsActive: true, RateLimit: 1}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("create key: %v", err)
	}

	r := gin.New()
	r.GET("/v1/ping", AuthMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req1 := httptest.NewRequest("GET", "/v1/ping", nil)
	req1.Header.Set("Authorization", "Bearer "+raw)
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w1.Code)
	}

	req2 := httptest.NewRequest("GET", "/v1/ping", nil)
	req2.Header.Set("Authorization", "Bearer "+raw)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d body=%q", w2.Code, w2.Body.String())
	}
}

func TestJWTMiddleware_DisabledUserForbidden(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	user := models.User{Email: "u4@example.com", PasswordHash: "x", Balance: 1, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := db.Model(&models.User{}).Where("id = ?", user.ID).Update("is_active", false).Error; err != nil {
		t.Fatalf("disable user: %v", err)
	}

	token, err := GenerateToken(user.ID)
	if err != nil {
		t.Fatalf("gen token: %v", err)
	}

	r := gin.New()
	r.GET("/api/me", JWTMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%q", w.Code, w.Body.String())
	}
}

func TestAuthMiddleware_OrgBudgetExceeded(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	user := models.User{Email: "org@example.com", PasswordHash: "x", Balance: 1, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	org := models.Organization{ID: "org-1", Name: "Org", OwnerID: user.ID, MonthlyBudget: 1, IsActive: true}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	member := models.OrgMember{OrgID: org.ID, UserID: user.ID, Role: "owner"}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("create member: %v", err)
	}
	usage := models.OrgUsage{OrgID: org.ID, Period: time.Now().Format("2006-01"), Spent: 1}
	if err := db.Create(&usage).Error; err != nil {
		t.Fatalf("create usage: %v", err)
	}

	raw := "sk-org-1"
	apiKey := models.ApiKey{UserID: user.ID, KeyHash: hashApiKey(raw), KeyPrefix: "sk-org", Label: "k", IsActive: true, OrgID: &org.ID}
	if err := db.Create(&apiKey).Error; err != nil {
		t.Fatalf("create key: %v", err)
	}

	r := gin.New()
	r.POST("/v1/chat/completions", AuthMiddleware(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"x","messages":[{"role":"user","content":"hi"}]}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+raw)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402, got %d body=%q", w.Code, w.Body.String())
	}
}
