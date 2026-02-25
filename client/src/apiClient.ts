import axios from 'axios';

// Configure API base URL
// - If REACT_APP_API_URL is set (e.g. colleague's backend URL), use it
// - Otherwise relative '' so dev proxy (client/package.json proxy → localhost:3000) or production proxy works
const API_BASE_URL = process.env.REACT_APP_API_URL ?? '';

// Create axios instance with base configuration
export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased to 30 seconds for slow queries
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to include auth token
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

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
