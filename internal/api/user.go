package api

import (
	"log"
	"net/http"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// --- Helper Functions ---
func checkBalanceAlert(userID string) {
	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		log.Printf("Error fetching user for balance check: %v", err)
		return
	}

	if user.Balance < user.BalanceAlertThreshold {
		// In a real system, this would send an email or webhook
		// For MVP, we'll just log it
		log.Printf("[ALERT] User %s balance is low! Current: %.2f, Threshold: %.2f", 
			user.Email, user.Balance, user.BalanceAlertThreshold)
		
		// Create a system notification (mock)
		// config.DB.Create(&Notification{...})
	}
}

// --- API Key Management ---

func ListApiKeysHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	var keys []models.ApiKey
	if err := config.DB.Where("user_id = ?", userID).Find(&keys).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch API keys"})
		return
	}
	c.JSON(http.StatusOK, keys)
}

func CreateApiKeyHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	var req models.CreateApiKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate a new key
	// In production, use a secure random string generator
	rawKey := "sk-" + uuid.New().String()
	
	pref := req.RoutingPreference
	if pref == "" {
		pref = "lowest_cost"
	}

	apiKey := models.ApiKey{
		UserID:            userID,
		KeyHash:           rawKey, // In a real app, hash this!
		KeyPrefix:         rawKey[:7],
		Label:             req.Label,
		RoutingPreference: pref,
		IsActive:          true,
	}

	if err := config.DB.Create(&apiKey).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create API key"})
		return
	}

	// Return the raw key ONLY ONCE
	c.JSON(http.StatusCreated, gin.H{
		"id":         apiKey.ID,
		"key":        rawKey,
		"label":      apiKey.Label,
		"created_at": apiKey.CreatedAt,
	})
}

func DeleteApiKeyHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	keyID := c.Param("id")

	result := config.DB.Where("id = ? AND user_id = ?", keyID, userID).Delete(&models.ApiKey{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete API key"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "API key deleted"})
}

// --- Billing & Transactions ---

func GetTransactionsHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	var transactions []models.Transaction
	
	if err := config.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}
	
	c.JSON(http.StatusOK, transactions)
}

func RechargeHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	
	// Mock recharge request
	type RechargeRequest struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
	}
	var req RechargeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := config.DB.Begin()

	// 1. Create Transaction Record
	transaction := models.Transaction{
		UserID:      userID,
		Type:        "recharge",
		Amount:      req.Amount,
		Description: "Manual Recharge",
		ReferenceID: uuid.New().String(),
	}
	
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process recharge"})
		return
	}

	// 2. Update User Balance
	if err := tx.Model(&models.User{}).Where("id = ?", userID).Update("balance", gorm.Expr("balance + ?", req.Amount)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update balance"})
		return
	}

	tx.Commit()
	
	// Check balance alert (in case recharge brings it above threshold, 
	// though usually we alert when it goes *below*. 
	// But good to have consistent state checking)
	go checkBalanceAlert(userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Recharge successful",
		"amount":  req.Amount,
	})
}

// UpdateSettingsHandler updates user preferences like balance alert threshold
func UpdateSettingsHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	
	var req struct {
		BalanceAlertThreshold *float64 `json:"balance_alert_threshold"`
		Phone                 *string  `json:"phone"`
		VerificationCode      string   `json:"verification_code"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	updates := map[string]interface{}{}
	if req.BalanceAlertThreshold != nil {
		updates["balance_alert_threshold"] = *req.BalanceAlertThreshold
	}
	if req.Phone != nil {
		if *req.Phone == "" {
			// Clearing phone number might require verification too in strict systems, 
			// but for now let's assume it's allowed or not supported via UI yet.
			updates["phone"] = nil
		} else {
			// Verify SMS code
			if req.VerificationCode == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code required to update phone"})
				return
			}
			if !verifyCode(*req.Phone, req.VerificationCode) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification code"})
				return
			}
			
			// Check if phone already taken
			var existingUser models.User
			if err := config.DB.Where("phone = ? AND id != ?", *req.Phone, userID).First(&existingUser).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "Phone number already in use"})
				return
			}
			
			updates["phone"] = *req.Phone
		}
	}
	
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No settings to update"})
		return
	}
	
	if err := config.DB.Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	go checkBalanceAlert(userID)
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Settings updated",
		"updates": updates,
	})
}

// GetUserStatsHandler returns statistics for the user
func GetUserStatsHandler(c *gin.Context) {
	userID := c.GetString("user_id")

	var totalCalls int64
	if err := config.DB.Model(&models.AuditLog{}).Where("user_id = ?", userID).Count(&totalCalls).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count API calls"})
		return
	}

	// Get daily usage for the last 10 days
	days := 10
	now := time.Now()
	// Normalize start time to beginning of the day 10 days ago (actually 9 days ago + today)
	// If we want exactly 10 points ending today.
	// Start date = Today - 9 days.
	startTime := now.AddDate(0, 0, -(days - 1))
	// Strip time part for accurate comparison if needed, but DB query with >= time is fine.
	// We'll normalize in the loop.
	
	var logs []models.AuditLog
	// Optimize: only fetch CreatedAt
	if err := config.DB.Select("created_at").
		Where("user_id = ? AND created_at >= ?", userID, startTime.Format("2006-01-02 00:00:00")).
		Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch usage stats"})
		return
	}

	// Aggregate in memory
	usageMap := make(map[string]int)
	for _, log := range logs {
		// Use local time for date bucketing
		dateStr := log.CreatedAt.Local().Format("2006-01-02")
		usageMap[dateStr]++
	}

	type DailyUsage struct {
		Date  string `json:"date"`
		Usage int    `json:"usage"`
	}
	var dailyUsage []DailyUsage

	// Generate last 10 days keys
	for i := 0; i < days; i++ {
		d := startTime.AddDate(0, 0, i)
		dateStr := d.Format("2006-01-02")
		
		dailyUsage = append(dailyUsage, DailyUsage{
			Date:  dateStr,
			Usage: usageMap[dateStr],
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"total_api_calls": totalCalls,
		"daily_usage":     dailyUsage,
	})
}

