import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Bot, User as UserIcon, Trash2 } from 'lucide-react';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';

interface Model {
  id: string;
  name: string;
}

interface ApiKey {
  id: string;
  label: string;
  is_active: boolean;
  key?: string;
  key_prefix: string;
  created_at: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
}

export default function Playground() {
  const { t } = useTranslation();
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const gatewayBase = (() => {
    const raw = (import.meta.env.VITE_API_BASE_URL || 'https://api.t-router.com').toString().replace(/\/+$/, '');
    return raw.replace(/\/(api|v1)$/, '');
  })();

  useEffect(() => {
    let canceled = false;
    const init = async () => {
      const fetchModelsWithKey = async (apiKey: string) => {
        try {
          const res = await fetch(`${gatewayBase}/v1/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`);
          }

          const payload: unknown = await res.json();
          const ids = Array.isArray(payload)
            ? payload
            : ((payload as { data?: Array<{ id?: unknown }> })?.data ?? []).map((m) => m?.id);
          const list = ids
            .filter((x): x is string => typeof x === 'string' && x.length > 0)
            .map((id) => ({ id, name: id }));
          setModels(list);
          if (list.length > 0) {
            setSelectedModel(list[0].id);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        }
      };

      try {
        const res = await api.get<ApiKey[]>('/keys');
        if (canceled) return;
        const usable = res.data.filter(k => k.is_active && k.key);
        setApiKeys(usable);

        const cachedId = localStorage.getItem('playground_api_key_id') || '';
        const defaultKey = (cachedId && usable.find(k => k.id === cachedId)) || usable[0];
        if (defaultKey?.key) {
          setSelectedApiKeyId(defaultKey.id);
          localStorage.setItem('playground_api_key_id', defaultKey.id);
          localStorage.setItem('playground_api_key', defaultKey.key);
          fetchModelsWithKey(defaultKey.key);
          return;
        }

        const created = await api.post<{ key: string }>('/keys', { label: 'Playground' });
        if (canceled) return;
        localStorage.setItem('playground_api_key', created.data.key);
        fetchModelsWithKey(created.data.key);
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
        try {
          const created = await api.post<{ key: string }>('/keys', { label: 'Playground' });
          if (canceled) return;
          localStorage.setItem('playground_api_key', created.data.key);
          fetchModelsWithKey(created.data.key);
        } catch (e) {
          console.error('Failed to create API key:', e);
        }
      }
    };
    init();
    return () => {
      canceled = true;
    };
  }, [gatewayBase]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, streaming]);

  const ensurePlaygroundApiKey = async (): Promise<string> => {
    const selected = selectedApiKeyId ? apiKeys.find(k => k.id === selectedApiKeyId) : undefined;
    if (selected?.key) {
      localStorage.setItem('playground_api_key_id', selected.id);
      localStorage.setItem('playground_api_key', selected.key);
      return selected.key;
    }

    const cached = localStorage.getItem('playground_api_key');
    if (cached) return cached;

    const res = await api.get<ApiKey[]>('/keys');
    const existing = res.data.find(k => k.is_active && k.key)?.key;
    if (existing) {
      localStorage.setItem('playground_api_key', existing);
      return existing;
    }

    const created = await api.post<{ key: string }>('/keys', { label: 'Playground' });
    localStorage.setItem('playground_api_key', created.data.key);
    return created.data.key;
  };

  const fetchModels = async (apiKeyParam?: string) => {
    try {
      const apiKey = apiKeyParam || await ensurePlaygroundApiKey();
      const res = await fetch(`${gatewayBase}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const payload: unknown = await res.json();
      const ids = Array.isArray(payload)
        ? payload
        : ((payload as { data?: Array<{ id?: unknown }> })?.data ?? []).map(m => m?.id);
      const list = ids
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .map(id => ({ id, name: id }));
      setModels(list);
      if (list.length > 0) {
        setSelectedModel(list[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setStreaming(true);

    try {
      // Create a temporary message for the assistant
      const assistantMessage: Message = { role: 'assistant', content: '' };
      setMessages([...newMessages, assistantMessage]);

      const requestInitBase: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      };

      let usedEndpoint = '';

      const v1Endpoint = `${gatewayBase}/v1/chat/completions`;

      const tryFetch = async (endpoint: string, authToken: string): Promise<Response> => {
        return fetch(endpoint, {
          ...requestInitBase,
          headers: {
            ...(requestInitBase.headers || {}),
            Authorization: `Bearer ${authToken}`,
          },
        });
      };

      const apiKey = await ensurePlaygroundApiKey();
      usedEndpoint = v1Endpoint;
      const response = await tryFetch(v1Endpoint, apiKey);

      if (!response.ok) {
        const requestId = response.headers.get('X-Request-ID');
        let detail = '';
        try {
          detail = await response.text();
        } catch {
          detail = '';
        }

        let message = response.statusText || `HTTP ${response.status}`;
        if (detail) {
          try {
            const parsed = JSON.parse(detail);
            message = parsed?.details ? `${parsed?.error || message}: ${parsed.details}` : (parsed?.error || detail);
          } catch {
            message = detail;
          }
        }
        if (requestId) {
          message = `${message} (req: ${requestId})`;
        }
        message = `${message} (endpoint: ${usedEndpoint})`;

        throw new Error(message);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let assistantReasoning = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split('\n');
        
        // Keep the last part in buffer if it doesn't end with newline
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          let data = '';
          if (line.startsWith('data: ')) {
            data = line.slice(6);
          } else if (line.startsWith('data:')) {
            data = line.slice(5);
          } else {
            continue;
          }

          if (data.trim() === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const choices = parsed.choices || [];
            const delta = choices[0]?.delta || {};
            const content = delta.content || '';
            const reasoning = delta.reasoning_content || '';
              
              assistantContent += content;
              assistantReasoning += reasoning;
              
              setMessages(prev => {
                const updated = [...prev];
                // Ensure we are updating the last message which should be the assistant one
                if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = { 
                      role: 'assistant', 
                      content: assistantContent,
                      reasoning_content: assistantReasoning
                    };
                }
                return updated;
              });
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const msg = error instanceof Error ? error.message : 'Failed to get response from model.';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[75vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">{t('playground.title')}</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedApiKeyId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedApiKeyId(id);
              localStorage.setItem('playground_api_key_id', id);
              const k = apiKeys.find(x => x.id === id);
              if (k?.key) {
                localStorage.setItem('playground_api_key', k.key);
                fetchModels(k.key);
              } else {
                localStorage.removeItem('playground_api_key');
              }
            }}
            className="block w-56 rounded-md border-0 bg-gray-800 py-1.5 text-white shadow-sm ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="" disabled>{t('playground.select_api_key')}</option>
            {apiKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label} ({k.key_prefix})
              </option>
            ))}
          </select>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="block w-48 rounded-md border-0 bg-gray-800 py-1.5 text-white shadow-sm ring-1 ring-inset ring-gray-700 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="" disabled>{t('playground.select_model')}</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <button
            onClick={clearHistory}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            title={t('playground.clear_history')}
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden flex flex-col">
        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-6"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Bot size={48} className="mb-4 opacity-50" />
              <p>{t('playground.empty_state')}</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-100'
                }`}>
                  {msg.role === 'assistant' && msg.reasoning_content && (
                    <div className="mb-2 p-3 bg-gray-900 rounded border border-gray-700 text-gray-400 text-xs font-mono">
                      <div className="font-semibold mb-1 uppercase tracking-wider text-gray-500 text-[10px]">Thinking Process</div>
                      <div className="whitespace-pre-wrap">{msg.reasoning_content}</div>
                    </div>
                  )}
                  <div className="prose prose-invert max-w-none text-sm">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <UserIcon size={16} className="text-gray-300" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={t('playground.input_placeholder')}
              disabled={loading || !selectedModel}
              className="flex-1 bg-gray-900 text-white rounded-md border-0 py-2.5 px-4 ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !selectedModel || !input.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
