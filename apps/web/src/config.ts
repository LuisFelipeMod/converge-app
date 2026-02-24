// In dev, Vite proxies /api (with rewrite) and /auth (without rewrite) to localhost:3000.
// In production, VITE_API_URL points directly to the backend (e.g. https://server.up.railway.app).
const backendUrl = import.meta.env.VITE_API_URL || '';

// For API calls: in dev '/api' is proxied and stripped; in prod hits backend directly.
export const API_BASE = backendUrl || '/api';

// For auth redirects and socket: in dev '/auth' and '/socket.io' are proxied as-is; in prod hits backend directly.
export const BACKEND_BASE = backendUrl;
