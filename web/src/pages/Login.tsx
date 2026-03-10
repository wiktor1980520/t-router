import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { Turnstile } from '@marsidev/react-turnstile';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';
import type { AxiosError } from 'axios';

const LoginPage = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(t('auth.security_check'));
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/login', { 
        email, 
        password,
        turnstile_token: turnstileToken
      });
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const axiosErr = err as AxiosError<{ error?: string }>;
      let msg = t('auth.login_failed');
      if (axiosErr.response?.data?.error) {
        msg = `${msg}: ${axiosErr.response.data.error}`;
      } else if (axiosErr.message) {
        msg = `${msg}: ${axiosErr.message}`;
      }
      if (axiosErr.config?.url) {
        msg += ` (${axiosErr.config.baseURL || ''}${axiosErr.config.url})`;
      }
      setError(msg);
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
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white">{t('auth.login_title')}</h2>
          <p className="mt-2 text-sm text-gray-400">
            {t('auth.no_account')} <Link to="/register" className="font-medium text-blue-500 hover:text-blue-400">{t('auth.sign_up')}</Link>
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
            <div>
              <input
                type="password"
                required
                className="relative block w-full rounded-b-md border-0 bg-gray-800 py-2.5 px-3 text-gray-100 ring-1 ring-inset ring-gray-700 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
            <div className="flex justify-center">
              <Turnstile 
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onError={() => setError(t('auth.security_check_failed'))}
                options={{ theme: 'dark' }}
              />
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {loading ? t('auth.signing_in') : t('auth.sign_in')}
            </button>
          </div>
        </form>
      </div>
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>&copy; 2015-{new Date().getFullYear()} {t('common.company_name')}</p>
        <p className="mt-2 text-xs text-gray-600">{__APP_VERSION__}</p>
      </footer>
    </div>
  );
};

export default LoginPage;
