package models

// ChatCompletionRequest represents the request body for /chat/completions
type ChatCompletionRequest struct {
	Model       string    `json:"model" binding:"required"`
	Messages    []Message `json:"messages" binding:"required"`
	Stream      bool      `json:"stream"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
	
	// Routing Extensions
	RoutingStrategy   string        `json:"routing_strategy,omitempty"`
	ProviderAllowlist []string      `json:"provider_allowlist,omitempty"`
	StreamOptions     *StreamOptions `json:"stream_options,omitempty"`
}

type StreamOptions struct {
	IncludeUsage bool `json:"include_usage,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionResponse represents the standard non-streaming response
type ChatCompletionResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens      int     `json:"total_tokens"`
	TotalCost        float64 `json:"total_cost"` // Extension
}

// StreamResponse represents a chunk in the SSE stream
type StreamResponse struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	Created int64          `json:"created"`
	Model   string         `json:"model"`
	Choices []StreamChoice `json:"choices"`
	Usage   *Usage         `json:"usage,omitempty"` // For stream_options: {"include_usage": true}
}

type StreamChoice struct {
	Index        int           `json:"index"`
	Delta        MessageDelta  `json:"delta"`
	FinishReason *string       `json:"finish_reason"`
}

type MessageDelta struct {
	Role             string `json:"role,omitempty"`
	Content          string `json:"content,omitempty"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// --- Auth & User Models ---

type LoginRequest struct {
	Email          string `json:"email" binding:"required,email"`
	Password       string `json:"password" binding:"required"`
	TurnstileToken string `json:"turnstile_token"`
}

type RegisterRequest struct {
	Email            string `json:"email" binding:"required,email"`
	Password         string `json:"password" binding:"required,min=6"`
	Phone            string `json:"phone" binding:"required"`
	VerificationCode string `json:"verification_code" binding:"required"`
	TurnstileToken   string `json:"turnstile_token"`
}

type SendCodeRequest struct {
	Phone          string `json:"phone" binding:"required"`
	TurnstileToken string `json:"turnstile_token"`
}

type UpdatePhoneRequest struct {
	Phone            string `json:"phone" binding:"required"`
	VerificationCode string `json:"verification_code" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateApiKeyRequest struct {
	Label             string `json:"label" binding:"required"`
	RoutingPreference string `json:"routing_preference"` // 'lowest_cost', 'lowest_latency'
	AllowedModels     []string `json:"allowed_models,omitempty"`
}

type BalanceAlertRequest struct {
	Threshold float64 `json:"threshold" binding:"required"`
}

