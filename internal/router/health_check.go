package router

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"trouter/internal/config"
	"trouter/internal/models"

	"gorm.io/gorm"
)

// StartHealthCheckWorker starts a background goroutine to periodically check route latency
func StartHealthCheckWorker(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("HealthCheck Worker panicked: %v", r)
			}
		}()
		log.Printf("Starting Health Check Worker with interval: %v", interval)
		for range ticker.C {
			log.Println("HealthCheck: Tick")
			checkRoutes()
		}
	}()
}

func checkRoutes() {
	var routes []models.ModelRoute
	// Fetch all active routes with their providers
	if err := config.DB.Preload("Provider").
		Where("is_active = ?", true).
		Find(&routes).Error; err != nil {
		log.Printf("HealthCheck: Failed to fetch routes: %v", err)
		return
	}

	for _, route := range routes {
		// Use goroutine for parallel checks
		go checkSingleRoute(route)
	}
}

func checkSingleRoute(route models.ModelRoute) {
	// We check the Provider's BaseURL as a proxy for latency
	// Note: Ideally we would call a specific lightweight endpoint or use a TCP ping.
	// For REST APIs, a HEAD request or a GET to root is often safe.
	
	targetURL := route.Provider.BaseURL
	
	start := time.Now()
	
	// Use a short timeout for health checks
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	// We just want to check connectivity and RTT. 
	// We don't care much about the response content (401/404 is fine, means server is reachable)
	// Connection refused or timeout means down/high latency.
	req, err := http.NewRequestWithContext(context.Background(), "GET", targetURL, nil)
	if err != nil {
		log.Printf("HealthCheck: Error creating request for route %d (%s): %v", route.ID, route.Provider.Name, err)
		updateRouteStatus(route, 0, false)
		return
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		log.Printf("HealthCheck: Route %d (%s) failed: %v", route.ID, route.Provider.Name, err)
		// Set to 0 to indicate high latency/unreachable
		updateRouteStatus(route, 0, false)
		return
	}
	defer resp.Body.Close()

	// 5xx errors indicate server-side issues, treat as failure
	if resp.StatusCode >= 500 {
		log.Printf("HealthCheck: Route %d (%s) returned status %d", route.ID, route.Provider.Name, resp.StatusCode)
		updateRouteStatus(route, 0, false)
		return
	}
	
	// 4xx errors (404, 401, 403) mean the server is reachable and processed the request.
	// For a latency check, this is considered a SUCCESS.
	// We log it for debugging but don't mark as failure.
	if resp.StatusCode >= 400 {
		// Optional: Log verbose only if needed
		// log.Printf("HealthCheck: Route %d (%s) returned status %d (treated as reachable)", route.ID, route.Provider.Name, resp.StatusCode)
	}

	// Update DB
	log.Printf("HealthCheck: Route %d (%s) latency: %dms", route.ID, route.Provider.Name, latency)
	updateRouteStatus(route, int(latency), true)
}

func updateRouteStatus(route models.ModelRoute, latencyMs int, success bool) {
	// Prepare updates
	updates := map[string]interface{}{
		"last_check": time.Now(),
	}

	if success {
		updates["latency"] = latencyMs
		updates["failure_count"] = 0 // Reset on success
	} else {
		updates["latency"] = 0 // Indicate failure/timeout
		updates["failure_count"] = gorm.Expr("failure_count + 1")
		
		// Check if we need to alert (current count + 1 == 3)
		if route.FailureCount + 1 == 3 {
			sendAlert(route)
		}
	}

	if err := config.DB.Model(&models.ModelRoute{}).Where("id = ?", route.ID).Updates(updates).Error; err != nil {
		log.Printf("HealthCheck: Failed to update route %d: %v", route.ID, err)
	}
}

func sendAlert(route models.ModelRoute) {
	msg := fmt.Sprintf("🚨 ALERT: Route %d (Model: %s) has failed 3 consecutive times via Provider: %s!", route.ID, route.ModelName, route.Provider.Name)
	log.Println(msg)
	
	webhookURL := os.Getenv("HEALTH_CHECK_WEBHOOK_URL")
	if webhookURL != "" {
		go func() {
			payload := map[string]string{
				"text": msg, // Compatible with Slack/Mattermost
				"content": msg, // Some other webhooks
				"msg_type": "text", // Feishu/Lark
			}
			
			jsonPayload, _ := json.Marshal(payload)
			resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(jsonPayload))
			if err != nil {
				log.Printf("Failed to send alert webhook: %v", err)
				return
			}
			defer resp.Body.Close()
		}()
	}
}

