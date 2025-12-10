export const getApiBaseUrl = () => {
    if (import.meta.env.DEV) {
        return 'http://localhost:3001/api';
    }
    // In production, we assume the API is available at the server root /api
    // IF the user wanted it under the specific project path, we'd use '/projects/cash/api'
    // But standard practice is root /api or relative to base.
    // Let's use relative path which is safer if they are on same specific port/host
    // But since we are in /projects/cash/, relative 'api' -> /projects/cash/api
    // relative '../api' -> /projects/api
    // absolute '/api' -> /api (Root of domain)

    // Given the user URL: http://69.62.99.34:3000/projects/cash
    // If the backend handles /api, then '/api' is correct.
    return '/api';
};
