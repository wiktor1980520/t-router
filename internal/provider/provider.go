package provider

import (
	"context"
	"trouter/internal/models"
)

// Provider defines the interface that all model providers must implement
type Provider interface {
	// Name returns the provider name (e.g., "openai", "anthropic")
	Name() string

	// ChatCompletion handles non-streaming chat completion requests
	ChatCompletion(ctx context.Context, req *models.ChatCompletionRequest) (*models.ChatCompletionResponse, error)

	// ChatCompletionStream handles streaming chat completion requests
	// It writes chunks to the response channel
	ChatCompletionStream(ctx context.Context, req *models.ChatCompletionRequest, responseChan chan<- *models.StreamResponse) error
}
