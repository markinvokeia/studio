'use client';

/**
 * Turns the rendered print container into a PDF in the browser (html2pdf.js =
 * html2canvas + jsPDF), so emailed documents come out exactly like printed ones.
 *
 * The document styles live inside `@media print` (globals.css, Tailwind `print:`
 * variants), which a screen capture doesn't apply. Rather than duplicating them,
 * the capture copies every rule found inside `@media print` into a plain stylesheet
 * injected into html2canvas's cloned document — print media emulated by construction.
 */

/** Same page box as the `@page` rule in globals.css: A4 portrait, 12mm × 15mm margins. */
const PAGE_MARGIN_MM: [number, number, number, number] = [12, 15, 12, 15];

function collectPrintRules(rules: CSSRuleList, inPrint: boolean, out: string[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      const isPrint = Array.from(rule.media).some((m) => m.trim() === 'print');
      collectPrintRules(rule.cssRules, inPrint || isPrint, out);
    } else if (inPrint && !(rule instanceof CSSPageRule)) {
      out.push(rule.cssText);
    }
  }
}

/** Every rule the browser would apply only when printing, unwrapped from its media query. */
function getPrintOnlyCss(): string {
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectPrintRules(sheet.cssRules, false, out);
    } catch {
      // Cross-origin stylesheet (e.g. Google Fonts): its rules can't be read and hold
      // no print styles of ours anyway.
    }
  }
  return out.join('\n');
}

/** Renders `element` to an A4 PDF and returns it as plain base64 (no data-URI prefix). */
export async function elementToPdfBase64(element: HTMLElement): Promise<string> {
  const { default: html2pdf } = await import('html2pdf.js');
  const printCss = getPrintOnlyCss();

  const options = {
    margin: PAGE_MARGIN_MM,
    image: { type: 'jpeg' as const, quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      onclone: (doc: Document) => {
        const style = doc.createElement('style');
        style.setAttribute('data-print-emulation', '');
        style.textContent = printCss;
        doc.head.appendChild(style);
      },
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const, compress: true },
    // Not in html2pdf's typings: keep table rows and template sections whole across pages.
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.print-template-section'] },
  };

  const dataUri: string = await html2pdf().set(options).from(element).outputPdf('datauristring');
  return dataUri.slice(dataUri.indexOf(',') + 1);
}
