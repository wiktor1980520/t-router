package factory

import (
	"fmt"
	"trouter/internal/models"
	"trouter/internal/provider"
	"trouter/internal/provider/anthropic"
	"trouter/internal/provider/gemini"
	"trouter/internal/provider/openai"
)

// NewProvider creates a new provider instance based on the database record
func NewProvider(p *models.Provider) (provider.Provider, error) {
	switch p.Type {
	case "openai":
		return openai.NewOpenAIProvider(p.ApiKey, p.BaseURL), nil
	case "azure":
		// Placeholder for Azure implementation
		// return openai.NewAzureProvider(p.ApiKey, p.BaseURL, p.ApiVersion), nil
		return nil, fmt.Errorf("provider type 'azure' not yet implemented")
	case "anthropic":
		return anthropic.NewAnthropicProvider(p.ApiKey, p.BaseURL), nil
	case "gemini":
		return gemini.NewGeminiProvider(p.ApiKey, p.BaseURL), nil
	default:
		// Default to OpenAI compatible if type is unknown but has base URL
		// This handles "moonshot", "deepseek", etc. if they are just labeled as such but use OpenAI protocol
		// Or we can explicitly support "openai-compatible" type
		if p.BaseURL != "" {
			return openai.NewOpenAIProvider(p.ApiKey, p.BaseURL), nil
		}
		return nil, fmt.Errorf("unsupported provider type: %s", p.Type)
	}
}
