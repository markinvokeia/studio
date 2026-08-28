'use client';

import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { QRCodeCanvas } from 'qrcode.react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

const INVOKEIA_LOGO = 'https://www.invokeia.com/assets/InvokeIA_C@4x-4T0dztu0.webp';

/** Lado del canvas oculto del que se extrae el PNG: alto para que imprima nítido. */
const QR_RENDER_SIZE = 620;

interface FlierPage {
  /** Color de acento de la página: barra superior, badge, píldora y sombra. */
  accent: string;
  qrBorder: string;
  pillBg: string;
  pillText: string;
  shadow: string;
  badge: string;
  title: string;
  body: string;
  footer: string;
  qrDataUrl: string;
  urlLabel: string;
}

interface AccessFlierButtonProps {
  staffUrl: string;
  patientUrl: string;
  /** Logo de la clínica. Si falla al cargar, el flier sale sin él. */
  clinicLogoUrl: string;
  clinicName: string;
}

/**
 * Imprime un flier de dos páginas con los accesos al sistema: una para el
 * personal y otra para los pacientes, cada una con su QR.
 *
 * Se arma un documento HTML autocontenido en una ventana nueva en vez de
 * imprimir la página actual: el flier tiene su propia tipografía, márgenes y
 * saltos de página, y no debe arrastrar nada del layout de la app.
 */
export function AccessFlierButton({
  staffUrl,
  patientUrl,
  clinicLogoUrl,
  clinicName,
}: AccessFlierButtonProps) {
  const t = useTranslations('PatientPortalConfigPage.flier');

  const staffCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const patientCanvasRef = React.useRef<HTMLCanvasElement>(null);

  /** Se muestra la URL sin protocolo ni barra final: es más corta y se lee mejor. */
  const clean = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const handlePrint = () => {
    const staffQr = staffCanvasRef.current?.toDataURL('image/png');
    const patientQr = patientCanvasRef.current?.toDataURL('image/png');
    if (!staffQr || !patientQr) return;

    const pages: FlierPage[] = [
      {
        accent: '#4b56d6',
        qrBorder: '#e7e7ee',
        pillBg: '#f2f3fb',
        pillText: '#4b56d6',
        shadow: 'rgba(75,86,214,0.10)',
        badge: t('staff.badge'),
        title: t('staff.title'),
        body: t('staff.body'),
        footer: t('staff.footer'),
        qrDataUrl: staffQr,
        urlLabel: clean(staffUrl),
      },
      {
        accent: '#d93bd0',
        qrBorder: '#f4dcf2',
        pillBg: '#fbeffa',
        pillText: '#c032b7',
        shadow: 'rgba(217,59,208,0.12)',
        badge: t('patient.badge'),
        title: t('patient.title'),
        body: t('patient.body'),
        footer: t('patient.footer'),
        qrDataUrl: patientQr,
        urlLabel: clean(patientUrl),
      },
    ];

    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;

    win.document.write(buildFlierHtml(pages, clinicLogoUrl, clinicName));
    win.document.close();
  };

  return (
    <>
      <Button variant="outline" onClick={handlePrint} className="gap-1.5">
        <Printer className="h-4 w-4" />
        {t('print')}
      </Button>

      {/* Canvas fuera de pantalla: sólo existen para extraer el PNG del QR.
          No se usa `imageSettings` para incrustar el logo porque es una imagen
          de otro dominio y contaminaría el canvas, rompiendo `toDataURL`. El
          logo se superpone por CSS en el documento impreso. */}
      <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0">
        <QRCodeCanvas ref={staffCanvasRef} value={staffUrl} size={QR_RENDER_SIZE} level="H" marginSize={1} />
        <QRCodeCanvas ref={patientCanvasRef} value={patientUrl} size={QR_RENDER_SIZE} level="H" marginSize={1} />
      </div>
    </>
  );
}

