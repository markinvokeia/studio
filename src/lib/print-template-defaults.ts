import type { PrintDocumentType } from '@/stores/print-document-store';

// HTML default templates for each document type.
//
// Available {{tokens}} — substituted at print time by custom-template-renderer.tsx:
//
//   CLÍNICA  : {{clinic_name}} {{clinic_logo}} {{clinic_address}} {{clinic_phone}} {{clinic_email}}
//   DOCUMENTO: {{doc_no}} {{date}} {{due_date}} {{status}} {{payment_status}} {{currency}} {{reference}} {{notes}}
//   PACIENTE : {{patient_name}}
//   TOTALES  : {{total}} {{subtotal}} {{discount}} {{paid}} {{pending}}
//              {{amount_invoiced}} {{pending_invoice}} {{amount_paid}} {{pending_payment}}
//   PAGO     : {{amount}} {{method}} {{transaction_type}} {{exchange_rate}}
//   N. CRÉD. : {{original_invoice}}
//   BLOQUES  : {{items_table}} {{payments_table}} {{invoices_section}}
//   FECHA    : {{generated_at}}

// ── Shared partials ────────────────────────────────────────────────────────────

const HEADER = `<div style="display:flex;align-items:center;gap:1.25rem;padding-bottom:1rem;margin-bottom:1.5rem;border-bottom:2px solid #d1d5db;">
  <img src="{{clinic_logo}}" alt="{{clinic_name}}" style="height:4rem;width:auto;max-width:140px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />
  <div>
    <p style="font-size:1.2rem;font-weight:700;margin:0 0 2px;">{{clinic_name}}</p>
    <p style="font-size:0.75rem;color:#6b7280;margin:0;">{{clinic_address}}</p>
    <p style="font-size:0.75rem;color:#6b7280;margin:0;">{{clinic_phone}}{{clinic_phone_email_sep}}{{clinic_email}}</p>
  </div>
</div>`;

