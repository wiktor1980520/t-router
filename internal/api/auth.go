package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))
var turnstileSecretKey = os.Getenv("TURNSTILE_SECRET_KEY")

func init() {
	if len(jwtSecret) == 0 {
		jwtSecret = []byte("default-secret-key-change-me")
	}
}

// VerifyTurnstile checks the token with Cloudflare
func VerifyTurnstile(token string, ip string) bool {
	if turnstileSecretKey == "" {
		return true // Skip verification if key is not set (dev mode)
	}
	
	// Use Cloudflare's verification API
	// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
	
	// Simple implementation using http.PostForm
	resp, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify",
		map[string][]string{
			"secret":   {turnstileSecretKey},
			"response": {token},
			"remoteip": {ip},
		})
		
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	
	var result struct {
		Success bool `json:"success"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}
	
	return result.Success
}

// GenerateToken creates a JWT token for a user
func GenerateToken(userID string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// Register creates a new user
func RegisterHandler(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Turnstile
	// if !VerifyTurnstile(req.TurnstileToken, c.ClientIP()) {
	// 	c.JSON(http.StatusForbidden, gin.H{"error": "Turnstile verification failed"})
	// 	return
	// }

	// Check if user exists
	var existingUser models.User
	if err := config.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	// Check if phone exists
	if req.Phone != "" {
		var phoneUser models.User
		if err := config.DB.Where("phone = ?", req.Phone).First(&phoneUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Phone number already registered"})
			return
		}

		// Verify SMS code
		if !verifyCode(req.Phone, req.VerificationCode) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification code"})
			return
		}
	} else {
		// Phone is mandatory now per requirements?
		// User said "Register page needs phone number, and needs SMS verification".
		// So phone is mandatory.
		c.JSON(http.StatusBadRequest, gin.H{"error": "Phone number is required"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Get initial balance from SystemConfig
	var initialBalance float64 = 0
	var configItem models.SystemConfig
	if err := config.DB.Where("key = ?", "new_user_gift_amount").First(&configItem).Error; err == nil {
		if val, err := strconv.ParseFloat(configItem.Value, 64); err == nil {
			initialBalance = val
		}
	}

	phonePtr := &req.Phone
	user := models.User{
		Email:        req.Email,
		Phone:        phonePtr,
		PasswordHash: string(hashedPassword),
		Balance:      initialBalance, // Set from config
	}

	if err := config.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Create a transaction record for the gift if amount > 0
	if initialBalance > 0 {
		transaction := models.Transaction{
			UserID:      user.ID,
			Type:        "gift",
			Amount:      initialBalance,
			Description: "New User Registration Gift",
			Status:      "completed",
		}
		config.DB.Create(&transaction)
	}

	// Generate token
	token, err := GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

// Login authenticates a user
func LoginHandler(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Turnstile
	// if !VerifyTurnstile(req.TurnstileToken, c.ClientIP()) {
	// 	c.JSON(http.StatusForbidden, gin.H{"error": "Turnstile verification failed"})
	// 	return
	// }

	var user models.User
	if err := config.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate token
	token, err := GenerateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token: token,
		User:  user,
	})
}

// GetMe returns the current user's profile
func GetMeHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}
