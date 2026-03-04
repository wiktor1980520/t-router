package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Email     string    `gorm:"uniqueIndex;not null" json:"email"`
	Phone     *string   `gorm:"uniqueIndex;size:20" json:"phone"` // Optional unique phone number
	PasswordHash string `gorm:"default:'';not null" json:"-"`
	Balance   float64   `gorm:"type:decimal(20,8);default:0" json:"balance"`
	BalanceAlertThreshold float64 `gorm:"type:decimal(20,8);default:10.00" json:"balance_alert_threshold"` // Default alert at $10
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	
	ApiKeys   []ApiKey  `gorm:"foreignKey:UserID" json:"api_keys,omitempty"`
	Transactions []Transaction `gorm:"foreignKey:UserID" json:"transactions,omitempty"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return
}

type ApiKey struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	UserID    string    `gorm:"size:36;not null;index" json:"user_id"`
	KeyHash   string    `gorm:"uniqueIndex;not null" json:"key"` // Store hash, not raw key (Exposed as "key" for MVP)
	KeyPrefix string    `gorm:"size:10;not null" json:"key_prefix"`
	Label     string    `gorm:"size:50" json:"label"`
	RoutingPreference string `gorm:"size:20;default:'lowest_cost'" json:"routing_preference"`
	ExpiresAt *time.Time `json:"expires_at"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

func (k *ApiKey) BeforeCreate(tx *gorm.DB) (err error) {
	if k.ID == "" {
		k.ID = uuid.New().String()
	}
	return
}

type Transaction struct {
	ID          string    `gorm:"primaryKey;size:36" json:"id"`
	UserID      string    `gorm:"size:36;not null;index" json:"user_id"`
	Type        string    `gorm:"size:20;not null" json:"type"` // "recharge", "consumption"
	Amount      float64   `gorm:"type:decimal(20,8);not null" json:"amount"`
	Status      string    `gorm:"size:20;default:'completed'" json:"status"` // "pending", "completed", "failed"
	PaymentMethod string  `gorm:"size:50" json:"payment_method"` // "alipay", "wxpay", "system"
	Description string    `gorm:"size:255" json:"description"`
	ReferenceID string    `gorm:"size:100;index" json:"reference_id"` // e.g., request ID or payment ID
	CreatedAt   time.Time `json:"created_at"`
}

func (t *Transaction) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	return
}

// Model represents a unified model definition with retail pricing
type Model struct {
	ID                string    `gorm:"primaryKey;size:100" json:"id"` // e.g., "gpt-4"
	Name              string    `gorm:"size:100;not null" json:"name"`
	Description       string    `gorm:"type:text" json:"description"`
	ContextLength     int       `json:"context_length"`
	RetailPriceInput  float64   `gorm:"type:decimal(20,8);default:0" json:"retail_price_input"`  // Price per 1M tokens
	RetailPriceOutput float64   `gorm:"type:decimal(20,8);default:0" json:"retail_price_output"` // Price per 1M tokens
	IsActive          bool      `gorm:"default:true" json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Provider represents an upstream model provider (e.g., OpenAI, Groq)
type Provider struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:50;not null;unique" json:"name"`
	Type      string    `gorm:"size:20;not null" json:"type"` // openai, azure, anthropic
	BaseURL   string    `gorm:"size:255;not null" json:"base_url"`
	ApiKey    string    `gorm:"size:255;not null" json:"-"`
	Weight    int       `gorm:"default:10" json:"weight"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ModelRoute defines which provider serves which model and at what cost
type ModelRoute struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ModelName  string    `gorm:"size:50;not null;index" json:"model_name"` // e.g. "gpt-4"
	ProviderID uint      `gorm:"not null;index" json:"provider_id"`
	Provider   Provider  `gorm:"foreignKey:ProviderID" json:"provider"`
	CostInput  float64   `gorm:"type:decimal(20,10);default:0" json:"cost_input"`  // Cost per 1M tokens
	CostOutput float64   `gorm:"type:decimal(20,10);default:0" json:"cost_output"` // Cost per 1M tokens
	Priority   int       `gorm:"default:0" json:"priority"`                        // Higher = preferred
	IsActive   bool      `gorm:"default:true" json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// AuditLog records every request for compliance and billing
type AuditLog struct {
	ID               string    `gorm:"primaryKey;size:36" json:"id"`
	RequestID        string    `gorm:"size:64;index;not null" json:"request_id"`
	UserID           string    `gorm:"size:36;index;not null" json:"user_id"`
	Model            string    `gorm:"size:50;index" json:"model"`
	ProviderID       uint      `gorm:"index" json:"provider_id"`
	PromptTokens     int       `json:"prompt_tokens"`
	CompletionTokens int       `json:"completion_tokens"`
	TotalCost        float64   `gorm:"type:decimal(20,10)" json:"total_cost"`
	LatencyMS        int64     `json:"latency_ms"`
	StatusCode       int       `json:"status_code"`
	ClientIP         string    `gorm:"size:45" json:"client_ip"`
	CreatedAt        time.Time `json:"created_at"`
}

func (l *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	if l.ID == "" {
		l.ID = uuid.New().String()
	}
	return
}
