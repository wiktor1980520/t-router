import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Settings, 
  RotateCcw,
  Loader2,
  Edit2,
  X,
  Check
} from 'lucide-react';
import api from '../../lib/api';

interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function SystemConfigPage() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await api.get<SystemConfig[]>('/admin/config');
      setConfigs(response.data);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
      setMessage({ type: 'error', text: t('admin.config_fetch_failed') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEdit = (config: SystemConfig) => {
    setEditingId(config.id);
    setEditValue(config.value);
    setMessage(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
    setMessage(null);
  };

  const handleSave = async (config: SystemConfig) => {
    if (editValue === config.value) {
      handleCancel();
      return;
    }

    try {
      setSaving(true);
      await api.put('/admin/config', {
        key: config.key,
        value: editValue
      });
      
      // Update local state
      setConfigs(configs.map(c => 
        c.id === config.id ? { ...c, value: editValue } : c
      ));
      
      setMessage({ type: 'success', text: t('admin.config_update_success') });
      setEditingId(null);
    } catch (error: any) {
      console.error('Failed to update config:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || t('admin.config_update_failed') 
      });
    } finally {
      setSaving(false);
    }
  };

  const formatKey = (key: string) => {
    // Try to translate if key exists in translation file, otherwise format the key string
    const translationKey = `admin.config_keys.${key}`;
    const translated = t(translationKey);
    
    // Check if translation exists (if key is returned, translation is missing)
    if (translated !== translationKey) {
      return translated;
    }
    
    // Fallback: new_user_gift_amount -> New User Gift Amount
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6" />
            {t('admin.system_config')}
          </h1>
          <p className="text-gray-400 mt-1 ml-8">{t('admin.system_config_desc')}</p>
        </div>
        <button 
          onClick={fetchConfigs} 
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          title={t('common.refresh')}
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : configs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {t('common.no_data')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-700">
                  <th className="p-4 font-semibold text-gray-300 w-1/4">{t('admin.config_name')}</th>
                  <th className="p-4 font-semibold text-gray-300 w-1/3">{t('admin.config_value')}</th>
                  <th className="p-4 font-semibold text-gray-300">{t('admin.config_description')}</th>
                  <th className="p-4 font-semibold text-gray-300 w-24 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-750/50 transition-colors">
                    <td className="p-4 text-white font-medium">
                      {formatKey(config.key)}
                      <div className="text-xs text-gray-500 font-mono mt-1">{config.key}</div>
                    </td>
                    <td className="p-4">
                      {editingId === config.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="text-gray-300 font-mono bg-gray-900/50 px-2 py-1 rounded">
                          {config.value}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
                      {config.description || '-'}
                    </td>
                    <td className="p-4 text-right">
                      {editingId === config.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSave(config)}
                            disabled={saving}
                            className="p-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors disabled:opacity-50"
                            title={t('common.save')}
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={saving}
                            className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-50"
                            title={t('common.cancel')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-1.5 hover:bg-gray-700 text-gray-400 hover:text-white rounded transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
