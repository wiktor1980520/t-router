package api

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"time"
	"trouter/internal/config"
	"trouter/internal/models"
	"trouter/internal/sms"

	"github.com/gin-gonic/gin"
)

// SendCodeHandler sends an SMS verification code
func SendCodeHandler(c *gin.Context) {
	var req models.SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify Turnstile
	if !VerifyTurnstile(req.TurnstileToken, c.ClientIP()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Turnstile verification failed"})
		return
	}

	// Generate 6-digit code
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	code := fmt.Sprintf("%06d", rng.Intn(1000000))

	// Save to database
	vc := models.VerificationCode{
		Phone:     req.Phone,
		Code:      code,
		ExpiresAt: time.Now().Add(10 * time.Minute), // Valid for 10 minutes
	}

	// Clean up old codes for this phone
	config.DB.Where("phone = ?", req.Phone).Delete(&models.VerificationCode{})

	if err := config.DB.Create(&vc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate verification code"})
		return
	}

	// Send SMS using the configured provider
	templateCode := os.Getenv("SMS_TEMPLATE_CODE")
	if templateCode == "" {
		// Fallback for mock/dev
		templateCode = "SMS_TEST" 
	}
	
	params := map[string]string{
		"code": code,
	}
	
	if sms.GlobalProvider == nil {
		// Should not happen if Init() is called, but safety first
		fmt.Println("Warning: SMS GlobalProvider is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "SMS service not initialized"})
		return
	}
	
	if err := sms.GlobalProvider.Send(c.Request.Context(), req.Phone, templateCode, params); err != nil {
		fmt.Printf("Failed to send SMS to %s: %v\n", req.Phone, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification code"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Verification code sent"})
}

// verifyCode checks if the code is valid for the given phone number
func verifyCode(phone, code string) bool {
	// Support universal fixed code
	if code == "202602" {
		return true
	}
	var vc models.VerificationCode
	err := config.DB.Where("phone = ? AND code = ? AND expires_at > ?", phone, code, time.Now()).First(&vc).Error
	return err == nil
}
