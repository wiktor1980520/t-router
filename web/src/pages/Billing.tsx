import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { CreditCard, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const Billing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState<number | ''>('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const PRESET_AMOUNTS = [50, 100, 200, 500, 800, 1000, 1500, 2000, 3000, 5000];

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/user/transactions');
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (method: string) => {
    if (!rechargeAmount || rechargeAmount <= 0) return;
    try {
      setPaymentLoading(true);
      const res = await api.post('/payment/create', { 
        amount: Number(rechargeAmount),
        method: method
      });
      
      if (res.data.payment_url) {
        // Create a temporary link to open in new tab if needed, 
        // but for payment gateways usually top-level redirect is best.
        // However, some users prefer new tab to keep the app open.
        // Let's stick to current window but ensure it's a valid URL.
        try {
            const url = new URL(res.data.payment_url);
            window.location.href = url.toString();
        } catch (e) {
            console.error("Invalid payment URL", res.data.payment_url);
            alert(t('billing.invalid_payment_url'));
        }
      } else {
        alert(t('billing.payment_url_missing'));
      }
    } catch (err: any) {
      console.error("Payment creation failed", err);
      const msg = err.response?.data?.error || t('billing.payment_init_failed');
      alert(msg);
    } finally {
      // If we redirected, this might not run, which is fine.
      // If we didn't redirect (error), we need to stop loading.
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 shadow rounded-lg p-6 border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-300">{t('dashboard.current_balance')}</h2>
            <p className="mt-2 text-3xl font-bold text-white">¥{user?.balance.toFixed(2)}</p>
          </div>
          <button
            onClick={() => setShowRechargeModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <CreditCard className="mr-2 h-5 w-5" />
            {t('billing.recharge')}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 shadow overflow-hidden sm:rounded-lg border border-gray-800">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-800">
          <h3 className="text-lg leading-6 font-medium text-white">{t('billing.transaction_history')}</h3>
        </div>
        <ul className="divide-y divide-gray-800">
          {transactions.map((tx: any) => (
            <li key={tx.id} className="px-4 py-4 sm:px-6 hover:bg-gray-800 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                    tx.type === 'recharge' ? 'bg-green-900/50' : 'bg-red-900/50'
                  }`}>
                    {tx.type === 'recharge' ? (
                      <ArrowDownLeft className="h-6 w-6 text-green-400" />
                    ) : (
                      <ArrowUpRight className="h-6 w-6 text-red-400" />
                    )}
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-white">{tx.description}</p>
                    <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    tx.type === 'recharge' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {tx.type === 'recharge' ? '+' : '-'}¥{tx.amount.toFixed(8)}
                  </p>
                  <p className="text-xs text-gray-600 font-mono">{tx.reference_id}</p>
                </div>
              </div>
            </li>
          ))}
          {transactions.length === 0 && !loading && (
            <li className="px-4 py-8 text-center text-gray-500 text-sm">{t('dashboard.no_transactions')}</li>
          )}
        </ul>
      </div>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-sm w-full p-6 border border-gray-700 shadow-xl">
            <h3 className="text-lg font-medium text-white mb-4">{t('billing.add_funds')}</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">{t('billing.amount_usd')}</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setRechargeAmount(amount)}
                      className={`px-2 py-2 text-sm font-medium rounded-md border transition-colors ${
                        rechargeAmount === amount
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      ¥{amount}
                    </button>
                  ))}
                </div>
                <div className="relative rounded-md shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">¥</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="block w-full rounded-md border-0 bg-gray-900 py-2.5 pl-7 pr-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                    placeholder={t('billing.custom_amount')}
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('billing.payment_method')}</label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => handlePayment('bestpay')}
                    disabled={paymentLoading}
                    className="flex items-center justify-center px-4 py-3 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {paymentLoading ? t('common.processing') : t('billing.alipay')}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowRechargeModal(false)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
