package api

import (
	"net/http"
	"strconv"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AdminListUsersHandler lists all users with pagination
func AdminListUsersHandler(c *gin.Context) {
	var users []models.User
	var total int64

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	
	if page < 1 { page = 1 }
	if pageSize < 1 { pageSize = 20 }

	config.DB.Model(&models.User{}).Count(&total)
	
	if err := config.DB.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"page_size": pageSize,
	})
}

// AdminGetUserHandler gets user details
func AdminGetUserHandler(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := config.DB.Preload("ApiKeys").First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// AdminToggleUserStatusHandler enables/disables a user
func AdminToggleUserStatusHandler(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := config.DB.Model(&models.User{}).Where("id = ?", id).Update("is_active", req.IsActive).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User status updated"})
}

// AdminGetTransactionsHandler gets all transactions (optionally filtered by user or type)
func AdminGetTransactionsHandler(c *gin.Context) {
    userID := c.Query("user_id")
    txnType := c.Query("type") // "recharge" or "consumption"

    var transactions []models.Transaction
    
    query := config.DB.Order("created_at desc")
    
    if userID != "" {
        query = query.Where("user_id = ?", userID)
    }
    if txnType != "" {
        query = query.Where("type = ?", txnType)
    }
    
    if err := query.Limit(100).Find(&transactions).Error; err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
        return
    }
    
    c.JSON(http.StatusOK, transactions)
}

// AdminRechargeUserHandler allows admins to manually recharge a user's balance
func AdminRechargeUserHandler(c *gin.Context) {
	// Only admin middleware should allow access here
	
	var req struct {
		UserID string  `json:"user_id" binding:"required"`
		Amount float64 `json:"amount" binding:"required,gt=0"`
		Remark string  `json:"remark"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := config.DB.Begin()

	// 1. Create Transaction Record
	transaction := models.Transaction{
		UserID:      req.UserID,
		Type:        "admin_gift", // Distinguish from regular recharge
		Amount:      req.Amount,
		Description: "Admin Gift: " + req.Remark,
		ReferenceID: "ADMIN-" + uuid.New().String(),
	}
	
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction record"})
		return
	}

	// 2. Update User Balance
	if err := tx.Model(&models.User{}).Where("id = ?", req.UserID).Update("balance", gorm.Expr("balance + ?", req.Amount)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user balance"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"message": "User balance updated successfully",
		"amount":  req.Amount,
		"new_balance_added": true,
	})
}
