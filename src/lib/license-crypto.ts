'use client';

import type { LicensePayload } from '@/lib/types';

const APP_SALT = new TextEncoder().encode('InvokeIA-License-v1');
const KDF_ITERATIONS = 100_000;

async function deriveKey(masterKey: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: APP_SALT, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

export async function encryptLicense(payload: LicensePayload, masterKey: string): Promise<string> {
  const key = await deriveKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const combined = new Uint8Array(12 + ct.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ct), 12);
  return toBase64Url(combined.buffer);
}

export async function decryptLicense(licenseKey: string, masterKey: string): Promise<LicensePayload> {
  const data = fromBase64Url(licenseKey);
  if (data.length < 29) throw new Error('Invalid license format');
  const key = await deriveKey(masterKey);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: data.slice(0, 12) },
    key,
    data.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as LicensePayload;
}
