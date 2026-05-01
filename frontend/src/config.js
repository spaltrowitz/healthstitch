// Base URL for all API requests.
// Set VITE_API_URL in .env to point at the backend origin (e.g. a Cloudflare Tunnel).
// When empty (local dev), requests stay same-origin and the Vite proxy handles them.
export const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;
