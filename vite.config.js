import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    base: '/',
    resolve: {
        alias: {
            'exceljs': path.resolve(__dirname, 'node_modules/exceljs/dist/exceljs.min.js')
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            }
        }
    }
});
