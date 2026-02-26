import axios from 'axios';
import { getBackendBaseUrl } from '@/config/env';

// Use Vite proxy in development (relative URL) or VITE_API_URL from .env
const getApiBaseURL = () => {
  if (import.meta.env.DEV) return '/api';
  const base = getBackendBaseUrl();
  return base ? `${base}/api` : '/api';
};

const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url: string | undefined = error.config?.url;

    if (status === 401) {
      const isAuthLogin =
        url?.includes('/auth/login') ||
        url?.includes('/auth/request-otp') ||
        url?.includes('/auth/verify-otp');

      // Only treat 401 as session-expired if it's NOT from auth endpoints
      // and there is an existing token. This prevents reloads on failed login.
      const hasToken = !!localStorage.getItem('token');
      if (!isAuthLogin && hasToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;

