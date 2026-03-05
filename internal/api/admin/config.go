package admin

import (
	"net/http"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

// GetSystemConfigHandler returns all system configurations
func GetSystemConfigHandler(c *gin.Context) {
	var configs []models.SystemConfig
	if err := config.DB.Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch system configurations"})
		return
	}
	c.JSON(http.StatusOK, configs)
}

// UpdateSystemConfigHandler updates a system configuration
func UpdateSystemConfigHandler(c *gin.Context) {
	var req struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var systemConfig models.SystemConfig
	if err := config.DB.Where("key = ?", req.Key).First(&systemConfig).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Configuration not found"})
		return
	}

	systemConfig.Value = req.Value
	if err := config.DB.Save(&systemConfig).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update configuration"})
		return
	}

	c.JSON(http.StatusOK, systemConfig)
}
