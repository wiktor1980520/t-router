package router

import (
	"context"
	"log"
	"net/http"
	"time"

	"trouter/internal/config"
	"trouter/internal/models"
)

// StartHealthCheckWorker starts a background goroutine to periodically check route latency
func StartHealthCheckWorker(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		log.Println("Starting Health Check Worker...")
		for range ticker.C {
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
		return
	}

	resp, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		log.Printf("HealthCheck: Route %d (%s) failed: %v", route.ID, route.Provider.Name, err)
		// Set to 0 to indicate high latency/unreachable
		updateRouteLatency(route.ID, 0)
		return
	}
	defer resp.Body.Close()

	// Update DB
	log.Printf("HealthCheck: Route %d (%s) latency: %dms", route.ID, route.Provider.Name, latency)
	updateRouteLatency(route.ID, int(latency))
}

func updateRouteLatency(routeID uint, latencyMs int) {
	// Use pure SQL or GORM to update just the latency fields
	err := config.DB.Model(&models.ModelRoute{}).
		Where("id = ?", routeID).
		Updates(map[string]interface{}{
			"latency":    latencyMs,
			"last_check": time.Now(),
		}).Error

	if err != nil {
		log.Printf("HealthCheck: Failed to update latency for route %d: %v", routeID, err)
	}
}
