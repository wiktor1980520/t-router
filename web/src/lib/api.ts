import axios from 'axios';

declare const __API_BASE_URL__: string | undefined;

const inferApiBase = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return undefined;
  return 'https://api.t-router.com';
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof __API_BASE_URL__ !== 'undefined' ? __API_BASE_URL__ : undefined) ||
  inferApiBase();

const joinBase = (base: string, suffix: '/api' | '/v1') => {
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed.endsWith(suffix)) return trimmed;
  return `${trimmed}${suffix}`;
};

const api = axios.create({
  baseURL: API_BASE ? joinBase(API_BASE, '/api') : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const chatApi = axios.create({
  baseURL: API_BASE ? joinBase(API_BASE, '/v1') : '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
