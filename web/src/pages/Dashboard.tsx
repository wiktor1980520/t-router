import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Coins, Zap } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  retail_price_input: number;
  retail_price_output: number;
  context_length: number;
}

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ total_api_calls: 0, total_tokens: 0, daily_usage: [] });
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txRes, statsRes, modelsRes] = await Promise.all([
          api.get('/user/transactions'),
          api.get('/user/stats'),
          api.get('/models')
        ]);
        setTransactions(txRes.data.slice(0, 5)); // Get recent 5
        setStats(statsRes.data);
        setModels(modelsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Balance Card */}
        <div className="bg-gray-900 overflow-hidden shadow rounded-lg border border-gray-800">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">{t('dashboard.current_balance')}</dt>
                  <dd>
                    <div className="text-lg font-medium text-white">¥{user?.balance.toFixed(2)}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-400">{t('dashboard.alert_threshold')}: </span>
              <span className="text-white">¥{user?.balance_alert_threshold.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* API Calls Card */}
        <div className="bg-gray-900 overflow-hidden shadow rounded-lg border border-gray-800">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">{t('dashboard.total_api_calls')}</dt>
                  <dd>
                    <div className="text-lg font-medium text-white">{stats.total_api_calls.toLocaleString()}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Token Usage Card */}
        <div className="bg-gray-900 overflow-hidden shadow rounded-lg border border-gray-800">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">{t('dashboard.total_tokens')}</dt>
                  <dd>
                    <div className="text-lg font-medium text-white">{(stats.total_tokens || 0).toLocaleString()}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 shadow rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg leading-6 font-medium text-white mb-4">{t('dashboard.usage_overview')}</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.daily_usage && stats.daily_usage.length > 0 
              ? stats.daily_usage.map((item: any) => ({ name: item.date.slice(5), usage: item.usage })) 
              : []}>
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                itemStyle={{ color: '#F3F4F6' }}
              />
              <Bar dataKey="usage" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Available Models */}
      <div className="bg-gray-900 shadow rounded-lg border border-gray-800">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-800">
          <h3 className="text-lg leading-6 font-medium text-white">{t('dashboard.available_models')}</h3>
        </div>
        <ul className="divide-y divide-gray-800">
          {models.map((model) => (
            <li key={model.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
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
              </div>
            </li>
          ))}
          {models.length === 0 && !loading && (
            <li className="px-6 py-4 text-center text-gray-500 text-sm">{t('models.no_models')}</li>
          )}
        </ul>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900 shadow rounded-lg border border-gray-800">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-800">
          <h3 className="text-lg leading-6 font-medium text-white">{t('dashboard.recent_transactions')}</h3>
        </div>
        <ul className="divide-y divide-gray-800">
          {transactions.map((tx: any) => (
            <li key={tx.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-400 truncate">{tx.description}</p>
                <div className="ml-2 flex-shrink-0 flex">
                  <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    tx.type === 'recharge' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {tx.type === 'recharge' ? '+' : '-'}¥{tx.amount.toFixed(8)}
                  </p>
                </div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between">
                <div className="sm:flex">
                  <p className="flex items-center text-sm text-gray-400">
                    {new Date(tx.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {transactions.length === 0 && (
            <li className="px-4 py-4 sm:px-6 text-center text-gray-500 text-sm">{t('dashboard.no_transactions')}</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
