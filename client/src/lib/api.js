import axios from 'axios';
import { io } from 'socket.io-client';

const configuredBaseUrl = (import.meta.env.VITE_API_URL || '').trim();

function resolveBaseUrl() {
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '5173' || port === '4173') {
      return `${protocol}//${hostname}:3001`;
    }
  }

  return '';
}

const baseURL = resolveBaseUrl();

export const api = axios.create({
  baseURL,
  withCredentials: true
});

export function getApiBaseUrl() {
  return baseURL;
}

export function buildApiUrl(pathname) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${baseURL}${normalizedPath}`;
}

export function createRealtimeClient() {
  return io(baseURL || undefined, {
    autoConnect: false,
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    withCredentials: true
  });
}
