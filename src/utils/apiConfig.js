export const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001/api';
    }
    // For production (single container), use relative path
    return '/api';
};
