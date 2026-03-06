import axios from 'axios';

// Force API URL to localhost:8080 for development to avoid env issues
export const API_URL = 'http://localhost:8080';

const api = axios.create({
  baseURL: `${API_URL}/api`, // Dashboard API
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token
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
  baseURL: `${API_URL}/v1`, // Chat API
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
