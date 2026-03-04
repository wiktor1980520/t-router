import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Bell, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const { user, refreshUser } = useAuth();
  const [threshold, setThreshold] = useState(user?.balance_alert_threshold || 10.0);
  const [phone, setPhone] = useState(user?.phone || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();

  const handleSendCode = async () => {
    if (!phone) {
      setError(t('auth.invalid_phone'));
      return;
    }
    setError('');
    
    try {
      await api.post('/auth/send-code', { phone });
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.code_send_failed'));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await api.put('/user/settings', { 
        balance_alert_threshold: parseFloat(threshold.toString()),
        phone: phone,
        verification_code: verificationCode
      });
      await refreshUser();
      setMessage(t('settings.update_success'));
      setVerificationCode(''); // Clear code after success
    } catch (err: any) {
      setError(err.response?.data?.error || t('settings.update_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">{t('settings.title')}</h1>

      <div className="bg-gray-900 shadow rounded-lg border border-gray-800 p-6">
        <div className="flex items-center mb-4">
          <Bell className="h-6 w-6 text-blue-500 mr-2" />
          <h2 className="text-xl font-semibold text-white">{t('settings.general')}</h2>
        </div>
        
        <div className="mb-6 max-w-md">
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {t('settings.language')}
            </label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              value={i18n.language}
              onChange={(e) => {
                i18n.changeLanguage(e.target.value);
              }}
            >
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {t('settings.phone')}
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {t('settings.phone_desc')}
            </p>
            <input
              type="tel"
              className="block w-full rounded-md border-0 bg-gray-800 py-1.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="+86 13800000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {phone !== (user?.phone || '') && (
              <div className="mt-2 relative">
                 <input
                   type="text"
                   className="block w-full rounded-md border-0 bg-gray-800 py-1.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 pr-24"
                   placeholder={t('auth.verification_code')}
                   value={verificationCode}
                   onChange={(e) => setVerificationCode(e.target.value)}
                 />
                 <button
                   type="button"
                   onClick={handleSendCode}
                   disabled={countdown > 0}
                   className="absolute right-2 top-1.5 z-20 text-sm font-medium text-blue-500 hover:text-blue-400 disabled:text-gray-500 disabled:cursor-not-allowed"
                 >
                   {countdown > 0 ? `${countdown}s` : t('auth.send_code')}
                 </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {t('settings.balance_alert')} (¥)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {t('settings.balance_alert_desc')}
            </p>
            <div className="relative rounded-md shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-gray-400 sm:text-sm">¥</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                className="block w-full rounded-md border-0 bg-gray-800 py-1.5 pl-7 pr-12 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {message && <div className="text-green-500 text-sm">{message}</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