/** Escapa el texto que se interpola en el HTML del flier. */
function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFlierHtml(pages: FlierPage[], clinicLogoUrl: string, clinicName: string): string {
  const sections = pages
    .map(
      (page) => `
  <section class="page" style="--accent:${page.accent}">
    <div class="topbar"></div>

    <header class="head">
      <img class="clinic-logo" src="${esc(clinicLogoUrl)}" alt="${esc(clinicName)}"
           onerror="this.style.display='none'">
      <span class="badge">${esc(page.badge)}</span>
    </header>

    <div class="brand">
      <img src="${INVOKEIA_LOGO}" alt="InvokeIA">
      <div class="brand-name">InvokeIA</div>
    </div>

    <div class="copy">
      <h1>${esc(page.title)}</h1>
      <p>${esc(page.body)}</p>
    </div>

    <div class="qr-block">
      <div class="qr-frame" style="border-color:${page.qrBorder};box-shadow:0 14px 40px ${page.shadow}">
        <img class="qr" src="${page.qrDataUrl}" alt="QR">
        <span class="qr-logo"><img src="${INVOKEIA_LOGO}" alt=""></span>
      </div>
      <div class="url-pill" style="background:${page.pillBg};color:${page.pillText}">
        <span class="dot" style="background:${page.accent}"></span>${esc(page.urlLabel)}
      </div>
    </div>

    <footer class="foot">
      <span>${esc(page.footer)}</span><strong>InvokeIA</strong>
    </footer>
  </section>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(clinicName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f4f4f7}
  .page{
    position:relative;width:210mm;height:297mm;margin:0 auto 12px;background:#fff;
    font-family:'Manrope',system-ui,sans-serif;color:#141414;
    display:flex;flex-direction:column;padding:6% 8%;overflow:hidden;
  }
  .topbar{position:absolute;top:0;left:0;right:0;height:10px;background:var(--accent)}
  .head{display:flex;align-items:center;justify-content:space-between;gap:16px}
  .clinic-logo{width:150px;height:64px;object-fit:contain}
  .badge{
    font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:12px;letter-spacing:.14em;
    text-transform:uppercase;color:var(--accent);border:2px solid var(--accent);
    border-radius:100px;padding:8px 16px;white-space:nowrap;
  }
  .brand{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:34px}
  .brand img{width:112px;height:112px;object-fit:contain}
  .brand-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;letter-spacing:.02em;margin-top:8px}
  .copy{text-align:center;margin-top:26px}
  .copy h1{
    font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:52px;line-height:1.02;
    letter-spacing:-.02em;margin:0;text-wrap:balance;
  }
  .copy p{font-size:19px;line-height:1.45;color:#4a4a4a;max-width:470px;margin:18px auto 0;text-wrap:pretty}
  .qr-block{display:flex;flex-direction:column;align-items:center;margin-top:auto;margin-bottom:auto}
  .qr-frame{position:relative;padding:22px;background:#fff;border:2px solid;border-radius:24px}
  .qr{width:300px;height:300px;display:block}
  /* El logo va superpuesto y no dibujado en el canvas: así el PNG del QR se
     puede exportar sin que una imagen de otro dominio lo contamine. */
  .qr-logo{
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#fff;padding:8px;border-radius:8px;line-height:0;
  }
  .qr-logo img{width:62px;height:62px;object-fit:contain;display:block}
  .url-pill{
    margin-top:20px;display:inline-flex;align-items:center;gap:10px;border-radius:100px;
    padding:12px 22px;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:17px;letter-spacing:-.01em;
  }
  .dot{width:9px;height:9px;border-radius:50%}
  .foot{
    display:flex;align-items:center;justify-content:center;gap:8px;
    font-size:12.5px;color:#9a9aa8;font-weight:500;letter-spacing:.01em;
  }
  .foot strong{font-family:'Space Grotesk',sans-serif;font-weight:700;color:#5a5a68}
  @page{size:A4 portrait;margin:0}
  @media print{
    html,body{background:#fff}
    /* Los fondos de color son la identidad del flier: hay que forzarlos. */
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{margin:0;break-after:page}
    .page:last-child{break-after:auto}
  }
</style>
</head>
<body>
${sections}
<script>
  // Se espera a que carguen fuentes e imágenes; si no, la primera página sale
  // con la tipografía de respaldo y el logo en blanco.
  const ready = [document.fonts ? document.fonts.ready : Promise.resolve()].concat(
    Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = res; })
    )
  );
  Promise.all(ready).then(() => setTimeout(() => { window.focus(); window.print(); }, 120));
</script>
</body>
</html>`;
}
