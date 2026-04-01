package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

func TestAdminMetricsOverviewHandler_BasicAggregation(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	u1 := models.User{Email: "a@example.com", PasswordHash: "x", Balance: 0, IsActive: true}
	u2 := models.User{Email: "b@example.com", PasswordHash: "x", Balance: 0, IsActive: true}
	if err := db.Create(&u1).Error; err != nil {
		t.Fatalf("create u1: %v", err)
	}
	if err := db.Create(&u2).Error; err != nil {
		t.Fatalf("create u2: %v", err)
	}

	if err := db.Create(&models.Transaction{UserID: u1.ID, Type: "recharge", Amount: 10, Status: "completed", ReferenceID: "r1"}).Error; err != nil {
		t.Fatalf("create tx: %v", err)
	}

	now := time.Now()
	if err := db.Create(&models.AuditLog{
		RequestID:        "req-1",
		UserID:           u1.ID,
		Model:            "m1",
		ProviderID:       1,
		PromptTokens:     10,
		CompletionTokens: 5,
		TotalCost:        2,
		ProviderCost:     1,
		LatencyMS:        100,
		StatusCode:       http.StatusOK,
		ClientIP:         "127.0.0.1",
		CreatedAt:        now,
	}).Error; err != nil {
		t.Fatalf("create audit: %v", err)
	}

	r := gin.New()
	r.GET("/api/admin/metrics/overview", AdminMetricsOverviewHandler)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/admin/metrics/overview?days=7", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%q", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if int(resp["total_users"].(float64)) != 2 {
		t.Fatalf("expected total_users=2, got %v", resp["total_users"])
	}
	if int(resp["calls"].(float64)) != 1 {
		t.Fatalf("expected calls=1, got %v", resp["calls"])
	}
	if resp["gross_profit"].(float64) != 1 {
		t.Fatalf("expected gross_profit=1, got %v", resp["gross_profit"])
	}
}

func TestAdminInvitationMetricsHandler_ByCode(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	if err := db.Create(&models.InvitationCode{Code: "ABCDEF12", Remark: "r"}).Error; err != nil {
		t.Fatalf("create code: %v", err)
	}

	u := models.User{Email: "c@example.com", PasswordHash: "x", Balance: 0, IsActive: true, InvitationCode: "ABCDEF12"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	if err := db.Create(&models.AuditLog{
		RequestID:        "req-2",
		UserID:           u.ID,
		Model:            "m1",
		ProviderID:       1,
		PromptTokens:     1,
		CompletionTokens: 1,
		TotalCost:        1,
		ProviderCost:     0.5,
		LatencyMS:        10,
		StatusCode:       http.StatusOK,
		ClientIP:         "127.0.0.1",
	}).Error; err != nil {
		t.Fatalf("create audit: %v", err)
	}
	if err := db.Create(&models.Transaction{UserID: u.ID, Type: "recharge", Amount: 5, Status: "completed", ReferenceID: "r2"}).Error; err != nil {
		t.Fatalf("create tx: %v", err)
	}

	r := gin.New()
	r.GET("/api/admin/metrics/invitations", AdminInvitationMetricsHandler)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/admin/metrics/invitations?days=30", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%q", w.Code, w.Body.String())
	}

	var resp struct {
		Items []struct {
			Code           string  `json:"code"`
			Registrations  int64   `json:"registrations"`
			ActivatedUsers int64   `json:"activated_users"`
			RechargedUsers int64   `json:"recharged_users"`
			RechargeAmount float64 `json:"recharge_amount"`
		} `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	found := false
	for _, it := range resp.Items {
		if it.Code == "ABCDEF12" {
			found = true
			if it.Registrations != 1 || it.ActivatedUsers != 1 || it.RechargedUsers != 1 || it.RechargeAmount != 5 {
				t.Fatalf("unexpected item: %+v", it)
			}
		}
	}
	if !found {
		t.Fatalf("expected code item")
	}
}
