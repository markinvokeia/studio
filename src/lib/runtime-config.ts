export interface RuntimeConfig {
  apiUrl: string;
  licenseKey: string;
  masterSec: string;
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

