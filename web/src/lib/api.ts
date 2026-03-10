import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : '/api',
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
  baseURL: API_BASE ? `${API_BASE}/v1` : '/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
