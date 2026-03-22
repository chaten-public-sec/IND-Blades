import axios from 'axios';
import { io } from 'socket.io-client';

const configuredBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
const baseURL = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : '';

export const api = axios.create({
  baseURL,
  withCredentials: true
});

export function createRealtimeClient() {
  return io(baseURL || undefined, {
    autoConnect: false,
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true
  });
}
