import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// import { useAuth } from '../context/AuthContext';

const ApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { t } = useTranslation();
  // const { user } = useAuth(); // Get user from AuthContext

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const res = await api.get('/keys');
      setKeys(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      const res = await api.post('/keys', { label: newKeyLabel });
      setCreatedKey(res.data.key);
      setNewKeyLabel('');
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
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

      {/* Keys List */}
      <div className="bg-gray-900 shadow overflow-hidden sm:rounded-md border border-gray-800">
        <ul className="divide-y divide-gray-800">
          {keys.map((key: any) => (
            <li key={key.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-800 transition-colors">
              <div>
                <div className="flex items-center">
                  <p className="text-sm font-medium text-blue-400 truncate">{key.label}</p>
                  <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {key.is_active ? t('keys.active') : t('keys.inactive')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500 font-mono flex items-center gap-2">
                  <span>{visibleKeys.has(key.id) ? (key.key || 'Key hidden') : `${key.key_prefix}...`}</span>
                  <button 
                    onClick={() => toggleVisibility(key.id)} 
                    className="text-gray-400 hover:text-white transition-colors"
                    title={visibleKeys.has(key.id) ? t('keys.hide_key') : t('keys.show_key')}
                  >
                    {visibleKeys.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  {visibleKeys.has(key.id) && key.key && (
                    <button 
                      onClick={() => navigator.clipboard.writeText(key.key)} 
                      className="text-gray-400 hover:text-white transition-colors"
                      title={t('keys.copy_key')}
                    >
                      <Copy size={14} />
                    </button>
                  )}
                </div>
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
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
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
                    onClick={() => navigator.clipboard.writeText(createdKey)}
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
