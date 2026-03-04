package sms

import (
	"context"
	"fmt"
	"os"
)

// Provider defines the interface for sending SMS messages
type Provider interface {
	Send(ctx context.Context, phone string, templateCode string, templateParams map[string]string) error
}

var GlobalProvider Provider

// Init initializes the SMS provider based on environment variables
func Init() error {
	// Default to Mock provider
	GlobalProvider = &MockProvider{}
	
	providerType := os.Getenv("SMS_PROVIDER")
	
	switch providerType {
	case "aliyun":
		p, err := NewAliyunProvider()
		if err != nil {
			return err
		}
		GlobalProvider = p
	case "mock":
		// Already set
		fmt.Println("Using Mock SMS Provider")
	default:
		if providerType != "" {
			fmt.Printf("Unknown SMS provider: %s, using Mock\n", providerType)
		}
	}
	return nil
}

// MockProvider is a mock implementation for development
type MockProvider struct{}

func (m *MockProvider) Send(ctx context.Context, phone string, templateCode string, templateParams map[string]string) error {
	// Log the SMS content (already handled in api/sms.go, but good to have here too)
	fmt.Printf("[Mock SMS] To: %s, Template: %s, Params: %v\n", phone, templateCode, templateParams)
	return nil
}
