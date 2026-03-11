import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { CreditCard, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  reference_id?: string;
}

const Billing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await api.get<Transaction[]>('/user/transactions');
      setTransactions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const transferRemark = `t-router:${user?.email || t('billing.remark_email_placeholder')}`;
  const transferReceiptEmail = 'pay@t-router.com';
  const transferDetails = [
    `${t('billing.payee_name')}${t('common.colon', { defaultValue: '：' })}${t('billing.payee_name_value')}`,
    `${t('billing.payee_bank')}${t('common.colon', { defaultValue: '：' })}${t('billing.payee_bank_value')}`,
    `${t('billing.payee_account')}${t('common.colon', { defaultValue: '：' })}${t('billing.payee_account_value')}`,
    `${t('billing.payee_remark')}${t('common.colon', { defaultValue: '：' })}${transferRemark}`,
    `${t('billing.receipt_email')}${t('common.colon', { defaultValue: '：' })}${transferReceiptEmail}`,
  ].join('\n');

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(t('billing.copied'));
    } catch {
      alert(t('billing.copy_failed'));
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
          {transactions.map((tx) => (
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
                  {tx.reference_id && <p className="text-xs text-gray-600 font-mono">{tx.reference_id}</p>}
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
            <h3 className="text-lg font-medium text-white mb-4">{t('billing.bank_transfer_title')}</h3>
            <div className="space-y-6">
              <div>
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 space-y-3">
                  <div className="text-sm text-gray-200 font-medium">{t('billing.transfer_notice_title')}</div>
                  <div className="text-sm text-gray-400 leading-relaxed">{t('billing.transfer_notice_desc')}</div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-md p-3">
                    {transferDetails}
                  </pre>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => copyText(transferDetails)}
                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm"
                    >
                      {t('billing.copy_all')}
                    </button>
                    <button
                      onClick={() => copyText(transferRemark)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                    >
                      {t('billing.copy_remark')}
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 leading-relaxed">
                    {t('billing.transfer_receipt_hint', { email: transferReceiptEmail, account: user?.email || '-' , phone: user?.phone || '-' })}
                  </div>
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
