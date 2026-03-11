import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Trash2, Copy, Eye, EyeOff, Code2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// import { useAuth } from '../context/AuthContext';

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
  allowed_models?: string[];
}

type ExampleType = 'curl' | 'node' | 'python' | 'openclaw';

const ApiKeys = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [allowedModels, setAllowedModels] = useState<Set<string>>(new Set());
  const [showExamplesModal, setShowExamplesModal] = useState(false);
  const [exampleType, setExampleType] = useState<ExampleType>('curl');
  const { t } = useTranslation();
  // const { user } = useAuth(); // Get user from AuthContext

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    if (!showNewKeyModal || createdKey) return;
    fetchAvailableModels();
  }, [showNewKeyModal, createdKey]);

  const fetchKeys = async () => {
    try {
      const res = await api.get<ApiKey[]>('/keys');
      setKeys(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const res = await api.get<Model[]>('/models/available');
      setAvailableModels(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleVisibility = (id: string) => {
    const newSet = new Set(visibleKeys);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setVisibleKeys(newSet);
  };

  const handleCreateKey = async () => {
    try {
      const payload: Record<string, unknown> = { label: newKeyLabel };
      if (allowedModels.size > 0) {
        payload.allowed_models = Array.from(allowedModels);
      }
      const res = await api.post('/keys', payload);
      setCreatedKey(res.data.key);
      setNewKeyLabel('');
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAllowedModel = (modelID: string) => {
    const next = new Set(allowedModels);
    if (next.has(modelID)) {
      next.delete(modelID);
    } else {
      next.add(modelID);
    }
    setAllowedModels(next);
  };

  const handleDeleteKey = async (id: string) => {
    if (!window.confirm(t('keys.delete_confirm'))) return;
    try {
      await api.delete(`/keys/${id}`);
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const v1BaseUrl = (() => {
    return `https://api.t-router.com/v1`;
  })();

  const buildCurlExample = (url: string, apiKey: string, payload: string) => {
    return [
      `curl "${url}" \\`,
      `  -H "Authorization: Bearer ${apiKey}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${payload}'`,
    ].join('\n');
  };

  const buildNodeExample = (url: string, apiKey: string, model: string) => {
    return [
      `const url = "${url}";`,
      `const apiKey = "${apiKey}";`,
      ``,
      `const res = await fetch(url, {`,
      `  method: "POST",`,
      `  headers: {`,
      `    Authorization: \`Bearer \${apiKey}\`,`,
      `    "Content-Type": "application/json",`,
      `  },`,
      `  body: JSON.stringify({`,
      `    model: "${model}",`,
      `    messages: [{ role: "user", content: "Hello!" }],`,
      `  }),`,
      `});`,
      ``,
      `if (!res.ok) {`,
      `  throw new Error(\`HTTP \${res.status}: \${await res.text()}\`);`,
      `}`,
      ``,
      `const data = await res.json();`,
      `console.log(data.choices?.[0]?.message?.content ?? data);`,
    ].join('\n');
  };

  const buildPythonExample = (url: string, apiKey: string, model: string) => {
    return [
      `import os`,
      `import requests`,
      ``,
      `url = "${url}"`,
      `api_key = os.getenv("TROUTER_API_KEY", "${apiKey}")`,
      ``,
      `payload = {`,
      `  "model": "${model}",`,
      `  "messages": [{"role": "user", "content": "Hello!"}],`,
      `}`,
      ``,
      `resp = requests.post(url, headers={`,
      `  "Authorization": f"Bearer {api_key}",`,
      `  "Content-Type": "application/json",`,
      `}, json=payload, timeout=60)`,
      ``,
      `resp.raise_for_status()`,
      `data = resp.json()`,
      `print(data["choices"][0]["message"]["content"])`,
    ].join('\n');
  };

  const buildExample = (type: ExampleType): string => {
    const apiKey = '<YOUR_API_KEY>';
    const model = '<MODEL>';
    const url = `${v1BaseUrl}/chat/completions`;
    const payload = `{"model":"${model}","messages":[{"role":"user","content":"Hello!"}]}`;

    if (type === 'openclaw') {
      return [
        `${t('keys.openclaw_title')}`,
        ``,
        `${t('keys.openclaw_base_url')}: https://api.t-router.com/v1`,
        `${t('keys.openclaw_auth')}: Authorization: Bearer <API_KEY>`,
        `${t('keys.openclaw_endpoint')}: /chat/completions`,
        ``,
        `${t('keys.openclaw_steps')}`,
        `1) ${t('keys.openclaw_step_1')}`,
        `2) ${t('keys.openclaw_step_2')}`,
        `3) ${t('keys.openclaw_step_3')}`,
        `4) ${t('keys.openclaw_step_4')}`,
        ``,
        `${t('keys.openclaw_test')}`,
        buildCurlExample(url, apiKey, payload),
      ].join('\n');
    }

    if (type === 'curl') {
      return buildCurlExample(url, apiKey, payload);
    }

    if (type === 'node') {
      return buildNodeExample(url, apiKey, model);
    }

    return buildPythonExample(url, apiKey, model);
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadDemo = (type: ExampleType) => {
    const content = buildExample(type);
    const filename =
      type === 'curl'
        ? 'trouter-demo.sh'
        : type === 'node'
          ? 'trouter-demo.mjs'
          : type === 'python'
            ? 'trouter-demo.py'
            : 'openclaw-setup.txt';
    downloadText(filename, content);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">{t('keys.title')}</h1>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t('keys.create_new')}
          </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-md p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium text-white">{t('keys.integration_examples')}</div>
          <div className="text-xs text-gray-400">{t('keys.integration_examples_desc')}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowExamplesModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 text-white rounded border border-gray-700"
          >
            <Code2 className="h-4 w-4" />
            {t('keys.view_examples')}
          </button>
          <button
            type="button"
            onClick={() => {
              setExampleType('openclaw');
              setShowExamplesModal(true);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 text-white rounded border border-gray-700"
          >
            <Code2 className="h-4 w-4" />
            {t('keys.openclaw_tab')}
          </button>
          <button
            type="button"
            onClick={() => downloadDemo('node')}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded border border-transparent"
          >
            <Download className="h-4 w-4" />
            {t('keys.download_demo')}
          </button>
        </div>
      </div>

      {/* Keys List */}
      <div className="bg-gray-900 shadow overflow-hidden sm:rounded-md border border-gray-800">
        <ul className="divide-y divide-gray-800">
          {keys.map((key) => (
            <li key={key.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
              <div>
                <div className="flex items-center">
                  <p className="text-sm font-medium text-blue-400 truncate">{key.label}</p>
                  <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {key.is_active ? t('keys.active') : t('keys.inactive')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500 font-mono flex items-center gap-2">
                  <span>{visibleKeys.has(key.id) ? (key.key || t('keys.key_hidden')) : `${key.key_prefix}...`}</span>
                  <button 
                    onClick={() => toggleVisibility(key.id)} 
                    className="text-gray-400 hover:text-white transition-colors"
                    title={visibleKeys.has(key.id) ? t('keys.hide_key') : t('keys.show_key')}
                  >
                    {visibleKeys.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {visibleKeys.has(key.id) && key.key && (
                    <button 
                      onClick={() => navigator.clipboard.writeText(key.key!)} 
                      className="text-gray-400 hover:text-white transition-colors"
                      title={t('keys.copy_key')}
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
                {Array.isArray(key.allowed_models) && (
                  <p className="mt-1 text-xs text-gray-600">
                    {t('keys.allowed_models')}: {key.allowed_models.length > 0 ? key.allowed_models.join(', ') : t('keys.all_models')}
                  </p>
                )}
                <p className="text-xs text-gray-600">{t('common.created_at')}: {new Date(key.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <button
                  onClick={() => handleDeleteKey(key.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
          {keys.length === 0 && !loading && (
            <li className="px-6 py-4 text-center text-gray-500 text-sm">{t('keys.no_keys')}</li>
          )}
        </ul>
      </div>

      {showExamplesModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-3xl w-full p-6 border border-gray-700">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-white">{t('keys.examples_modal_title')}</h3>
                <div className="text-xs text-gray-400">{t('keys.examples_modal_desc')}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowExamplesModal(false)}
                className="px-3 py-2 bg-gray-900 hover:bg-gray-850 text-white rounded border border-gray-700"
              >
                {t('common.cancel')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setExampleType('curl')}
                className={`px-3 py-2 rounded border ${exampleType === 'curl' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-850'}`}
              >
                cURL
              </button>
              <button
                type="button"
                onClick={() => setExampleType('node')}
                className={`px-3 py-2 rounded border ${exampleType === 'node' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-850'}`}
              >
                Node.js
              </button>
              <button
                type="button"
                onClick={() => setExampleType('python')}
                className={`px-3 py-2 rounded border ${exampleType === 'python' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-850'}`}
              >
                Python
              </button>
              <button
                type="button"
                onClick={() => setExampleType('openclaw')}
                className={`px-3 py-2 rounded border ${exampleType === 'openclaw' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-850'}`}
              >
                OpenClaw
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-gray-400">
                  {exampleType === 'openclaw' ? (
                    <>
                      {t('keys.openclaw_base_url')}: <span className="font-mono text-gray-200">https://api.t-router.com/v1</span>
                    </>
                  ) : (
                    <>
                      {t('keys.api_endpoint')}: <span className="font-mono text-gray-200">{v1BaseUrl}/chat/completions</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(buildExample(exampleType))}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-750 text-white rounded border border-gray-700"
                  >
                    <Copy className="h-4 w-4" />
                    {t('keys.copy_example')}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadDemo(exampleType)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded border border-transparent"
                  >
                    <Download className="h-4 w-4" />
                    {exampleType === 'openclaw' ? t('keys.download_openclaw') : t('keys.download_example')}
                  </button>
                </div>
              </div>
              <pre className="p-4 text-sm text-gray-200 overflow-auto max-h-[60vh]">
                <code className="font-mono whitespace-pre">{buildExample(exampleType)}</code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">{t('keys.modal_title')}</h3>
            
            {!createdKey ? (
              <>
                <input
                  type="text"
                  placeholder={t('keys.key_label')}
                  className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                />
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-200">{t('keys.allowed_models')}</div>
                      <div className="text-xs text-gray-500">{t('keys.allowed_models_desc')}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAllowedModels(new Set())}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {t('keys.clear_selection')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowedModels(new Set(availableModels.map(m => m.id)))}
                        className="text-xs text-gray-400 hover:text-white"
                      >
                        {t('keys.select_all')}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-auto rounded border border-gray-700 bg-gray-900 p-2">
                    {availableModels.length === 0 ? (
                      <div className="text-xs text-gray-500 px-1 py-2">{t('keys.no_available_models')}</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-1">
                        {availableModels.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm text-gray-200 px-2 py-1 rounded hover:bg-gray-800">
                            <input
                              type="checkbox"
                              checked={allowedModels.has(m.id)}
                              onChange={() => toggleAllowedModel(m.id)}
                              className="h-4 w-4"
                            />
                            <span className="flex-1 truncate">{m.name}</span>
                            <span className="text-xs text-gray-500">{m.id}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyLabel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {t('common.create')}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-yellow-400 bg-yellow-900/20 p-3 rounded border border-yellow-900/50">
                  {t('keys.copy_warning')}
                </p>
                <div className="flex items-center bg-gray-900 p-3 rounded border border-gray-700">
                  <code className="text-green-400 flex-1 break-all">{createdKey}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(createdKey!)}
                    className="ml-2 text-gray-400 hover:text-white"
                  >
                    <Copy className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setCreatedKey(null);
                      setShowNewKeyModal(false);
                      setAllowedModels(new Set());
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeys;
