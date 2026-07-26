import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        // The instance defaults to application/json, but axios reads that header back when it
        // transforms the body: a FormData payload sent with a JSON content type gets flattened
        // through formDataToJSON, which silently drops every File. Clearing the header lets the
        // browser set multipart/form-data with its boundary, so uploads actually carry the files.
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            const headers = config.headers as any;
            // AxiosHeaders#delete matches case-insensitively; the fallback covers a plain object.
            if (typeof headers?.delete === 'function') headers.delete('Content-Type');
            else delete headers['Content-Type'];
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
