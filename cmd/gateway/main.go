package main

import (
	"log"
	"os"
	"trouter/internal/api"
	adminApi "trouter/internal/api/admin"
	"trouter/internal/config"
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
	
	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
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
	r.Use(gin.Recovery())
	r.Use(gin.Logger())

	// API Routes (V1 - OpenAI Compatible)
	v1 := r.Group("/v1")
	{
		// Apply API Key Auth Middleware to chat endpoints
		v1.POST("/chat/completions", api.AuthMiddleware(), api.ChatCompletionHandler)
		
		// Health check
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status": "ok",
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
		dashboard.POST("/auth/send-code", api.SendCodeHandler) // SMS Verification
		dashboard.GET("/payment/notify", api.PaymentNotifyHandler) // Webhook endpoint

		// Protected routes
		protected := dashboard.Group("/")
		protected.Use(api.JWTMiddleware())
		{
			protected.GET("/user/me", api.GetMeHandler)
			protected.GET("/user/transactions", api.GetTransactionsHandler)
			protected.POST("/user/recharge", api.RechargeHandler) // Keep for manual/admin
			protected.POST("/payment/create", api.CreatePaymentHandler)
			protected.PUT("/user/settings", api.UpdateSettingsHandler)
			protected.GET("/user/stats", api.GetUserStatsHandler)
			
			protected.GET("/keys", api.ListApiKeysHandler)
			protected.POST("/keys", api.CreateApiKeyHandler)
			protected.DELETE("/keys/:id", api.DeleteApiKeyHandler)
			
			protected.GET("/user/audit_logs", api.GetAuditLogsHandler)

			// Read-only access for regular users
			protected.GET("/providers", api.ListProvidersHandler)
			protected.GET("/routes", api.ListModelRoutesHandler)
			protected.GET("/models", api.ListModelsHandler)
			
			// Playground Chat Endpoint (JWT Auth)
			protected.POST("/chat/completions", api.ChatCompletionHandler)
		}

		// Admin Routes
		admin := dashboard.Group("/admin")
		admin.Use(api.JWTMiddleware(), api.AdminMiddleware())
		{
			// User Management
			admin.GET("/users", api.AdminListUsersHandler)
			admin.GET("/users/:id", api.AdminGetUserHandler)
			admin.PUT("/users/:id/status", api.AdminToggleUserStatusHandler)
			admin.POST("/users/recharge", api.AdminRechargeUserHandler)
			admin.GET("/transactions", api.AdminGetTransactionsHandler)

			// Provider & Model Management (Write Access)
			admin.POST("/providers", api.CreateProviderHandler)
			admin.DELETE("/providers/:id", api.DeleteProviderHandler)
			
			admin.POST("/routes", api.CreateModelRouteHandler)
			admin.DELETE("/routes/:id", api.DeleteModelRouteHandler)
			
			admin.POST("/models", api.CreateModelHandler)
			admin.DELETE("/models/:id", api.DeleteModelHandler)

			// System Config Management
			admin.GET("/config", adminApi.GetSystemConfigHandler)
			admin.PUT("/config", adminApi.UpdateSystemConfigHandler)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting TRouter Gateway on :%s...", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
