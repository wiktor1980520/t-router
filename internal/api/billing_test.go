package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:trouter_test_%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.ApiKey{},
		&models.Transaction{},
		&models.PaymentOrder{},
		&models.SubscriptionPlan{},
		&models.UserSubscription{},
		&models.AuditLog{},
		&models.Organization{},
		&models.OrgMember{},
		&models.OrgUsage{},
		&models.Model{},
		&models.InvitationCode{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	config.DB = db
	return db
}

func TestProcessBillingAndAudit_InsufficientBalance_NoNegative(t *testing.T) {
	db := setupTestDB(t)

	user := models.User{Email: "u@example.com", PasswordHash: "x", Balance: 0.50, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	model := models.Model{ID: "gpt-test", Name: "gpt-test", RetailPriceInput: 1, RetailPriceOutput: 0, IsActive: true}
	if err := db.Create(&model).Error; err != nil {
		t.Fatalf("create model: %v", err)
	}
	route := &models.ModelRoute{ProviderID: 1, CostInput: 0, CostOutput: 0}

	requestID := "req-1"
	processBillingAndAudit(user.ID, "", requestID, model.ID, route, 1000000, 0, time.Now().Add(-time.Second), "127.0.0.1")

	var after models.User
	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != user.Balance {
		t.Fatalf("expected balance unchanged %.2f, got %.2f", user.Balance, after.Balance)
	}

	var tx models.Transaction
	if err := db.First(&tx, "type = ? AND reference_id = ?", "consumption", requestID).Error; err != nil {
		t.Fatalf("fetch transaction: %v", err)
	}
	if tx.Status != "failed" {
		t.Fatalf("expected transaction failed, got %s", tx.Status)
	}

	var audit models.AuditLog
	if err := db.First(&audit, "request_id = ?", requestID).Error; err != nil {
		t.Fatalf("fetch audit: %v", err)
	}
	if audit.StatusCode != http.StatusPaymentRequired {
		t.Fatalf("expected audit 402, got %d", audit.StatusCode)
	}
	if audit.TotalCost != 0 {
		t.Fatalf("expected paid cost 0, got %f", audit.TotalCost)
	}

	processBillingAndAudit(user.ID, "", requestID, model.ID, route, 1000000, 0, time.Now().Add(-time.Second), "127.0.0.1")

	var txCount int64
	db.Model(&models.Transaction{}).Where("type = ? AND reference_id = ?", "consumption", requestID).Count(&txCount)
	if txCount != 1 {
		t.Fatalf("expected 1 transaction, got %d", txCount)
	}
}

func TestProcessBillingAndAudit_SufficientBalance_DeductsOnce(t *testing.T) {
	db := setupTestDB(t)

	user := models.User{Email: "u2@example.com", PasswordHash: "x", Balance: 2.00, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	model := models.Model{ID: "gpt-test", Name: "gpt-test", RetailPriceInput: 1, RetailPriceOutput: 0, IsActive: true}
	if err := db.Create(&model).Error; err != nil {
		t.Fatalf("create model: %v", err)
	}
	route := &models.ModelRoute{ProviderID: 1, CostInput: 0, CostOutput: 0}

	requestID := "req-2"
	processBillingAndAudit(user.ID, "", requestID, model.ID, route, 1000000, 0, time.Now().Add(-time.Second), "127.0.0.1")

	var after models.User
	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 1.00 {
		t.Fatalf("expected balance 1.00, got %.2f", after.Balance)
	}

	processBillingAndAudit(user.ID, "", requestID, model.ID, route, 1000000, 0, time.Now().Add(-time.Second), "127.0.0.1")
	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 1.00 {
		t.Fatalf("expected balance unchanged 1.00, got %.2f", after.Balance)
	}
}

func TestProcessBillingAndAudit_SubscriptionCoversCost_NoBalanceDeduction(t *testing.T) {
	db := setupTestDB(t)

	user := models.User{Email: "sub@example.com", PasswordHash: "x", Balance: 0, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	model := models.Model{ID: "gpt-sub", Name: "gpt-sub", RetailPriceInput: 1, RetailPriceOutput: 0, IsActive: true}
	if err := db.Create(&model).Error; err != nil {
		t.Fatalf("create model: %v", err)
	}
	plan := models.SubscriptionPlan{Name: "Basic", MonthlyPrice: 0, MonthlyQuota: 10, AllowedModels: models.ModelList([]string{model.ID}), IsActive: true}
	if err := db.Create(&plan).Error; err != nil {
		t.Fatalf("create plan: %v", err)
	}
	now := time.Now()
	sub := models.UserSubscription{
		UserID:         user.ID,
		PlanID:         plan.ID,
		Status:         "active",
		StartAt:        now.Add(-time.Hour),
		EndAt:          now.Add(time.Hour),
		RemainingQuota: 2,
		AutoRenew:      false,
	}
	if err := db.Create(&sub).Error; err != nil {
		t.Fatalf("create sub: %v", err)
	}

	route := &models.ModelRoute{ProviderID: 1, CostInput: 0, CostOutput: 0}
	requestID := "req-sub-1"
	processBillingAndAudit(user.ID, "", requestID, model.ID, route, 1000000, 0, time.Now().Add(-time.Second), "127.0.0.1")

	var after models.User
	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 0 {
		t.Fatalf("expected balance 0, got %.2f", after.Balance)
	}

	var afterSub models.UserSubscription
	if err := db.Preload("Plan").First(&afterSub, "id = ?", sub.ID).Error; err != nil {
		t.Fatalf("fetch sub: %v", err)
	}
	if afterSub.RemainingQuota != 1 {
		t.Fatalf("expected remaining_quota 1, got %.2f", afterSub.RemainingQuota)
	}

	var tx models.Transaction
	if err := db.First(&tx, "type = ? AND reference_id = ?", "consumption", requestID).Error; err != nil {
		t.Fatalf("fetch tx: %v", err)
	}
	if tx.PaymentMethod != "subscription" {
		t.Fatalf("expected payment_method subscription, got %q", tx.PaymentMethod)
	}
}

func TestPaymentNotifyHandler_IdempotentAndValidatesAmount(t *testing.T) {
	db := setupTestDB(t)
	gin.SetMode(gin.TestMode)

	t.Setenv("PAYMENT_CHANNEL", "yipay")
	t.Setenv("YIPAY_KEY", "k")

	user := models.User{Email: "p@example.com", PasswordHash: "x", Balance: 0, IsActive: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	order := models.PaymentOrder{UserID: user.ID, OutTradeNo: "order-1", Channel: "yipay", Amount: 10.00, Status: "pending"}
	if err := db.Create(&order).Error; err != nil {
		t.Fatalf("create order: %v", err)
	}
	trx := models.Transaction{UserID: user.ID, Type: "recharge", Amount: 10.00, Status: "pending", ReferenceID: "order-1"}
	if err := db.Create(&trx).Error; err != nil {
		t.Fatalf("create transaction: %v", err)
	}

	router := gin.New()
	router.POST("/api/payment/notify", PaymentNotifyHandler)

	params := map[string]string{
		"out_trade_no": "order-1",
		"money":        "10.00",
		"trade_status": "TRADE_SUCCESS",
		"sign_type":    "MD5",
		"trade_no":     "gw-1",
	}
	sign := SignYiPay(params, "k")
	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}
	form.Set("sign", sign)

	req := httptest.NewRequest("POST", "/api/payment/notify", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != "success" {
		t.Fatalf("expected 200 success, got %d %q", w.Code, w.Body.String())
	}

	var after models.User
	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 10.00 {
		t.Fatalf("expected balance 10.00, got %.2f", after.Balance)
	}

	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest("POST", "/api/payment/notify", strings.NewReader(form.Encode()))
	req2.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK || strings.TrimSpace(w2.Body.String()) != "success" {
		t.Fatalf("expected 200 success on retry, got %d %q", w2.Code, w2.Body.String())
	}

	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 10.00 {
		t.Fatalf("expected balance unchanged 10.00, got %.2f", after.Balance)
	}

	order2 := models.PaymentOrder{UserID: user.ID, OutTradeNo: "order-2", Channel: "yipay", Amount: 10.00, Status: "pending"}
	if err := db.Create(&order2).Error; err != nil {
		t.Fatalf("create order2: %v", err)
	}
	trx2 := models.Transaction{UserID: user.ID, Type: "recharge", Amount: 10.00, Status: "pending", ReferenceID: "order-2"}
	if err := db.Create(&trx2).Error; err != nil {
		t.Fatalf("create transaction2: %v", err)
	}

	paramsBad := map[string]string{
		"out_trade_no": "order-2",
		"money":        "9.99",
		"trade_status": "TRADE_SUCCESS",
		"sign_type":    "MD5",
		"trade_no":     "gw-2",
	}
	signBad := SignYiPay(paramsBad, "k")
	formBad := url.Values{}
	for k, v := range paramsBad {
		formBad.Set(k, v)
	}
	formBad.Set("sign", signBad)

	w3 := httptest.NewRecorder()
	req3 := httptest.NewRequest("POST", "/api/payment/notify", strings.NewReader(formBad.Encode()))
	req3.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	router.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK || strings.TrimSpace(w3.Body.String()) != "success" {
		t.Fatalf("expected 200 success for manual_review, got %d %q", w3.Code, w3.Body.String())
	}

	if err := db.First(&after, "id = ?", user.ID).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if after.Balance != 10.00 {
		t.Fatalf("expected balance unchanged 10.00, got %.2f", after.Balance)
	}

	var savedOrder2 models.PaymentOrder
	if err := db.First(&savedOrder2, "out_trade_no = ?", "order-2").Error; err != nil {
		t.Fatalf("fetch order2: %v", err)
	}
	if savedOrder2.Status != "manual_review" {
		t.Fatalf("expected manual_review, got %s", savedOrder2.Status)
	}
}
