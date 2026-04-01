import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  // ChevronLeft, 
  // ChevronRight, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Filter
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

interface Transaction {
  id: string;
  user_id: string;
  type: 'recharge' | 'consumption';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method: string;
  description: string;
  created_at: string;
}

export default function AdminTransactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('');
  const [userIdInput, setUserIdInput] = useState('');
  const [userIdQuery, setUserIdQuery] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let url = '/admin/transactions?';
      if (filterType) url += `type=${filterType}&`;
      if (userIdQuery) url += `user_id=${userIdQuery}&`;
      
      const response = await api.get<Transaction[]>(url);
      setTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, userIdQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUserIdQuery(userIdInput);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6" />
          {t('admin.transactions')}
        </h1>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('admin.filter_user_id')}
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
              {t('common.search')}
            </button>
          </form>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              className="bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-lg focus:outline-none"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">{t('admin.all_types')}</option>
              <option value="recharge">{t('admin.recharge')}</option>
              <option value="consumption">{t('admin.consumption')}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">{t('admin.date')}</th>
                <th className="px-6 py-4">{t('admin.user_id')}</th>
                <th className="px-6 py-4">{t('admin.type')}</th>
                <th className="px-6 py-4">{t('admin.amount')}</th>
                <th className="px-6 py-4">{t('admin.status')}</th>
                <th className="px-6 py-4">{t('admin.description')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('admin.no_transactions_found')}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500" title={tx.user_id}>
                      {tx.user_id.substring(0, 8)}...
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
