import { io } from 'socket.io-client';

// Determine URL based on environment
// If in production (served by backend), use relative path (undefined)
// If in dev (Vite), use backend URL
const URL = import.meta.env.PROD ? undefined : 'http://localhost:3001';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect() {
        if (this.socket) return;

        console.log('LOG: [SocketService] 🔌 Connecting to WebSocket at', URL || 'origin');
        this.socket = io(URL, {
            transports: ['websocket', 'polling'], // Prefer WebSocket
            reconnection: true,
        });

        this.socket.on('connect', () => {
            console.log('LOG: [SocketService] ✅ Connected! Socket ID:', this.socket.id);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('LOG: [SocketService] ❌ Disconnected. Reason:', reason);
        });

        this.socket.on('connect_error', (err) => {
            console.error('LOG: [SocketService] ⚠️ Connection Error:', err);
        });

        // Wildcard listener to log ALL incoming events (useful for debugging)
        this.socket.onAny((event, ...args) => {
            console.log(`LOG: [SocketService] 📥 Received '${event}':`, args);
        });
    }

    disconnect() {
        if (this.socket) {
            console.log('LOG: [SocketService] 🛑 Disconnecting manually...');
            this.socket.disconnect();
            this.socket = null;
        }
    }

    on(event, callback) {
        if (!this.socket) this.connect();

        console.log(`LOG: [SocketService] 👂 Registering listener for '${event}'`);
        // We wrap the callback to log when it fires
        const wrappedCallback = (data) => {
            console.log(`LOG: [SocketService] ⚡ Listener for '${event}' triggered.`);
            callback(data);
        };

        // Use the original callback reference? No, Socket.IO needs exact ref for .off()
        // But for debugging, we might just accept we can't easily .off() specific wrapped callbacks 
        // unless we store map.
        // For now, let's keep it simple and just log registration. 
        // If we wrap, we break removeListener unless we manage it. 
        // So I will NOT wrap the callback passed to socket.io, but rely on onAny for incoming logs.

        this.socket.on(event, callback);
    }

    off(event, callback) {
        if (this.socket) {
            console.log(`LOG: [SocketService] 🔇 Removing listener for '${event}'`);
            this.socket.off(event, callback);
        }
    }

    emit(event, data) {
        if (!this.socket) this.connect();
        console.log(`LOG: [SocketService] 📤 Emitting '${event}':`, data);
        this.socket.emit(event, data);
    }
}

export default new SocketService();
