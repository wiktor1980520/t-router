import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Bot, User as UserIcon, Trash2 } from 'lucide-react';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';

interface Model {
  id: string;
  name: string;
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
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const fetchModels = async () => {
    try {
      const res = await api.get<Model[]>('/models');
      setModels(res.data);
      if (res.data.length > 0) {
        setSelectedModel(res.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
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

      const API_BASE = import.meta.env.VITE_API_BASE_URL;
      const endpoint = API_BASE ? `${API_BASE}/api/chat/completions` : '/api/chat/completions';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
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
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response from model.' }]);
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
