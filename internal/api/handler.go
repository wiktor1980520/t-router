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
	"gorm.io/gorm/clause"
)

func ChatCompletionHandler(c *gin.Context) {
	startTime := time.Now()
	requestID := c.GetString("request_id")
	if requestID == "" {
		requestID = uuid.New().String()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
	}

	var req models.ChatCompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("Failed to bind JSON for request %s: %v", requestID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "request_id": requestID})
		return
	}

	// Basic validation
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "messages array cannot be empty", "request_id": requestID})
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error checking permissions", "request_id": requestID})
			return
		}

		if apiKeyCount == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Account must have a valid API Key to use this service. Please create one in the dashboard.", "request_id": requestID})
			return
		}

		// Check User Balance
		var user models.User
		if err := config.DB.Select("balance, is_admin").First(&user, "id = ?", userID).Error; err != nil {
			log.Printf("Error fetching user balance for %s: %v", userID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error checking balance", "request_id": requestID})
			return
		}

		if !user.IsAdmin && user.Balance <= 0 {
			if !hasUsableSubscription(userID, req.Model) {
				c.JSON(http.StatusPaymentRequired, gin.H{
					"error":      "Insufficient balance. Please recharge to continue using the service.",
					"balance":    user.Balance,
					"request_id": requestID,
				})
				return
			}
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

	// Enforce API Key model allowlist (if configured)
	if apiKeyVal, exists := c.Get(ContextKeyApiKey); exists {
		if apiKey, ok := apiKeyVal.(*models.ApiKey); ok && len(apiKey.AllowedModels) > 0 {
			allowed := false
			for _, m := range apiKey.AllowedModels {
				if m == req.Model {
					allowed = true
					break
				}
			}
			if !allowed {
				c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Model '%s' is not allowed for this API key", req.Model), "request_id": requestID})
				return
			}
		}
	}

	// Enforce User model allowlist
	if userID != "" {
		var user models.User
		if err := config.DB.Select("allowed_models").First(&user, "id = ?", userID).Error; err == nil && len(user.AllowedModels) > 0 {
			allowed := false
			for _, m := range user.AllowedModels {
				if m == req.Model {
					allowed = true
					break
				}
			}
			if !allowed {
				c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("Model '%s' is not allowed for your account", req.Model), "request_id": requestID})
				return
			}
		}
	}

	// Route Request (Get list of candidates for fallback)
	log.Printf("Routing request %s for model %s", requestID, req.Model)
	routeResults, err := router.GetRouter().Route(req.Model, routingPreference)
	if err != nil {
		log.Printf("Routing error for model %s: %v", req.Model, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Model '%s' not supported or unavailable", req.Model), "request_id": requestID})
		return
	}

	var lastErr error
	attempts := make([]gin.H, 0, len(routeResults))
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
			config.DB.Model(&models.ModelRoute{}).Where("id = ?", result.ModelRoute.ID).Updates(map[string]interface{}{
				"failure_count": 0,
				"last_check":    time.Now(),
			})
			return // Success!
		}

		lastErr = err
		config.DB.Model(&models.ModelRoute{}).Where("id = ?", result.ModelRoute.ID).Updates(map[string]interface{}{
			"failure_count": gorm.Expr("failure_count + 1"),
			"last_check":    time.Now(),
		})
		attempts = append(attempts, gin.H{
			"route_id":       result.ModelRoute.ID,
			"provider_id":    result.ModelRoute.ProviderID,
			"provider_name":  result.ModelRoute.Provider.Name,
			"provider_type":  result.ModelRoute.Provider.Type,
			"failure_count":  result.ModelRoute.FailureCount,
			"provider_error": err.Error(),
		})
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
			OrgID:      c.GetString("org_id"),
			LatencyMS:  time.Since(startTime).Milliseconds(),
			StatusCode: http.StatusBadGateway,
			ClientIP:   c.ClientIP(),
		}
		config.DB.Create(&auditLog)
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("unknown provider failure")
	}
	c.JSON(http.StatusBadGateway, gin.H{
		"error":      "All providers failed",
		"details":    lastErr.Error(),
		"request_id": requestID,
		"attempts":   attempts,
	})
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
		if text, ok := resp.Choices[0].Message.Content.(string); ok {
			completionTokens = estimateTokens(text)
		} else {
			completionTokens = estimateTokens(fmt.Sprintf("%v", resp.Choices[0].Message.Content))
		}
	}

	processBillingAndAudit(userID, c.GetString("org_id"), requestID, req.Model, route, promptTokens, completionTokens, startTime, c.ClientIP())
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
			if content, ok := firstChunk.Choices[0].Delta.Content.(string); ok {
				completionBuilder.WriteString(content)
			} else if firstChunk.Choices[0].Delta.Content != nil {
				completionBuilder.WriteString(fmt.Sprintf("%v", firstChunk.Choices[0].Delta.Content))
			}
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
					if content, ok := chunk.Choices[0].Delta.Content.(string); ok {
						completionBuilder.WriteString(content)
					} else if chunk.Choices[0].Delta.Content != nil {
						completionBuilder.WriteString(fmt.Sprintf("%v", chunk.Choices[0].Delta.Content))
					}
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
			processBillingAndAudit(userID, c.GetString("org_id"), requestID, req.Model, route, promptTokens, completionTokens, startTime, c.ClientIP())
		}

		return nil
	case <-c.Request.Context().Done():
		return c.Request.Context().Err()
	}
	return nil
}

