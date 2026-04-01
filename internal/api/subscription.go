package api

import (
	"net/http"
	"strconv"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func AdminListSubscriptionPlansHandler(c *gin.Context) {
	var plans []models.SubscriptionPlan
	if err := config.DB.Order("created_at desc").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscription plans"})
		return
	}
	c.JSON(http.StatusOK, plans)
}

func AdminCreateSubscriptionPlanHandler(c *gin.Context) {
	var req struct {
		Name          string   `json:"name" binding:"required"`
		MonthlyPrice  float64  `json:"monthly_price"`
		MonthlyQuota  float64  `json:"monthly_quota"`
		AllowedModels []string `json:"allowed_models"`
		RateLimit     int      `json:"rate_limit"`
		IsActive      *bool    `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	plan := models.SubscriptionPlan{
		Name:          req.Name,
		MonthlyPrice:  req.MonthlyPrice,
		MonthlyQuota:  req.MonthlyQuota,
		AllowedModels: models.ModelList(req.AllowedModels),
		RateLimit:     req.RateLimit,
		IsActive:      isActive,
	}
	if err := config.DB.Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription plan"})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

func AdminUpdateSubscriptionPlanHandler(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var plan models.SubscriptionPlan
	if err := config.DB.First(&plan, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}

	var req struct {
		Name          *string   `json:"name"`
		MonthlyPrice  *float64  `json:"monthly_price"`
		MonthlyQuota  *float64  `json:"monthly_quota"`
		AllowedModels *[]string `json:"allowed_models"`
		RateLimit     *int      `json:"rate_limit"`
		IsActive      *bool     `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]any{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.MonthlyPrice != nil {
		updates["monthly_price"] = *req.MonthlyPrice
	}
	if req.MonthlyQuota != nil {
		updates["monthly_quota"] = *req.MonthlyQuota
	}
	if req.AllowedModels != nil {
		updates["allowed_models"] = models.ModelList(*req.AllowedModels)
	}
	if req.RateLimit != nil {
		updates["rate_limit"] = *req.RateLimit
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No updates"})
		return
	}

	if err := config.DB.Model(&models.SubscriptionPlan{}).Where("id = ?", plan.ID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update plan"})
		return
	}

	if err := config.DB.First(&plan, "id = ?", plan.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated plan"})
		return
	}
	c.JSON(http.StatusOK, plan)
}

func AdminDeleteSubscriptionPlanHandler(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := config.DB.Delete(&models.SubscriptionPlan{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete plan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func AdminGrantSubscriptionHandler(c *gin.Context) {
	var req struct {
		UserID    string `json:"user_id" binding:"required"`
		PlanID    uint   `json:"plan_id" binding:"required"`
		Months    int    `json:"months"`
		AutoRenew bool   `json:"auto_renew"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	months := req.Months
	if months <= 0 {
		months = 1
	}

	var plan models.SubscriptionPlan
	if err := config.DB.First(&plan, "id = ? AND is_active = ?", req.PlanID, true).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Plan not found"})
		return
	}

	now := time.Now()
	sub := models.UserSubscription{
		UserID:         req.UserID,
		PlanID:         plan.ID,
		Status:         "active",
		StartAt:        now,
		EndAt:          now.AddDate(0, months, 0),
		RemainingQuota: plan.MonthlyQuota * float64(months),
		AutoRenew:      req.AutoRenew,
	}

	tx := config.DB.Begin()
	if err := tx.Model(&models.UserSubscription{}).Where("user_id = ? AND status = ?", req.UserID, "active").Update("status", "expired").Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update existing subscriptions"})
		return
	}
	if err := tx.Create(&sub).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
		return
	}
	tx.Commit()

	if err := config.DB.Preload("Plan").First(&sub, "id = ?", sub.ID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subscription"})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

func GetMySubscriptionHandler(c *gin.Context) {
	userID := c.GetString("user_id")
	now := time.Now()

	var sub models.UserSubscription
	err := config.DB.Preload("Plan").
		Where("user_id = ? AND status = ? AND start_at <= ? AND end_at > ?", userID, "active", now, now).
		Order("end_at desc").
		First(&sub).Error
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"subscription": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"subscription": sub})
}

func loadActiveSubscriptionForBilling(tx *gorm.DB, userID string, now time.Time) (*models.UserSubscription, *models.SubscriptionPlan, error) {
	var sub models.UserSubscription
	if err := tx.Preload("Plan").
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("user_id = ? AND status = ? AND start_at <= ? AND end_at > ?", userID, "active", now, now).
		Order("end_at desc").
		First(&sub).Error; err != nil {
		return nil, nil, err
	}
	return &sub, &sub.Plan, nil
}

func hasUsableSubscription(userID string, modelName string) bool {
	now := time.Now()
	var sub models.UserSubscription
	if err := config.DB.Preload("Plan").
		Where("user_id = ? AND status = ? AND start_at <= ? AND end_at > ?", userID, "active", now, now).
		Order("end_at desc").
		First(&sub).Error; err != nil {
		return false
	}
	if !sub.Plan.IsActive || sub.RemainingQuota <= 0 {
		return false
	}
	if len(sub.Plan.AllowedModels) == 0 {
		return true
	}
	for _, m := range sub.Plan.AllowedModels {
		if m == modelName {
			return true
		}
	}
	return false
}

func activeSubscriptionRateLimit(userID string) int {
	now := time.Now()
	var sub models.UserSubscription
	if err := config.DB.Preload("Plan").
		Where("user_id = ? AND status = ? AND start_at <= ? AND end_at > ?", userID, "active", now, now).
		Order("end_at desc").
		First(&sub).Error; err != nil {
		return 0
	}
	if !sub.Plan.IsActive {
		return 0
	}
	return sub.Plan.RateLimit
}
