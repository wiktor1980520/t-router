package api

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"trouter/internal/config"
	"trouter/internal/models"
	"trouter/internal/provider"
	"trouter/internal/router"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func ChatCompletionHandler(c *gin.Context) {
	startTime := time.Now()
	requestID := uuid.New().String()
	c.Header("X-Request-ID", requestID)

	var req models.ChatCompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Basic validation
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages array cannot be empty"})
		return
	}

	// Ensure User has a valid API Key (even if authenticated via JWT)
	// This is a business policy requirement: "Account must have a usable API Key to call the large model"
	userID := c.GetString("user_id")
	if userID != "" {
		// Check if user has at least one active API key
		var apiKeyCount int64
		if err := config.DB.Model(&models.ApiKey{}).Where("user_id = ? AND is_active = ?", userID, true).Count(&apiKeyCount).Error; err != nil {
			log.Printf("Error checking API key for user %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error checking permissions"})
			return
		}

		if apiKeyCount == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Account must have a valid API Key to use this service. Please create one in the dashboard."})
			return
		}

		// Check User Balance
		var user models.User
		if err := config.DB.Select("balance, is_admin").First(&user, "id = ?", userID).Error; err != nil {
			log.Printf("Error fetching user balance for %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error checking balance"})
			return
		}

		if !user.IsAdmin && user.Balance <= 0 {
			c.JSON(http.StatusPaymentRequired, gin.H{
				"error": "Insufficient balance. Please recharge to continue using the service.",
				"balance": user.Balance,
			})
			return
		}
	}

	// Get User Preference
	routingPreference := "lowest_cost" // Default
	if apiKeyVal, exists := c.Get("api_key"); exists {
		if apiKey, ok := apiKeyVal.(*models.ApiKey); ok {
			if apiKey.RoutingPreference != "" {
				routingPreference = apiKey.RoutingPreference
			}
		}
	}

	// Route Request (Get list of candidates for fallback)
	log.Printf("Routing request %s for model %s", requestID, req.Model)
	routeResults, err := router.GetRouter().Route(req.Model, routingPreference)
	if err != nil {
		log.Printf("Routing error for model %s: %v", req.Model, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Model '%s' not supported or unavailable", req.Model)})
		return
	}

	var lastErr error
	// Fallback Loop
	for _, result := range routeResults {
		log.Printf("Attempting provider %s (Route ID: %d) for request %s", result.Provider.Name(), result.ModelRoute.ID, requestID)
		if req.Stream {
			err = attemptStreamResponse(c, result.Provider, result.ModelRoute, &req, requestID, startTime)
		} else {
			err = attemptNormalResponse(c, result.Provider, result.ModelRoute, &req, requestID, startTime)
		}

		if err == nil {
			log.Printf("Provider %s succeeded for request %s", result.Provider.Name(), requestID)
			return // Success!
		}
		
		lastErr = err
		log.Printf("Provider %s (Route ID: %d) failed: %v. Retrying next provider...", result.Provider.Name(), result.ModelRoute.ID, err)
	}

	// All providers failed
	// Audit the failure against the last attempted provider
	if userID != "" && len(routeResults) > 0 {
		lastRoute := routeResults[len(routeResults)-1]
		auditLog := models.AuditLog{
			RequestID:  requestID,
			UserID:     userID,
			Model:      req.Model,
			ProviderID: lastRoute.ModelRoute.ProviderID,
			LatencyMS:  time.Since(startTime).Milliseconds(),
			StatusCode: http.StatusBadGateway,
			ClientIP:   c.ClientIP(),
		}
		config.DB.Create(&auditLog)
	}

	c.JSON(http.StatusBadGateway, gin.H{"error": "All providers failed", "details": lastErr.Error()})
}

func attemptNormalResponse(c *gin.Context, p provider.Provider, route *models.ModelRoute, req *models.ChatCompletionRequest, requestID string, startTime time.Time) error {
	resp, err := p.ChatCompletion(c.Request.Context(), req)
	if err != nil {
		return err
	}
	
	c.JSON(http.StatusOK, resp)

	// Billing & Audit Logic
	userID := c.GetString("user_id")
	if userID == "" {
		return nil
	}

	promptTokens := resp.Usage.PromptTokens
	completionTokens := resp.Usage.CompletionTokens
	
	// Fallback estimation if 0
	if promptTokens == 0 {
		promptTokens = estimateTokensFromMessages(req.Messages)
	}
	if completionTokens == 0 && len(resp.Choices) > 0 {
		completionTokens = estimateTokens(resp.Choices[0].Message.Content)
	}

	processBillingAndAudit(userID, requestID, req.Model, route, promptTokens, completionTokens, startTime, c.ClientIP())
	return nil
}

