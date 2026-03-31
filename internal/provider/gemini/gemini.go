package gemini

import (
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

type GeminiProvider struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

type geminiPart struct {
	Text string `json:"text,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiGenerationConfig struct {
	Temperature      float64 `json:"temperature,omitempty"`
	MaxOutputTokens  int     `json:"maxOutputTokens,omitempty"`
}

type geminiRequest struct {
	Contents          []geminiContent         `json:"contents"`
	SystemInstruction *geminiContent          `json:"systemInstruction,omitempty"`
	GenerationConfig  *geminiGenerationConfig `json:"generationConfig,omitempty"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	UsageMetadata *struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata,omitempty"`
}

type geminiErrorResponse struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

func NewGeminiProvider(apiKey string, baseURL string) provider.Provider {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "https://generativelanguage.googleapis.com/v1beta"
	}
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	return &GeminiProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *GeminiProvider) Name() string {
	return "gemini"
}

func (p *GeminiProvider) generateContentURL(model string) (string, error) {
	m := strings.TrimSpace(model)
	if m == "" {
		return "", fmt.Errorf("model is required")
	}
	if !strings.HasPrefix(m, "models/") {
		m = "models/" + m
	}

	u, err := url.Parse(p.baseURL + "/")
	if err != nil {
		return "", err
	}
	ref, err := url.Parse(m + ":generateContent")
	if err != nil {
		return "", err
	}
	full := u.ResolveReference(ref)
	q := full.Query()
	q.Set("key", p.apiKey)
	full.RawQuery = q.Encode()
	return full.String(), nil
}

func toGeminiRequest(req *models.ChatCompletionRequest) geminiRequest {
	systemParts := make([]string, 0)
	contents := make([]geminiContent, 0, len(req.Messages))

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

		gRole := "user"
		if role == "assistant" {
			gRole = "model"
		}

		var txt string
		if s, ok := m.Content.(string); ok {
			txt = s
		} else {
			txt = fmt.Sprintf("%v", m.Content)
		}

		contents = append(contents, geminiContent{
			Role:  gRole,
			Parts: []geminiPart{{Text: txt}},
		})
	}

	var sys *geminiContent
	if len(systemParts) > 0 {
		sys = &geminiContent{
			Parts: []geminiPart{{Text: strings.Join(systemParts, "\n")}},
		}
	}

	var genCfg *geminiGenerationConfig
	if req.Temperature != 0 || req.MaxTokens != 0 {
		genCfg = &geminiGenerationConfig{
			Temperature:     req.Temperature,
			MaxOutputTokens: req.MaxTokens,
		}
	}

	return geminiRequest{
		Contents:          contents,
		SystemInstruction: sys,
		GenerationConfig:  genCfg,
	}
}

func (p *GeminiProvider) ChatCompletion(ctx context.Context, req *models.ChatCompletionRequest) (*models.ChatCompletionResponse, error) {
	urlStr, err := p.generateContentURL(req.Model)
	if err != nil {
		return nil, err
	}

	upReq := toGeminiRequest(req)
	body, err := json.Marshal(upReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", urlStr, bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var er geminiErrorResponse
		if json.Unmarshal(raw, &er) == nil && er.Error.Message != "" {
			return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, er.Error.Message)
		}
		return nil, fmt.Errorf("upstream error (status %d): %s", resp.StatusCode, string(raw))
	}

	var gr geminiResponse
	if err := json.Unmarshal(raw, &gr); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	text := ""
	if len(gr.Candidates) > 0 {
		for _, part := range gr.Candidates[0].Content.Parts {
			text += part.Text
		}
	}

	promptTokens := 0
	completionTokens := 0
	totalTokens := 0
	if gr.UsageMetadata != nil {
		promptTokens = gr.UsageMetadata.PromptTokenCount
		completionTokens = gr.UsageMetadata.CandidatesTokenCount
		totalTokens = gr.UsageMetadata.TotalTokenCount
	}

	out := &models.ChatCompletionResponse{
		ID:      "chatcmpl-" + fmt.Sprintf("%d", time.Now().UnixNano()),
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
				FinishReason: "stop",
			},
		},
		Usage: models.Usage{
			PromptTokens:     promptTokens,
			CompletionTokens: completionTokens,
			TotalTokens:      totalTokens,
		},
	}
	return out, nil
}

func (p *GeminiProvider) ChatCompletionStream(ctx context.Context, req *models.ChatCompletionRequest, responseChan chan<- *models.StreamResponse) error {
	resp, err := p.ChatCompletion(ctx, req)
	if err != nil {
		return err
	}

	content := ""
	if len(resp.Choices) > 0 {
		if s, ok := resp.Choices[0].Message.Content.(string); ok {
			content = s
		} else {
			content = fmt.Sprintf("%v", resp.Choices[0].Message.Content)
		}
	}

	responseChan <- &models.StreamResponse{
		ID:      resp.ID,
		Object:  "chat.completion.chunk",
		Created: resp.Created,
		Model:   req.Model,
		Choices: []models.StreamChoice{
			{
				Index: 0,
				Delta: models.MessageDelta{
					Content: content,
				},
			},
		},
		Usage: &resp.Usage,
	}

	return nil
}