const INVOICE_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Factura</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{doc_no}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Fecha: </span><strong>{{date}}</strong></div>
    <div><span style="color:#6b7280;">Estado: </span><strong>{{status}}</strong></div>
    <div><span style="color:#6b7280;">Estado de pago: </span><strong>{{payment_status}}</strong></div>
    <div><span style="color:#6b7280;">Moneda: </span><strong>{{currency}}</strong></div>
    <div><span style="color:#6b7280;">Referencia: </span><strong>{{reference}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Servicios</h2>
    {{items_table}}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:1.5rem;">
    <table class="print-template-table" style="width:16rem;">
      <tbody>
        <tr><td style="color:#4b5563;">Subtotal</td><td style="text-align:right;font-weight:500;">{{currency}} {{subtotal}}</td></tr>
        <tr><td style="color:#4b5563;">Descuento</td><td style="text-align:right;font-weight:500;">- {{currency}} {{discount}}</td></tr>
        <tr><td style="color:#4b5563;">Total</td><td style="text-align:right;font-weight:500;">{{currency}} {{total}}</td></tr>
        <tr><td style="color:#4b5563;">Pagado</td><td style="text-align:right;font-weight:500;">{{currency}} {{paid}}</td></tr>
        <tr style="border-top:1px solid #d1d5db;font-weight:700;"><td>Pendiente</td><td style="text-align:right;">{{currency}} {{pending}}</td></tr>
      </tbody>
    </table>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Pagos</h2>
    {{payments_table}}
  </div>
  <div style="font-size:0.85rem;">{{notes}}</div>
</div>`;

const QUOTE_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Presupuesto</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{doc_no}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Fecha: </span><strong>{{date}}</strong></div>
    <div><span style="color:#6b7280;">Estado: </span><strong>{{status}}</strong></div>
    <div><span style="color:#6b7280;">Estado de pago: </span><strong>{{payment_status}}</strong></div>
    <div><span style="color:#6b7280;">Moneda: </span><strong>{{currency}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Servicios</h2>
    {{items_table}}
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:1.5rem;">
    <table class="print-template-table" style="width:18rem;">
      <tbody>
        <tr><td style="color:#4b5563;">Subtotal</td><td style="text-align:right;">{{currency}} {{subtotal}}</td></tr>
        <tr><td style="color:#4b5563;">Descuento</td><td style="text-align:right;">- {{currency}} {{discount}}</td></tr>
        <tr style="font-weight:700;border-bottom:1px solid #d1d5db;"><td>Total</td><td style="text-align:right;">{{currency}} {{total}}</td></tr>
        <tr><td style="color:#4b5563;">Facturado</td><td style="text-align:right;">{{currency}} {{amount_invoiced}}</td></tr>
        <tr><td style="color:#4b5563;">Pend. Factura</td><td style="text-align:right;">{{currency}} {{pending_invoice}}</td></tr>
        <tr><td style="color:#4b5563;">Pagado</td><td style="text-align:right;">{{currency}} {{amount_paid}}</td></tr>
        <tr style="font-weight:700;"><td>Pend. Pago</td><td style="text-align:right;">{{currency}} {{pending_payment}}</td></tr>
      </tbody>
    </table>
  </div>
  {{invoices_section}}
  <div style="font-size:0.85rem;">{{notes}}</div>
</div>`;

const PAYMENT_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Recibo de Pago</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{doc_no}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Fecha: </span><strong>{{date}}</strong></div>
    <div><span style="color:#6b7280;">Método: </span><strong>{{method}}</strong></div>
    <div><span style="color:#6b7280;">Tipo: </span><strong>{{transaction_type}}</strong></div>
    <div><span style="color:#6b7280;">Referencia: </span><strong>{{reference}}</strong></div>
    <div><span style="color:#6b7280;">Tipo de cambio: </span><strong>{{exchange_rate}}</strong></div>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:4px;margin-bottom:1.5rem;">
    <table class="print-template-table" style="width:100%;">
      <thead><tr><th>Método</th><th style="text-align:center;">Moneda</th><th style="text-align:right;">Total</th></tr></thead>
      <tbody>
        <tr>
          <td>{{method}}</td>
          <td style="text-align:center;">{{currency}}</td>
          <td style="text-align:right;font-weight:600;">{{currency}} {{amount}}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div style="font-size:0.85rem;">{{notes}}</div>
</div>`;

const CREDIT_NOTE_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Nota de Crédito</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{doc_no}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Fecha: </span><strong>{{date}}</strong></div>
    <div><span style="color:#6b7280;">Moneda: </span><strong>{{currency}}</strong></div>
    <div><span style="color:#6b7280;">Factura original: </span><strong>{{original_invoice}}</strong></div>
    <div><span style="color:#6b7280;">Referencia: </span><strong>{{reference}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Servicios</h2>
    {{items_table}}
  </div>
  <div style="font-size:0.85rem;">{{notes}}</div>
</div>`;

const PREPAYMENT_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Pre-pago</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{doc_no}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Fecha: </span><strong>{{date}}</strong></div>
    <div><span style="color:#6b7280;">Método: </span><strong>{{method}}</strong></div>
    <div><span style="color:#6b7280;">Moneda: </span><strong>{{currency}}</strong></div>
    <div><span style="color:#6b7280;">Tipo de cambio: </span><strong>{{exchange_rate}}</strong></div>
  </div>
  <div style="border:1px solid #e5e7eb;border-radius:4px;margin-bottom:1.5rem;">
    <table class="print-template-table" style="width:100%;">
      <thead><tr><th>Método</th><th style="text-align:center;">Moneda</th><th style="text-align:right;">Total</th></tr></thead>
      <tbody>
        <tr>
          <td>{{method}}</td>
          <td style="text-align:center;">{{currency}}</td>
          <td style="text-align:right;font-weight:600;">{{currency}} {{amount}}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div style="margin-top:1rem;padding:0.75rem;border:1px solid #e5e7eb;border-radius:4px;font-size:0.85rem;color:#4b5563;">
    Disponible como crédito para futuras facturas.
  </div>
  <div style="font-size:0.85rem;margin-top:1rem;">{{notes}}</div>
</div>`;

const FINANCIAL_SUMMARY_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Resumen Financiero</h1>
    <span style="font-size:0.85rem;color:#4b5563;">{{date_from}} — {{date_to}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Paciente: </span><strong>{{patient_name}}</strong></div>
    <div><span style="color:#6b7280;">Cédula / RUT: </span><strong>{{patient_id}}</strong></div>
    <div><span style="color:#6b7280;">Email: </span><strong>{{patient_email}}</strong></div>
    <div><span style="color:#6b7280;">Teléfono: </span><strong>{{patient_phone}}</strong></div>
  </div>
  {{movements_table}}
</div>`;

const CAJA_APERTURA_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Apertura de Caja</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{session_id}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Cajero: </span><strong>{{cashier_name}}</strong></div>
    <div><span style="color:#6b7280;">Apertura: </span><strong>{{opening_date}}</strong></div>
    <div><span style="color:#6b7280;">Punto de caja: </span><strong>{{cash_point_name}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Saldo inicial</h2>
    {{opening_amounts_table}}
  </div>
</div>`;

const CAJA_CIERRE_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Cierre de Caja</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{session_id}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Cajero: </span><strong>{{cashier_name}}</strong></div>
    <div><span style="color:#6b7280;">Apertura: </span><strong>{{opening_date}}</strong></div>
    <div><span style="color:#6b7280;">Cierre: </span><strong>{{closing_date}}</strong></div>
    <div><span style="color:#6b7280;">Punto de caja: </span><strong>{{cash_point_name}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Resumen de cierre</h2>
    {{closing_summary_table}}
  </div>
  <div style="font-size:0.85rem;">{{closing_notes}}</div>
</div>`;

const CAJA_SESION_DEFAULT = `<div style="font-family:sans-serif;font-size:0.85rem;color:#111827;">
  ${HEADER}
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1.5rem;padding-bottom:0.75rem;border-bottom:1px solid #e5e7eb;">
    <h1 style="font-size:1.4rem;font-weight:700;text-transform:uppercase;margin:0;">Reporte de Sesión</h1>
    <span style="font-size:0.85rem;color:#4b5563;font-family:monospace;">#{{session_id}}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem 2rem;margin-bottom:1.5rem;font-size:0.85rem;">
    <div><span style="color:#6b7280;">Cajero: </span><strong>{{cashier_name}}</strong></div>
    <div><span style="color:#6b7280;">Apertura: </span><strong>{{opening_date}}</strong></div>
    <div><span style="color:#6b7280;">Cierre: </span><strong>{{closing_date}}</strong></div>
    <div><span style="color:#6b7280;">Punto de caja: </span><strong>{{cash_point_name}}</strong></div>
  </div>
  <div style="margin-bottom:1.5rem;">
    <h2 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin-bottom:0.5rem;">Movimientos</h2>
    {{movements_table}}
  </div>
</div>`;

export const PRINT_TEMPLATE_DEFAULTS: Record<PrintDocumentType, string> = {
  invoice:           INVOICE_DEFAULT,
  quote:             QUOTE_DEFAULT,
  payment:           PAYMENT_DEFAULT,
  credit_note:       CREDIT_NOTE_DEFAULT,
  prepayment:        PREPAYMENT_DEFAULT,
  financial_summary: FINANCIAL_SUMMARY_DEFAULT,
  // The patient ledger is a React-only print (not a customizable HTML template).
  ledger:            '',
  caja_apertura:     CAJA_APERTURA_DEFAULT,
  caja_cierre:       CAJA_CIERRE_DEFAULT,
  caja_sesion:       CAJA_SESION_DEFAULT,
};
