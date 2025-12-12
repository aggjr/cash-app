export const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001/api';
    }
    // Hardcode production API URL for Easypanel deployment
    return 'https://cash-api.gutoapps.site/api';
};
