import { useState, useEffect } from 'react';
import { 
  Box, 
  Server, 
  Network, 
  Plus, 
  Trash2, 
  Loader2,
  // Save,
  // X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

// --- Interfaces ---

interface Model {
  id: string;
  name: string;
  description: string;
  context_length: number;
  retail_price_input: number;
  retail_price_output: number;
}

interface Provider {
  id: number;
  name: string;
  type: string;
  base_url: string;
  weight: number;
  // api_key is hidden
}

interface ModelRoute {
  id: number;
  model_name: string;
  provider_id: number;
  cost_input: number;
  cost_output: number;
  priority: number;
  provider?: Provider;
}

// --- Component ---

export default function AdminModels() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'models' | 'providers' | 'routes'>('models');
  const [loading, setLoading] = useState(true);
  
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routes, setRoutes] = useState<ModelRoute[]>([]);

  // Form States
  const [showModelForm, setShowModelForm] = useState(false);
  const [newModel, setNewModel] = useState<Partial<Model>>({});

  const [showProviderForm, setShowProviderForm] = useState(false);
  const [newProvider, setNewProvider] = useState<Partial<Provider> & { api_key?: string }>({});

  const [showRouteForm, setShowRouteForm] = useState(false);
  const [newRoute, setNewRoute] = useState<Partial<ModelRoute>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [modelsRes, providersRes, routesRes] = await Promise.all([
        api.get<Model[]>('/models'),
        api.get<Provider[]>('/providers'),
        api.get<ModelRoute[]>('/routes')
      ]);
      setModels(modelsRes.data);
      setProviders(providersRes.data);
      setRoutes(routesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Handlers ---

  const handleCreateModel = async () => {
    try {
      await api.post('/admin/models', newModel);
      setShowModelForm(false);
      setNewModel({});
      fetchData();
    } catch (error) {
      console.error('Failed to create model:', error);
      alert(t('admin.error_create_model'));
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!window.confirm(t('admin.confirm_delete_model'))) return;
    try {
      await api.delete(`/admin/models/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete model:', error);
      alert(t('admin.error_delete_model'));
    }
  };

  const handleCreateProvider = async () => {
    try {
      await api.post('/admin/providers', newProvider);
      setShowProviderForm(false);
      setNewProvider({});
      fetchData();
    } catch (error) {
      console.error('Failed to create provider:', error);
      alert(t('admin.error_create_provider'));
    }
  };

  const handleDeleteProvider = async (id: number) => {
    if (!window.confirm(t('admin.confirm_delete_provider'))) return;
    try {
      await api.delete(`/admin/providers/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete provider:', error);
      alert(t('admin.error_delete_provider'));
    }
  };

  const handleCreateRoute = async () => {
    try {
      await api.post('/admin/routes', {
        ...newRoute,
        provider_id: Number(newRoute.provider_id),
        priority: Number(newRoute.priority),
        cost_input: Number(newRoute.cost_input),
        cost_output: Number(newRoute.cost_output)
      });
      setShowRouteForm(false);
      setNewRoute({});
      fetchData();
    } catch (error) {
      console.error('Failed to create route:', error);
      alert(t('admin.error_create_route'));
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!window.confirm(t('admin.confirm_delete_route'))) return;
    try {
      await api.delete(`/admin/routes/${id}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete route:', error);
      alert(t('admin.error_delete_route'));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Server className="w-6 h-6" />
          {t('admin.models_providers')}
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (activeTab === 'models') setShowModelForm(true);
              if (activeTab === 'providers') setShowProviderForm(true);
              if (activeTab === 'routes') setShowRouteForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'models' ? t('admin.add_model') : activeTab === 'providers' ? t('admin.add_provider') : t('admin.add_route')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('models')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'models' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <Box className="w-4 h-4" />
          {t('nav.models')}
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'providers' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <Server className="w-4 h-4" />
          {t('models.providers')}
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'routes' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <Network className="w-4 h-4" />
          {t('models.routes')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          
          {/* Models Tab */}
          {activeTab === 'models' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">{t('admin.id')}</th>
                    <th className="px-6 py-4">{t('admin.name')}</th>
                    <th className="px-6 py-4">{t('admin.context_tokens')}</th>
                    <th className="px-6 py-4">{t('admin.retail_input')}</th>
                    <th className="px-6 py-4">{t('admin.retail_output')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 font-mono text-white">{m.id}</td>
                      <td className="px-6 py-4">{m.name}</td>
                      <td className="px-6 py-4">{m.context_length.toLocaleString()}</td>
                      <td className="px-6 py-4">${m.retail_price_input}</td>
                      <td className="px-6 py-4">${m.retail_price_output}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteModel(m.id)} className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">{t('admin.id')}</th>
                    <th className="px-6 py-4">{t('admin.name')}</th>
                    <th className="px-6 py-4">{t('admin.provider_type')}</th>
                    <th className="px-6 py-4">{t('models.base_url')}</th>
                    <th className="px-6 py-4">{t('admin.provider_weight')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {providers.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 font-mono">{p.id}</td>
                      <td className="px-6 py-4 text-white font-medium">{p.name}</td>
                      <td className="px-6 py-4 capitalize">{p.type}</td>
                      <td className="px-6 py-4 font-mono text-xs">{p.base_url}</td>
                      <td className="px-6 py-4">{p.weight}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteProvider(p.id)} className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Routes Tab */}
          {activeTab === 'routes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">{t('admin.id')}</th>
                    <th className="px-6 py-4">{t('admin.model')}</th>
                    <th className="px-6 py-4">{t('admin.provider')}</th>
                    <th className="px-6 py-4">{t('admin.cost_input')}</th>
                    <th className="px-6 py-4">{t('admin.cost_output')}</th>
                    <th className="px-6 py-4">{t('admin.priority')}</th>
                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {routes.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 font-mono">{r.id}</td>
                      <td className="px-6 py-4 text-white font-medium">{r.model_name}</td>
                      <td className="px-6 py-4">{r.provider?.name || r.provider_id}</td>
                      <td className="px-6 py-4">${r.cost_input}</td>
                      <td className="px-6 py-4">${r.cost_output}</td>
                      <td className="px-6 py-4">{r.priority}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteRoute(r.id)} className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- Modals --- */}
      
      {/* Create Model Modal */}
      {showModelForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">{t('admin.add_new_model')}</h2>
            <div className="space-y-4">
              <input 
                placeholder={t('admin.model_id_placeholder')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newModel.id || ''}
                onChange={e => setNewModel({...newModel, id: e.target.value})}
              />
              <input 
                placeholder={t('admin.display_name')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newModel.name || ''}
                onChange={e => setNewModel({...newModel, name: e.target.value})}
              />
              <input 
                placeholder={t('models.description')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newModel.description || ''}
                onChange={e => setNewModel({...newModel, description: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number"
                  placeholder={t('models.context_length')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                  value={newModel.context_length || ''}
                  onChange={e => setNewModel({...newModel, context_length: Number(e.target.value)})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" step="0.000001"
                  placeholder={t('admin.retail_price_input_full')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                  value={newModel.retail_price_input || ''}
                  onChange={e => setNewModel({...newModel, retail_price_input: Number(e.target.value)})}
                />
                <input 
                  type="number" step="0.000001"
                  placeholder={t('admin.retail_price_output_full')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                  value={newModel.retail_price_output || ''}
                  onChange={e => setNewModel({...newModel, retail_price_output: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModelForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">{t('common.cancel')}</button>
              <button onClick={handleCreateModel} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">{t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Provider Modal */}
      {showProviderForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">{t('admin.add_new_provider')}</h2>
            <div className="space-y-4">
              <input 
                placeholder={t('admin.provider_name_placeholder')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newProvider.name || ''}
                onChange={e => setNewProvider({...newProvider, name: e.target.value})}
              />
              <select 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newProvider.type || ''}
                onChange={e => setNewProvider({...newProvider, type: e.target.value})}
              >
                <option value="">{t('admin.select_type')}</option>
                <option value="openai">{t('admin.type_openai')}</option>
                <option value="azure">{t('admin.type_azure')}</option>
                <option value="anthropic">{t('admin.type_anthropic')}</option>
              </select>
              <input 
                placeholder={t('models.base_url')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newProvider.base_url || ''}
                onChange={e => setNewProvider({...newProvider, base_url: e.target.value})}
              />
              <input 
                placeholder={t('models.api_key')} 
                type="password"
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newProvider.api_key || ''}
                onChange={e => setNewProvider({...newProvider, api_key: e.target.value})}
              />
              <input 
                type="number"
                placeholder={t('admin.weight_load_balancing')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newProvider.weight || ''}
                onChange={e => setNewProvider({...newProvider, weight: Number(e.target.value)})}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowProviderForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">{t('common.cancel')}</button>
              <button onClick={handleCreateProvider} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">{t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Route Modal */}
      {showRouteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">{t('admin.add_new_route')}</h2>
            <div className="space-y-4">
              <select 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newRoute.model_name || ''}
                onChange={e => setNewRoute({...newRoute, model_name: e.target.value})}
              >
                <option value="">{t('admin.select_model')}</option>
                {models.map(m => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}
              </select>
              
              <select 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newRoute.provider_id || ''}
                onChange={e => setNewRoute({...newRoute, provider_id: Number(e.target.value)})}
              >
                <option value="">{t('admin.select_provider')}</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" step="0.000001"
                  placeholder={t('admin.cost_input_short')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                  value={newRoute.cost_input || ''}
                  onChange={e => setNewRoute({...newRoute, cost_input: Number(e.target.value)})}
                />
                <input 
                  type="number" step="0.000001"
                  placeholder={t('admin.cost_output_short')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                  value={newRoute.cost_output || ''}
                  onChange={e => setNewRoute({...newRoute, cost_output: Number(e.target.value)})}
                />
              </div>
              <input 
                type="number"
                placeholder={t('admin.priority_higher_first')} 
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white"
                value={newRoute.priority || ''}
                onChange={e => setNewRoute({...newRoute, priority: Number(e.target.value)})}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowRouteForm(false)} className="px-4 py-2 text-gray-400 hover:text-white">{t('common.cancel')}</button>
              <button onClick={handleCreateRoute} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">{t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}