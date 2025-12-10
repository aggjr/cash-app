export const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001/api';
    }
    // In production, the app is served at /projects/cash
    // so the API is at /projects/cash/api (proxied by Nginx)
    return '/projects/cash/api';
};
