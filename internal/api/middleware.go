package api

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"
	"trouter/internal/provider"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	ContextKeyUser   = "user"
	ContextKeyApiKey = "api_key"
)

type rateWindow struct {
	start time.Time
	count int
}

var rateLimitMu sync.Mutex
var rateLimitState = map[string]rateWindow{}

func hashApiKey(raw string) string {
	pepper := strings.TrimSpace(os.Getenv("API_KEY_PEPPER"))
	if pepper == "" {
		pepper = string(jwtSecret)
	}
	sum := sha256.Sum256([]byte(pepper + ":" + raw))
	return "sha256:" + hex.EncodeToString(sum[:])
}

func extractBearerToken(authHeader string) (string, bool) {
	if authHeader == "" {
		return "", false
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && parts[0] == "Bearer" && strings.TrimSpace(parts[1]) != "" {
		return strings.TrimSpace(parts[1]), true
	}
	if strings.HasPrefix(authHeader, "sk-") {
		return strings.TrimSpace(authHeader), true
	}
	return "", false
}

func abortWithRequestID(c *gin.Context, status int, payload gin.H) {
	if payload == nil {
		payload = gin.H{}
	}
	if _, ok := payload["request_id"]; !ok {
		if rid := c.GetString("request_id"); rid != "" {
			payload["request_id"] = rid
		}
	}
	c.AbortWithStatusJSON(status, payload)
}

func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Request = c.Request.WithContext(provider.WithRequestID(c.Request.Context(), requestID))
		c.Next()
	}
}

func JWTMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Invalid Authorization format"})
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
			return
		}

		c.Set("user_id", userID)
		var user models.User
		if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if !user.IsActive {
			abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "User account is disabled"})
			return
		}
		c.Set(ContextKeyUser, &user)
		c.Next()
	}
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := extractBearerToken(c.GetHeader("Authorization"))
		if !ok {
			token = strings.TrimSpace(c.GetHeader("X-API-Key"))
		}
		if token == "" {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Missing API key"})
			return
		}

		// 1. Verify API Key
		var apiKey models.ApiKey
		hashed := hashApiKey(token)
		if err := config.DB.Where("key_hash = ? AND is_active = ?", hashed, true).First(&apiKey).Error; err != nil {
			legacyRes := config.DB.Where("key_hash = ? AND is_active = ?", token, true).First(&apiKey)
			if legacyRes.Error != nil {
				abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "Invalid API Key"})
				return
			}
			apiKey.KeyHash = hashed
			config.DB.Save(&apiKey)
		}

		if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "API key expired"})
			return
		}

		effectiveLimit := apiKey.RateLimit
		if s := activeSubscriptionRateLimit(apiKey.UserID); s > effectiveLimit {
			effectiveLimit = s
		}

		if effectiveLimit > 0 {
			now := time.Now()
			rateLimitMu.Lock()
			w := rateLimitState[apiKey.ID]
			if w.start.IsZero() || now.Sub(w.start) >= time.Minute {
				w = rateWindow{start: now, count: 0}
			}
			if w.count >= effectiveLimit {
				rateLimitState[apiKey.ID] = w
				rateLimitMu.Unlock()
				abortWithRequestID(c, http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
				return
			}
			w.count++
			rateLimitState[apiKey.ID] = w
			rateLimitMu.Unlock()
		}

		// 2. Get User & Check Balance
		var user models.User
		if err := config.DB.First(&user, "id = ?", apiKey.UserID).Error; err != nil {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		if !user.IsActive {
			abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "User account is disabled"})
			return
		}

		if apiKey.OrgID != nil && strings.TrimSpace(*apiKey.OrgID) != "" {
			orgID := strings.TrimSpace(*apiKey.OrgID)
			var org models.Organization
			if err := config.DB.First(&org, "id = ? AND is_active = ?", orgID, true).Error; err != nil {
				abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "Organization not found"})
				return
			}
			var member models.OrgMember
			if err := config.DB.First(&member, "org_id = ? AND user_id = ?", orgID, user.ID).Error; err != nil {
				abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "Organization access denied"})
				return
			}

			if org.MonthlyBudget > 0 && strings.HasSuffix(c.Request.URL.Path, "/chat/completions") {
				period := time.Now().Format("2006-01")
				var usage models.OrgUsage
				if err := config.DB.Where("org_id = ? AND period = ?", orgID, period).First(&usage).Error; err == nil {
					if usage.Spent >= org.MonthlyBudget {
						abortWithRequestID(c, http.StatusPaymentRequired, gin.H{"error": "Organization budget exceeded"})
						return
					}
				}
			}

			c.Set("org_id", orgID)
		}

		c.Set("user_id", user.ID)
		c.Set(ContextKeyUser, &user)
		c.Set(ContextKeyApiKey, &apiKey)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "User ID not found in context"})
			return
		}

		var user models.User
		if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
			abortWithRequestID(c, http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		if !user.IsActive {
			abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "User account is disabled"})
			return
		}

		if !user.IsAdmin {
			abortWithRequestID(c, http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}

		c.Next()
	}
}
