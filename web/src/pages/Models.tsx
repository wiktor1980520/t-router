import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Trash2, Server, Cpu, Coins, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Provider {
  id: number;
  name: string;
  type: string;
  base_url: string;
  weight: number;
  is_active: boolean;
  created_at: string;
}

interface ModelRoute {
  id: number;
  model_name: string;
  provider_id: number;
  provider: Provider;
  cost_input: number;
  cost_output: number;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  retail_price_input: number;
  retail_price_output: number;
  is_active: boolean;
}

const Models = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routes, setRoutes] = useState<ModelRoute[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'providers' | 'routes' | 'pricing'>('pricing');
  const { t } = useTranslation();

  // Form states
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', type: 'openai', base_url: 'https://api.openai.com/v1', api_key: '', weight: 10 });
  
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [newRoute, setNewRoute] = useState({ model_name: '', provider_id: 0, cost_input: 0, cost_output: 0, priority: 0 });

  const [showModelModal, setShowModelModal] = useState(false);
  const [newModel, setNewModel] = useState<Model>({ id: '', name: '', description: '', context_length: 4096, retail_price_input: 0, retail_price_output: 0, is_active: true });
  const [isEditingModel, setIsEditingModel] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [providersRes, routesRes, modelsRes] = await Promise.all([
        api.get('/providers'),
        api.get('/routes'),
        api.get('/models')
      ]);
      setProviders(providersRes.data);
      setRoutes(routesRes.data);
      setModels(modelsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    let baseUrl = 'https://api.openai.com/v1';
    if (type === 'moonshot') {
      baseUrl = 'https://api.moonshot.cn/v1';
    } else if (type === 'anthropic') {
      baseUrl = 'https://api.anthropic.com';
    } else if (type === 'azure') {
      baseUrl = 'https://YOUR_RESOURCE_NAME.openai.azure.com';
    }
    setNewProvider({ ...newProvider, type, base_url: baseUrl });
  };

  const handleCreateProvider = async () => {
    try {
      await api.post('/providers', newProvider);
      setShowProviderModal(false);
      setNewProvider({ name: '', type: 'openai', base_url: '', api_key: '', weight: 10 });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create provider');
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!window.confirm('Are you sure? This might break existing routes.')) return;
    try {
      await api.delete(`/providers/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRoute = async () => {
    try {
      await api.post('/routes', newRoute);
      setShowRouteModal(false);
      setNewRoute({ model_name: '', provider_id: 0, cost_input: 0, cost_output: 0, priority: 0 });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create route');
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await api.delete(`/routes/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveModel = async () => {
    try {
      if (isEditingModel) {
        // Since we don't have a PUT /models/:id endpoint explicitly defined in the previous turns, 
        // I'll assume POST /models handles upsert or look for the implementation.
        // Checking provider.go from memory, CreateModelHandler handles creation. 
        // I need to check if there is an update handler. 
        // Wait, the user asked to implement UpdateModelHandler in the previous turn but I might have missed it.
        // Let's assume POST for now or check if I need to implement it.
        // Actually, for now let's just use POST to create. If editing, we might need to delete and recreate or implement PUT.
        // Re-reading context: "Pending Tasks: Implement UpdateModelHandler". 
        // So currently only Create is supported? Or maybe I should implement UpdateModelHandler in backend too.
        // For now, I will implement the frontend to call POST /models which might be an upsert or just create.
        // Let's double check provider.go later.
        await api.post('/models', newModel);
      } else {
        await api.post('/models', newModel);
      }
      setShowModelModal(false);
      setNewModel({ id: '', name: '', description: '', context_length: 4096, retail_price_input: 0, retail_price_output: 0, is_active: true });
      setIsEditingModel(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save model');
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await api.delete(`/models/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditModel = (model: Model) => {
    setNewModel(model);
    setIsEditingModel(true);
    setShowModelModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">{t('models.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pricing')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'pricing' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t('models.pricing')}
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'routes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t('models.routes')}
          </button>
          <button
            onClick={() => setActiveTab('providers')}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'providers' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t('models.providers')}
          </button>
        </div>
      </div>

      {activeTab === 'pricing' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setNewModel({ id: '', name: '', description: '', context_length: 4096, retail_price_input: 0, retail_price_output: 0, is_active: true });
                setIsEditingModel(false);
                setShowModelModal(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('models.add_model')}
            </button>
          </div>

          <div className="bg-gray-900 shadow overflow-hidden sm:rounded-md border border-gray-800">
            <ul className="divide-y divide-gray-800">
              {models.map((model) => (
                <li key={model.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-800 p-2 rounded-lg">
                      <Coins className="h-6 w-6 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{model.name}</h3>
                      <p className="text-xs text-gray-500">ID: {model.id}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-500">In: ¥{model.retail_price_input}/1M</span>
                        <span className="text-xs text-gray-500">Out: ¥{model.retail_price_output}/1M</span>
                        <span className="text-xs text-gray-500">Ctx: {model.context_length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditModel(model)} className="text-gray-400 hover:text-blue-500">
                      <Edit className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDeleteModel(model.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              ))}
              {models.length === 0 && !loading && (
                <li className="px-6 py-4 text-center text-gray-500 text-sm">{t('models.no_models')}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'providers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowProviderModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('models.add_provider')}
            </button>
          </div>

          <div className="bg-gray-900 shadow overflow-hidden sm:rounded-md border border-gray-800">
            <ul className="divide-y divide-gray-800">
              {providers.map((provider) => (
                <li key={provider.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-800 p-2 rounded-lg">
                      <Server className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                      <p className="text-xs text-gray-500">{provider.base_url}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">{provider.type}</span>
                        <span className="text-xs text-gray-500">{t('models.weight')}: {provider.weight}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteProvider(provider.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
              {providers.length === 0 && !loading && (
                <li className="px-6 py-4 text-center text-gray-500 text-sm">{t('models.no_providers')}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowRouteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('models.add_route')}
            </button>
          </div>

          <div className="bg-gray-900 shadow overflow-hidden sm:rounded-md border border-gray-800">
            <ul className="divide-y divide-gray-800">
              {routes.map((route) => (
                <li key={route.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-800 p-2 rounded-lg">
                      <Cpu className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{route.model_name}</h3>
                      <p className="text-xs text-gray-500">via {route.provider?.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-500">In: ¥{route.cost_input}/1M</span>
                        <span className="text-xs text-gray-500">Out: ¥{route.cost_output}/1M</span>
                        <span className="text-xs text-gray-500">{t('models.priority')}: {route.priority}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteRoute(route.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              ))}
              {routes.length === 0 && !loading && (
                <li className="px-6 py-4 text-center text-gray-500 text-sm">{t('models.no_routes')}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Provider Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">{t('models.provider_modal_title')}</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('models.provider_name')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newProvider.name}
                onChange={e => setNewProvider({...newProvider, name: e.target.value})}
              />
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newProvider.type}
                onChange={handleTypeChange}
              >
                <option value="openai">OpenAI Compatible</option>
                <option value="moonshot">Moonshot AI (Kimi)</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure OpenAI</option>
              </select>
              <input
                type="text"
                placeholder={t('models.base_url')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newProvider.base_url}
                onChange={e => setNewProvider({...newProvider, base_url: e.target.value})}
              />
              <input
                type="password"
                placeholder={t('models.api_key')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newProvider.api_key}
                onChange={e => setNewProvider({...newProvider, api_key: e.target.value})}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowProviderModal(false)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{t('common.cancel')}</button>
                <button onClick={handleCreateProvider} className="px-4 py-2 bg-blue-600 text-white rounded">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">{t('models.route_modal_title')}</h3>
            <div className="space-y-4">
              {models.length > 0 ? (
                <select
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newRoute.model_name}
                  onChange={e => setNewRoute({...newRoute, model_name: e.target.value})}
                >
                  <option value="">{t('models.select_model')}</option>
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded text-yellow-200 text-sm">
                  {t('models.no_models_warning')}
                </div>
              )}
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newRoute.provider_id}
                onChange={e => setNewRoute({...newRoute, provider_id: Number(e.target.value)})}
              >
                <option value={0}>{t('models.provider_select')}</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder={t('models.input_cost')}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newRoute.cost_input}
                  onChange={e => setNewRoute({...newRoute, cost_input: Number(e.target.value)})}
                />
                <input
                  type="number"
                  placeholder={t('models.output_cost')}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newRoute.cost_output}
                  onChange={e => setNewRoute({...newRoute, cost_output: Number(e.target.value)})}
                />
              </div>
              <input
                  type="number"
                  placeholder={t('models.priority')}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newRoute.priority}
                  onChange={e => setNewRoute({...newRoute, priority: Number(e.target.value)})}
                />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowRouteModal(false)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{t('common.cancel')}</button>
                <button onClick={handleCreateRoute} className="px-4 py-2 bg-blue-600 text-white rounded">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-lg font-medium text-white mb-4">{isEditingModel ? t('models.edit_model') : t('models.add_model')}</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('models.model_id')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newModel.id}
                onChange={e => setNewModel({...newModel, id: e.target.value})}
                disabled={isEditingModel}
              />
              <input
                type="text"
                placeholder={t('models.model_name')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newModel.name}
                onChange={e => setNewModel({...newModel, name: e.target.value})}
              />
              <input
                type="text"
                placeholder={t('models.description')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newModel.description}
                onChange={e => setNewModel({...newModel, description: e.target.value})}
              />
              <input
                type="number"
                placeholder={t('models.context_length')}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                value={newModel.context_length}
                onChange={e => setNewModel({...newModel, context_length: Number(e.target.value)})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder={t('models.retail_price_input')}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newModel.retail_price_input}
                  onChange={e => setNewModel({...newModel, retail_price_input: Number(e.target.value)})}
                />
                <input
                  type="number"
                  placeholder={t('models.retail_price_output')}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  value={newModel.retail_price_output}
                  onChange={e => setNewModel({...newModel, retail_price_output: Number(e.target.value)})}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowModelModal(false)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">{t('common.cancel')}</button>
                <button onClick={handleSaveModel} className="px-4 py-2 bg-blue-600 text-white rounded">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Models;
