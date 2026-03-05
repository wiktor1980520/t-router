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
  api_keys?: any[];
}

export default function AdminUserDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [userRes, txRes] = await Promise.all([
          api.get<UserDetail>(`/admin/users/${id}`),
          api.get<Transaction[]>(`/admin/transactions?user_id=${id}`)
        ]);
        setUser(userRes.data);
        setTransactions(txRes.data);
      } catch (error) {
        console.error('Failed to fetch user details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

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