func attemptStreamResponse(c *gin.Context, p provider.Provider, route *models.ModelRoute, req *models.ChatCompletionRequest, requestID string, startTime time.Time) error {
	respChan := make(chan *models.StreamResponse)
	errChan := make(chan error, 1)

	// Start provider stream in goroutine
	go func() {
		defer close(respChan)
		defer close(errChan)
		if err := p.ChatCompletionStream(c.Request.Context(), req, respChan); err != nil {
			errChan <- err
		}
	}()

	// Wait for first event (data or error) to decide if we commit headers
	log.Printf("Waiting for first chunk from provider for request %s", requestID)
	select {
	case err := <-errChan:
		log.Printf("Received error from provider channel for request %s: %v", requestID, err)
		if err != nil {
			return err // Failed before sending data, allow fallback
		}
	case firstChunk, ok := <-respChan:
		log.Printf("Received first chunk from provider channel for request %s. OK: %v", requestID, ok)
		if !ok {
			// Stream closed immediately? Treat as error for fallback purposes
			return fmt.Errorf("stream closed unexpectedly without data")
		}

		// Success! We have data. Commit headers now.
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("Transfer-Encoding", "chunked")
		
		// Send first chunk
		// Note: SSEvent adds "data:" prefix automatically
		c.SSEvent("", firstChunk)

		var finalUsage *models.Usage
		var completionBuilder strings.Builder
		
		// Capture first chunk content
		if len(firstChunk.Choices) > 0 {
			completionBuilder.WriteString(firstChunk.Choices[0].Delta.Content)
			completionBuilder.WriteString(firstChunk.Choices[0].Delta.ReasoningContent)
		}

		// Continue streaming the rest
		c.Stream(func(w io.Writer) bool {
			select {
			case chunk, ok := <-respChan:
				if !ok {
					c.Writer.WriteString("data: [DONE]\n\n")
					return false
				}
				
				// Accumulate content
				if len(chunk.Choices) > 0 {
					completionBuilder.WriteString(chunk.Choices[0].Delta.Content)
					completionBuilder.WriteString(chunk.Choices[0].Delta.ReasoningContent)
				}
				
				if chunk.Usage != nil {
					finalUsage = chunk.Usage
				}

				c.SSEvent("", chunk)
				return true
			case err := <-errChan:
				if err != nil {
					log.Printf("Stream error mid-stream: %v", err)
					// In SSE, we can't easily change status code once headers are sent.
					// We could send a special error event, but client needs to handle it.
					// For now, just log and stop.
					return false
				}
				return false
			case <-c.Request.Context().Done():
				return false
			}
		})

		// Billing & Audit Logic (Post-Stream)
		userID := c.GetString("user_id")
		if userID != "" {
			promptTokens := 0
			completionTokens := 0

			if finalUsage != nil {
				promptTokens = finalUsage.PromptTokens
				completionTokens = finalUsage.CompletionTokens
			} else {
				promptTokens = estimateTokensFromMessages(req.Messages)
				completionTokens = estimateTokens(completionBuilder.String())
			}
			processBillingAndAudit(userID, requestID, req.Model, route, promptTokens, completionTokens, startTime, c.ClientIP())
		}
		
		return nil
	case <-c.Request.Context().Done():
		return c.Request.Context().Err()
	}
	return nil
}

func processBillingAndAudit(userID, requestID, modelName string, route *models.ModelRoute, promptTokens, completionTokens int, startTime time.Time, clientIP string) {
	// 1. Fetch Model for Retail Pricing
	var modelDef models.Model
	if err := config.DB.First(&modelDef, "id = ?", modelName).Error; err != nil {
		log.Printf("Error fetching model definition for billing: %v", err)
		// Fallback to 0 cost or default? 
		// For safety, let's log error and maybe charge 0, but this is a critical error.
	}

	// Calculate Cost for User (Retail Price per 1M tokens)
	retailCostInput := float64(promptTokens) * modelDef.RetailPriceInput / 1000000.0
	retailCostOutput := float64(completionTokens) * modelDef.RetailPriceOutput / 1000000.0
	totalUserCost := retailCostInput + retailCostOutput

	// Calculate Cost for Provider (Provider Cost per 1M tokens - from ModelRoute)
	// Note: ModelRoute.CostInput is now "per 1M tokens" for consistency
	providerCostInput := float64(promptTokens) * route.CostInput / 1000000.0
	providerCostOutput := float64(completionTokens) * route.CostOutput / 1000000.0
	totalProviderCost := providerCostInput + providerCostOutput

	latency := time.Since(startTime).Milliseconds()

	tx := config.DB.Begin()
	
	// 2. Deduct Balance (User Cost)
	if err := tx.Model(&models.User{}).Where("id = ?", userID).Update("balance", gorm.Expr("balance - ?", totalUserCost)).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to update balance for user %s: %v", userID, err)
		return
	}
	
	// Check for balance alert
	// We can do this async
	go checkBalanceAlert(userID)

	// 3. Create Transaction Record
	transaction := models.Transaction{
		UserID:      userID,
		Type:        "consumption",
		Amount:      totalUserCost,
		Description: fmt.Sprintf("Chat Completion (%s)", modelName),
		ReferenceID: requestID,
		Status:      "completed",
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to create transaction record: %v", err)
		return
	}

	// 4. Create Audit Log
	auditLog := models.AuditLog{
		RequestID:        requestID,
		UserID:           userID,
		Model:            modelName,
		ProviderID:       route.ProviderID,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalCost:        totalUserCost, // Tracking what user paid
		LatencyMS:        latency,
		StatusCode:       http.StatusOK,
		ClientIP:         clientIP,
	}
	if err := tx.Create(&auditLog).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to create audit log: %v", err)
		return
	}

	tx.Commit()
	
	// Optional: Log Provider Cost for internal analytics (maybe to a different table or log file)
	log.Printf("[ARBITRAGE] ReqID: %s | UserPaid: %.6f | ProviderCost: %.6f | Margin: %.6f", 
		requestID, totalUserCost, totalProviderCost, totalUserCost - totalProviderCost)
}

// Simple token estimation (approx 4 chars = 1 token)
func estimateTokens(text string) int {
	return len(text) / 4
}

func estimateTokensFromMessages(messages []models.Message) int {
	count := 0
	for _, msg := range messages {
		count += estimateTokens(msg.Content)
	}
	return count
}
