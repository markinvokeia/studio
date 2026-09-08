export interface RuntimeConfig {
  apiUrl: string;
  licenseKey: string;
  masterSec: string;
  clientId: string;
  eventPusherKey: string;
  eventPusherUrl: string;
}

declare global {
  interface Window {
    __INVOKEIA_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

const FALLBACK_API_URL = 'https://n8n-project-n8n.7ig1i3.easypanel.host';

function getRuntimeConfig(): Partial<RuntimeConfig> {
  if (typeof window !== 'undefined') {
    return window.__INVOKEIA_RUNTIME_CONFIG__ ?? {};
  }

  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    licenseKey: process.env.NEXT_PUBLIC_LICENSE_KEY,
    masterSec: process.env.NEXT_PUBLIC_MASTER_SEC,
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    eventPusherKey: process.env.NEXT_PUBLIC_EVENT_PUSHER_KEY,
    eventPusherUrl: process.env.NEXT_PUBLIC_EVENT_PUSHER_URL,
  };
}

export function getApiUrl(): string {
  return getRuntimeConfig().apiUrl || process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_URL;
}

export function getWebhookBaseUrl(): string {
  return `${getApiUrl()}/webhook`;
}

export function getLicenseKey(): string {
  return getRuntimeConfig().licenseKey || process.env.NEXT_PUBLIC_LICENSE_KEY || '';
}

export function getMasterSec(): string {
  return getRuntimeConfig().masterSec || process.env.NEXT_PUBLIC_MASTER_SEC || '';
}

export function getClientId(): string {
  return getRuntimeConfig().clientId || process.env.NEXT_PUBLIC_CLIENT_ID || '';
}

export function getEventPusherKey(): string {
  return getRuntimeConfig().eventPusherKey || process.env.NEXT_PUBLIC_EVENT_PUSHER_KEY || '';
}

/**
 * Base URL (origin) del servidor de eventos SSE. Si no se define, el stream usa
 * una ruta relativa (`/events/stream`) contra el mismo origen del frontend,
 * resuelta por el reverse proxy. Si se define, debe ser solo el origen
 * (ej. `https://events.invokeia.com`), sin el path `/events/stream`.
 */
export function getEventPusherUrl(): string {
  return getRuntimeConfig().eventPusherUrl || process.env.NEXT_PUBLIC_EVENT_PUSHER_URL || '';
}

