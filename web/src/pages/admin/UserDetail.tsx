import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Wallet, 
  CreditCard, 
  Activity, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  User as UserIcon
} from 'lucide-react';
import api from '../../lib/api';

interface Transaction {
  id: string;
  type: 'recharge' | 'consumption';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  description: string;
  created_at: string;
}

interface UserDetail {
  id: string;
  email: string;
  phone?: string;
  balance: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  api_keys?: unknown[];
  allowed_models?: string[];
}

interface Model {
  id: string;
  name: string;
}

export default function AdminUserDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Models State
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [savingModels, setSavingModels] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [userRes, txRes, modelsRes] = await Promise.all([
          api.get<UserDetail>(`/admin/users/${id}`),
          api.get<Transaction[]>(`/admin/transactions?user_id=${id}`),
          api.get<Model[]>('/models')
        ]);
        setUser(userRes.data);
        setTransactions(txRes.data);
        setAllModels(modelsRes.data);
      } catch (error) {
        console.error('Failed to fetch user details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleToggleModel = (modelId: string) => {
    if (!user) return;
    const current = user.allowed_models || [];
    const updated = current.includes(modelId)
      ? current.filter(id => id !== modelId)
      : [...current, modelId];
    
    setUser({ ...user, allowed_models: updated });
  };

  const saveAllowedModels = async () => {
    if (!user || !id) return;
    try {
      setSavingModels(true);
      await api.put(`/admin/users/${id}`, {
        allowed_models: user.allowed_models
      });
      alert(t('common.saved_successfully'));
    } catch (error) {
      console.error('Failed to save allowed models:', error);
      alert(t('common.error_occurred'));
    } finally {
      setSavingModels(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-blue-500">
        <Activity className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-red-500">
        {t('admin.user_not_found')}
      </div>
    );
  }

  const totalRecharge = transactions
    .filter(t => t.type === 'recharge' && t.status === 'completed')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalConsumption = transactions
    .filter(t => t.type === 'consumption' && t.status === 'completed')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/users" className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserIcon className="w-6 h-6 text-blue-500" />
            {user.email}
          </h1>
          <p className="text-sm text-gray-400 font-mono">{t('admin.id')}: {user.id}</p>
        </div>
        <div className="ml-auto flex gap-2">
           <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {user.is_active ? t('common.active') : t('common.disabled')}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Wallet className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('admin.current_balance')}</p>
              <h3 className="text-2xl font-bold text-white">${user.balance.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <CreditCard className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('admin.total_recharged')}</p>
              <h3 className="text-2xl font-bold text-white">${totalRecharge.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <Activity className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('admin.total_consumption')}</p>
              <h3 className="text-2xl font-bold text-white">${Math.abs(totalConsumption).toFixed(2)}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Allowed Models */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
            <div>
                <h3 className="text-lg font-semibold text-white">{t('admin.allowed_models')}</h3>
                <p className="text-sm text-gray-400">{t('admin.allowed_models_desc')}</p>
            </div>
            <button 
                onClick={saveAllowedModels} 
                disabled={savingModels}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
                {savingModels && <Activity className="w-4 h-4 animate-spin" />}
                {t('common.save')}
            </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allModels.map(model => (
                <label key={model.id} className={`flex items-center gap-2 p-3 rounded border cursor-pointer transition-colors ${
                    user?.allowed_models?.includes(model.id) 
                        ? 'bg-blue-500/10 border-blue-500/50' 
                        : 'bg-gray-900 border-gray-700 hover:border-gray-500'
                }`}>
                    <input 
                        type="checkbox" 
                        checked={user?.allowed_models?.includes(model.id) || false}
                        onChange={() => handleToggleModel(model.id)}
                        className="w-4 h-4 text-blue-500 rounded border-gray-600 focus:ring-blue-500 bg-gray-700"
                    />
                    <span className="text-sm text-white">{model.name}</span>
                </label>
            ))}
        </div>
        {(!user?.allowed_models || user.allowed_models.length === 0) && (
            <p className="mt-2 text-sm text-green-400">{t('admin.all_models_allowed_hint')}</p>
        )}
      </div>

      {/* Transactions List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{t('admin.transaction_history')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">{t('admin.date')}</th>
                <th className="px-6 py-4">{t('admin.type')}</th>
                <th className="px-6 py-4">{t('admin.amount')}</th>
                <th className="px-6 py-4">{t('common.status')}</th>
                <th className="px-6 py-4">{t('admin.description')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    {t('dashboard.no_transactions')}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        tx.type === 'recharge' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {t(`admin.${tx.type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                      {tx.type === 'consumption' ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {tx.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {tx.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                        {tx.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="capitalize">{t(`admin.${tx.status}`)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={tx.description}>
                      {tx.description || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}