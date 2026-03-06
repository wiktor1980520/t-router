package api

import (
	"net/http"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
)

// --- Model Definition Management (Static Pricing) ---

func ListModelsHandler(c *gin.Context) {
	var ms []models.Model
	if err := config.DB.Find(&ms).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch models"})
		return
	}
	c.JSON(http.StatusOK, ms)
}

type CreateModelRequest struct {
	ID                string  `json:"id" binding:"required"` // e.g. "gpt-4"
	Name              string  `json:"name" binding:"required"`
	Description       string  `json:"description"`
	ContextLength     int     `json:"context_length"`
	RetailPriceInput  float64 `json:"retail_price_input"`
	RetailPriceOutput float64 `json:"retail_price_output"`
}

func CreateModelHandler(c *gin.Context) {
	var req CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model := models.Model{
		ID:                req.ID,
		Name:              req.Name,
		Description:       req.Description,
		ContextLength:     req.ContextLength,
		RetailPriceInput:  req.RetailPriceInput,
		RetailPriceOutput: req.RetailPriceOutput,
	}

	// Use Save to support upsert (update if exists)
	if err := config.DB.Save(&model).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save model"})
		return
	}

	c.JSON(http.StatusOK, model)
}

func DeleteModelHandler(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.Model{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete model"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Model deleted"})
}

// --- Provider Management ---

func ListProvidersHandler(c *gin.Context) {
	var providers []models.Provider
	// Exclude ApiKey from the result if not needed, but here we just return the struct which has ApiKey as "-" (hidden in JSON)
	if err := config.DB.Find(&providers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch providers"})
		return
	}
	c.JSON(http.StatusOK, providers)
}

type CreateProviderRequest struct {
	Name    string `json:"name" binding:"required"`
	Type    string `json:"type" binding:"required"`
	BaseURL string `json:"base_url" binding:"required"`
	ApiKey  string `json:"api_key" binding:"required"`
	Weight  int    `json:"weight"`
}

func CreateProviderHandler(c *gin.Context) {
	var req CreateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	provider := models.Provider{
		Name:    req.Name,
		Type:    req.Type,
		BaseURL: req.BaseURL,
		ApiKey:  req.ApiKey,
		Weight:  req.Weight,
	}
	
	if provider.Weight == 0 {
		provider.Weight = 10
	}

	if err := config.DB.Create(&provider).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create provider"})
		return
	}

	c.JSON(http.StatusCreated, provider)
}

func DeleteProviderHandler(c *gin.Context) {
	id := c.Param("id")
	
	// Start a transaction
	tx := config.DB.Begin()

	// 1. Delete associated ModelRoutes first
	if err := tx.Where("provider_id = ?", id).Delete(&models.ModelRoute{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete associated routes"})
		return
	}

	// 2. Delete the Provider
	if err := tx.Delete(&models.Provider{}, id).Error; err != nil {
		tx.Rollback()
		// Check for foreign key violation (e.g. AuditLogs)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete provider (might be in use by logs)"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "Provider and associated routes deleted"})
}

type UpdateProviderRequest struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	BaseURL string `json:"base_url"`
	ApiKey  string `json:"api_key"`
	Weight  int    `json:"weight"`
}

func UpdateProviderHandler(c *gin.Context) {
	id := c.Param("id")
	var req UpdateProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var provider models.Provider
	if err := config.DB.First(&provider, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Provider not found"})
		return
	}

	// Update fields if provided
	if req.Name != "" {
		provider.Name = req.Name
	}
	if req.Type != "" {
		provider.Type = req.Type
	}
	if req.BaseURL != "" {
		provider.BaseURL = req.BaseURL
	}
	if req.ApiKey != "" {
		provider.ApiKey = req.ApiKey
	}
	if req.Weight > 0 {
		provider.Weight = req.Weight
	}

	if err := config.DB.Save(&provider).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update provider"})
		return
	}

	c.JSON(http.StatusOK, provider)
}


// --- Model Route Management ---

func ListModelRoutesHandler(c *gin.Context) {
	var routes []models.ModelRoute
	if err := config.DB.Preload("Provider").Find(&routes).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch model routes"})
		return
	}
	c.JSON(http.StatusOK, routes)
}

type CreateModelRouteRequest struct {
	ModelName  string  `json:"model_name" binding:"required"`
	ProviderID uint    `json:"provider_id" binding:"required"`
	CostInput  float64 `json:"cost_input"`
	CostOutput float64 `json:"cost_output"`
	Priority   int     `json:"priority"`
}

func CreateModelRouteHandler(c *gin.Context) {
	var req CreateModelRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	route := models.ModelRoute{
		ModelName:  req.ModelName,
		ProviderID: req.ProviderID,
		CostInput:  req.CostInput,
		CostOutput: req.CostOutput,
		Priority:   req.Priority,
	}

	if err := config.DB.Create(&route).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create model route"})
		return
	}

	// Load provider details for response
	config.DB.Preload("Provider").First(&route, route.ID)

	c.JSON(http.StatusCreated, route)
}

func DeleteModelRouteHandler(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.ModelRoute{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete model route"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Model route deleted"})
}