func processBillingAndAudit(userID, orgID, requestID, modelName string, route *models.ModelRoute, promptTokens, completionTokens int, startTime time.Time, clientIP string) {
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

	var user models.User
	if err := tx.Select("id, balance, is_admin").Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", userID).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to fetch user for billing %s: %v", userID, err)
		return
	}

	if user.IsAdmin {
		totalUserCost = 0
	}

	now := time.Now()
	costFromBalance := totalUserCost
	paymentMethod := "balance"
	if totalUserCost > 0 {
		if sub, plan, err := loadActiveSubscriptionForBilling(tx, userID, now); err == nil && plan != nil && plan.IsActive && sub.RemainingQuota > 0 {
			allowed := len(plan.AllowedModels) == 0
			if !allowed {
				for _, m := range plan.AllowedModels {
					if m == modelName {
						allowed = true
						break
					}
				}
			}
			if allowed {
				useFromSub := totalUserCost
				if useFromSub > sub.RemainingQuota {
					useFromSub = sub.RemainingQuota
				}
				if useFromSub > 0 {
					upd := tx.Model(&models.UserSubscription{}).
						Where("id = ? AND remaining_quota >= ?", sub.ID, useFromSub).
						Update("remaining_quota", gorm.Expr("remaining_quota - ?", useFromSub))
					if upd.Error != nil {
						tx.Rollback()
						log.Printf("Failed to update subscription quota for user %s: %v", userID, upd.Error)
						return
					}
					if upd.RowsAffected > 0 {
						costFromBalance = totalUserCost - useFromSub
						if costFromBalance <= 0 {
							paymentMethod = "subscription"
						} else {
							paymentMethod = "subscription+balance"
						}
					}
				}
			}
		}
	}

	transaction := models.Transaction{
		UserID:        userID,
		Type:          "consumption",
		Amount:        totalUserCost,
		Description:   fmt.Sprintf("Chat Completion (%s)", modelName),
		ReferenceID:   requestID,
		Status:        "pending",
		PaymentMethod: paymentMethod,
	}
	createRes := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&transaction)
	if createRes.Error != nil {
		tx.Rollback()
		log.Printf("Failed to create transaction record: %v", createRes.Error)
		return
	}
	if createRes.RowsAffected == 0 {
		tx.Rollback()
		return
	}

	statusCode := http.StatusOK
	if costFromBalance > 0 {
		deductRes := tx.Model(&models.User{}).
			Where("id = ? AND balance >= ?", userID, costFromBalance).
			Update("balance", gorm.Expr("balance - ?", costFromBalance))
		if deductRes.Error != nil {
			tx.Rollback()
			log.Printf("Failed to update balance for user %s: %v", userID, deductRes.Error)
			return
		}
		if deductRes.RowsAffected == 0 {
			statusCode = http.StatusPaymentRequired
			transaction.Status = "failed"
		} else {
			transaction.Status = "completed"
		}
	} else {
		transaction.Status = "completed"
	}
	if err := tx.Save(&transaction).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to update transaction status: %v", err)
		return
	}

	if statusCode == http.StatusOK && orgID != "" && totalUserCost > 0 {
		period := now.Format("2006-01")
		usage := models.OrgUsage{
			OrgID:  orgID,
			Period: period,
			Spent:  totalUserCost,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "org_id"}, {Name: "period"}},
			DoUpdates: clause.Assignments(map[string]any{
				"spent":      gorm.Expr("spent + ?", totalUserCost),
				"updated_at": time.Now(),
			}),
		}).Create(&usage).Error; err != nil {
			tx.Rollback()
			log.Printf("Failed to update org usage: %v", err)
			return
		}
	}

	// 4. Create Audit Log
	paidCost := totalUserCost
	paidProviderCost := totalProviderCost
	if statusCode != http.StatusOK {
		paidCost = 0
		paidProviderCost = 0
	}
	auditLog := models.AuditLog{
		RequestID:        requestID,
		UserID:           userID,
		Model:            modelName,
		ProviderID:       route.ProviderID,
		OrgID:            orgID,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalCost:        paidCost,
		ProviderCost:     paidProviderCost,
		LatencyMS:        latency,
		StatusCode:       statusCode,
		ClientIP:         clientIP,
	}
	if err := tx.Create(&auditLog).Error; err != nil {
		tx.Rollback()
		log.Printf("Failed to create audit log: %v", err)
		return
	}

	tx.Commit()

	if statusCode == http.StatusOK && costFromBalance > 0 {
		go checkBalanceAlert(userID)
	}

	// Optional: Log Provider Cost for internal analytics (maybe to a different table or log file)
	log.Printf("[ARBITRAGE] ReqID: %s | UserPaid: %.6f | ProviderCost: %.6f | Margin: %.6f",
		requestID, totalUserCost, totalProviderCost, totalUserCost-totalProviderCost)
}

// Simple token estimation (approx 4 chars = 1 token)
func estimateTokens(text string) int {
	return len(text) / 4
}

func estimateTokensFromMessages(messages []models.Message) int {
	count := 0
	for _, msg := range messages {
		if text, ok := msg.Content.(string); ok {
			count += estimateTokens(text)
		} else {
			// For non-string content (multimodal), we can just estimate based on string representation
			count += estimateTokens(fmt.Sprintf("%v", msg.Content))
		}
	}
	return count
}
