package main

import (
	"log"
	"os"
	"time"
	"trouter/internal/api"
	adminApi "trouter/internal/api/admin"
	"trouter/internal/config"
	"trouter/internal/router"
	"trouter/internal/sms"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	} else {
		log.Println("Loaded environment variables from .env")
	}

	// Initialize Database
	config.InitDB()

	// Initialize SMS Provider
	if err := sms.Init(); err != nil {
		log.Printf("Warning: Failed to initialize SMS provider: %v. Using Mock Provider.", err)
	} else {
		log.Println("SMS Provider initialized successfully.")
	}

	// Start Health Check Worker
	// Default 60 seconds, can be overridden by HEALTH_CHECK_INTERVAL environment variable
	intervalStr := os.Getenv("HEALTH_CHECK_INTERVAL")
	interval := 60 * time.Second
	if intervalStr != "" {
		if d, err := time.ParseDuration(intervalStr); err == nil {
			interval = d
		}
	}
	router.StartHealthCheckWorker(interval)

	r := gin.New()
	r.Use(api.RequestIDMiddleware())

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Global Middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// API Routes (V1 - OpenAI Compatible)
	v1 := r.Group("/v1")
	{
		// Apply API Key Auth Middleware to chat endpoints
		v1.POST("/chat/completions", api.AuthMiddleware(), api.ChatCompletionHandler)
		v1.GET("/models", api.AuthMiddleware(), api.ListV1ModelsHandler)

		// Health check
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "ok",
				"service": "TRouter Gateway",
			})
		})
	}

	// Dashboard API Routes
	dashboard := r.Group("/api")
	{
		// Public routes
		dashboard.POST("/auth/register", api.RegisterHandler)
		dashboard.POST("/auth/login", api.LoginHandler)
		dashboard.POST("/auth/send-code", api.SendCodeHandler)     // SMS Verification
		dashboard.GET("/payment/notify", api.PaymentNotifyHandler) // Webhook endpoint

		// Protected routes
		protected := dashboard.Group("/")
		protected.Use(api.JWTMiddleware())
		{
			protected.GET("/user/me", api.GetMeHandler)
			protected.GET("/user/transactions", api.GetTransactionsHandler)
			protected.GET("/user/subscription", api.GetMySubscriptionHandler)
			protected.POST("/user/recharge", api.RechargeHandler) // Keep for manual/admin
			protected.POST("/payment/create", api.CreatePaymentHandler)
			protected.PUT("/user/settings", api.UpdateSettingsHandler)
			protected.PUT("/user/password", api.ChangePasswordHandler)
			protected.GET("/user/stats", api.GetUserStatsHandler)

			protected.POST("/team", api.CreateOrganizationHandler)
			protected.GET("/team", api.ListMyOrganizationsHandler)
			protected.GET("/team/:id", api.GetOrganizationHandler)
			protected.PUT("/team/:id", api.UpdateOrganizationHandler)
			protected.DELETE("/team/:id", api.DissolveOrganizationHandler)
			protected.POST("/team/:id/members", api.AddOrganizationMemberHandler)
			protected.DELETE("/team/:id/members/:user_id", api.RemoveOrganizationMemberHandler)
			protected.POST("/team/:id/api-keys/:key_id/attach", api.AttachApiKeyToOrganizationHandler)
			protected.GET("/team/:id/audit_logs/export", api.ExportOrganizationAuditLogsHandler)
			protected.GET("/keys", api.ListApiKeysHandler)
			protected.POST("/keys", api.CreateApiKeyHandler)
			protected.DELETE("/keys/:id", api.DeleteApiKeyHandler)

			protected.GET("/user/audit_logs", api.GetAuditLogsHandler)

			// Read-only access for regular users
			protected.GET("/providers", api.ListProvidersHandler)
			protected.GET("/routes", api.ListModelRoutesHandler)
			protected.GET("/models", api.ListModelsHandler)
			protected.GET("/models/available", api.ListAvailableModelsHandler)

			// Playground Chat Endpoint (JWT Auth)
			protected.POST("/chat/completions", api.ChatCompletionHandler)
		}

		// Admin Routes
		admin := dashboard.Group("/admin")
		admin.Use(api.JWTMiddleware(), api.AdminMiddleware())
		{
			admin.GET("/metrics/overview", api.AdminMetricsOverviewHandler)
			admin.GET("/metrics/invitations", api.AdminInvitationMetricsHandler)
			admin.GET("/subscription-plans", api.AdminListSubscriptionPlansHandler)
			admin.POST("/subscription-plans", api.AdminCreateSubscriptionPlanHandler)
			admin.PUT("/subscription-plans/:id", api.AdminUpdateSubscriptionPlanHandler)
			admin.DELETE("/subscription-plans/:id", api.AdminDeleteSubscriptionPlanHandler)
			admin.POST("/subscriptions/grant", api.AdminGrantSubscriptionHandler)

			// User Management
			admin.GET("/users", api.AdminListUsersHandler)
			admin.GET("/users/:id", api.AdminGetUserHandler)
			admin.PUT("/users/:id", api.AdminUpdateUserHandler)
			admin.PUT("/users/:id/status", api.AdminToggleUserStatusHandler)
			admin.POST("/users/recharge", api.AdminRechargeUserHandler)
			admin.GET("/transactions", api.AdminGetTransactionsHandler)

			// Invitation Code Management
			admin.GET("/invitation-codes", api.AdminListInvitationCodesHandler)
			admin.POST("/invitation-codes", api.AdminCreateInvitationCodeHandler)
			admin.DELETE("/invitation-codes/:id", api.AdminDeleteInvitationCodeHandler)

			// Provider & Model Management (Write Access)
			admin.POST("/providers", api.CreateProviderHandler)
			admin.DELETE("/providers/:id", api.DeleteProviderHandler)
			admin.PUT("/providers/:id", api.UpdateProviderHandler)

			admin.POST("/routes", api.CreateModelRouteHandler)
			admin.DELETE("/routes/:id", api.DeleteModelRouteHandler)

			admin.POST("/models", api.CreateModelHandler)
			admin.DELETE("/models/:id", api.DeleteModelHandler)

			// System Config Management
			admin.GET("/config", adminApi.GetSystemConfigHandler)
			admin.PUT("/config", adminApi.UpdateSystemConfigHandler)
			admin.GET("/db/schema", api.AdminDbSchemaHandler)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting TRouter Gateway on :%s...", port)
	log.Printf("Version: %s, BuildTime: %s, Commit: %s", config.Version, config.BuildTime, config.CommitHash)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
