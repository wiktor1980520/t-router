import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

const RegisterPage = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwords_mismatch'));
      setLoading(false);
      return;
    }

    if (!phone) {
      setError(t('auth.invalid_phone'));
      setLoading(false);
      return;
    }

    if (!verificationCode) {
      setError(t('auth.invalid_code'));
      setLoading(false);
      return;
    }

    if (!turnstileToken) {
      setError(t('auth.security_check'));
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', { 
        email, 
        password,
        phone,
        verification_code: verificationCode,
        turnstile_token: turnstileToken
      });
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.register_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-12 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="bg-gray-900 text-gray-300 text-sm border border-gray-700 rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer hover:border-gray-600 transition-colors"
        >
          <option value="en">English</option>
          <option value="zh">简体中文</option>
        </select>
      </div>
      <div className="w-full max-w-md space-y-8 bg-gray-900 p-8 rounded-lg border border-gray-800">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">{t('auth.register_title')}</h2>
          <p className="mt-2 text-sm text-gray-400">
            {t('auth.has_account')} <Link to="/login" className="font-medium text-blue-500 hover:text-blue-400">{t('auth.sign_in')}</Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <input
                type="email"
                required
                className="relative block w-full rounded-t-md border-0 bg-gray-800 py-2.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <input
                type="tel"
                required
                className="relative block w-full border-0 bg-gray-800 py-2.5 pl-12 pr-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('auth.phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20">
                <span className="text-gray-100 sm:text-sm">+86</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                className="relative block w-full border-0 bg-gray-800 py-2.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 pr-24"
                placeholder={t('auth.verification_code')}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={countdown > 0}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-sm font-medium text-blue-500 hover:text-blue-400 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {countdown > 0 ? `${countdown}s` : t('auth.send_code')}
              </button>
            </div>
            <div>
              <input
                type="password"
                required
                className="relative block w-full border-0 bg-gray-800 py-2.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 bg-gray-800 py-2.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('auth.confirm_password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <Turnstile 
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
              onSuccess={setTurnstileToken}
              onError={() => setError(t('auth.security_check_failed'))}
              options={{ theme: 'dark' }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {loading ? t('auth.creating_account') : t('auth.create_account')}
            </button>
          </div>
        </form>
      </div>
      <footer className="mt-8 text-center text-sm text-gray-500">
        &copy; 2015-{new Date().getFullYear()} {t('common.company_name')}
      </footer>
    </div>
  );
};

export default RegisterPage;
