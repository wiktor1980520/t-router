package anthropic

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"trouter/internal/models"
	"trouter/internal/provider"
)

type AnthropicProvider struct {
	apiKey          string
	baseURL         string
	anthropicVersion string
	client          *http.Client
}

type anthropicTextBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type anthropicMessage struct {
	Role    string              `json:"role"`
	Content []anthropicTextBlock `json:"content"`
}

type anthropicMessagesRequest struct {
	Model       string            `json:"model"`
	MaxTokens   int               `json:"max_tokens"`
	Messages    []anthropicMessage `json:"messages"`
	System      string            `json:"system,omitempty"`
	Temperature float64           `json:"temperature,omitempty"`
	Stream      bool              `json:"stream,omitempty"`
}

type anthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type anthropicMessagesResponse struct {
	ID      string              `json:"id"`
	Type    string              `json:"type"`
	Role    string              `json:"role"`
	Content []anthropicTextBlock `json:"content"`
	Usage   anthropicUsage      `json:"usage"`
}

type anthropicErrorResponse struct {
	Error struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

func NewAnthropicProvider(apiKey string, baseURL string) provider.Provider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://api.anthropic.com"
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")

	version := strings.TrimSpace(os.Getenv("ANTHROPIC_VERSION"))
	if version == "" {
		version = "2023-06-01"
	}

	return &AnthropicProvider{
		apiKey:          apiKey,
		baseURL:         baseURL,
		anthropicVersion: version,
		client:          &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *AnthropicProvider) Name() string {
	return "anthropic"
}

func (p *AnthropicProvider) messagesURL() string {
	u, err := url.Parse(p.baseURL + "/")
	if err != nil {
		return strings.TrimRight(p.baseURL, "/") + "/v1/messages"
	}
	ref, _ := url.Parse("v1/messages")
	return u.ResolveReference(ref).String()
}

func contentToBlocks(content interface{}) []anthropicTextBlock {
	switch v := content.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return []anthropicTextBlock{{Type: "text", Text: ""}}
		}
		return []anthropicTextBlock{{Type: "text", Text: v}}
	case []interface{}:
		blocks := make([]anthropicTextBlock, 0, len(v))
		for _, item := range v {
			m, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			t, _ := m["type"].(string)
			if t == "" {
				continue
			}
			if t == "text" {
				txt, _ := m["text"].(string)
				blocks = append(blocks, anthropicTextBlock{Type: "text", Text: txt})
			}
		}
		if len(blocks) > 0 {
			return blocks
		}
		return []anthropicTextBlock{{Type: "text", Text: fmt.Sprintf("%v", content)}}
	default:
		return []anthropicTextBlock{{Type: "text", Text: fmt.Sprintf("%v", content)}}
	}
}

func toAnthropicRequest(req *models.ChatCompletionRequest) anthropicMessagesRequest {
	systemParts := make([]string, 0)
	msgs := make([]anthropicMessage, 0, len(req.Messages))

	for _, m := range req.Messages {
		role := strings.ToLower(strings.TrimSpace(m.Role))
		if role == "system" {
			if s, ok := m.Content.(string); ok {
				systemParts = append(systemParts, s)
			} else {
				systemParts = append(systemParts, fmt.Sprintf("%v", m.Content))
			}
			continue
		}
		if role != "user" && role != "assistant" {
			role = "user"
		}
		msgs = append(msgs, anthropicMessage{
			Role:    role,
			Content: contentToBlocks(m.Content),
		})
	}

	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 1024
	}

	out := anthropicMessagesRequest{
		Model:       req.Model,
		MaxTokens:   maxTokens,
		Messages:    msgs,
		Temperature: req.Temperature,
		Stream:      req.Stream,
	}
	if len(systemParts) > 0 {
		out.System = strings.Join(systemParts, "\n")
	}
	return out
}

func blocksToText(blocks []anthropicTextBlock) string {
	var b strings.Builder
	for _, blk := range blocks {
		if blk.Type == "text" {
			b.WriteString(blk.Text)
		}
	}
	return b.String()
}

func (p *AnthropicProvider) setHeaders(r *http.Request) {
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("x-api-key", p.apiKey)
	r.Header.Set("anthropic-version", p.anthropicVersion)
}

func (p *AnthropicProvider) ChatCompletion(ctx context.Context, req *models.ChatCompletionRequest) (*models.ChatCompletionResponse, error) {
	upstreamReq := toAnthropicRequest(req)
	upstreamReq.Stream = false

	body, err := json.Marshal(upstreamReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.messagesURL(), bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	p.setHeaders(httpReq)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		var er anthropicErrorResponse
		if json.Unmarshal(raw, &er) == nil && er.Error.Message != "" {
			return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, er.Error.Message)
		}
		return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(raw))
	}

	var ar anthropicMessagesResponse
	if err := json.NewDecoder(resp.Body).Decode(&ar); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	text := blocksToText(ar.Content)
	finish := "stop"

	out := &models.ChatCompletionResponse{
		ID:      ar.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   req.Model,
		Choices: []models.Choice{
			{
				Index: 0,
				Message: models.Message{
					Role:    "assistant",
					Content: text,
				},
				FinishReason: finish,
			},
		},
		Usage: models.Usage{
			PromptTokens:     ar.Usage.InputTokens,
			CompletionTokens: ar.Usage.OutputTokens,
			TotalTokens:      ar.Usage.InputTokens + ar.Usage.OutputTokens,
		},
	}
	return out, nil
}

type anthropicStreamEvent struct {
	Type  string          `json:"type"`
	Delta json.RawMessage `json:"delta,omitempty"`
	Usage *anthropicUsage `json:"usage,omitempty"`
}

type anthropicContentDelta struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

func (p *AnthropicProvider) ChatCompletionStream(ctx context.Context, req *models.ChatCompletionRequest, responseChan chan<- *models.StreamResponse) error {
	upstreamReq := toAnthropicRequest(req)
	upstreamReq.Stream = true

	body, err := json.Marshal(upstreamReq)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.messagesURL(), bytes.NewBuffer(body))
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

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(raw))
	}

	reader := bufio.NewReader(resp.Body)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("error reading stream: %v", err)
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}

		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			return nil
		}

		var ev anthropicStreamEvent
		if err := json.Unmarshal([]byte(payload), &ev); err != nil {
			continue
		}

		if ev.Type == "content_block_delta" {
			var d anthropicContentDelta
			if err := json.Unmarshal(ev.Delta, &d); err != nil {
				continue
			}
			if d.Type != "text_delta" || d.Text == "" {
				continue
			}

			responseChan <- &models.StreamResponse{
				ID:      "chatcmpl-" + strings.ReplaceAll(strings.TrimPrefix(ev.Type, ""), " ", ""),
				Object:  "chat.completion.chunk",
				Created: time.Now().Unix(),
				Model:   req.Model,
				Choices: []models.StreamChoice{
					{
						Index: 0,
						Delta: models.MessageDelta{
							Content: d.Text,
						},
					},
				},
			}
			continue
		}

		if ev.Type == "message_stop" {
			return nil
		}
	}
}

