package openai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"trouter/internal/models"
	"trouter/internal/provider"
)

type OpenAIProvider struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

type upstreamChatCompletionRequest struct {
	Model         string                `json:"model"`
	Messages      []models.Message      `json:"messages"`
	Stream        bool                  `json:"stream,omitempty"`
	Temperature   float64               `json:"temperature,omitempty"`
	MaxTokens     int                   `json:"max_tokens,omitempty"`
	StreamOptions *models.StreamOptions `json:"stream_options,omitempty"`
}

func buildUpstreamRequest(req *models.ChatCompletionRequest) upstreamChatCompletionRequest {
	return upstreamChatCompletionRequest{
		Model:         req.Model,
		Messages:      req.Messages,
		Stream:        req.Stream,
		Temperature:   req.Temperature,
		MaxTokens:     req.MaxTokens,
		StreamOptions: req.StreamOptions,
	}
}

func NewOpenAIProvider(apiKey string, baseURL string) provider.Provider {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &OpenAIProvider{
		apiKey:  apiKey,
		baseURL: normalizeBaseURL(baseURL),
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *OpenAIProvider) Name() string {
	return "openai"
}

func normalizeBaseURL(baseURL string) string {
	baseURL = strings.TrimSpace(baseURL)
	baseURL = strings.TrimRight(baseURL, "/")
	if strings.HasSuffix(baseURL, "/chat/completions") {
		baseURL = strings.TrimSuffix(baseURL, "/chat/completions")
		baseURL = strings.TrimRight(baseURL, "/")
	}
	return baseURL
}

func joinURLPath(baseURL string, p string) string {
	baseURL = strings.TrimRight(baseURL, "/") + "/"
	u, err := url.Parse(baseURL)
	if err != nil {
		return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(p, "/")
	}
	ref, err := url.Parse(strings.TrimLeft(p, "/"))
	if err != nil {
		return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(p, "/")
	}
	return u.ResolveReference(ref).String()
}

func (p *OpenAIProvider) chatCompletionsURL() string {
	return joinURLPath(p.baseURL, "chat/completions")
}

func (p *OpenAIProvider) ChatCompletion(ctx context.Context, req *models.ChatCompletionRequest) (*models.ChatCompletionResponse, error) {
	// Prepare request body
	upstreamReq := buildUpstreamRequest(req)
	reqBody, err := json.Marshal(upstreamReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.chatCompletionsURL(), bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	p.setHeaders(httpReq)

	// Send request
	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var completionResp models.ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&completionResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	return &completionResp, nil
}

func (p *OpenAIProvider) ChatCompletionStream(ctx context.Context, req *models.ChatCompletionRequest, responseChan chan<- *models.StreamResponse) error {
	// Force stream to true
	req.Stream = true

	upstreamReq := buildUpstreamRequest(req)
	reqBody, err := json.Marshal(upstreamReq)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.chatCompletionsURL(), bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	p.setHeaders(httpReq)
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(body))
	}

	// Read stream
	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("error reading stream: %v", err)
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Handle data: prefix
		if strings.HasPrefix(line, "data:") {
			data := strings.TrimPrefix(line, "data:")
			data = strings.TrimSpace(data)
			if data == "[DONE]" {
				break
			}

			var streamResp models.StreamResponse
			if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
				// Log warning but continue? Or error out?
				// For now, continue
				fmt.Printf("Warning: failed to unmarshal stream response: %v, data: %s\n", err, data)
				continue
			}

			responseChan <- &streamResp
		}
	}

	return nil
}

func (p *OpenAIProvider) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	if requestID := provider.RequestIDFromContext(req.Context()); requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}
}
