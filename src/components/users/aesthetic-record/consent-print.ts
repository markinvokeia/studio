import { formatDateTime } from '@/lib/utils';

import type { AestheticServiceConsent } from '@/lib/types';

export interface ConsentPrintLabels {
  signer: string;
  date: string;
  signature: string;
  reusedSignature: string;
  clinicalPhotos: string;
  marketingPhotos: string;
  yes: string;
  no: string;
}

/** Opens the signed consent of a service in a new window ready to print */
export function printConsent(consent: AestheticServiceConsent, signatureUrl: string | null, labels: ConsentPrintLabels): void {
  const win = window.open('', '_blank');
  if (!win) return;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const title = consent.title || consent.serviceName;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
h1{font-size:20px;margin:0 0 16px}p.text{white-space:pre-wrap;font-size:14px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;font-size:13px}
dt{color:#555}.sig{margin-top:32px;border-top:1px solid #999;padding-top:8px;width:280px;font-size:12px;color:#555}.sig img{max-height:90px;display:block;margin-bottom:6px}</style>
</head><body><h1>${esc(title)}</h1><p class="text">${esc(consent.text)}</p>
<dl><dt>${esc(labels.clinicalPhotos)}</dt><dd>${consent.allowsClinicalPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.marketingPhotos)}</dt><dd>${consent.allowsMarketingPhotos ? esc(labels.yes) : esc(labels.no)}</dd>
<dt>${esc(labels.date)}</dt><dd>${esc(formatDateTime(consent.signedAt))}</dd>${consent.contentSha256 ? `<dt>SHA-256</dt><dd style="font-family:monospace;font-size:11px;word-break:break-all">${esc(consent.contentSha256)}</dd>` : ''}</dl>
<div class="sig">${signatureUrl ? `<img src="${esc(signatureUrl)}" alt="">` : ''}${esc(labels.signature)}: ${esc(consent.signerName)}${consent.signatureSource === 'reused' ? `<br>${esc(labels.reusedSignature)}` : ''}</div>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
