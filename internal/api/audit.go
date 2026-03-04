package api

import (
	"net/http"
	"strconv"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

// GetAuditLogsHandler returns paginated audit logs for the authenticated user
func GetAuditLogsHandler(c *gin.Context) {
	// Get User ID from JWT context (set by JWTMiddleware)
	// Note: In JWTMiddleware, we set "user_id" which is the string ID
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var logs []models.AuditLog
	var total int64

	// Base query
	query := config.DB.Model(&models.AuditLog{}).Where("user_id = ?", userID)

	// Filtering
	if reqID := c.Query("request_id"); reqID != "" {
		query = query.Where("request_id = ?", reqID)
	}
	if model := c.Query("model"); model != "" {
		query = query.Where("model LIKE ?", "%"+model+"%")
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count logs"})
		return
	}

	// Fetch data
	offset := (page - 1) * pageSize
	if err := query.Order("created_at desc").Offset(offset).Limit(pageSize).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": logs,
		"meta": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"last_page": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}
