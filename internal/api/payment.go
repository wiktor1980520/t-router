package api

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"

	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// YiPayConfig holds the configuration for YiPay
type YiPayConfig struct {
	URL string
	PID string
	Key string
}

func getYiPayConfig() YiPayConfig {
	return YiPayConfig{
		URL: os.Getenv("YIPAY_API_URL"),
		PID: os.Getenv("YIPAY_PID"),
		Key: os.Getenv("YIPAY_KEY"),
	}
}

// SignYiPay generates the signature for YiPay requests
func SignYiPay(params map[string]string, key string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		if k != "sign" && k != "sign_type" && params[k] != "" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	var builder strings.Builder
	for i, k := range keys {
		if i > 0 {
			builder.WriteString("&")
		}
		builder.WriteString(k)
		builder.WriteString("=")
		builder.WriteString(params[k])
	}
	builder.WriteString(key)

	hash := md5.Sum([]byte(builder.String()))
	return hex.EncodeToString(hash[:])
}

// CreatePaymentHandler initiates a payment request
func CreatePaymentHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	
	var req struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
		Method string  `json:"method" binding:"required"` // alipay, wxpay, usdt
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg := getYiPayConfig()
	if cfg.PID == "" || cfg.Key == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Payment gateway not configured"})
		return
	}

	// 1. Create a pending transaction
	orderID := uuid.New().String()
	transaction := models.Transaction{
		UserID:        userID,
		Type:          "recharge",
		Amount:        req.Amount,
		Status:        "pending",
		PaymentMethod: req.Method,
		Description:   fmt.Sprintf("Recharge $%.2f via %s", req.Amount, req.Method),
		ReferenceID:   orderID,
	}

	if err := config.DB.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction"})
		return
	}

	// 2. Prepare YiPay parameters
	// Assuming the aggregator accepts "money" in CNY or USD depending on config.
	// Here we assume the gateway handles currency conversion or 1:1 if configured.
	// Common YiPay params: pid, type, out_trade_no, notify_url, return_url, name, money, sitename
	
	// Construct absolute URLs for callbacks
	// In production, these should be from config
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)
	
	// For local dev, we might need a tunnel or these won't work for callbacks.
	// Using localhost for return_url is fine for user redirect.
	notifyURL := baseURL + "/api/payment/notify"
	returnURL := os.Getenv("FRONTEND_URL") // e.g., http://localhost:5173/dashboard/billing
	if returnURL == "" {
		returnURL = "http://localhost:5173/dashboard/billing"
	}

	params := map[string]string{
		"pid":          cfg.PID,
		"type":         req.Method,
		"out_trade_no": orderID,
		"notify_url":   notifyURL,
		"return_url":   returnURL,
		"name":         "TRouter Balance Recharge",
		"money":        fmt.Sprintf("%.2f", req.Amount),
		"sitename":     "TRouter",
	}

	params["sign"] = SignYiPay(params, cfg.Key)
	params["sign_type"] = "MD5"

	// 3. Return the payment URL or Form
	// YiPay usually works by submitting a form to the gateway URL
	// We can construct the URL with query params for a GET redirect
	
	values := url.Values{}
	for k, v := range params {
		values.Add(k, v)
	}
	
	paymentURL := fmt.Sprintf("%s?%s", cfg.URL, values.Encode())

	c.JSON(http.StatusOK, gin.H{
		"payment_url": paymentURL,
		"order_id":    orderID,
	})
}

// PaymentNotifyHandler handles the asynchronous callback from YiPay
func PaymentNotifyHandler(c *gin.Context) {
	// Parse form data
	if err := c.Request.ParseForm(); err != nil {
		c.String(http.StatusBadRequest, "fail")
		return
	}

	params := make(map[string]string)
	for k, v := range c.Request.Form {
		if len(v) > 0 {
			params[k] = v[0]
		}
	}

	cfg := getYiPayConfig()
	
	// 1. Verify Signature
	sign := params["sign"]
	calculatedSign := SignYiPay(params, cfg.Key)
	
	if sign != calculatedSign {
		log.Printf("[Payment] Signature verification failed. Received: %s, Calculated: %s", sign, calculatedSign)
		c.String(http.StatusBadRequest, "fail")
		return
	}

	// 2. Check Status
	status := params["trade_status"]
	if status != "TRADE_SUCCESS" {
		log.Printf("[Payment] Trade failed or pending: %s", status)
		c.String(http.StatusOK, "success") // Acknowledge receipt even if not success
		return
	}

	// 3. Process Order
	outTradeNo := params["out_trade_no"]
	moneyStr := params["money"]
	money, _ := strconv.ParseFloat(moneyStr, 64)

	tx := config.DB.Begin()

	var transaction models.Transaction
	if err := tx.Where("reference_id = ?", outTradeNo).First(&transaction).Error; err != nil {
		tx.Rollback()
		log.Printf("[Payment] Transaction not found: %s", outTradeNo)
		c.String(http.StatusBadRequest, "fail")
		return
	}

	if transaction.Status == "completed" {
		tx.Rollback()
		c.String(http.StatusOK, "success") // Already processed
		return
	}

	// Update Transaction
	transaction.Status = "completed"
	if err := tx.Save(&transaction).Error; err != nil {
		tx.Rollback()
		log.Printf("[Payment] Failed to update transaction: %v", err)
		c.String(http.StatusInternalServerError, "fail")
		return
	}

	// Update User Balance
	if err := tx.Model(&models.User{}).Where("id = ?", transaction.UserID).Update("balance", gorm.Expr("balance + ?", money)).Error; err != nil {
		tx.Rollback()
		log.Printf("[Payment] Failed to update user balance: %v", err)
		c.String(http.StatusInternalServerError, "fail")
		return
	}

	tx.Commit()
	log.Printf("[Payment] Successfully processed order %s for user %s, amount: %.2f", outTradeNo, transaction.UserID, money)

	c.String(http.StatusOK, "success")
}
