

export type UserDetailMode = 'sales' | 'purchases';

export type IdentityDocumentType = 'cedula_uy' | 'cedula_ext' | 'pasaporte_uy' | 'pasaporte_ext' | 'dni' | 'nie';

export type User = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  avatar: string;
  internal_id?: string | number | null;
  identity_document?: string;
  identity_document_type?: IdentityDocumentType;
  birth_date?: string;
  color?: string;
  is_sales?: boolean;
  total_invoiced?: any;
  total_paid?: any;
  current_debt?: any;
  available_balance?: any;
  notes?: string;
  address?: string;
  alternative_phone?: string;
  bank_account?: string;
  mutual_society_id?: string | number;
  mutual_society_name?: string;
  is_dependent?: boolean;
  responsible_contact_id?: string;
  responsible_contact_name?: string;
  /** Teléfono del tutor (propio o alternativo); lo trae la búsqueda de `/users`. */
  responsible_phone_number?: string;
  /** La búsqueda lo encontró solo por los datos de su tutor, no por los suyos. */
  matched_by_responsible?: boolean;
  calendar_source_id?: string;
  /** Default doctor assigned to this patient. Nullable. */
  doctor_id?: string | null;
  doctor_name?: string;
  sex?: 'male' | 'female' | null;
  active_sede_id?: string | null;
};

/**
 * Código ISO 4217 de 3 letras (`USD`, `EUR`, `UYU`, …). Es lo que se guarda y
 * lo que viaja al backend. Deliberadamente `string` y no una unión cerrada: la
 * moneda es configurable por clínica, y un registro histórico puede venir en
 * cualquier moneda con la que se haya operado en el pasado. El conjunto que la
 * UI ofrece lo acotan `@/constants/currencies` y `useCurrencySettings()`.
 */
export type CurrencyCode = string;

export type CurrencyFinancialData = {
  total_paid: number;
  current_debt: number;
  account_status: number;
  total_invoiced: number;
  available_balance: number;
  total_credit_notes: number;
};

/** Datos financieros del paciente, indexados por código de moneda. */
export type UserFinancialData = Partial<Record<CurrencyCode, CurrencyFinancialData>>;

export type UserFinancial = {
  user_id: string;
  financial_data: UserFinancialData;
};

export type FinancialSummaryMovementMetadata = {
  label: string;
  notes: string | null;
  payment_type?: string;
  target_invoices?: string[];
  doc_no?: string;
  services?: string[];
  applied_to?: string[];
};

export type FinancialSummaryMovement = {
  amount: number;
  doc_no: string;
  user_id: string;
  currency: string;
  metadata: FinancialSummaryMovementMetadata;
  created_at: string;
  internal_id: number;
  document_type: 'invoice' | 'payment' | 'credit_note';
  running_balance: number;
};

export type FinancialSummaryByCurrency = {
  movements: FinancialSummaryMovement[];
  final_balance: number;
  initial_balance: number;
};

export type FinancialSummaryReport = {
  user_id: string;
  name: string;
  email: string;
  phone_number: string;
  identity_document: string;
  report_start_date: string | null;
  report_end_date: string | null;
  history_by_currency: Record<string, FinancialSummaryByCurrency>;
};

/** A single row in the interactive account-statement timeline (one currency). */
export type StatementEntry = {
  /** Stable key, e.g. `${currency}-${internal_id}`. */
  id: string;
  kind: 'invoice' | 'payment' | 'credit_note';
  /** ISO date of the movement (created_at). */
  date: string;
  docNo: string;
  /** Composed concept line (label — services — payment type — pays invoice X). */
  concept: string;
  notes?: string | null;
  /** Signed amount as in the movement (>0 invoice/debit = green, <0 payment = red). */
  amount: number;
  currency: string;
  runningBalance: number;
  // Invoice-only fields (populated by joining USER_INVOICES):
  /** Real invoice id, required to register a payment against it. */
  invoiceId?: string;
  /** Outstanding amount; >0 means the invoice is a collectable candidate. */
  pending?: number;
  paymentStatus?: string;
};

/** A selected unpaid-invoice line in the quick "Cobrar" (settle) flow. */
export type CobrarLineState = {
  invoiceId: string;
  docNo: string;
  currency: string;
  pending: number;
  /** Amount to collect for this line (≤ pending). */
  amount: number;
  /** Per-line payment-method override; falls back to the shared method. */
  methodId?: string;
};

export type UserPermission = {
  permission: string;
  action: string;
  resource: string;
  code: string;
};

export type UserRoleAndPermission = {
  role_name: string;
  role_description: string;
  permissions: UserPermission[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  internal_id?: string | null;
  is_active: boolean;
  roles_and_permissions: UserRoleAndPermission[];
};

export type PatientDischarge = {
  id: string;
  user_id: string;
  appointment_date: string;
  created_at?: string;
};

export type Debtor = {
  user_id: string;
  patient_name: string;
  email: string;
  identity_document: string;
  currency: CurrencyCode;
  pending_invoices_count: string;
  total_debt_amount: string;
};

export type Document = {
  id: string;
  name: string;
  mimeType?: string;
  hasThumbnail?: boolean;
  thumbnailLink?: string;
};

export type Role = {
  id: string;
  name: string;
  is_default?: boolean;
};

export type Permission = {
  id: string;
  name: string;
  action: string;
  resource: string;
  description?: string;
  // Extended fields for permission matrix
  module?: string;
  submenu?: string;
  permission_code?: string;
  permission_type?: string;
  casl_action?: string;
};

export type UserRole = {
  user_role_id: string;
  role_id: string;
  name: string;
  is_active: boolean;
  id: string; // Add id to satisfy User type when using in a mixed context
  email: string; // Add email for consistency
};


export type UserRoleAssignment = {
  role_id: string;
  is_active: boolean;
};

export type UserClinic = {
  user_id: string;
  clinic_id: string;
  start_date: string;
  position: string;
};

/** Cómo se expresa un descuento: porcentaje sobre la base, o importe fijo. */
export type DiscountMode = 'percent' | 'amount';

/** Dónde se aplica el descuento en un documento: por línea, o sobre el total. */
export type DiscountScope = 'line' | 'total';

/**
 * Campos de descuento de una línea (`quote_items`, `order_items`, `invoice_items`).
 *
 * Invariante: `total` es SIEMPRE el importe neto, ya descontado, porque el
 * backend recalcula el total del documento como `SUM(items.total)`. `gross_total`
 * guarda el bruto (`unit_price × quantity`) para poder imprimir la línea sin
 * descontar. Las filas anteriores a esta feature traen todo a `undefined`: hay
 * que leerlas como `gross_total ?? total` y sin descuento.
 */
export type LineDiscountFields = {
  gross_total?: number;
  discount_mode?: DiscountMode | null;
  discount_value?: number | null;
  discount_amount?: number | null;
};

/**
 * Campos de descuento de una cabecera (`quotes`, `orders`, `invoices`).
 * `discount_mode` y `discount_value` sólo se rellenan con `discount_scope: 'total'`;
 * con `'line'`, `discount_amount` es la suma de los descuentos de las líneas.
 */
export type DocumentDiscountFields = LineDiscountFields & {
  discount_scope?: DiscountScope | null;
};

export type Quote = {
  id: string;
  doc_no?: string;
  quote_doc_no?: string;
  user_id: string;
  doctor_id?: string;
  doctor_name?: string;
  sede_id?: string;
  sede_name?: string;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'pending' | 'confirmed';
  payment_status: 'unpaid' | 'paid' | 'partial' | 'partially_paid';
  billing_status: string;
  currency?: CurrencyCode;
  user_name?: string;
  userEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  exchange_rate?: number;
  created_by?: string;
  updated_by?: string;
  amount_invoiced?: number;
  amount_pending_invoice?: number;
  amount_paid?: number;
  amount_pending_payment?: number;
  external_id?: string | number | null;
} & DocumentDiscountFields;

export type QuoteItem = {
  id: string;
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total: number;
  tooth_number?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
} & LineDiscountFields;

export type Order = {
  id: string;
  doc_no?: string;
  user_id: string;
  quote_id: string;
  quote_doc_no?: string;
  user_name?: string;
  currency?: CurrencyCode;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  is_invoiced?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
} & DocumentDiscountFields;

export type OrderItem = {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  tooth_number?: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  scheduled_date?: string;
  completed_date?: string;
  invoiced_date?: string;
  appointment_id?: string;
  quote_item_id?: string | number;
} & LineDiscountFields;

export type Invoice = {
  id: string;
  invoice_ref: string;
  doc_no?: string;
  order_id: string;
  order_doc_no?: string;
  quote_doc_no?: string;
  invoice_doc_no?: string;
  quote_id: string;
  user_name: string;
  userEmail?: string;
  user_id: string;
  doctor_id?: string;
  doctor_name?: string;
  sede_id?: string;
  sede_name?: string;
  total: number;
  currency?: CurrencyCode;
  notes?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'booked';
  payment_status: 'unpaid' | 'paid' | 'partial' | 'partially_paid';
  paid_amount?: number;
  type?: string;
  invoice_id?: string | null;
  parent_id?: string;
  is_historical?: boolean;
  due_date?: string;
  external_id?: string | number | null;
  createdAt: string;
  updatedAt: string;
} & DocumentDiscountFields;

export type CreditNote = Invoice & {
  type: 'credit_note';
  parent_id?: string;
};

export interface DocPrintTemplate {
  id: string;
  clinic_id: string;
  template_type: 'quote' | 'invoice' | 'payment' | 'credit_note' | 'prepayment' | 'financial_summary' | 'ledger' | 'caja_apertura' | 'caja_cierre' | 'caja_sesion' | 'clinic_history';
  template_html: string;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceItem = {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  tooth_number?: number;
  quote_item_id?: string | number;
  step_id?: string;
  steps?: string;
} & LineDiscountFields;

export type Payment = {
  id: string;
  doc_no?: string;
  payment_doc_no?: string;
  order_id: string;
  order_doc_no?: string;
  invoice_doc_no?: string;
  invoice_id: string | null;
  quote_id: string | null;
  user_name: string;
  userEmail?: string;
  payment_date: string;
  amount_applied: number;
  source_amount: number;
  source_currency: CurrencyCode;
  exchange_rate?: number;
  payment_method_id?: string;
  payment_method: string;
  payment_method_code?: string;
  transaction_type: 'direct_payment' | 'credit_note_allocation' | 'payment_allocation';
  transaction_id: string | null;
  /** The `payments.id` behind this row. On an allocation, `transaction_id` is the allocation's own id. */
  source_payment_id?: string;
  reference_doc_id?: string;
  notes?: string;
  status: 'pending' | 'completed' | 'failed';
  is_historical?: boolean;
  external_id?: string | number | null;
  doctor_id?: string;
  doctor_name?: string;
  createdAt: string;
  updatedAt: string;
  amount: number;
  method: string;
  currency?: CurrencyCode;
  type: 'invoice' | 'credit_note' | null;
};

export type InvoiceAllocation = {
  allocation_id: number;
  doc_no?: string;
  origen_doc_no: string;
  origen_tipo: 'credit_note';
  destino_doc_no: string;
  destino_tipo: 'invoice';
  monto_asignado: string;
  moneda: string;
  tipo_cambio: string;
  monto_en_destino: string;
  fecha_asignacion: string;
};

export type PaymentAllocation = {
  allocation_id: number;
  doc_no?: string;
  pago_doc_no: string;
  medio_pago: string;
  moneda_pago: string;
  factura_doc_no: string;
  factura_tipo: 'invoice' | 'credit_note';
  moneda_factura: string;
  monto_desde_pago: string;
  moneda_allocation: string;
  tipo_cambio: string;
  monto_aplicado_a_factura: string;
  fecha_aplicacion: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  is_cash_equivalent: boolean;
  is_active: boolean;
}

export type ServiceType = 'single' | 'workflow';

export type TreatmentStep = {
  position: number;
  name: string;
  offset_days_from_prev: number;
  duration_minutes: number;
  notes?: string;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  category_id?: string;
  category_name?: string;
  price: number;
  currency?: CurrencyCode;
  duration_minutes: number;
  description?: string;
  indications?: string;
  is_active: boolean;
  color?: string | null;
  is_sales?: boolean;
  service_type?: ServiceType;
  treatment_steps?: TreatmentStep[];
  /**
   * El paciente puede elegir este servicio al reservar desde el portal. Separa
   * el catálogo que la clínica brinda del subconjunto auto-agendable: una
   * cirugía existe como servicio pero no es algo que un paciente reserve solo.
   */
  bookable_online?: boolean;
  /** Trabajo de laboratorio: se puede pedir en una orden de laboratorio (script 167). */
  is_lab?: boolean;
  /** Categoría de laboratorio que hace este trabajo (opcional, script 170). */
  lab_category_id?: string | null;
  /** Última vez que se reemplazó la imagen. Se usa para invalidar la caché. */
  image_updated_at?: string | null;
};

export interface UserServicesEntry {
  user_id: string;
  services: Service[];
}

export type Clinic = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  phone_number: string;
  logo?: string;
  logo_base64?: string;
  /** Moneda de trabajo principal. Es la que usa toda la UI por defecto. */
  currency?: CurrencyCode;
  /**
   * Segunda moneda opcional en la que la clínica también acepta operar.
   * Configurada ⇒ los formularios ofrecen ambas y aparece el tipo de cambio.
   * Vacía ⇒ la clínica opera en moneda única.
   */
  secondary_currency?: CurrencyCode | null;
  // New fields from API response
  address?: string;
  phone?: string;
  email?: string;
  is_active?: boolean;
  created_at?: string;
  logo_filename?: string;
  logo_mimetype?: string;
  drive_file_id?: string;
  web_view_link?: string;
  thumbnail_link?: string;
  rut?: string;
};

export type ClinicSchedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  sede_id?: string;
};

export type ClinicExceptionRecurrence = 'once' | 'weekly' | 'biweekly' | 'monthly';

export type ClinicException = {
  id: string;
  /** Primera de `dates` cuando recurrence es 'once'; fecha de inicio de la
   *  recurrencia para 'weekly' | 'biweekly' | 'monthly'. */
  date: string;
  is_open: boolean;
  start_time?: string;
  end_time?: string;
  notes: string;
  /** Sede a la que aplica. Vacío/undefined = aplica a todas las sedes. */
  sede_id?: string;
  /** Nombre de la sede, cuando la API lo devuelve resuelto. */
  sede_name?: string;
  /** Patrón de repetición. 'once' (default) = fechas sueltas (`dates`). */
  recurrence?: ClinicExceptionRecurrence;
  /** Fechas `yyyy-MM-dd` para 'once', ordenadas. */
  dates?: string[];
  /** Días ISO para 'weekly' | 'biweekly' (1=lunes..7=domingo), ordenados. */
  days_of_week?: number[];
  /** Días del mes para 'monthly' (1-31), ordenados. */
  days_of_month?: number[];
  /** Requerido para 'biweekly': la paridad se cuenta desde el lunes de esta semana. */
  biweekly_reference_date?: string;
  /** Fin de la recurrencia (inclusive). Vacío/undefined = indefinida. */
  end_date?: string;
};

export type Conversation = {
  id: string;
  subject: string;
  user_id: string;
  channel_id: string;
  status: 'open' | 'closed' | 'pending';
};

export type CommunicationChannel = {
  id: string;
  name: string;
  channel_type: 'email' | 'sms' | 'chat';
  is_active: boolean;
};

export type SystemConfiguration = {
  id: string;
  key: string;
  value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  updated_by: string;
  description?: string;
  is_public?: boolean;
};

/** `system_configurations.google_calendar_sync_mode`: dirección de la sincronización con Google Calendar. */
export type GoogleCalendarSyncMode = 'none' | 'from_google' | 'to_google' | 'both';

/**
 * Ajustes de automatización que se editan en Preferencias de Clínica pero viven
 * en `system_configurations` (los leen los flujos de n8n).
 */
export interface ClinicAutomationSettings {
  alert_email_auto_send_enabled: boolean;
  google_calendar_sync_mode: GoogleCalendarSyncMode;
  /** `help_mascot_visible`: la mascota del asistente se ve en pantalla (por defecto sí). */
  help_mascot_visible: boolean;
  /** `appointment_schedule_export` (json): formato del Excel de la agenda (por defecto básico). */
  appointment_schedule_export: ScheduleExportSettings;
}

/**
 * Formato de "Exportar agenda a Excel".
 * - `basic`: un calendario; Horario · Nombre · Teléfono, con una fila de fecha antes de cada día.
 * - `extended`: varios calendarios/sedes, con las columnas elegidas y filtros.
 */
export type ScheduleExportMode = 'basic' | 'extended';

/** Columnas que puede llevar el Excel extendido (todas salen de `/users_appointments`). */
export type ScheduleExportColumn =
  | 'sede'
  | 'calendar'
  | 'date'
  | 'time'
  | 'end_time'
  | 'patient_name'
  | 'phone'
  | 'email'
  | 'doctor'
  | 'service'
  | 'status'
  | 'notes';

/** `system_configurations.appointment_schedule_export` (json). */
export interface ScheduleExportSettings {
  mode: ScheduleExportMode;
  /** Extendido: una hoja por sede (la columna Sede se omite, la dice el nombre de la hoja). */
  split_by_sede: boolean;
  /** Extendido: columnas en el orden en que salen. Nunca vacío. */
  columns: ScheduleExportColumn[];
}

export type AuditLog = {
  id: string;
  changed_at: string;
  changed_by: string;
  changed_by_name?: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_value: any;
  new_value: any;
};

export type AccessLog = {
  id: string;
  user_id: string;
  timestamp: string;
  action: 'login' | 'logout' | 'failed_login';
  success: boolean;
  ip_address: string;
  channel?: string;
  details?: string;
};

export type ErrorLog = {
  id: string;
  created_at: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  user_id?: string;
  channel?: string;
};

export type MedicalEvent = {
  id: string;
  date: string;
  title: string;
  doctor: string;
  summary: string;
  details: string;
  eventType: 'appointment' | 'procedure' | 'test' | 'prescription' | 'note';
};

export type Message = {
  id: string;
  user_id: string;
  content: string;
  timestamp: string;
  sender: 'user' | 'system';
  channel?: string;
};

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'arrived'
  | 'arrived_late'
  | 'in_progress'
  | 'completed'
  | 'attended_late'
  | 'no_show'
  | 'cancelled'
  | 'pending';

export type CancellationReason =
  | 'late'
  | 'in_time'
  | 'no_notice'
  | 'by_doctor'
  | 'by_clinic'
  | 'other'
  | 'reschedule';

/**
 * Nivel de la cadena `etiqueta de la cita > servicio > doctor > consultorio` del
 * que salió el `color` de una cita. `appointment` y `service` son colores que
 * alguien le asignó a esa cita; `doctor` y `calendar` son herencia.
 */
export type AppointmentColorSource = 'appointment' | 'service' | 'doctor' | 'calendar' | 'none';

/**
 * Niveles heredables de la cadena de color de una cita (Configuración → Colores
 * de calendario → Origen del color). El color propio de la cita no se
 * configura: es una elección explícita del usuario y siempre gana.
 */
export type InheritedColorLevel = 'service' | 'doctor' | 'calendar';
export type CalendarColorSources = Record<InheritedColorLevel, boolean>;

/**
 * Cuánto refleja la vista del calendario el color del calendario que se está
 * viendo, para distinguir de un vistazo entre sedes (un calendario por sede).
 * off = nada, subtle = franja superior, strong = marco + etiqueta, full = toda la
 * vista teñida (marco, panel de agendas, encabezado y grilla; solo la barra de
 * navegación queda con el tema normal).
 */
export type CalendarViewHighlight = 'off' | 'subtle' | 'strong' | 'full';

/** Lo que se configura por alcance en Colores de calendario → Origen del color. */
export type CalendarColorSettings = CalendarColorSources & {
  highlight: CalendarViewHighlight;
};

// ── Órdenes de laboratorio ─────────────────────────────────────────────────────

/** initial: exactamente una activa (ahí entra toda orden nueva) · final: al menos una (ya no está pendiente). */
export type LabStageKind = 'initial' | 'intermediate' | 'final';

/**
 * Disparador de una alerta de etapa: al entrar a la etapa o por atraso ('dwell': más de
 * overdue_days o, en la etapa donde se fijó la fecha de entrega, pasada esa fecha). 'due' ya no se
 * configura (script 177): queda como texto del aviso de atraso por la fecha de entrega.
 */
export type LabStageAlertTrigger = 'enter' | 'dwell' | 'due';

/** Alerta de una etapa (tabla `lab_stage_alerts`, script 150). */
export interface LabStageAlertConfig {
  /** Permanencia y entrega vencida: repetir cada N días mientras siga igual. null = una sola vez. */
  repeat_every_days: number | null;
  recipient_role_ids: number[];
  recipient_user_ids: string[];
  notify_order_doctor: boolean;
  notify_order_creator: boolean;
  channel_in_app: boolean;
  channel_email: boolean;
  channel_whatsapp: boolean;
  /** Plantilla EMAIL; sin ella se manda un texto por defecto. */
  email_template_id: number | null;
  /** Plantilla WHATSAPP aprobada en Meta/YCloud (obligatoria para el canal). */
  whatsapp_template_id: number | null;
}

export interface LabStageAlerts {
  enter: LabStageAlertConfig | null;
  /** Atraso: días en la etapa o, en la etapa donde se fijó la fecha de entrega, esa fecha (script 177). */
  dwell: LabStageAlertConfig | null;
}

/** Etapa del circuito de laboratorio (tabla `lab_stages`, Configuración → Etapas de laboratorio). */
export interface LabStage {
  id: number;
  /** Lo escribe la clínica: no se traduce. */
  name: string;
  color: string;
  sort_order: number;
  kind: LabStageKind;
  /** Días en la etapa a partir de los cuales la orden está atrasada. null = sin umbral (siempre null en finales). */
  overdue_days: number | null;
  is_active: boolean;
  /** Órdenes que están hoy en esta etapa. */
  orders_count: number;
  /** Tiene órdenes o aparece en el historial: no se puede borrar, solo desactivar. */
  in_use: boolean;
  alerts: LabStageAlerts;
}

/** Una etapa tal como se manda a guardar (POST /lab-stages/save), en el orden de la pantalla. */
export interface LabStageSaveItem {
  /** null = etapa nueva. */
  id: number | null;
  name: string;
  color: string;
  kind: LabStageKind;
  overdue_days: number | null;
  is_active: boolean;
  /** Al desactivar una etapa con órdenes: etapa activa a la que pasan. */
  move_orders_to?: number | null;
  /** Alertas de la etapa (se reemplazan las tres). */
  alerts: LabStageAlerts;
}

/** Un servicio (trabajo de laboratorio) de la orden (lab_order_items, script 167). */
export interface LabOrderItem {
  id: number;
  service_id: number;
  /** Nombre del servicio al guardar la orden. */
  service_name: string;
  quantity: number;
  /** Piezas dentales (FDI) de este servicio. */
  teeth: number[];
  notes: string | null;
  /** Categoría de laboratorio del servicio (script 170). */
  lab_category_id: string | null;
}

/** Orden de laboratorio tal como la devuelve v_lab_orders (scripts 148 y 167). */
export interface LabOrder {
  id: number;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  /** Proveedor que hace el trabajo. */
  laboratory_id: string | null;
  laboratory_name: string | null;
  /** Descripción libre. Opcional si la orden tiene servicios. */
  work_description: string | null;
  /** Servicios de laboratorio de la orden. */
  items: LabOrderItem[];
  /** Texto corto del trabajo: los servicios ("Corona ×2, Férula") o, sin ellos, la descripción. */
  work_summary: string | null;
  /** Piezas dentales (FDI). Con servicios, la unión de las de cada uno. */
  teeth: number[];
  /** Fecha de entrega prometida ('YYYY-MM-DD'). Es el plazo de la etapa en la que se fijó (due_stage_id). */
  due_date: string | null;
  /** Etapa en la que se fijó la fecha de entrega (script 177). */
  due_stage_id: number | null;
  /** La orden está en esa etapa: el atraso es la fecha de entrega y no los días de la etapa. */
  due_applies: boolean;
  notes: string | null;
  current_stage_id: number;
  stage_name: string;
  stage_color: string;
  stage_kind: LabStageKind;
  stage_overdue_days: number | null;
  /** ISO UTC. */
  stage_entered_at: string;
  days_in_stage: number;
  /** La etapa actual no es final. */
  is_pending: boolean;
  /** Atrasada: is_stage_overdue o is_past_due. Nunca en etapa final. */
  is_overdue: boolean;
  /** Lleva más de stage_overdue_days en la etapa (fuera de la etapa de la fecha de entrega). */
  is_stage_overdue: boolean;
  /** La fecha de entrega ya pasó (desde el día siguiente) y la orden sigue en la etapa donde se fijó. */
  is_past_due: boolean;
  /** Días desde la fecha de entrega cuando is_past_due; 0 si no. */
  days_past_due: number;
  /** ISO UTC. */
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  /** Categorías de laboratorio de los servicios de la orden (script 170). */
  lab_category_ids: string[];
  /** Urgente: mientras está pendiente sale primero en la lista, el tablero y la ficha (script 173). */
  is_urgent: boolean;
  /** Archivos adjuntos (fotos, PDF, escaneos) de la orden (script 173). */
  attachments_count: number;
}

/** Adjunto de una orden (tabla `attachments`, source_name 'lab_order', script 173). */
export interface LabOrderAttachment {
  id: number;
  file_name: string;
  mime_type: string | null;
  /** Vista en Google Drive (se abre con permisos de la cuenta de la clínica). */
  web_view_link: string | null;
  thumbnail_link: string | null;
  /** ISO UTC. */
  created_at: string;
}

/** Categoría de laboratorio: un grupo de proveedores marcado como tal (script 170). */
export interface LabCategory {
  id: string;
  name: string;
  description: string | null;
  laboratories_count: number;
}

/** Laboratorio: proveedor que pertenece a alguna categoría de laboratorio. */
export interface Laboratory {
  id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
  categories: { id: string; name: string }[];
}

export interface LabOrderHistoryEntry {
  id: number;
  /** null = alta de la orden. */
  from_stage_id: number | null;
  from_stage_name: string | null;
  from_stage_color: string | null;
  to_stage_id: number;
  to_stage_name: string;
  to_stage_color: string;
  changed_by: string | null;
  changed_by_name: string | null;
  /** ISO UTC. Cuándo se registró el movimiento. */
  changed_at: string;
  /**
   * ISO UTC. Cuándo pasó (script 176): igual a `changed_at` salvo que se registrara después
   * ("se envió ayer"). Sin el script, el servicio lo completa con `changed_at`.
   */
  effective_at: string;
  /** 'stage_deactivated' cuando la movió la configuración de etapas. */
  note: string | null;
}

/** Un servicio tal como quedó en la auditoría (lista completa antes y después de un guardado). */
export interface LabOrderChangeItem {
  service_name: string;
  quantity: number;
  teeth: number[];
  notes: string | null;
}

/**
 * Un dato cambiado en una edición. `field` es la columna de lab_orders ('laboratory_id',
 * 'due_date', 'is_urgent', …) o 'items'. Doctor, laboratorio y paciente llegan con el nombre;
 * 'items' llega como LabOrderChangeItem[].
 */
export interface LabOrderChangeField {
  field: string;
  old: unknown;
  new: unknown;
}

/** Una edición de la orden: lo que cambió en un mismo guardado (audit_log, script 175). */
export interface LabOrderChange {
  id: number;
  /** ISO UTC. Igual al de un movimiento de etapa si se guardó en ese movimiento. */
  changed_at: string;
  changed_by: string | null;
  changed_by_name: string | null;
  fields: LabOrderChangeField[];
}

/** Laboratorio asignado, con sus datos de contacto (ficha del proveedor). Solo en el detalle (script 172). */
export interface LabOrderLaboratoryInfo extends Laboratory {
  alternative_phone: string | null;
  address: string | null;
  rut: string | null;
}

export interface LabOrderDetail extends LabOrder {
  history: LabOrderHistoryEntry[];
  /** Ediciones de la orden y sus servicios, de la más nueva a la más vieja. Vacío sin el script 175. */
  changes: LabOrderChange[];
  /** null sin laboratorio, o si el backend todavía no tiene el script 172 (solo se ve el nombre). */
  laboratory: LabOrderLaboratoryInfo | null;
  /** Adjuntos de la orden, del más viejo al más nuevo (script 173). */
  attachments: LabOrderAttachment[];
}

export type LabOrderSort = 'created_desc' | 'created_asc' | 'days_desc' | 'days_asc';

/** Filtros de POST /lab-orders/search. */
export interface LabOrderFilters {
  stage_ids?: number[];
  laboratory_id?: string;
  doctor_id?: string;
  patient_id?: string;
  /** Órdenes que incluyen este servicio. */
  service_id?: number;
  search?: string;
  /** 'YYYY-MM-DD', inclusive (fecha de alta). */
  date_from?: string;
  date_to?: string;
  /** Default true: solo órdenes que no están en etapa final. Se ignora si se filtra por etapa. */
  pending_only?: boolean;
  overdue_only?: boolean;
  /** 'YYYY-MM-DD', inclusive: solo pendientes con entrega en ese rango (script 171). */
  due_from?: string;
  due_to?: string;
  /** Solo pendientes sin laboratorio (script 171). */
  without_laboratory?: boolean;
  /** Solo urgentes pendientes (script 173). */
  urgent_only?: boolean;
  /** Solo las que entraron a su etapa actual en los últimos N días ("Cargar más" de una columna final). */
  entered_within_days?: number;
  sort?: LabOrderSort;
  limit?: number;
  offset?: number;
}

/** Filtros de POST /lab-orders/board. */
export interface LabOrderBoardFilters {
  search?: string;
  laboratory_id?: string;
  doctor_id?: string;
  service_id?: number;
  overdue_only?: boolean;
  /** 'YYYY-MM-DD', inclusive: solo pendientes con entrega en ese rango (script 171). */
  due_from?: string;
  due_to?: string;
  /** Solo pendientes sin laboratorio (script 171). */
  without_laboratory?: boolean;
  /** Solo urgentes pendientes (script 173). */
  urgent_only?: boolean;
  /** Tarjetas por columna (default 30). */
  per_column?: number;
  /** Las columnas finales muestran solo lo que llegó en los últimos N días (default 30). */
  final_days?: number;
}

/** Una columna del tablero: la etapa (activa) con su total y las primeras tarjetas. */
export interface LabOrderBoardColumn {
  stage_id: number;
  total: number;
  items: LabOrder[];
}

/** Alta (sin id) o edición. La etapa no se cambia acá: ver changeLabOrderStage. */
export interface LabOrderSavePayload {
  id?: number;
  patient_id: string;
  doctor_id: string | null;
  laboratory_id: string | null;
  work_description: string | null;
  /** Piezas de la orden. Con servicios las calcula el backend (unión de las de cada servicio). */
  teeth: number[];
  /**
   * Solo en la edición de una orden ya enviada (script 172): sin la clave, el backend deja la
   * guardada. En el alta se ignora: la fecha se fija al enviar (changeLabOrderStage).
   */
  due_date?: string | null;
  notes: string | null;
  /** Urgente (script 173). En la edición, sin la clave queda como estaba. */
  is_urgent?: boolean;
  /** Reemplaza los servicios de la orden. */
  items: LabOrderItemInput[];
}

export interface LabOrderItemInput {
  service_id: number;
  quantity: number;
  teeth: number[];
  notes: string | null;
}

/** Códigos de error de las funciones de órdenes (script 148). */
export type LabOrdersErrorCode =
  | 'NO_INITIAL_STAGE' | 'NOT_FOUND' | 'MISSING_PATIENT' | 'MISSING_WORK' | 'INVALID_TEETH'
  | 'INVALID_STAGE' | 'STAGE_CONFLICT' | 'INVALID_SERVICE' | 'INVALID_QUANTITY'
  | 'LABORATORY_REQUIRED' | 'INVALID_LABORATORY' | 'DUE_DATE_REQUIRED' | 'INVALID_DUE_DATE'
  | 'INVALID_EFFECTIVE_DATE' | 'EFFECTIVE_DATE_BEFORE_STAGE'
  | 'NO_FILES' | 'TOO_MANY_FILES' | 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'DELETE_FAILED'
  | 'UNKNOWN';

/** Códigos de error de lab_stages_save (script 147). */
export type LabStagesSaveErrorCode =
  | 'NO_INITIAL' | 'MANY_INITIAL' | 'NO_FINAL' | 'EMPTY_NAME' | 'DUPLICATE_NAME' | 'INVALID_KIND'
  | 'INVALID_OVERDUE' | 'INITIAL_INACTIVE' | 'UNKNOWN_STAGE' | 'STAGE_IN_USE' | 'STAGE_HAS_ORDERS'
  | 'INVALID_MOVE_TARGET' | 'DWELL_WITHOUT_THRESHOLD' | 'NO_RECIPIENTS' | 'NO_CHANNEL'
  | 'WHATSAPP_TEMPLATE_REQUIRED' | 'UNKNOWN';

/** `calendar_id: null` es la configuración general de la clínica. */
export type CalendarColorSourceRow = CalendarColorSettings & {
  calendar_id: string | null;
};

/**
 * Matriz de colores de estado configurable por cliente (Configuración → Colores
 * de calendario). `calendarMode` gobierna cuándo el estado pinta la card del
 * calendario; `badgeStyle` gobierna el resto de la app (badges, chips, notifs).
 */
export type StatusCalendarMode = 'always' | 'preference' | 'never';
export type StatusBadgeStyle = 'solid' | 'soft' | 'outline';

export type AppointmentStatusDisplay = {
  color: string;
  calendarMode: StatusCalendarMode;
  badgeStyle: StatusBadgeStyle;
};

export type AppointmentStatusDisplayMatrix = Record<AppointmentStatus, AppointmentStatusDisplay>;

export type CalendarStatusDisplayRow = AppointmentStatusDisplay & {
  calendar_id: string | null;
  status: AppointmentStatus;
};

/**
 * Contacto del responsable/tutor del paciente (`users.responsible_contact_id`).
 * Lo trae el backend como sub-json sólo cuando el paciente tiene responsable.
 */
export type ResponsibleContact = {
  id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  address?: string | null;
};

/** Paciente a cargo de un tutor, tal como lo lista `/users/dependents`. */
export interface PatientDependent {
  id: string;
  name: string;
  email?: string | null;
  phone_number?: string | null;
  identity_document?: string | null;
  identity_document_type?: string | null;
  birth_date?: string | null;
  is_active: boolean;
  /** Sin teléfono propio: alertas y recordatorios le escriben al tutor. */
  uses_responsible_phone: boolean;
}

export type Appointment = {
  id: string; // appointmentId in backend
  patientId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  /** Presente cuando el paciente de la cita tiene un responsable/tutor asociado. */
  responsibleContact?: ResponsibleContact | null;
  doctorId: string;
  doctorName?: string;
  doctorEmail?: string;
  summary: string; // was service_name before
  service_name?: string; // keeping for backward compatibility if needed in UI, but summary is the new standard
  description?: string;
  notes?: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  created_at?: string;
  google_calendar_id?: string;
  googleEventId?: string;
  /** La cita fue importada desde Google Calendar; no se creó desde la app. */
  imported_from_google?: boolean;
  calendar_id?: string; // keeping legacy for a moment to avoid immediate break
  calendar_source_id?: string;
  calendar_name?: string;
  color?: string;
  colorId?: string;
  /** De qué nivel de la cadena salió `color`. Lo usa el calendario para decidir si
   *  el color es de la cita (y hay que preservarlo) o heredado. */
  colorSource?: AppointmentColorSource;
  start?: any;
  end?: any;
  services?: Service[];
  quote_id?: string; // ID del presupuesto asociado
  quote_doc_no?: string; // Número de documento del presupuesto (Doc No)
  invoice_id?: string | null; // Factura vinculada (si existe, Cobro Rápido la reutiliza)
  // Treatment plan link — set when this appointment is linked to a treatment_seq_steps row
  treatment_seq_step_id?: number | null;
  // Cancellation metadata — populated when status='cancelled'.
  // When cancelled because of a reschedule, reason='reschedule' is the only
  // signal stored; the link to the new appointment is intentionally not persisted.
  cancellation_reason?: CancellationReason | null;
  cancellation_note?: string | null;
};

export type AppointmentDatePreset = 'today' | 'this_week' | 'this_month';

export interface AppointmentBulkFilterParams {
  date_from: string;
  date_to: string;
  doctor_ids?: string[];
  calendar_source_ids?: string[];
  statuses?: AppointmentStatus[];
}

export interface AppointmentBulkFilterResponse {
  ids: string[];
  total: number;
}

export interface AppointmentBulkReassignRequest {
  appointment_ids: string[];
  doctor_id: string;
  doctor_name: string;
  doctor_email?: string;
}

export interface AppointmentBulkReassignResponse {
  updated: number;
  failed: number;
  errors: Array<{ appointment_id: string; reason: string }>;
}

export type CalendarReminderPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type CalendarReminderStatus = 'pending' | 'done' | 'dismissed' | 'cancelled';

export type CalendarItemType = 'note' | 'reminder';

export type CalendarReminderVisibility = 'personal' | 'clinic';

export type ReminderRecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type ReminderRecurrenceEndMode = 'never' | 'until' | 'count';

/** La regla de repetición, descompuesta en columnas (no RRULE). Espeja `reminder_series`. */
export type ReminderRecurrence = {
  freq: ReminderRecurrenceFreq;
  interval: number;
  /** ISODOW 1..7 (1 = lunes). Solo en `WEEKLY`. */
  byweekday?: number[] | null;
  /** 1..31, recortado al último día del mes cuando no existe. Solo en `MONTHLY`. */
  by_month_day?: number | null;
  end_mode: ReminderRecurrenceEndMode;
  until_date?: string | null;
  occurrence_count?: number | null;
};

/**
 * Sobre qué actúa una edición o un borrado de algo que pertenece a una serie: solo esta
 * ocurrencia, o toda la serie. Lo pregunta `ReminderScopeDialog`.
 */
export type CalendarItemScope = 'occurrence' | 'series';

export type CalendarReminder = {
  id: string;
  type: CalendarItemType;
  calendar_id: string | null;
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  color?: string | null;
  priority: CalendarReminderPriority;
  status: CalendarReminderStatus;
  visibility: CalendarReminderVisibility;
  /**
   * Ítem de todo el día. La convención, atada por `reminders_all_day_range_check`, es
   * `start_datetime` = día 00:00:00 y `end_datetime` = mismo día 23:59:59. El calendario
   * lo dibuja en la banda fija de arriba, nunca dentro de la rejilla de horas.
   */
  is_all_day: boolean;
  /** Serie a la que pertenece esta ocurrencia, si la hay. */
  series_id?: string | null;
  /** La ocurrencia se editó o se canceló a mano: la regeneración de la serie no la pisa. */
  is_series_exception?: boolean;
  /** La regla de la serie. La trae el GET con el JOIN a `reminder_series`; es la misma
   *  para todas las ocurrencias y solo se usa para mostrarla y para sembrar el editor. */
  recurrence?: ReminderRecurrence | null;
  raise_alert?: boolean;
  alert_instance_id?: number | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
};

// ── Unified notification panel ────────────────────────────────────────────────

export type AppointmentStatusChangeNotification = {
  id: string;
  type: 'appointment_status_change';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
  previousStatus: AppointmentStatus;
};

export type SessionCompletedNotification = {
  id: string;
  type: 'session_completed';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
  session?: PatientSession | null;
  discharge?: PatientDischarge | null;
  actions_taken?: ('quote' | 'invoice' | 'schedule')[];
};

export type ReminderPanelNotification = {
  id: string;
  type: 'reminder';
  createdAt: string;
  seen?: boolean;
  reminder: CalendarReminder;
};

export type NewAppointmentNotification = {
  id: string;
  type: 'new_appointment';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
};

export type AppointmentRescheduledNotification = {
  id: string;
  type: 'appointment_rescheduled';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
  originalAppointmentId: string;
};

export type AppointmentReassignedNotification = {
  id: string;
  type: 'appointment_reassigned';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
};

export type AppointmentUpdatedNotification = {
  id: string;
  type: 'appointment_updated';
  createdAt: string;
  seen?: boolean;
  appointment: Appointment;
};

export type WhatsappHandoffRequestedNotification = {
  id: string;
  type: 'whatsapp_handoff_requested';
  createdAt: string;
  seen?: boolean;
  /** May be empty when the WhatsApp number is not a registered patient. */
  patientId: string;
  patientName: string;
  phone: string;
  /** The patient's last inbound message, for context. */
  lastMessage: string;
  /** Short reason the agent captured when escalating. */
  reason: string;
};

/** Aviso de una alerta de etapa de laboratorio (notifications.type 'lab_order_alert', script 150). */
export type LabOrderAlertNotification = {
  id: string;
  type: 'lab_order_alert';
  createdAt: string;
  seen?: boolean;
  trigger: LabStageAlertTrigger;
  labOrderId: number;
  patientName: string;
  workDescription: string;
  laboratoryName: string;
  stageName: string;
  stageColor: string;
  daysInStage: number;
  /** Solo 'due': días de atraso de la entrega al crearse el aviso. */
  daysPastDue: number;
};

export type UnifiedNotification =
  | AppointmentStatusChangeNotification
  | SessionCompletedNotification
  | ReminderPanelNotification
  | NewAppointmentNotification
  | AppointmentRescheduledNotification
  | AppointmentReassignedNotification
  | AppointmentUpdatedNotification
  | WhatsappHandoffRequestedNotification
  | LabOrderAlertNotification;

// ─────────────────────────────────────────────────────────────────────────────

export type UserLog = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};

export type Stat = {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
};

export type SalesChartData = {
  month: string;
  revenue: number;
};

export type SalesByServiceChartData = {
  name: string;
  sales: number;
  percentage: number;
  color: string;
};

export type InvoiceStatusData = {
  name: string;
  value: number;
  fill: string;
};

export type KpiChangeType = 'positive' | 'negative' | 'neutral';

export type AverageBilling = {
  value: number;
  change: number;
  changeType: KpiChangeType;
};

export type PatientDemographicsData = {
  type: 'New' | 'Recurrent';
  count: number;
  fill: string;
};

export type PatientDemographics = {
  total: number;
  data: PatientDemographicsData[];
};

export type AppointmentAttendanceRate = {
  value: number;
  change: number;
  changeType: KpiChangeType;
};

/* ── Panel de Control Gerencial ─────────────────────────────────────────────── */

export type DashboardCurrency = CurrencyCode;

/**
 * Métrica con doble lectura hoy / mes acumulado.
 * `null` significa "sin datos de origen", que no es lo mismo que 0 — la UI debe
 * distinguirlos (gastos y resultado de caja hoy no tienen ningún dato cargado).
 */
export type DashboardMetricPair = {
  hoy: number | null;
  mes: number | null;
  var_dia_pct?: number | null;
  var_mes_pct?: number | null;
};

export type DashboardExecutiveSummary = {
  fecha_servidor: string;
  sede_id: number | null;
  currency: DashboardCurrency;
  /** `estimated` mientras `invoices.sede_id` esté vacío y la sede salga de la heurística. */
  sede_source: 'estimated' | 'actual';
  produccion: DashboardMetricPair & { mes_anterior: number | null };
  /** `payments` no tiene vía a la sede: el monto es siempre consolidado. */
  cobranza: DashboardMetricPair & { disponible_por_sede: boolean };
  gastos: DashboardMetricPair & { sin_datos: boolean };
  resultado: DashboardMetricPair & { sin_datos: boolean };
  /** Personas distintas con al menos una cita atendida. No es aditivo entre ventanas. */
  pacientes_atendidos: {
    hoy: number;
    mes: number;
    var_dia_abs: number;
    var_mes_pct: number | null;
    agendados_hoy: number;
  };
  /**
   * Citas atendidas, no personas: quien vino dos veces cuenta dos. A diferencia de los
   * pacientes distintos **es aditivo**, así que la suma de los días da el total del mes.
   * Ausente contra un workflow anterior — la UI vuelve entonces a rotular "pacientes
   * atendidos" en vez de mostrar personas bajo la etiqueta "atenciones".
   */
  atenciones?: {
    hoy: number;
    mes: number;
    var_dia_abs: number;
    var_mes_pct: number | null;
    agendados_hoy: number;
  };
  pacientes_nuevos: { mes: number; var_pct: number | null };
};

export type ProduccionSucursalRow = {
  sede_id: number;
  name: string;
  produccion: number;
  /** Personas distintas atendidas en la sede. */
  pacientes: number;
  /** Citas atendidas en la sede. Ausente contra un workflow anterior. */
  atenciones?: number;
  no_show: number;
  ticket_promedio: number | null;
  pct: number;
};

export type ProduccionSucursalResponse = {
  sede_source: 'estimated' | 'actual';
  total: number;
  rows: ProduccionSucursalRow[];
};

/**
 * Granularidad de la serie de pacientes atendidos. La elige el backend según el ancho del
 * período: con varios meses, una barra por día es ilegible y el eje repite los mismos
 * números de día. La agregación es del backend porque los pacientes únicos de una semana
 * no son la suma de los únicos de cada día.
 */
export type DashboardGranularity = 'day' | 'week' | 'month';

export type PacientesPorDiaPoint = {
  fecha_inicio: string;
  fecha_fin: string;
  /** Total de pacientes únicos del bucket. Siempre `nuevos + recurrentes`. */
  pacientes: number;
  /**
   * Pacientes cuya primera cita atendida de la historia cae en este bucket. Es primera
   * visita **en la clínica**, no en la sede: con el filtro de sucursal puesto, quien debutó
   * en otra sede cuenta como recurrente. Ausentes contra un workflow anterior al desglose.
   */
  nuevos?: number;
  recurrentes?: number;
  /** Citas atendidas del bucket, la serie aditiva del gráfico. */
  atenciones?: number;
  atenciones_nuevos?: number;
  atenciones_recurrentes?: number;
  /** El período en curso (el bucket que contiene la fecha del servidor). */
  es_actual: boolean;
  /**
   * Forma anterior del webhook, previa a la granularidad adaptativa. El workflow de n8n se
   * despliega a mano y por fuera del frontend, así que puede haber una versión vieja en
   * servicio: se aceptan los dos nombres para que el panel siga funcionando en modo diario
   * en lugar de quedarse sin eje.
   */
  fecha?: string;
  es_hoy?: boolean;
};

export type PacientesPorDiaResponse = {
  granularity: DashboardGranularity;
  /** Promedio de personas distintas por período con actividad. */
  promedio: number;
  /** Promedio de atenciones por período con actividad. */
  promedio_atenciones?: number;
  periodos_con_actividad: number;
  rows: PacientesPorDiaPoint[];
};

export type VentasPorServicioResponse = {
  total: number;
  rows: SalesByServiceChartData[];
};

/* ── Evolución mensual ──────────────────────────────────────────────────────── */

export type EvolucionMensualMes = {
  /** `YYYY-MM`. */
  mes: string;
  inicio: string;
  fin: string;
  /** El mes todavía está en curso: `fin` es la fecha del servidor, no el fin de mes. */
  es_parcial: boolean;
};

export type EvolucionMensualMetrica = {
  key: 'produccion' | 'cobranza' | 'atenciones' | 'pacientes' | 'nuevos' | 'gastos';
  tipo: 'moneda' | 'conteo';
  /** Un valor por mes, en el mismo orden que `meses`. `null` = sin dato de origen. */
  valores: (number | null)[];
  /**
   * Variación del último mes. Si está en curso compara contra el mismo tramo de días del
   * mes anterior, no contra el mes anterior completo. `null` si no hay base de comparación.
   */
  var_pct: number | null;
  sin_datos: boolean;
};

export type EvolucionMensualResponse = {
  meses: EvolucionMensualMes[];
  metricas: EvolucionMensualMetrica[];
};

export type CalendarSettings = {
  id?: string;
  user_id?: string;
  default_view: string;
  grouped_by: string;
  check_availability: boolean;
  filter_doctors_by_service: boolean;
  /** When true, blocks (greys out + prevents clicks on) time outside clinic
   *  business hours, honoring schedules and exceptions. Default true. */
  block_unavailable?: boolean;
  /** Height in px of one hour slot in day/week views. */
  hour_height?: number;
  /** Default slot duration in minutes (10/15/20/30/60). Defines how many slots
   *  fit in an hour and floors the row height so titles stay readable. Default 15. */
  slot_duration?: number;
  /** How each appointment's label is composed. See EVENT_LABEL_FORMATS. */
  event_label_format?: string;
  /** Default branch (sede) id to show. Empty string = all branches. */
  default_sede?: string;
  /** When true, clicking a slot creates the appointment inline on the calendar
   *  (a draft card) instead of opening the modal. The "Create" button always
   *  opens the modal regardless. Default false. */
  inline_appointment_creation?: boolean;
  /** When true (tablet/desktop), the inline appointment card floats next to the
   *  appointment (Google Calendar style, no backdrop), which is previewed live on the
   *  grid while it is filled in (date/time/duration/agenda). Changing the date
   *  navigates the calendar to that day and keeps the appointment centered.
   *  Purely visual. Default false. */
  inline_draft_live_preview?: boolean;
  /** When true, appointments in a status other than "scheduled" paint the whole
   *  card with that status' color instead of the calendar/service/doctor color.
   *  Default true. */
  color_by_status?: boolean;
  /** Display mode. 'invoke' = multi-column when grouped; 'custom' = a single
   *  agenda shown at a time, chosen from the "Agendas" side panel. Default
   *  'custom'. See CALENDAR_MODES. */
  mode?: string;
  /** Days of week hidden from the day/week grid (0=Sunday…6=Saturday, same
   *  convention as `ClinicSchedule.day_of_week`). Purely visual: it doesn't
   *  change the date range fetched, only which day columns are rendered.
   *  Default []. */
  hidden_weekdays?: number[];
  /** Hours shown on the day/week grid: 'full' (whole day), 'custom'
   *  (`visible_hours_start`..`visible_hours_end`) or 'clinic' (the clinic's
   *  working hours for the days on screen). Purely visual. Default 'full'.
   *  See VISIBLE_HOURS_MODES. */
  visible_hours_mode?: string;
  /** Last custom range ("HH:mm"; end may be "24:00"). Kept while another mode
   *  is selected so switching back to 'custom' restores it. */
  visible_hours_start?: string | null;
  visible_hours_end?: string | null;
};

export type Sede = {
  id: string;
  clinic_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Calendar = {
  id: string;
  name: string;
  google_calendar_id?: string;
  is_active: boolean;
  color?: string;
  sede_id?: string;
  sede_name?: string;
};

export type CalendarUserAccess = {
  calendar_source_id: string;
  user_id: string;
  user_name?: string;
};

export type Ailment = {
  id: string;
  nombre: string;
  categoria: string;
  nivel_alerta: number;
};

export type Medication = {
  id: string;
  nombre_generico: string;
  nombre_comercial?: string;
};

export type DentalCondition = {
  id: string;
  nombre: string;
  codigo_visual: string;
  color_hex?: string;
};

export type DentalSurface = {
  id: string;
  nombre: string;
  codigo: string;
};

export type TreatmentDetail = {
  numero_diente: number | null;
  descripcion: string;
  // Campos que llegan del backend al leer sesiones clínicas guardadas
  service_catalog_id?: number | string; // ID del servicio tal como lo guarda el backend
  // Campos generados por IA / normalizados en el frontend
  service_id?: string;    // Siempre usar este en el frontend (string, normalizado desde service_catalog_id)
  service_name?: string;
  unit_price?: number;
  quantity?: number;
  is_for_next_session?: boolean;
  /** Frontend-only flag — stripped before sending to backend. True when added manually from catalog. */
  is_manual?: boolean;
};

/**
 * Servicio pre-cargado por IA desde una sesión clínica, para pre-llenar presupuesto/factura.
 * `service_id` es siempre requerido — sólo los tratamientos con ID pueden pre-cargar forms.
 */
export type SessionPreloadedService =
  Required<Pick<TreatmentDetail, 'service_id'>> &
  Pick<TreatmentDetail, 'service_name' | 'unit_price' | 'quantity' | 'is_for_next_session' | 'numero_diente'>;

export type AttachedFile = {
  id?: string;
  diente_asociado: number | null;
  ruta: string;
  tipo: string;
  file_name?: string;
  mime_type?: string;
  base64?: string;
  thumbnail_url?: string;
};

export type PatientSession = {
  sesion_id: number;
  tipo_sesion?: 'odontograma' | 'clinica';
  fecha_sesion: string;
  diagnostico?: string | null;
  pieza?: string | null;
  color?: string | null;
  procedimiento_realizado: string;
  notas_clinicas?: string;
  plan_proxima_cita?: string;
  fecha_proxima_cita?: string;
  doctor_id: string | null;
  doctor_name?: string;
  nombre_doctor?: string;
  estado_odontograma?: any;
  tratamientos: TreatmentDetail[];
  archivos_adjuntos: AttachedFile[];
  quote_id?: string;
  quote_doc_no?: string;
  appointment_id?: string;
  invoice_id?: string | null; // Factura vinculada (si existe, Cobro Rápido la reutiliza)
};

export type DoctorPatientAllergy = {
  alergeno: string;
  reaccion_descrita?: string;
};

export type DoctorTreatmentPlanContext = {
  service_name: string;
  status: TreatmentSequenceStatus;
  next_step?: string;
  next_step_date?: string;
};

export type DoctorQuoteItemContext = {
  service_name: string;
  tooth_number?: number | null;
};

export type DoctorClinicalContext = {
  patient_name: string;
  appointment_date?: string;
  appointment_time?: string;
  service_name?: string;
  appointment_notes?: string;
  latest_session?: PatientSession | null;
  recent_sessions: PatientSession[];
  allergies: DoctorPatientAllergy[];
  active_treatment_plans: DoctorTreatmentPlanContext[];
  quote_items: DoctorQuoteItemContext[];
};

export type DoctorClinicalBrief = {
  resumen_clinico: string;
  ultimo_realizado: string;
  que_toca_hoy: string[];
  alertas: string[];
  preguntas_sugeridas: string[];
};

export type DoctorClinicalQuestionAnswer = {
  answer: string;
};

export type StructuredClinicalSession = {
  diagnostico: string;
  procedimiento_realizado: string;
  notas_clinicas: string;
  plan_proxima_cita: string;
  tratamientos: TreatmentDetail[];
  missing_information: string[];
};

export type DoctorAiIntent = 'clinical_summary' | 'clinical_question' | 'session_structuring' | 'unknown';

export type DoctorAiSessionPatch = {
  diagnostico: string;
  procedimiento_realizado: string;
  notas_clinicas: string;
  plan_proxima_cita: string;
  tratamientos: TreatmentDetail[];
  missing_information?: string[];
};

export type DoctorAgentActionType =
  | 'open_clinic_session'
  | 'save_clinic_session'
  | 'review_clinic_session'
  | 'open_odontogram'
  | 'open_patient_detail'
  | 'open_clinical_history'
  | 'open_patient_appointments'
  | 'open_patient_messages'
  | 'open_patient_notes'
  | 'select_appointment';

export type OdontogramMarcacion = {
  diente: string;
  condicion: OdontogramCondition;
  superficie?: OdontogramSurface | 'whole' | 'overlay';
};

export type DoctorAgentActionPayload = {
  appointment_id?: string;
  clinical_history_view?: 'anamnesis' | 'timeline' | 'documents';
  doctor_id?: string;
  doctor_name?: string;
  procedimiento_realizado?: string;
  notas_clinicas?: string;
  plan_proxima_cita?: string;
  fecha_proxima_cita?: string;
  tratamientos?: TreatmentDetail[];
  marcaciones?: OdontogramMarcacion[];
};

export type DoctorAgentAction = {
  type: DoctorAgentActionType;
  payload?: DoctorAgentActionPayload | null;
};

export type DoctorAiQueryResponse = {
  intent: DoctorAiIntent;
  answer?: string;
  output?: string;
  speak_text?: string;
  suggestions?: string[];
  clinical_brief?: DoctorClinicalBrief | null;
  session_patch?: DoctorAiSessionPatch | null;
  action?: DoctorAgentAction | null;
};

export type TreatmentSequenceStepStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'missed';

export type TreatmentSequenceStep = {
  /** treatment_seq_steps.id (integer stored as string) */
  id: string;
  step_number: number;
  step_name: string;
  scheduled_date?: string;
  /** appointments.id — present when this step has a calendar appointment */
  appointment_id?: string;
  /** patient_sessions.sesion_id — present when a clinical session has been linked to this step */
  sesion_id?: string | null;
  status: TreatmentSequenceStepStatus;
  notes?: string;
  completed_at?: string;
  duration_minutes?: number;
  is_lab_pending?: boolean;
};

export type TreatmentSequenceStatus = 'active' | 'completed' | 'cancelled' | 'paused';

export type TreatmentSequence = {
  id: string;
  patient_id: string;
  service_id: string;
  service_name: string;
  service_color?: string | null;
  status: TreatmentSequenceStatus;
  started_at: string;
  expected_end_at?: string | null;
  steps: TreatmentSequenceStep[];
  notes?: string;
  created_at?: string;
  // Doctor / calendar info — populated when creating from appointment
  doctor_id?: string;
  doctor_name?: string;
  doctor_email?: string;
  google_calendar_id?: string | null;
  started_by?: string;
};

export type SessionPrefillData = {
  step_id?: string;
  service_id?: string;
  scheduled_date?: string;
  doctor_id?: string;
  doctor_name?: string;
  step_number?: number;
  step_name?: string;
  notes?: string;
  appointment_id?: string;
};

// ── Step operation types ──────────────────────────────────────────────────────
//
// A "step instance" = treatment_seq_steps row (keyed by id).
// treatment_steps is a read-only template (per service_catalog, not per patient).
// appointments are linked optionally via treatment_seq_steps.appointment_id.

/** How to handle subsequent steps when a date is shifted */
export type StepCascadeMode = 'none' | 'shift_all';

/**
 * Create or update a treatment_seq_steps row.
 * - seq_step_id present → UPDATE existing row
 * - seq_step_id absent  → INSERT new row (requires sequence_id + step_position + step_name)
 */
export type StepUpsertPayload = {
  seq_step_id?: number;           // treatment_seq_steps.id — omit to create
  sequence_id: number;
  step_position: number;
  step_name: string;
  scheduled_date?: string;
  duration_minutes?: number;
  notes?: string;
  is_lab_pending?: boolean;
  cascade_mode?: StepCascadeMode;
  cascade_days?: number;          // days to shift subsequent steps (+push / -pull)
};

/**
 * Delete (hard) or cancel a treatment_seq_steps row.
 * Optionally cancels the linked appointment.
 */
export type StepDeletePayload = {
  seq_step_id: number;            // treatment_seq_steps.id
  sequence_id: number;
  cancel_appointment?: boolean;   // also cancel the linked appointment
  cascade_mode?: StepCascadeMode;
  cascade_days?: number;          // negative = pull subsequent forward
  notify_patient?: boolean;
};

/**
 * Change milestone_status on a treatment_seq_steps row.
 * Auto-completes the treatment_sequence when all steps are done.
 */
export type StepStatusPayload = {
  seq_step_id: number;
  milestone_status: 'waiting' | 'done' | 'alert' | 'pending';
  appointment_status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notify_patient?: boolean;
};

/**
 * Create a calendar appointment for a step that has none.
 * Links the new appointment back to the treatment_seq_steps row.
 */
export type StepSchedulePayload = {
  seq_step_id: number;
  patient_id: string;
  doctor_id: string;
  doctor_name?: string;
  scheduled_date: string;
  scheduled_time: string;   // HH:mm
  duration_minutes: number;
  notes?: string;
  service_id?: string;
  google_calendar_id?: string | null;
};

export type StepOperationResult = {
  success: boolean;
  /** The updated/created appointments row mapped to TreatmentSequenceStep */
  step?: TreatmentSequenceStep;
  /** All steps for the sequence after a cascade operation */
  affected_steps?: TreatmentSequenceStep[];
  appointment_id?: string;
  sequence_completed?: boolean;
  error?: string;
};

export type AbandonedPlan = {
  sequence_id: number;
  patient_id: string;
  patient_name?: string;
  service_name: string;
  step_position: number;
  seq_step_id: number;
  missed_step_name: string;
  missed_days_ago: number;
};

export type AvailabilityResult = {
  step_id: string;
  status: 'available' | 'conflict';
  conflict_reason?: string | null;
  alternatives: string[];
};

export type AvailabilityRule = {
  id: string;
  user_id: string;
  user_name?: string;
  /** 'daily' (lunes a viernes) es legado: el script 139 lo pasó a weekly y la UI ya no lo crea. */
  recurrence: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  /** Días ISO para 'weekly' | 'biweekly' (1=lunes..7=domingo), ordenados. */
  days_of_week?: number[];
  /** Días del mes para 'monthly' (1-31), ordenados. */
  days_of_month?: number[];
  /** 'biweekly': la paridad se cuenta desde el lunes de esta semana. */
  biweekly_reference_date?: string;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date?: string;
};

export type AvailabilityException = {
  id: string;
  user_id: string;
  user_name?: string;
  /** Primera de `dates` (orden y buscador). */
  exception_date: string;
  /** Fechas `yyyy-MM-dd` a las que aplica, ordenadas. */
  dates: string[];
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type CajaSesion = {
  id: string;
  usuarioId?: string;
  user_name?: string;
  puntoDeCajaId?: string;
  cash_point_name?: string;
  estado: 'OPEN' | 'CLOSE' | 'ABIERTA' | 'CERRADA';
  fechaApertura: string;
  fechaCierre?: string | null;
  closed_at?: string;
  montoApertura: number;
  opening_details?: object | string;
  closing_details?: object | string | null;
  notasCierre?: string | null;
  currencies_data?: Array<{
    currency: CurrencyCode;
    opening_amount: number;
    declared_cash: number;
    calculated_cash: number;
    cash_variance: number;
    calculated_card: number;
    calculated_transfer: number;
    calculated_other: number;
  }>;
  currency?: string;
  date_rate?: number;
  amounts?: Array<{
    currency: CurrencyCode;
    opening_amount: number;
    cash_on_hand?: number;
  }>;
};

export type CajaMovimiento = {
  id: string;
  cajaSesionId: string;
  tipo: 'INGRESO' | 'EGRESO';
  /** Normalized payment method code; custom methods keep their own code. */
  metodoPago: string;
  metodoPagoNombre?: string;
  /** Whether the method counts as physical cash (payment_methods.is_cash_equivalent). */
  esEquivalenteEfectivo: boolean;
  monto: number;
  descripcion: string;
  fecha: string;
  usuarioId: string;
  pagoId?: string;
  currency: CurrencyCode;
  isSales?: boolean;
  documentNumber?: string;
  registeredUserName?: string;
};

export type CajaSessionMovement = {
  movement_id: number;
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
  currency: string;
  description: string;
  created_at: string;
  payment_method_name: string;
  registered_by_user: string;
};

export type CajaSessionDetails = {
  id: number;
  status: 'OPEN' | 'CLOSE';
  opened_at: string;
  closed_at?: string | null;
  opening_details?: Record<string, any>;
  closing_details?: Record<string, any>;
  bank_deposit_details?: Record<string, any>;
  cash_point_id?: number;
  user_id?: string;
  cash_point_name?: string;
  user_name?: string;
  currencies_data?: Array<{
    currency: string;
    opening_amount: number;
    declared_cash: number;
    calculated_cash: number;
    cash_variance: number;
    calculated_card: number;
    calculated_transfer: number;
    calculated_other: number;
  }>;
  movements_data?: CajaSessionMovement[];
};

export type CashPoint = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sede_id?: string;
  sede_name?: string;
};

export type MiscellaneousCategory = {
  id: string;
  name: string;
  code: string;
  description: string;
  type: 'income' | 'expense';
  is_active: boolean;
  parent_category_id?: string;
  accounting_code?: string;
  created_at: string;
  updated_at: string;
};

export type MiscellaneousTransaction = {
  id: string;
  doc_no: string;
  transaction_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  converted_amount: number;
  description: string;
  external_reference?: string;
  status: 'pending' | 'completed' | 'cancelled';
  category_id: string;
  category_code: string;
  category_name: string;
  category_type: 'income' | 'expense';
  beneficiary_id?: string;
  beneficiary_name?: string;
  beneficiary_type?: string;
  created_by: string;
  created_at: string;
  payment_method_id?: string;
  payment_method_name?: string;
  cash_session_id?: string;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_pattern?: string;
  completed_at?: string;
};

export type MutualSociety = {
  id: string | number;
  name: string;
  description?: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PatientGroup = {
  id: string | number;
  name: string;
  description?: string;
  is_active: boolean;
  is_doctor?: boolean;
  user_id?: string | null;
  external_id?: string | null;
  created_at?: string;
  updated_at?: string;
};


export type ProviderGroup = {
  id: string | number;
  name: string;
  description?: string;
  is_active: boolean;
  /** Es una categoría de laboratorio: sus proveedores son laboratorios (script 170). */
  is_lab_category?: boolean;
  external_id?: string | null;
  created_at?: string;
  updated_at?: string;
};


export type Credit = {
  source_id: string;
  available_balance: string;
  currency: CurrencyCode;
  type: 'credit_note' | 'prepaid';
};

export type AlertCategory = {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order?: number;
  is_active: boolean;
  rules_count?: number;
  internal_category_id?: string;
  internal_category_name?: string;
  notification_category_slug?: string;
};

export type AlertDisplayField = {
  label: string;
  source_column: string;
  type: 'text' | 'datetime' | 'number' | 'boolean';
};

export type AlertRule = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source_table: string;
  query_template: string;
  user_id_field?: string;
  /** condition_config.event_field: column holding the event date (one alert per event date),
   *  'none' (no event date) or empty (inferred by the scheduler from the conditions). */
  event_field?: string;
  days_before?: number;
  days_after?: number;
  recurrence_type?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  auto_send_email: boolean;
  auto_send_sms: boolean;
  email_template_id?: string;
  sms_template_id?: string;
  /** FK to a CommunicationTemplate with type='WHATSAPP' — its `code` is sent as-is as the YCloud template name */
  whatsapp_template_id?: string;
  is_active: boolean;
  display_config?: AlertDisplayField[];
  ui_display_config?: { fields: AlertDisplayField[] };
  /** Raw condition_config. `managed_by` marks a rule owned by another module (e.g. 'lab_stages'):
   *  the backend rejects edits and deletes, only activation can change. */
  condition_config?: { managed_by?: string; generator?: string; [key: string]: unknown };
};

export interface AlertSourceColumn {
  name: string;
  type: string;
  is_nullable: string;
}

/** Metadata of a selectable alert rule origin (GET /system/tables → `sources`). Views
 *  (`v_alert_*`) declare in their COMMENT the real table their alert instances point to,
 *  so `reference_table` is what ends up in alert_instances.reference_table. */
export interface AlertSourceMeta {
  kind: 'table' | 'view';
  reference_table: string;
  label?: string | null;
}

export type AlertInstance = {
  id: string;
  rule_id?: number;
  category_id?: string;
  reference_table: string;
  reference_id: string;
  patient_id?: string;
  patient_name?: string;
  alert_date: string;
  event_date?: string;
  title: string;
  summary?: string;
  status: 'PENDING' | 'ACTION_TAKEN' | 'COMPLETED' | 'IGNORED' | 'SNOOZED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigned_to?: string;
  assigned_to_name?: string;
  actions?: AlertAction[];
  details_json?: any;
  created_at?: string;
  updated_at?: string;
};

/** Business entity a WHATSAPP template's variables are resolved from — see docs/whatsapp-templates-alerts-design.md */
/** 'lab_order': avisos de etapas de laboratorio al equipo (script 150, flujo Lab Orders). */
export type WhatsAppTemplateEntityType = 'patient' | 'appointment' | 'invoice' | 'lab_order';

/** Maps each variable name as it appears in the Meta/YCloud template to a resolver field key (e.g. "patient.name", "invoice.due_date_formatted") */
export type WhatsAppVariablesSchema = Record<string, string>;

export type CommunicationTemplate = {
  id?: string;
  /** For type='WHATSAPP', this is the exact template name approved in Meta/YCloud — not a free internal code */
  code: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'DOCUMENT' | 'WHATSAPP';
  category_id?: number;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables_schema?: WhatsAppVariablesSchema | any;
  /** Only type='WHATSAPP'. Language of the template in Meta/YCloud, e.g. "es" */
  provider_language?: string;
  /** Only type='WHATSAPP'. See WhatsAppTemplateEntityType */
  entity_type?: WhatsAppTemplateEntityType;
  default_sender?: string;
  attachments_config?: any;
  is_active: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
};

export type AlertAction = {
  id: number;
  alert_instance_id: number;
  action_type: string;
  action_data?: {
    data?: any;
    clinic?: {
      name: string;
      email: string;
      phone: string;
      address: string;
    };
    patient?: {
      email: string;
      phone: string;
      full_name: string;
      document_id: string;
    };
  };
  result_status: 'SUCCESS' | 'FAILED' | 'PENDING';
  result_message?: string;
  /** null for system-generated actions (e.g. alert auto-send); a user uuid when a person took the action. */
  performed_by: string | null;
  performed_at: string;
  title?: string;
  summary?: string;
  notes?: string;
};

export type CommunicationLog = {
  id: string;
  alert_instance_id?: string;
  template_id?: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PRINT';
  recipient_address: string;
  title?: string;
  summary?: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  sent_at?: string;
  error_message?: string;
  notes?: string;
};

/** UI-only curated key for the patient-profile "send reminder" dialog — maps to a live CommunicationTemplate.code, see whatsapp-template-send-dialog.tsx */
export type WhatsAppTemplateCode = 'birthday' | 'appointment_reminder' | 'invoice_due';

export type WhatsAppTemplateSendPayload = {
  id: string; // patient id
  /** CommunicationTemplate.code (type='WHATSAPP') — the exact Meta/YCloud template name */
  template_code: string;
  /** Backwards-compat alias for reference_table='appointments' + reference_id — prefer reference_table/reference_id */
  appointment_id?: string;
  /** Business entity the template's variables resolve from, e.g. "appointments" | "invoices" */
  reference_table?: string;
  reference_id?: string;
  /** When sending from an alert: ties the send to alert_actions for audit trail. performed_by is then required. */
  alert_instance_id?: string;
  performed_by?: string;
};

export type AlertScheduleRun = {
  id: number;
  run_date: string;
  started_at: string;
  completed_at: string;
  status: string;
  rules_processed: number;
  alerts_created: number;
  alerts_skipped: number;
  emails_queued: number;
  emails_sent: number;
  sms_sent: number;
  errors_count: number;
  error_details: any | null;
  execution_log: any | null;
  triggered_by: string;
};

export type UserAlertPreference = {
  id: string;
  user_id: string;
  category_id?: string;
  rule_id?: string;
  show_in_dashboard: boolean;
  email_notification: boolean;
};

export type Sequence = {
  id: number;
  name: string;
  document_type: 'invoice' | 'quote' | 'order' | 'payment' | 'credit_note' | 'purchase_order';
  pattern: string;
  current_counter: number;
  reset_period: 'never' | 'yearly' | 'monthly' | 'daily';
  is_active: boolean;
  preview_example?: string;
  created_at?: string;
  updated_at?: string;
};

export type SequenceVariable = {
  key: string;
  description: string;
  example: string;
};

export type SequencePatternValidation = {
  is_valid: boolean;
  errors: string[];
  preview: string;
};

export type NotificationPlatform = {
  platform_id: number;
  platform_name: string;
  is_active: boolean;
};

export type NotificationCategory = {
  slug: string;
  name: string;
  description?: string;
  is_critical: boolean;
  is_active?: boolean;
};

export type GlobalNotificationSetting = {
  channel_slug: string;
  category_slug: string;
  is_enabled: boolean;
};

export type DoctorAlertStyle = 'modal' | 'toast';

/** `unified` = single account ledger (Debe/Haber/Saldo). `tabs` = separate Quotes/Invoices/Payments tabs. */
export type PatientFinanceView = 'unified' | 'tabs';

/** Display order of the patient finance lists: most recent document at the top, or at the end (opened scrolled to it). */
export type FinanceSortOrder = 'newest-first' | 'newest-last';

/**
 * Where toasts appear on screen. Small screens always show them at the top
 * (safe-area aware), so this preference only takes effect from `sm:` upwards.
 */
export type ToastPosition = 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';

export type UserPreferences = {
  alert_style?: DoctorAlertStyle;
  finance_view?: PatientFinanceView;
  toast_position?: ToastPosition;
  /** Mostrar la mascota animada del asistente (por defecto true). */
  show_mascot?: boolean;
};

export type UserPreferencesResponse = {
  user_id: string;
  preferences: UserPreferences;
};

export type Cotizacion = {
  venta: number;
  codigo: string;
  compra: number;
  moneda: string;
};

export type ExchangeRateHistoryItem = {
  id: number;
  fecha: string;
  datos_completos: {
    usd_venta: number;
    usd_compra: number;
    cotizaciones: Cotizacion[];
  };
};

export type ExchangeRateHistoryMetadata = {
  total_registros: number;
  total_paginas: number;
  pagina_actual: number;
  registros_por_pagina: number;
};

export type ExchangeRateHistoryResponse = {
  metadata: ExchangeRateHistoryMetadata;
  data: ExchangeRateHistoryItem[];
};

export type UserCommunicationPreference = {
  id?: string;
  user_id: string;
  category_slug: string;
  channel_slug: string;
  is_enabled: boolean;
};

export type UserCommunicationPreferences = {
  user_id: string;
  preferences: UserCommunicationPreference[];
};

// ── TV Display ────────────────────────────────────────────────────────────────

export interface TVDisplaySettings {
  isEnabled: boolean;
  showPatientName: boolean;
  showDoctorName: boolean;
  showAppointmentTime: boolean;
  showNextPatient: boolean;
  autoAdvance: boolean;
  videoUrls: string[];
  videoColumnPosition: 'none' | 'left' | 'right' | 'top' | 'bottom';
  promoVideoUrls: string[];
  musicEnabled: boolean;
  musicUrl: string;
  displayTitle: string;
  theme: 'dark' | 'light' | 'branded';
  refreshIntervalMinutes: number;
  promoIntervalMinutes: number;
  selectedCalendarIds: string[];
  showClock: boolean;
  showDate: boolean;
  showClinicPhone: boolean;
  showClinicAddress: boolean;
  showClinicEmail: boolean;
  groupByCalendar: boolean;
}

export interface TVRoomState {
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  currentIndex: number;
  appointments: Appointment[];
}

export type QuoteClinicSession = {
  id: string;
  paciente_id: string;
  doctor_id: string;
  fecha_sesion: string;
  procedimiento_realizado: string;
  plan_proxima_cita: string | null;
  diagnostico: string | null;
  notas_clinicas: string;
  fecha_proxima_cita: string | null;
  quote_id: number;
  paciente_nombre: string;
  doctor_nombre: string | null;
};

// ──── Odontogram (interactive, session-based) ────

/**
 * All possible conditions that can be applied to a tooth or surface.
 * Ids are persisted inside `estado_odontograma`, so existing ids must never be renamed.
 */
export type OdontogramCondition =
  // Surface conditions (apply per face)
  | 'healthy' | 'caries' | 'filling' | 'pulp' | 'dyschromic' | 'worn'
  | 'caries-incipient' | 'amalgam' | 'resin' | 'restoration-required' | 'sealant'
  // Whole-tooth conditions
  | 'crown' | 'crown-tmp' | 'missing' | 'root-remnant' | 'prosthesis'
  | 'fixed-prosth' | 'implant' | 'edentulism' | 'endodontics'
  | 'crown-indicated' | 'bridge-in-progress' | 'bridge-defective'
  | 'endo-done' | 'endo-indicated' | 'implant-osseo' | 'implant-planned' | 'extraction-indicated'
  // Overlay conditions (stack on top)
  | 'fracture' | 'diastema' | 'rem-prost' | 'drifting' | 'rotation'
  | 'fusion' | 'eruption' | 'transposition' | 'supernumerary' | 'bolt'
  | 'fixed-ortho' | 'macrodontia' | 'microdontia' | 'impacted-semi'
  | 'intrusion' | 'ectopic' | 'impacted' | 'rem-orthodo' | 'extrusion' | 'post'
  | 'post-fiber' | 'root-post' | 'perio-pocket' | 'gingival-recession' | 'gingival-enlargement'
  | 'mobility-1' | 'mobility-2' | 'mobility-3' | 'furcation' | 'retained' | 'semi-erupted'
  | 'bracket' | 'fixed-retainer' | 'ortho-movement' | 'malposition' | 'ortho-fracture'
  | 'crown-fracture' | 'root-fracture' | 'periapical-lesion' | 'root-resorption'
  | 'abrasion' | 'abfraction' | 'erosion';

export type OdontogramProcedureCategory =
  | 'restorations' | 'fixed-prosthesis' | 'endodontics' | 'implants'
  | 'periodontics' | 'oral-surgery' | 'orthodontics' | 'pathologies';

/** Whether a procedure is painted on a surface, on the whole tooth, or on either */
export type OdontogramProcedureTarget = 'surface' | 'tooth' | 'both';

/** Catalog entry for a condition/procedure. Labels live in `DentalRecord.procedures.<id>` */
export interface OdontogramProcedure {
  id: OdontogramCondition;
  category: OdontogramProcedureCategory;
  code: string;
  color: string;
  appliesTo: OdontogramProcedureTarget;
  /** Tooth-level storage slot: `whole` holds a single primary condition, the rest go to `overlays` */
  slot: 'whole' | 'overlay';
  /** Read-only: still rendered on old sessions, but not offered in the palette */
  legacy?: boolean;
}

/** 5 surfaces of a tooth */
export type OdontogramSurface = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type OdontogramToothState = {
  /** Oclusal / Incisal surface */
  center?: OdontogramCondition;
  /** Vestibular surface */
  top?: OdontogramCondition;
  /** Lingual / Palatino surface */
  bottom?: OdontogramCondition;
  /** Mesial surface */
  left?: OdontogramCondition;
  /** Distal surface */
  right?: OdontogramCondition;
  /** Condition affecting the whole tooth (corona, ausente, etc.) */
  whole?: OdontogramCondition;
  /** Stacked overlays (fractura, ortodoncia, etc.) */
  overlays?: OdontogramCondition[];
  /** Free-text clinical notes for this tooth */
  notes?: string;
  /**
   * Optional details of each mark, keyed by surface (`top`…`center`) or by `t:<condition>` for
   * tooth-level marks. Older sessions have none: their status comes from the condition id.
   */
  meta?: Record<string, OdontogramMarkMeta>;
  /** Marks inherited from an earlier session that were voided in this one (kept for the audit trail) */
  voided?: OdontogramVoidedMark[];
};

/** Hallazgo / indicado · existente · realizado hoy */
export type OdontogramMarkStatus = 'indicated' | 'existing' | 'done';

/** Where a mark came from: the chart, dictation in the odontogram, or the doctor agent */
export type OdontogramMarkSource = 'manual' | 'voice' | 'agent';

export type OdontogramMarkMeta = {
  st?: OdontogramMarkStatus;
  /** ISO datetime the mark was recorded */
  at?: string;
  /** User id that recorded it */
  by?: string;
  src?: OdontogramMarkSource;
  /** Groups the teeth of one bridge */
  range?: string;
};

export type OdontogramVoidedMark = {
  /** Surface or `t:<condition>`, same as the `meta` key */
  slot: string;
  condition: OdontogramCondition;
  reason: string;
  at: string;
  by?: string;
};

/** Keyed by FDI tooth ID string (e.g. "16", "48") */
export type OdontogramState = {
  [toothId: string]: OdontogramToothState;
};

export type OdontogramAttachment = {
  diente_asociado: number | null;
  ruta: string;
  thumbnail?: string;
  tipo: string;
};

export type OdontogramSnapshot = {
  id?: string;
  appointmentId?: string;
  date: string;          // ISO date string (YYYY-MM-DD) for storage
  description: string;   // Session title
  state: OdontogramState;
  notes?: string;
  doctorId?: string;
  doctorName?: string;
  planProximaCita?: string;
  fechaProximaCita?: string;
  archivosAdjuntos?: OdontogramAttachment[];
};

// ──── Aesthetic record (face map) ────

/** Region of the body a map view belongs to */
export type AestheticMapRegion = 'face' | 'body';

/**
 * Template shown on the map. Face views keep their original ids (`front`, `left`, `right`);
 * profiles are named after the patient's visible side.
 */
export type AestheticMapView = 'front' | 'left' | 'right' | 'bodyFront' | 'bodyBack';

export type AestheticBodyFigure = 'female' | 'male';

/** Patient's side (not the viewer's) */
export type AestheticSide = 'left' | 'right';

/** Zones drawn on the face templates */
export type AestheticFaceZone =
  | 'forehead'
  | 'glabella'
  | 'temple'
  | 'crowsFeet'
  | 'tearTrough'
  | 'cheek'
  | 'nose'
  | 'nasolabial'
  | 'upperLip'
  | 'lowerLip'
  | 'marionette'
  | 'masseter'
  | 'jawline'
  | 'chin'
  | 'neck';

/** Muscle panels of the body map (Open Muscle Map `muscleId`s) */
export type AestheticBodyMuscle =
  | 'sternocleidomastoid'
  | 'trapezius'
  | 'anterior_deltoid'
  | 'lateral_deltoid'
  | 'posterior_deltoid'
  | 'pectoralis_major'
  | 'biceps_brachii'
  | 'brachialis'
  | 'serratus_anterior'
  | 'rectus_abdominis'
  | 'external_oblique'
  | 'forearm_flexors'
  | 'tensor_fasciae_latae'
  | 'iliopsoas'
  | 'hip_adductors'
  | 'sartorius'
  | 'rectus_femoris'
  | 'vastus_lateralis'
  | 'vastus_medialis'
  | 'patella_region'
  | 'tibialis_anterior'
  | 'gastrocnemius'
  | 'fibularis_group'
  | 'soleus'
  | 'posterior_rotator_cuff'
  | 'triceps_brachii'
  | 'latissimus_dorsi'
  | 'erector_spinae'
  | 'forearm_extensors'
  | 'gluteus_medius'
  | 'gluteus_maximus'
  | 'iliotibial_tract'
  | 'biceps_femoris'
  | 'medial_hamstrings'
  | 'popliteal_region'
  | 'achilles_tendon'
  | 'patellar_tendon_region';

export type AestheticZoneBase = AestheticFaceZone | AestheticBodyMuscle;

/** Midline zones are bare (`chin`); bilateral ones carry the patient's side (`crowsFeet.left`) */
export type AestheticZoneId = AestheticZoneBase | `${AestheticZoneBase}.${AestheticSide}`;

export type AestheticDepth = 'intradermal' | 'subcutaneous' | 'supraperiosteal' | 'intramuscular';

export type AestheticTechnique = 'bolus' | 'linearRetrograde' | 'fanning' | 'microdroplets' | 'cannula';

/** `point`: one click; `area`: a polygon drawn over the template; `line`: two ends (threads), snapped to vertical/horizontal */
export type AestheticMarkKind = 'point' | 'area' | 'line';

/** Dose unit of the catalog (`measurement_units`) */
export interface MeasurementUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  /** Step of the quantity field (1 for whole units, 0.05 for ml…) */
  step: number;
  isActive: boolean;
  sortOrder: number;
  /** Used by a service or a session: it can only be deactivated */
  inUse: boolean;
}

/** How a service is marked on the aesthetic record */
export interface ServiceAestheticConfig {
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  isActive: boolean;
  unitId: string;
  unitSymbol: string;
  unitStep: number;
  markingTool: AestheticMarkKind;
  /** Quantity a new mark starts with */
  defaultQuantity: number | null;
  defaultDepth?: AestheticDepth;
  defaultTechnique?: AestheticTechnique;
  /** List price of the service, for the suggested charge at closing */
  price: number | null;
  /** Most that should be applied in one session; going over warns, it doesn't block */
  maxPerSession: number | null;
  /** Days that should pass between two applications on the same zone */
  minIntervalDays: number | null;
  /** Follow-up visit proposed at closing, `followUpDays` after the session */
  followUpDays: number | null;
  followUpLabel: string | null;
  /** Aftercare instructions sent to the patient at closing */
  aftercare: string | null;
}

/** Set once on the layer for all its marks; a mark that sets one overrides the layer's */
export interface AestheticSharedAttributes {
  lot?: string;
  /** yyyy-MM-dd */
  lotExpiry?: string;
  depth?: AestheticDepth;
  technique?: AestheticTechnique;
  notes?: string;
}

export interface AestheticMark extends AestheticSharedAttributes {
  id: string;
  /** Product used on this mark; empty: the layer's */
  productName?: string;
  kind: AestheticMarkKind;
  view: AestheticMapView;
  /** Point: its position. Area/line: where its number sits (centroid/midpoint). Relative to the template (0..1), so it survives any render size */
  x: number;
  y: number;
  /** Area outline or the line's two ends, `[x, y]` pairs relative to the template */
  polygon?: [number, number][];
  /** Zone under the mark; null when it was placed outside every zone */
  zone: AestheticZoneId | null;
  /** In an area, the total applied over it */
  quantity: number | null;
  /** When and by whom it was placed (activity log) */
  createdAt?: string;
  createdBy?: string;
}

/** One service applied in the session, with the marks where it went */
export interface AestheticLayer extends AestheticSharedAttributes {
  id: string;
  serviceId?: string;
  serviceName: string;
  /** Color of the service in the catalog */
  color?: string | null;
  /** Brand or product, free text */
  productName: string;
  /** Copied from the service when the layer is created, so later config changes don't rewrite old sessions */
  unitId?: string;
  unitSymbol: string;
  unitStep: number;
  markingTool: AestheticMarkKind;
  marks: AestheticMark[];
}

export type AestheticPhotoKind = 'before' | 'after';

/** How a photo got into the session */
export type AestheticPhotoSource = 'camera' | 'upload' | 'qr';

/** Placement of a photo under the map template of its view */
export interface AestheticPhotoAlignment {
  /** Photo centre, as a fraction (0–1) of the template width and height */
  x: number;
  y: number;
  /** Size relative to the photo fitted inside the template (1 = fully contained) */
  scale: number;
  /** Degrees, clockwise */
  rotation: number;
  /** Flipped horizontally (front cameras mirror the picture) */
  mirrored: boolean;
}

export interface AestheticPhoto {
  id: string;
  kind: AestheticPhotoKind;
  view: AestheticMapView;
  fileName: string;
  mimeType: string;
  createdAt: string;
  source?: AestheticPhotoSource;
  takenAt?: string;
  /** Set once the photo was aligned to be shown behind the map */
  alignment?: AestheticPhotoAlignment;
}

/** Consent text of a service; its `{{variables}}` are filled in when the patient signs */
export interface ServiceConsentTemplate {
  serviceId: string;
  title: string;
  body: string;
  updatedAt: string;
}

/** Drawn on the pad, or a previous signature of the same patient used again */
export type AestheticSignatureSource = 'drawn' | 'reused';

/** Signed consent of one service of the session */
export interface AestheticServiceConsent {
  serviceId: string;
  serviceName: string;
  title: string;
  /** Rendered consent text, frozen at signing time */
  text: string;
  /** Version of the service's template it was rendered from; absent for the generic text */
  templateUpdatedAt?: string;
  /** One signature can cover several services of the session */
  signatureId: string;
  signatureFileId: string;
  signatureSource: AestheticSignatureSource;
  /** For a reused signature, the drawn one it comes from */
  reusedFromSignatureId?: string;
  signerName: string;
  signedAt: string;
  allowsClinicalPhotos: boolean;
  allowsMarketingPhotos: boolean;
  /** SHA-256 of the title and text as signed */
  contentSha256?: string;
}

/** Photo permissions of the session: those given with its last signature */
export interface AestheticPhotoConsent {
  allowsClinicalPhotos: boolean;
  allowsMarketingPhotos: boolean;
  signerName: string;
  signedAt: string;
}

/**
 * Computed on the server from what the session holds, never picked:
 * draft → consented → in_treatment → ready_to_close → closed (or void before closing)
 */
// ──── Periodontograma (database/scripts/163) ────

/** v: vestibular · i: palatino/lingual */
export type PerioSide = 'v' | 'i';
export type PerioToothStatus = 'present' | 'missing' | 'pontic' | 'implant';
export type PerioExamType = 'initial' | 'reevaluation' | 'maintenance' | 'screening' | 'implants';
/** PSR/BPE code of a sextant; X: excluded (fewer than two teeth) */
export type PerioPsrCode = '0' | '1' | '2' | '3' | '4' | 'X';
export type PerioSextant = '1' | '2' | '3' | '4' | '5' | '6';

export interface PerioScreening {
  codes: Partial<Record<PerioSextant, PerioPsrCode>>;
  /** Sextants with * (furcation, mobility, mucogingival problem or recession ≥ 3.5 mm) */
  star?: PerioSextant[];
}
export type PerioImplantStatus = 'health' | 'mucositis' | 'periimplantitis';
/** Calculated by the database: probing → probed → closed (void: cancelled) */
export type PerioExamStatus = 'probing' | 'probed' | 'diagnosed' | 'closed' | 'void';
/** manual · same: "igual que antes" (guide exam value) · dictation */
export type PerioSiteSource = 'manual' | 'same' | 'dictation';
/** Furcation entries: v vestibular, mp mesiopalatine, dp distopalatine (upper), l lingual (lower) */
export type PerioFurcationEntry = 'v' | 'mp' | 'dp' | 'l';

export interface PerioSite {
  /** Probing depth (mm) */
  pd: number | null;
  /** Gingival margin (mm): recession positive, enlargement negative */
  gm: number | null;
  bop: boolean;
  sup: boolean;
  plaque: boolean;
  source: PerioSiteSource;
}

export interface PerioTooth {
  tooth: number;
  status: PerioToothStatus;
  mobility: number | null;
  furcation: Partial<Record<PerioFurcationEntry, number>>;
  note: string;
  /** Three sites per side, in anatomical order: distal, center, mesial */
  sites: Record<PerioSide, PerioSite[]>;
}

/** Indices of the natural teeth, calculated by perio_exam_recompute() */
export interface PerioStats {
  sites: number;
  bopPct: number;
  plaquePct: number;
  meanPd: number | null;
  meanCal: number | null;
  n4: number;
  n5: number;
  n6: number;
  b4: number;
  b5: number;
  teeth5: number;
  maxInterproximalCal: number | null;
}

export interface PerioExam {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  date: string;
  examType: PerioExamType;
  guideExamId?: string;
  title: string;
  notes: string;
  status: PerioExamStatus;
  completeness: number;
  stats: PerioStats | null;
  closedAt?: string;
  closedByName?: string;
  createdAt: string;
  updatedAt?: string;
  teeth: PerioTooth[];
  /** Confirmed (or in progress) diagnosis and plan; null until the Diagnosis step is opened */
  diagnosis: PerioDiagnosis | null;
  /** Patient's date of birth (YYYY-MM-DD), for the grade (bone loss / age) */
  patientBirthday?: string;
  /** Patient's phone and email, for the report */
  patientPhone?: string;
  patientEmail?: string;
  /** Sales invoice of the exam (same shape as the aesthetic session's) */
  invoice: AestheticSessionInvoice | null;
  closing: PerioClosing | null;
  /** Amendments added after closing, oldest first */
  amendments: PerioAmendment[];
  /** PSR/BPE screening (screening exams) */
  screening: PerioScreening | null;
}

/** What the closing step resolves before signing */
export interface PerioClosing {
  /** Nothing is charged today (resolves the billing without an invoice) */
  noCharge?: boolean;
  nextVisit?: {
    /** booked: appointment made · later: "agendar después" */
    mode: 'booked' | 'later';
    /** Suggested or booked date (YYYY-MM-DD) */
    date?: string;
    /** Booked time (HH:mm) */
    time?: string;
    /** What it is for: maintenance or reinstrumentation */
    kind?: 'maintenance' | 'reinstrumentation' | 'other';
    appointmentId?: string;
  };
  reportSentAt?: string;
}

export interface PerioAmendment {
  id: string;
  body: string;
  createdAt: string;
  createdByName?: string;
}

export type PerioStability = 'stable' | 'gingivitis' | 'unstable';
export type PerioStage = 'I' | 'II' | 'III' | 'IV';
export type PerioGrade = 'A' | 'B' | 'C';
export type PerioExtent = 'localized' | 'generalized' | 'molarIncisor';
export type PerioRisk = 'low' | 'moderate' | 'high';
export type PerioDiabetes = 'no' | 'controlled' | 'uncontrolled';
export type PerioPlanKind = 'hygiene' | 'scaling' | 'fullChart' | 'reinstrumentation' | 'surgery' | 'implantRx' | 'periImplant' | 'maintenance';

/** One step of the EFP plan, built from today's probing */
export interface PerioPlanItem {
  id: string;
  kind: PerioPlanKind;
  tooth?: number;
  /** Sites that justify it, e.g. "V distal 6 mm con sangrado" (already written for the record) */
  detail?: string;
  include: boolean;
  /** Done today (to the bill) or later (pending plan) */
  today: boolean;
}

/**
 * Diagnosis of the exam (AAP/EFP 2017 and Lang & Tonetti risk). Inputs that do not come from the
 * probing are typed by the professional; the classification starts as the suggestion and is what
 * the professional confirms.
 */
export interface PerioDiagnosis {
  teethLost: number | null;
  boneLossPct: number | null;
  age: number | null;
  cigarettes: number;
  diabetes: PerioDiabetes;
  isCase: boolean;
  stability: PerioStability;
  stage: PerioStage | null;
  extent: PerioExtent | null;
  grade: PerioGrade | null;
  risk: PerioRisk;
  maintenanceMonths: number;
  plan: PerioPlanItem[];
  /** Screening: highest PSR/BPE code (the classification does not apply) */
  psrMax?: number | null;
  /** Implants-only exam: status of each implant */
  implants?: { tooth: number; status: PerioImplantStatus }[];
  /** Values the professional changed by hand; the rest follow the suggestion until confirmed */
  manual?: Partial<Record<'isCase' | 'stability' | 'stage' | 'extent' | 'grade' | 'risk' | 'maintenanceMonths' | 'implants', boolean>>;
  confirmedAt: string | null;
}

export type AestheticSessionStatus = 'draft' | 'consented' | 'in_treatment' | 'ready_to_close' | 'closed' | 'void';

/** Timestamped note of the session; once closed only amendments are added, nothing is erased */
export interface AestheticSessionNote {
  id: string;
  body: string;
  kind: 'note' | 'amendment';
  createdAt: string;
  createdByName?: string;
}

export type AestheticSessionEventType =
  | 'created'
  | 'consent_signed'
  | 'photo_added'
  | 'photo_removed'
  | 'note_added'
  | 'amendment_added'
  | 'closed'
  | 'voided';

/** Activity log entry */
export interface AestheticSessionEvent {
  id: string;
  type: AestheticSessionEventType;
  payload: Record<string, unknown>;
  at: string;
  actorName?: string;
}

export interface AestheticSessionInvoice {
  id: string;
  docNo: string;
  total: number;
  paidAmount: number;
  currency: string;
  status: string;
  /** unpaid | partially_paid | paid */
  paymentState: string;
  createdAt: string;
  /** Services it bills, to warn about the ones added afterwards */
  serviceIds: string[];
}

export interface AestheticSession {
  id: string;
  patientId: string;
  /** yyyy-MM-dd */
  date: string;
  title: string;
  doctorId?: string;
  doctorName?: string;
  appointmentId?: string;
  notes: string;
  layers: AestheticLayer[];
  photos: AestheticPhoto[];
  /** One per service of the session that was signed */
  consents: AestheticServiceConsent[];
  photoConsent: AestheticPhotoConsent | null;
  /** Body figure the body points were placed on (their coordinates depend on it) */
  bodyFigure?: AestheticBodyFigure;
  status: AestheticSessionStatus;
  /** 0–100, a quarter per completed step */
  completeness: number;
  /** 1: recorded before the guided flow (no consent-first rule) */
  flowVersion: number;
  closedAt?: string;
  closedByName?: string;
  voidedAt?: string;
  voidReason?: string;
  /** Its sales invoice, with the amounts as they are now. At most one per session */
  invoice?: AestheticSessionInvoice | null;
  sessionNotes: AestheticSessionNote[];
  events: AestheticSessionEvent[];
  createdAt: string;
  updatedAt: string;
}

export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple' | 'orange';

export type StickyNote = {
  id: string;
  text: string;
  color: StickyNoteColor;
  created_by: string;
  created_at: string;
  updated_at?: string;
  status: 'active' | 'deleted';
  actions?: string[];
  redirects?: string[];
};

// ===== Reports =====

export interface ReportFiltersBase {
  date_from: string;
  date_to: string;
  currency?: CurrencyCode;
}

// R-01: Cierre de Caja
export interface ReportCierreCajaSummary {
  total_ingresos: number;
  total_egresos: number;
  resultado: number;
  num_sesiones: number;
}
export interface ReportCierreCajaByMethod {
  payment_method: string;
  currency: string;
  total_ingresos: number;
  total_egresos: number;
}
export interface ReportCierreCajaRow {
  session_id: number;
  cashier_name: string;
  cash_point_name: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  payment_method: string;
  currency: string;
  total_ingresos: number;
  total_egresos: number;
  num_movimientos: number;
}
export interface ReportCierreCajaResponse {
  summary: ReportCierreCajaSummary;
  by_method: ReportCierreCajaByMethod[];
  rows: ReportCierreCajaRow[];
}

// R-02: Cobros del Día
export interface ReportCobrosSummary {
  total_cobrado: number;
  num_cobros: number;
  promedio: number;
  mayor_cobro: number;
}
export interface ReportCobrosByMethod {
  payment_method: string;
  total: number;
  count: number;
}
export interface ReportCobrosRow {
  id: number;
  doc_no: string;
  created_at: string;
  patient_name: string;
  phone_number: string;
  payment_method: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  transaction_type: string;
  status: string;
  notes: string | null;
}
export interface ReportCobrosResponse {
  summary: ReportCobrosSummary;
  by_method: ReportCobrosByMethod[];
  rows: ReportCobrosRow[];
}

// R-03: Cuentas Corrientes (Balance sheet)
export interface ReportCuentasCorrientesSummary {
  total_facturado: number;
  total_cobrado: number;
  saldo_neto: number;
  num_pacientes: number;
  num_con_deuda: number;
}
export interface ReportCuentasCorrientesRow {
  id: string;
  patient_name: string;
  phone_number: string;
  email: string;
  total_invoiced: number;
  total_paid: number;
  saldo: number;
}
export interface ReportCuentasCorrientesResponse {
  summary: ReportCuentasCorrientesSummary;
  rows: ReportCuentasCorrientesRow[];
}

// R-16: Deudores (Aging)
export interface ReportAgingSummary {
  total_deuda: number;
  num_deudores: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}
export interface ReportAgingRow {
  id: string;
  patient_name: string;
  phone_number: string;
  email: string;
  total_debt: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}
export interface ReportAgingResponse {
  summary: ReportAgingSummary;
  rows: ReportAgingRow[];
}

// R-04: Presupuestos Pendientes
export interface ReportPresupuestosSummary {
  num_presupuestos: number;
  total_potencial: number;
  dias_promedio: number;
  tasa_conversion: number;
}
export interface ReportPresupuestosRow {
  id: number;
  doc_no: string;
  created_at: string;
  patient_name: string;
  phone_number: string;
  total: number;
  currency: string;
  status: string;
  billing_status: string;
  days_pending: number;
}
export interface ReportPresupuestosResponse {
  summary: ReportPresupuestosSummary;
  rows: ReportPresupuestosRow[];
}

// R-05: Producción por Doctor
export interface ReportProduccionSummary {
  total_facturado: number;
  total_cobrado: number;
  num_doctores: number;
  ticket_promedio: number;
}
export interface ReportProduccionRow {
  doctor_id: string;
  doctor_name: string;
  currency: string;
  num_pacientes: number;
  num_facturas: number;
  total_facturado: number;
  total_cobrado: number;
  ticket_promedio: number;
}
export interface ReportProduccionResponse {
  summary: ReportProduccionSummary;
  rows: ReportProduccionRow[];
}

// R-06: Tratamientos Realizados
export interface ReportTratamientosSummary {
  total_tratamientos: number;
  total_facturado: number;
  precio_promedio: number;
  num_categorias: number;
}
export interface ReportTratamientosRow {
  service_name: string;
  category: string;
  cantidad: number;
  total_facturado: number;
  precio_promedio: number;
  pct_total?: number;
}
export interface ReportTratamientosResponse {
  summary: ReportTratamientosSummary;
  rows: ReportTratamientosRow[];
}

// R-07: Comparativo de Producción
export interface ReportComparativoRow {
  mes: string;
  mes_num: number;
  doctor_name: string;
  currency: string;
  total_facturado: number;
  total_cobrado: number;
  num_pacientes: number;
}
export interface ReportComparativoResponse {
  rows: ReportComparativoRow[];
}

// R-08: Honorarios
export interface ReportHonorariosSummary {
  total_base: number;
  total_honorarios: number;
  num_doctores: number;
  porcentaje_promedio: number;
}
export interface ReportHonorariosRow {
  doctor_id: string;
  doctor_name: string;
  currency: string;
  base_calculo: number;
  porcentaje: number;
  honorario_calculado: number;
}
export interface ReportHonorariosResponse {
  summary: ReportHonorariosSummary;
  rows: ReportHonorariosRow[];
}

// R-09: Nuevos Pacientes
export interface ReportNuevosPxSummary {
  num_nuevos: number;
  con_cita: number;
  sin_cita: number;
  tasa_conversion: number;
}
export interface ReportNuevosPxRow {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  registration_date: string;
  first_appointment: string | null;
  total_appointments: number;
}
export interface ReportNuevosPxResponse {
  summary: ReportNuevosPxSummary;
  rows: ReportNuevosPxRow[];
}

// R-10: Pacientes Inactivos
export interface ReportPacientesInactivosSummary {
  total_inactivos: number;
  alta_medica: number;
  inactividad: number;
  con_deuda: number;
}
export interface ReportPacientesInactivosRow {
  id: string;
  patient_name: string;
  phone_number: string;
  email: string;
  alta_medica_date: string | null;
  last_activity_date: string | null;
  days_inactive: number | null;
  inactivity_reason: 'alta_medica' | 'inactividad';
  debt_uyu: number;
  debt_usd: number;
}
export interface ReportPacientesInactivosResponse {
  summary: ReportPacientesInactivosSummary;
  rows: ReportPacientesInactivosRow[];
}

// R-11: Tratamientos en Curso
export interface ReportTratamientosCursoSummary {
  total: number;
  en_curso: number;
  completados: number;
  tasa_completado: number;
  steps_done: number;
  steps_pending: number;
  steps_waiting: number;
  steps_alert: number;
}
export interface TratamientoStep {
  step_position: number;
  step_name: string;
  milestone_status: string;
}
export interface ReportTratamientosCursoRow {
  id: string;
  patient_name: string;
  phone_number: string;
  service_name: string;
  category: string;
  doctor_name: string;
  started_at: string | null;
  status: string;
  total_steps: number;
  done_steps: number;
  pending_steps: number;
  waiting_steps: number;
  alert_steps: number;
  days_active: number | null;
  days_since_last_step: number | null;
  steps_detail: TratamientoStep[];
}
export interface ReportTratamientosCursoResponse {
  summary: ReportTratamientosCursoSummary;
  rows: ReportTratamientosCursoRow[];
}

// R-12: Análisis de Citas (Ocupación de Agenda)
export interface ReportOcupacionSummary {
  total_citas: number;
  completadas: number;
  confirmadas: number;
  canceladas: number;
  no_shows: number;
  con_presupuesto: number;
  con_sesion: number;
  sin_atender: number;
  tasa_completadas: number;
  tasa_canceladas: number;
  tasa_con_presupuesto: number;
  duracion_promedio_min: number;
}
export interface ReportOcupacionByStatus {
  status: string;
  count: number;
  pct: number;
}
export interface ReportOcupacionByDoctor {
  doctor_name: string;
  total: number;
  completed: number;
  arrived: number;
  in_progress: number;
  confirmed: number;
  scheduled: number;
  no_show: number;
  cancelled: number;
  tasa_completadas: number;
}
export interface ReportOcupacionByPeriod {
  periodo: string;
  total: number;
  completed: number;
  arrived: number;
  in_progress: number;
  confirmed: number;
  scheduled: number;
  no_show: number;
  cancelled: number;
}
export interface ReportOcupacionByCalendar {
  calendar_name: string;
  total: number;
  completed: number;
  arrived: number;
  in_progress: number;
  confirmed: number;
  scheduled: number;
  no_show: number;
  cancelled: number;
  tasa: number;
}
export interface ReportOcupacionRow {
  id: number;
  start_datetime: string;
  end_datetime: string;
  duration_min: number;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  calendar_name: string;
  service_name: string | null;
  status: string;
  cancellation_reason: string | null;
  has_quote: boolean;
  has_session: boolean;
  periodo: string;
}
export interface ReportOcupacionResponse {
  summary: ReportOcupacionSummary;
  by_status: ReportOcupacionByStatus[];
  by_doctor: ReportOcupacionByDoctor[];
  by_period: ReportOcupacionByPeriod[];
  by_calendar: ReportOcupacionByCalendar[];
  rows: ReportOcupacionRow[];
}

// R-13: Cancelaciones
export interface ReportCancelacionesSummary {
  total: number;
  top_reason: string;
  top_reason_label: string;
  top_doctor: string;
  top_patient: string;
  top_service: string;
}
export interface ReportCancelacionesByReason {
  reason: string;
  label: string;
  count: number;
  pct: number;
}
export interface ReportCancelacionesByDoctor {
  doctor_name: string;
  count: number;
  pct: number;
}
export interface ReportCancelacionesByPatient {
  patient_name: string;
  phone_number: string;
  count: number;
}
export interface ReportCancelacionesByService {
  service_name: string;
  count: number;
  pct: number;
}
export interface ReportCancelacionesByCalendar {
  calendar_name: string;
  count: number;
  pct: number;
}
export interface ReportCancelacionesByPeriod {
  periodo: string;
  count: number;
}
export interface ReportCancelacionesRow {
  id: number;
  start_datetime: string;
  patient_name: string;
  phone_number: string;
  doctor_name: string;
  calendar_name: string;
  service_name: string | null;
  cancellation_reason: string | null;
}
export interface ReportCancelacionesResponse {
  summary: ReportCancelacionesSummary;
  by_reason: ReportCancelacionesByReason[];
  by_doctor: ReportCancelacionesByDoctor[];
  by_patient: ReportCancelacionesByPatient[];
  by_service: ReportCancelacionesByService[];
  by_calendar: ReportCancelacionesByCalendar[];
  by_period: ReportCancelacionesByPeriod[];
  rows: ReportCancelacionesRow[];
}

// R-14: Ingresos por Período
export interface ReportIngresosSummary {
  total_cobrado: number;
  num_cobros: number;
  num_transacciones: number;
  promedio_periodo: number;
  mejor_periodo: string;
}
export interface ReportIngresosRow {
  periodo: string;
  currency: string;
  total_cobrado: number;
  num_cobros: number;
  promedio: number;
}
export interface ReportIngresosResponse {
  summary: ReportIngresosSummary;
  rows: ReportIngresosRow[];
}

// R-15: Facturación vs Cobranza
export interface ReportFactCobranzaSummary {
  total_facturado: number;
  total_cobrado: number;
  pendiente: number;
  pct_cobrado: number;
}
export interface ReportFactCobranzaRow {
  mes: string;
  currency: string;
  total_facturado: number;
  total_cobrado: number;
  pendiente: number;
  pct_cobrado: number;
}
export interface ReportFactCobranzaResponse {
  summary: ReportFactCobranzaSummary;
  rows: ReportFactCobranzaRow[];
}

// R-17: Ingresos por Tratamiento
export interface ReportServiciosSummary {
  total_servicios: number;
  total_facturado: number;
  total_sesiones: number;
  precio_promedio: number;
  servicio_top: string;
}
export interface ReportServiciosRow {
  id: string;
  service_name: string;
  category: string;
  is_flow: boolean;
  num_facturas: number;
  total_facturado: number;
  precio_promedio: number;
  num_presupuestos: number;
  num_sesiones: number;
  num_tratamientos: number;
  pct_total: number;
}
export interface ReportServiciosResponse {
  summary: ReportServiciosSummary;
  rows: ReportServiciosRow[];
}

// R-18: Gastos Operativos
export interface ReportGastosSummary {
  total_misc: number;
  total_facturado: number;
  total_pagado: number;
  total_deuda: number;
  num_misc: number;
  num_invoices: number;
  top_category: string;
  top_supplier: string;
  top_debtor: string;
}
export interface ReportGastosByCategory {
  category: string;
  amount: number;
  pct: number;
}
export interface ReportGastosBySupplier {
  supplier_id: string;
  supplier_name: string;
  rut: string | null;
  total: number;
  paid: number;
  pending: number;
  invoices: number;
}
export interface ReportGastosByPeriod {
  periodo: string;
  misc: number;
  facturas: number;
  total: number;
}
export interface ReportGastosByService {
  service: string;
  amount: number;
}
export interface ReportGastosByPaymentState {
  state: string;
  count: number;
  total: number;
}
export interface ReportGastosMiscRow {
  id: number;
  doc_no: string;
  date: string;
  category_name: string;
  category_id: number;
  entity_name: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  notes: string | null;
}
export interface ReportGastosInvoiceRow {
  id: number;
  doc_no: string;
  date: string;
  supplier_id: string;
  supplier_name: string;
  supplier_rut: string | null;
  total: number;
  paid_amount: number;
  pending_amount: number;
  currency: string;
  payment_state: string;
  invoice_status: string;
  due_date: string | null;
  notes: string | null;
  top_service: string | null;
}
export interface ReportGastosResponse {
  summary: ReportGastosSummary;
  by_category: ReportGastosByCategory[];
  by_supplier: ReportGastosBySupplier[];
  by_supplier_debt: ReportGastosBySupplier[];
  by_period: ReportGastosByPeriod[];
  by_service: ReportGastosByService[];
  by_payment_state: ReportGastosByPaymentState[];
  misc_rows: ReportGastosMiscRow[];
  invoice_rows: ReportGastosInvoiceRow[];
}

// R-19: Estado de Resultados
export interface ReportEstadoResultadoLinea {
  concepto: string;
  total: number;
  pct_total: number;
}
export interface ReportEstadoResultadoResponse {
  ingresos: { total: number; lineas: ReportEstadoResultadoLinea[] };
  gastos: { total: number; lineas: ReportEstadoResultadoLinea[] };
  resultado: { neto: number; margen: number };
}

// R-20: KPIs Clínica
export interface ReportKPIsResponse {
  total_cobrado: number;
  nuevos_pacientes: number;
  tasa_retencion: number;
  tasa_ocupacion: number;
  ticket_promedio: number;
  total_gastos: number;
}

// R-21: Balance Mensual (Producido / Cobrado / Pendiente por médico)
export interface ReportBalanceMensualPatientGroup {
  id: string;
  name: string;
}
export interface ReportBalanceMensualProducidoRow {
  fecha: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string;
  service_name: string;
  invoice_doc_no: string;
  currency: string;
  importe: number;
  // Only populated when the request filtered by patient group — the group(s)
  // (among those requested) that this row's patient belongs to
  patient_groups?: ReportBalanceMensualPatientGroup[];
}
export interface ReportBalanceMensualCobradoRow {
  fecha: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string;
  invoice_doc_no: string;
  payment_method: string;
  currency: string;
  importe: number;
  patient_groups?: ReportBalanceMensualPatientGroup[];
}
export interface ReportBalanceMensualPendienteRow {
  doctor_id: string;
  doctor_name: string;
  currency: string;
  total_facturado: number;
  total_cobrado: number;
  saldo: number;
}
// Same shape as ReportBalanceMensualPendienteRow, broken down further by
// patient group — only present when the request filtered by patient group
export interface ReportBalanceMensualPendienteGrupoRow extends ReportBalanceMensualPendienteRow {
  group_id: string;
  group_name: string;
}
// Totales por moneda — nunca se suman importes de monedas distintas
export interface ReportBalanceMensualSummaryCurrencyRow {
  currency: string;
  total_producido: number;
  total_cobrado: number;
  total_pendiente: number;
}
export interface ReportBalanceMensualSummary {
  by_currency: ReportBalanceMensualSummaryCurrencyRow[];
  num_doctores: number;
}
// ── Resumen (pestaña Resumen + 1ra hoja de exportación) ──────────────────────
// Totales precalculados por el workflow. Los grupos salen del servicio
// facturado (group_services), no del paciente; "atribución completa": una
// línea/pago cuya factura toca varios grupos suma a cada uno, y lo que no
// pertenece a ningún grupo cae en "Sin grupo" (group_id: null).
export interface ReportBalanceMensualResumenDoctorRow {
  doctor_id: string | null;
  doctor_name: string;
  currency: string;
  total: number;
}
export interface ReportBalanceMensualResumenCurrencyRow {
  currency: string;
  total: number;
}
export interface ReportBalanceMensualResumenGrupoRow {
  group_id: string | null;
  group_name: string;
  currency: string;
  total: number;
}
export interface ReportBalanceMensualResumen {
  producido_por_doctor: ReportBalanceMensualResumenDoctorRow[];
  cobrado_total: ReportBalanceMensualResumenCurrencyRow[];
  cobrado_por_grupo: ReportBalanceMensualResumenGrupoRow[];
  producido_por_grupo: ReportBalanceMensualResumenGrupoRow[];
}
export interface ReportBalanceMensualResponse {
  summary: ReportBalanceMensualSummary;
  producido: ReportBalanceMensualProducidoRow[];
  cobrado: ReportBalanceMensualCobradoRow[];
  pendiente: ReportBalanceMensualPendienteRow[];
  pendiente_por_grupo?: ReportBalanceMensualPendienteGrupoRow[];
  // Optional: puede faltar si el workflow aún no fue desplegado — el frontend
  // reconstruye el resumen client-side en ese caso
  resumen?: ReportBalanceMensualResumen;
}

// ── Licensing ────────────────────────────────────────────────────────────────

export type AiAccessLevel = 'full' | 'doctors_only' | 'none';
export type SubscriptionType = 'monthly' | 'annual' | 'custom';

export interface LicensePayload {
  licenseId: string;
  version: number;
  subscriptionType: SubscriptionType;
  startDate: string;
  endDate: string;
  maxDoctors: number;
  maxReceptionists: number;
  maxAdmins: number;
  maxSuperAdmins: number;
  maxMonthlyNewPatients: number;
  aiAccess: AiAccessLevel;
  issuedAt: string;
  notes?: string;
}

export type MedicalInstructionTemplate = {
  id?: string;
  name: string;
  description?: string;
  content_html: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PatientMedicalInstruction = {
  id?: string;
  patient_id: string;
  fecha: string;
  numero_diente?: number | null;
  doctor_id: string | null;
  doctor_name?: string;
  template_id?: string;
  template_name?: string;
  content_html: string;
  created_at?: string;
  updated_at?: string;
};

export type PrescriptionTemplate = {
  id?: string;
  name: string;
  description?: string;
  content_html: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type PrescriptionItem = {
  id?: string;
  orden?: number;
  /** FK a catalogo_medicamentos. Null si el fármaco se escribió libre. */
  medicamento_id?: string | null;
  /** Nombre denormalizado — la receta sobrevive al borrado del catálogo. */
  medicamento_texto: string;
  presentacion?: string;
  dosis?: string;
  via_administracion?: string;
  frecuencia?: string;
  duracion_dias?: number | null;
  cantidad?: string;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  indicaciones?: string;
  /** True ⇒ la línea se refleja en los medicamentos de la anamnesis, con su período. */
  registrar_en_anamnesis: boolean;
};

export type PatientPrescription = {
  id?: string;
  patient_id: string;
  fecha: string;
  doctor_id: string | null;
  doctor_name?: string;
  template_id?: string;
  template_name?: string;
  diagnostico?: string;
  notas?: string;
  items: PrescriptionItem[];
  /** HTML final ya interpolado — fuente de verdad al reimprimir. */
  content_html: string;
  created_at?: string;
  updated_at?: string;
};

export type CreateLicenseInput = Omit<LicensePayload, 'licenseId' | 'version' | 'issuedAt'>;

export interface Subscription {
  id: string;
  licenseId: string;
  subscriptionType: SubscriptionType;
  startDate: string;
  endDate: string;
  maxDoctors: number;
  maxReceptionists: number;
  maxAdmins: number;
  maxSuperAdmins: number;
  maxMonthlyNewPatients: number;
  aiAccess: AiAccessLevel;
  issuedAt: string;
  notes?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Portal del paciente (/my-profile) — ver docs/patient-portal.md
// ---------------------------------------------------------------------------

/**
 * Datos públicos de la clínica que alimentan la landing /patient-login.
 * Los sirve un endpoint sin autenticación — nunca debe incluir datos sensibles.
 */
export type PublicClinicInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  /**
   * Logo de la clínica: data URI si el endpoint lo devuelve así, o la URL del
   * webhook binario `/clinic/logo` (el mismo que usan los reportes). La landing
   * sólo cae al isotipo de Invoke IA si la imagen **falla al cargar**.
   */
  logo_url: string | null;
  /** Video de bienvenida. `null` ⇒ el genérico de Invoke IA. */
  welcome_video_url: string | null;
  /** Texto del hero. `null` ⇒ copy por defecto traducido. */
  welcome_message: string | null;
  /** `false` ⇒ la clínica no habilitó el portal; la landing muestra el aviso. */
  patient_portal_enabled: boolean;
  /** `false` ⇒ el paciente puede consultar pero no reservar. */
  online_booking_enabled: boolean;
  /**
   * `true` ⇒ el portal es exclusivamente para reservar: se pide el identificador
   * y se pasa a la agenda, sin OTP ni acceso al perfil.
   */
  appointments_only: boolean;
  /**
   * `true` ⇒ el paciente elige servicios en un paso previo a la fecha y hora.
   * `false` ⇒ toda reserva se crea con `default_service`.
   */
  service_selection_enabled: boolean;
  /**
   * `true` ⇒ el portal muestra precios y duraciones. Es sólo presentación: la
   * duración de los servicios dimensiona el hueco de la agenda en cualquier caso.
   */
  show_pricing: boolean;
  /**
   * Servicio con el que se crea la reserva cuando el paciente no elige ninguno.
   * `null` ⇒ la cita se crea sin servicio y con la duración genérica.
   */
  default_service: BookableService | null;
  /** Unidad de la ventana de reserva. Ver `getBookingLimitDate`. */
  booking_window_unit: PatientBookingWindowUnit;
  /** Tamaño de la ventana de reserva, en `booking_window_unit`. */
  booking_window_value: number;
  /** Horarios de atención de la clínica, si no están cargados por sede. */
  schedules?: PublicClinicSchedule[];
};

/**
 * Servicio tal como lo ve un paciente al reservar. Es una proyección mínima del
 * catálogo: sólo lo que hace falta para elegir y para dimensionar la cita.
 *
 * `price` y `currency` son opcionales porque el backend los omite cuando la
 * clínica eligió no mostrar precios — si no se muestran, tampoco se exponen en
 * un endpoint sin token.
 */
export type BookableService = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price?: number | null;
  currency?: CurrencyCode | null;
  /**
   * El servicio tiene imagen cargada. Lo resuelve el backend contra
   * `image_drive_file_id`, que es la fuente de verdad. Ausente ⇒ no se sabe, y
   * entonces se pide la imagen igual: mejor un 204 de más que esconder una
   * imagen que sí existe.
   */
  has_image?: boolean;
  /** Cache-buster de la imagen: cambia cada vez que se reemplaza. */
  image_updated_at?: string | null;
};

/**
 * Sede tal como la ve un visitante del portal, desde `/sedes_noauth`.
 * Los horarios se piden aparte, a `/schedules_noauth?sede_id=`.
 */
export type PublicSede = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  schedules: PublicClinicSchedule[];
};

export type PublicClinicSchedule = {
  /** 0 = domingo … 6 = sábado */
  day_of_week: number;
  start_time: string;
  end_time: string;
};

/** Respuesta de POST /api/auth/patient/identify. Nunca trae datos del paciente. */
export type PatientIdentifyResponse = {
  found: boolean;
  /**
   * Sólo cuando `found`. Decide si se le pide OTP para entrar al portal o si se
   * lo manda directo a reservar (ver docs/patient-portal.md §3).
   */
  has_upcoming_appointments?: boolean;
  /** users.id — necesario para reservar sin sesión. Sólo cuando `found`. */
  user_id?: string | null;
  /** Nombre del paciente, para saludarlo antes de pedirle el código. */
  name?: string | null;
  /** El paciente existe pero no tiene email cargado: hay que pedírselo antes de enviar el código. */
  needs_email: boolean;
  /** Email enmascarado (j***z@gmail.com) para que el usuario confirme el destino. */
  masked_email: string | null;
};

/** Respuesta de POST /api/auth/patient/send-code. */
export type PatientSendCodeResponse = {
  sent: boolean;
  masked_email: string | null;
  /** Vigencia del código en segundos (600 = 10 min). */
  expires_in?: number;
  /**
   * `true` cuando el backend rechazó el reenvío por rate-limit: ya hay un
   * código vigente en la casilla del paciente. No es un error — hay que dejarlo
   * escribir el que recibió.
   */
  already_sent?: boolean;
  /** Segundos que faltan para poder pedir otro código. */
  retry_after?: number;
};

/** Respuesta de POST /api/auth/patient/verify-code. El token es el mismo JWT que emite /api/auth/login. */
export type PatientVerifyCodeResponse = {
  token: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
  /** true cuando el paciente se acaba de registrar: el portal le abre la reserva de cita. */
  is_new?: boolean;
};

/** Cuerpo de POST /api/auth/patient/register. Sólo name y email son obligatorios. */
export type PatientRegisterPayload = {
  name: string;
  email: string;
  /** Opcional: sirve para que la clínica pueda contactarlo, pero no bloquea el registro. */
  phone?: string;
  identity_document?: string;
  birth_date?: string;
  address?: string;
};

export type PatientRegisterResponse = PatientSendCodeResponse & {
  created: boolean;
  user_id: string;
  name?: string;
  email?: string;
};

/**
 * Ajustes de Configuración → Preferencias de Clínica (tabla `clinic_preferences`).
 * Se cargan una única vez tras el login y se leen desde el store; no se piden
 * en cada pantalla de venta.
 */
export type ClinicPreferences = {
  /** FALSE ⇒ ninguna pantalla de venta muestra campo de descuento. */
  discounts_enabled: boolean;
  /** Dónde se aplica el descuento. Excluyente: o por servicio, o sobre el documento. */
  discount_scope: DiscountScope;
  /** Porcentaje precargado en el campo. 0 ⇒ el campo arranca vacío. */
  default_discount_pct: number;
  /** Tope que el formulario deja guardar, en % sobre la base. 100 ⇒ sin tope. */
  max_discount_pct: number;
  /** TRUE ⇒ el formulario de pacientes exige un documento de identidad no vacío. */
  identity_document_required: boolean;
  /**
   * Estados de cita que exigen que el paciente tenga documento de identidad:
   * sin él, `update_status` rechaza el cambio (`identity_document_missing`).
   * Vacío ⇒ sin restricción. Nunca incluye `cancelled`. Independiente de
   * `identity_document_required`.
   */
  identity_document_warn_statuses: AppointmentStatus[];
  /**
   * TRUE ⇒ un paciente puede compartir teléfono con otro: el alta solo
   * advierte de quién lo tiene y pide confirmación. FALSE ⇒ se bloquea. El
   * correo siempre es único.
   */
  allow_duplicate_phone: boolean;
};

/** Ficha que ya usa el correo/teléfono que se intenta guardar (respuesta de `/users/upsert`). */
export interface DuplicateContactOwner {
  id: string;
  name: string;
  is_active: boolean;
  /** Documento de identidad (o RUT) para distinguir homónimos y familiares. */
  document?: string | null;
  birth_date?: string | null;
  phone_number?: string | null;
  is_dependent?: boolean;
  /** Tutor, si la ficha es de un dependiente. */
  responsible_name?: string | null;
  /** Tiene el rol paciente: solo esas fichas se pueden elegir para una cita. `undefined` = el backend no lo informó. */
  is_patient?: boolean;
  /**
   * Puede pasar a depender de quien se está guardando, cediéndole este contacto: es paciente,
   * no es dependiente ni tiene dependientes y no entra al portal. `undefined` = el backend no lo informó.
   */
  adoptable?: boolean;
}

/** Campo por el que una ficha existente coincide con el alta en curso. */
export type PatientMatchField = 'identity_document' | 'phone' | 'email';

/** Dueños del contacto repetido, por campo. */
export type DuplicateContactOwners = Partial<Record<PatientMatchField, DuplicateContactOwner[]>>;

/** `unique_conflict` de `/users/upsert`: campos que no se pueden repetir y, si se sabe, quién los tiene. */
export interface UniqueConflict {
  conflictedFields: string[];
  owners: DuplicateContactOwners;
}

/** `days`: desde hoy. `months`: meses calendario, el actual cuenta como el primero. */
export type PatientBookingWindowUnit = 'days' | 'months';

/** Ajustes de Configuración → Portal del Paciente. */
export type PatientPortalConfig = {
  patient_portal_enabled: boolean;
  online_booking_enabled: boolean;
  appointments_only: boolean;
  /** El paciente elige los servicios de su reserva. */
  service_selection_enabled: boolean;
  /**
   * Servicio con el que se crea la reserva cuando el paciente no elige.
   * Cadena vacía ⇒ sin servicio por defecto.
   */
  default_service_id: string;
  /** Muestra precios y duraciones en el portal. Sólo presentación. */
  show_pricing: boolean;
  /** Hasta qué fecha puede reservar el paciente. Ver `getBookingLimitDate`. */
  booking_window_unit: PatientBookingWindowUnit;
  booking_window_value: number;
  welcome_video_url: string;
  welcome_message: string;
};

export type PatientAiActionType = 'open_booking' | 'open_tab' | 'none';

export type PatientAiAction = {
  type: PatientAiActionType;
  payload?: { tab?: string; appointment_id?: string } | null;
};

/** Respuesta de POST /ai/patient/query — misma forma que DoctorAiQueryResponse. */
export type PatientAiQueryResponse = {
  answer?: string;
  output?: string;
  speak_text?: string;
  suggestions?: string[];
  action?: PatientAiAction | null;
};

// ─── Asistente guiado / base de conocimiento ────────────────────────────────
// Catálogo generado por scripts/knowledge/build-catalog.mjs en
// src/generated/help-catalog.json. Ver docs/onboarding-asistente.md.

/** Tipo de elemento indexado. Es el segundo segmento del help id: `<scope>.<kind>.<name>`. */
export type HelpElementKind = 'field' | 'btn' | 'tab' | 'filter' | 'nav' | 'section';

export interface HelpCatalogElement {
  /** Help id estable (`config.sedes.field.name`). Lo usan el asistente, los tests y la documentación. */
  id: string;
  kind: HelpElementKind;
  /** Etiqueta visible (resuelta desde es.json cuando el extractor la encuentra). */
  label?: string;
  description?: string;
  /** Archivo donde el extractor lo encontró. */
  source?: string;
}

export interface HelpCatalogScreen {
  /** Scope de la pantalla, derivado de la ruta (`/config/sedes` → `config.sedes`). */
  id: string;
  route: string;
  title: string;
  module?: string;
  permissions: string[];
  summary?: string;
  purpose?: string;
  prerequisites?: string[];
  tips?: string[];
  useCases?: string[];
  /** `draft` = generado/redactado por IA; `validated` = revisado por soporte/QA. */
  status: 'auto' | 'draft' | 'validated';
  inMenu: boolean;
  elements: HelpCatalogElement[];
}

/**
 * Paso de una guía. El motor (src/lib/help/guide-engine.ts) nunca hace clic
 * solo en un paso `confirm`: lo resalta y espera a que la persona lo pulse.
 */
export type HelpGuideStepAction =
  | 'navigate'
  | 'click'
  | 'highlight'
  | 'fill'
  | 'confirm'
  | 'wait';

/** Dato dictado que completa un campo (los días de la semana van como lista). */
export type HelpValue = string | number | boolean | Array<string | number>;

export interface HelpGuideStep {
  id: string;
  action: HelpGuideStepAction;
  title: string;
  description?: string;
  /** Help id del elemento (todas las acciones menos `navigate`). */
  target?: string;
  /** Ruta sin locale (`/config/sedes`) para `navigate`. */
  route?: string;
  /** Valor para `fill`. Admite `{{values.campo}}`, que se resuelve con los datos dictados. */
  value?: string | number | boolean;
  /** Si el paso es opcional, sin valor para `fill` se salta en vez de esperar. */
  optional?: boolean;
  /**
   * Lo que se ve junto a la manito: para qué sirve, qué cambia según lo que se
   * elija. Si la guía no lo trae, el extractor copia la descripción del
   * elemento desde su ficha.
   */
  details?: string;
  /** Recorridos de pantalla: si el elemento no está a la vista, el paso se salta. */
  skipIfMissing?: boolean;
  /**
   * `highlight`: el paso se da por hecho cuando aparece alguno de estos help ids
   * (p. ej. la persona hizo clic derecho en el turno y se abrió su menú). Sirve para
   * gestos que la guía no puede hacer por la persona: clic derecho, arrastrar.
   */
  until?: string | string[];
  /**
   * `highlight` sobre una opción de menú: el paso se da por hecho cuando el elemento
   * desaparece (la persona eligió una opción y el menú se cerró), aunque haya
   * elegido otra opción distinta de la señalada.
   */
  doneOnClose?: boolean;
  /**
   * La persona tiene que hacerlo (elegir un registro real, abrir su menú…): "Siguiente",
   * "Saltar" e "Ir al final" quedan deshabilitados hasta que lo haga. Los pasos con
   * `until` lo son siempre.
   */
  blocking?: boolean;
  /**
   * `fill` opcional que igual se muestra sin dato dictado (preferencias: se explica cada
   * opción y la persona decide si la cambia). Sin `ask`, un opcional sin dato se salta.
   */
  ask?: boolean;
  /**
   * `highlight` con `until`: si la guía corre con datos dictados (pruebas, videos demo),
   * la guía pulsa el elemento sola; con una persona, espera a que lo haga.
   */
  autoClick?: boolean;
  /**
   * El paso sólo corre si se cumple (si no, se salta). Un estado que registra la app
   * (`cash-session-open`, `cash-session-closed`) o un help id que tiene que estar en pantalla.
   * Con `@start`, el estado de cuando arrancó la guía. Así una guía cubre los dos casos:
   * "abrir la caja" con la caja ya abierta empieza por cerrarla.
   */
  onlyIf?: string;
  /** Lo contrario de `onlyIf`: el paso se salta si se cumple. */
  unless?: string;
}

export interface HelpUseCase {
  id: string;
  title: string;
  summary?: string;
  module?: string;
  /** Pantallas involucradas (scopes). */
  screens: string[];
  /** Agrupa las guías de una pantalla con muchas funciones (p. ej. la pestaña de la ficha). */
  group?: string;
  /** Datos que la guía puede completar con lo dictado: nombre → descripción. */
  inputs?: Record<string, string>;
  steps: HelpGuideStep[];
  /** Fase 3: id del video demo generado desde el test E2E de este caso. */
  videoId?: string;
  keywords?: string[];
}

export interface HelpJourneyStep {
  id: string;
  title: string;
  description: string;
  route: string;
  useCaseId?: string;
  required: boolean;
}

export interface HelpPermissionDoc {
  code: string;
  constant: string;
  description?: string;
}

export interface HelpCatalog {
  /** Hash del contenido: cambia sólo cuando cambia el catálogo. */
  version: string;
  screens: HelpCatalogScreen[];
  useCases: HelpUseCase[];
  journey: HelpJourneyStep[];
  permissions: HelpPermissionDoc[];
}

export type OnboardingStepStatus = 'done' | 'pending' | 'skipped';

export interface OnboardingStepState {
  step_id: string;
  status: OnboardingStepStatus;
  /** Cuántos registros encontró el chequeo (sedes, consultorios…). */
  count?: number;
  completed_at?: string | null;
  notes?: string | null;
}

/** Respuesta de GET /help/onboarding/status. Qué pasos son obligatorios lo dice el journey del catálogo. */
export interface OnboardingStatusResponse {
  steps: OnboardingStepState[];
}

/** Elemento visible en pantalla que el frontend le manda al asistente como contexto. */
export interface HelpVisibleTarget {
  id: string;
  kind: HelpElementKind;
  label?: string;
}

export interface HelpAssistantLink {
  route: string;
  label: string;
}

/** Respuesta de POST /help/assistant/chat (ya validada por el workflow contra el catálogo). */
/**
 * Video grabado de una guía (help_videos). `useCaseId` es el id de la guía, o
 * `tour.<pantalla>` para "Guiarme por esta pantalla". `url`: el mp4 publicado o el
 * archivo en Google Drive (ver src/lib/help/video-source.ts).
 */
export interface HelpVideo {
  useCaseId: string;
  url: string;
  title: string;
  durationSeconds?: number | null;
  locale?: string;
}

export interface HelpAssistantReply {
  answer: string;
  confidence?: number;
  links?: HelpAssistantLink[];
  /** La guía del catálogo más parecida al pedido (la primera de `useCaseIds`). */
  useCaseId?: string | null;
  /** Hasta 3 guías predefinidas, de la más parecida a la menos. Nunca se arman guías al vuelo. */
  useCaseIds?: string[];
  /** Valores extraídos de lo dictado para `{{values.x}}`. */
  values?: Record<string, HelpValue>;
  /** true cuando la persona pidió "guiame": la guía arranca sola. */
  autoStart?: boolean;
  /** Video de `useCaseId` (compatibilidad: `videos` trae los de todas las guías propuestas). */
  videoUrl?: string | null;
  /** Videos publicados (help_videos) de las guías propuestas y de la pantalla actual. */
  videos?: HelpVideo[];
  questionId?: string | null;
  escalated?: boolean;
  /** Ticket de soporte abierto al escalar. */
  ticketId?: string | null;
}

export interface HelpInsightsTotals {
  total: number;
  resolved: number;
  escalated: number;
  positive: number;
  negative: number;
  avg_confidence: number | null;
  /** Escaladas en fin de semana (la meta es sólo incidentes críticos). */
  weekend_human: number;
}

export interface HelpInsightsOpenQuestion {
  id: string;
  question: string;
  answer: string | null;
  confidence: number | null;
  rating: number | null;
  route: string | null;
  screen_id: string | null;
  created_at: string;
  user_name: string | null;
}

export type HelpTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface HelpInsightsTicket {
  id: number;
  subject: string;
  route: string | null;
  status: HelpTicketStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  channel: string;
  created_at: string;
  user_name: string | null;
}

/** Respuesta de GET /help/insights. */
export interface HelpInsights {
  totals: HelpInsightsTotals;
  by_week: { week: string; total: number; escalated: number }[];
  by_screen: { screen_id: string; total: number; unresolved: number }[];
  open_questions: HelpInsightsOpenQuestion[];
  tickets: HelpInsightsTicket[];
  onboarding: { step_id: string; status: OnboardingStepStatus; completed_at: string | null }[];
  videos: { ready: number; stale: number; requests_open: number; requests_failed: number } | null;
  catalog: { version: string | null; synced_at: string | null; screens: number; validated: number; tables: number } | null;
}

// ── Comandos de voz ─────────────────────────────────────────────────────────────

/** En qué está la sesión de voz: escucha, piensa, habla, espera una respuesta o ejecuta. */
export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'waiting' | 'running';

export interface VoiceCardRow {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
}

export interface VoiceChoice {
  label: string;
  detail?: string;
}

/** Tarjeta que acompaña al comando: qué entendió, qué va a hacer y qué pregunta. */
export interface VoiceCard {
  title: string;
  subtitle?: string;
  rows?: VoiceCardRow[];
  /** Lo que el asistente pregunta o informa (lo mismo que dice en voz alta). */
  message?: string;
  /** confirm: espera "sí/no"; danger: lo mismo pero cancela o retrocede; success/error: resultado. */
  tone?: 'info' | 'confirm' | 'danger' | 'success' | 'error';
  /** Opciones para elegir diciendo "el dos" o el nombre (o tocándolas). */
  choices?: VoiceChoice[];
  link?: { label: string; href: string };
}

/** Lo que un comando de voz puede hacer mientras corre. Todo se corta con `signal` (Escape, otro comando). */
export interface VoiceCommandContext {
  locale: string;
  signal: AbortSignal;
  /** Traductor desde la raíz de los mensajes ('VoiceCommands.x', 'LabOrdersPage.errors.y'). */
  t: (key: string, values?: Record<string, string | number>) => string;
  hasPermission: (code: string) => boolean;
  /** Ruta sin locale (p. ej. '/lab-orders?order=45'). */
  navigate: (route: string) => void;
  /** Muestra la tarjeta mientras trabaja (buscando la orden…). */
  show: (card: VoiceCard) => void;
  /**
   * Cambia el contenido de la tarjeta sin tocar lo que espera (la pregunta sigue abierta): por
   * ejemplo, el resumen de una orden que se editó a mano mientras se preguntaba.
   */
  update: (card: VoiceCard) => void;
  /**
   * Pregunta en voz alta y espera la respuesta dicha (el micrófono se abre solo). Con
   * `awaiting: 'confirm'` la tarjeta muestra Sí/No pero devuelve el texto tal cual (para
   * aceptar también otra respuesta, como una corrección).
   */
  ask: (card: VoiceCard, speech: string, awaiting?: 'answer' | 'confirm', options?: VoiceAskOptions) => Promise<string>;
  /** Pregunta entre opciones; devuelve el índice elegido. */
  choose: (card: VoiceCard, speech: string) => Promise<number>;
  /** "¿Confirmo?": true con "sí", false con "no". */
  confirm: (card: VoiceCard, speech: string) => Promise<boolean>;
  /** Resultado final (éxito, aviso o error) en la tarjeta y en voz alta. */
  finish: (card: VoiceCard, speech: string) => Promise<void>;
  /**
   * Lo que se respondió puede no ser para esta pregunta sino otro pedido. 'switched': era un pedido
   * nuevo y se aceptó dejar la tarea (que queda cancelada); 'handled': era una herramienta (se hizo)
   * o no se quiso cambiar de tarea (el comando vuelve a preguntar); 'none': no es ningún pedido.
   */
  handOff: (text: string) => Promise<'switched' | 'handled' | 'none'>;
  /** Dentro de un plan de varios pasos: no es el último (el resultado se muestra sin decirlo). */
  midPlan: boolean;
  /** Quién entendió la frase: el intérprete local o la IA. */
  source: 'local' | 'ai';
  /**
   * Lo local entendió la forma pero lo nombrado no existe («solo cuando atendemos» no es un
   * doctor): se le pregunta a la IA. true = la IA lo entendió y ya se está haciendo (el comando
   * termina); false = tampoco, el comando sigue (dice que no lo encontró).
   */
  tryAi: () => Promise<boolean>;
  /**
   * Lo que sigue del pedido después de este paso, en la pantalla nueva («andá a pacientes y buscá a
   * Juan»: navegar y después «buscá a Juan»). Se interpreta cuando termina la tarea, con el
   * contexto de la página a la que se llegó.
   */
  followUp: (text: string) => void;
  /** Los módulos de voz activos ahora (cambian al navegar). */
  activeDomains: () => readonly string[];
}

export interface VoiceAskOptions {
  /**
   * La respuesta puede ser una corrección libre (el formulario abierto: «con el doctor Pérez»,
   * «agregá limpieza»): todo va al comando, que decide (y si no es suyo usa ctx.handOff).
   */
  corrections?: boolean;
}

/**
 * Qué tiene que ver lo dicho con lo que se venía haciendo (lo decide la IA cuando hay una tarea
 * en curso): una respuesta, una herramienta en el medio (moverse, ver huecos…), algo nuevo, algo
 * que no es para el asistente, cancelar o retomar.
 */
export type VoiceRelation = 'new' | 'answer' | 'aux' | 'ignore' | 'cancel' | 'resume';

/** Lo que un módulo con planes devuelve de la IA, además de su resultado (ver VoiceDomain.ai). */
export interface VoiceAiPlan<S = unknown> {
  relation?: VoiceRelation;
  /** relation 'answer': la respuesta normalizada a la pregunta abierta («2», «sí», un nombre). */
  answer?: string | null;
  /** Pasos en orden; cada uno es un resultado del módulo (lo convierte un comando con ai.from). */
  steps?: S[];
}

/**
 * Un módulo de voz (órdenes de laboratorio, periodontograma…): agrupa sus comandos y sabe cómo
 * preguntarle a la IA. Cada pantalla monta el host con los módulos que tiene activos, así los
 * comandos y el contexto que va a la IA son solo los de esa pantalla.
 */
export interface VoiceDomain<R = unknown> {
  /** Id que viaja a POST voice/interpret ('lab_orders'): el servidor elige su prompt con esto. */
  id: string;
  /** Clave i18n del «No entendí» con ejemplos de este módulo (default: VoiceCommands.notUnderstood). */
  notUnderstoodKey?: string;
  /**
   * Cuando el intérprete local no entiende la frase se le pregunta a la IA. `context` arma lo que
   * la IA necesita saber (nunca datos de pacientes; sin él, lo pasa quien pregunta, como el dictado
   * del periodontograma con la posición de la sonda) y `sanitize` revalida la respuesta contra ese
   * mismo contexto: lo que no cierra queda en null.
   */
  ai?: {
    context?: (ctx: VoiceCommandContext) => Promise<Record<string, unknown>>;
    sanitize: (raw: unknown, context: Record<string, unknown>) => R;
    /** Si la frase vale la pena preguntársela a la IA de este módulo (default: siempre). */
    accepts?: (normalized: string) => boolean;
  };
}

/** Respuesta de POST voice/interpret, ya revalidada por el módulo. */
export interface VoiceInterpretation<R = unknown> {
  domain: string;
  /** 0–1: qué tan segura está la IA. Por debajo del mínimo de la sesión se dice que no se entendió. */
  confidence: number;
  result: R;
}

/** Un comando de voz: reconoce su frase sin IA y la ejecuta conversando con la persona. */
export interface VoiceCommand<P = unknown, R = any> {
  id: string;
  /** Módulo al que pertenece (VoiceDomain.id): solo corre en las pantallas que lo activan. */
  domain: string;
  /** Más alto se prueba antes (default 0): los comandos específicos le ganan a los generales. */
  priority?: number;
  /** Lo entendido de la frase (normalizada con normalizeSpeech), o null si no es para este comando. */
  match: (normalized: string, raw: string) => P | null;
  run: (parsed: P, ctx: VoiceCommandContext) => Promise<void>;
  /** Convierte lo que interpretó la IA (el `result` de su módulo) en lo que espera `run`. */
  ai?: {
    from: (result: R, raw: string) => P | null;
  };
  /**
   * Herramienta: solo mira o mueve la pantalla (navegar, vista, zoom, filtros, huecos, buscar,
   * avisos). Con una tarea a medias se hace en el medio sin cancelarla y se repite la pregunta.
   */
  aux?: boolean;
  /**
   * Actúa sobre la cita (o el paciente) en foco. Un pedido nuevo sin ningún comando así es un
   * cambio de contexto: el foco se suelta.
   */
  usesFocus?: boolean;
  /**
   * Se ocupa él mismo de una frase con varios pedidos (la navegación: va a la página y deja el
   * resto para la página nueva). Si reconoce la frase, no se arma un plan con la IA.
   */
  handlesCompound?: boolean;
  /**
   * Trabaja dentro de la ventana abierta (el cobro rápido, el formulario de la cita): no la cierra
   * al empezar y lo dicho no se toma primero como un botón o campo genérico de esa ventana.
   */
  keepsOverlay?: boolean;
}

/** Contexto del módulo lab_orders para la IA (POST voice/interpret). */
export interface VoiceAiContext {
  stages: Array<{ id: number; name: string; kind: string }>;
  laboratories: Array<{ id: string; name: string }>;
  /**
   * Orden abierta en el asistente por voz (alta o edición): la frase es una corrección.
   * Sin el paciente: solo trabajos, laboratorio, entrega y envío.
   */
  draft?: VoiceAiDraftContext;
}

export interface VoiceAiDraftContext {
  /** 'create': orden nueva (sin número); 'edit': la orden `order_id`, que ya existe. Sin el campo, alta. */
  mode?: 'create' | 'edit';
  order_id?: number | null;
  /** Edición: etapa en la que está (la entrega solo se cambia si ya se envió). */
  stage?: string | null;
  items: VoiceAiItem[];
  /** Piezas de la orden cuando no hay trabajos del catálogo. */
  teeth: number[];
  work_description: string | null;
  laboratory: string | null;
  send: boolean;
  due_date: string | null;
  is_urgent: boolean;
  notes: string | null;
}

/** lab_order.draft_edit: qué cambiar de la orden en creación. Lo que no se pidió, en null o vacío. */
export interface VoiceAiDraftEdit {
  /** Otro paciente (el nombre tal como se dijo). */
  patient: string | null;
  add_items: VoiceAiItem[];
  /** Trabajos a quitar, como se nombraron. */
  remove_items: string[];
  /** Cantidad o piezas de un trabajo ya cargado (service null: el único, o las piezas de la orden). */
  update_items: Array<{ service: string | null; quantity: number | null; teeth: number[] | null }>;
  work_description: string | null;
  laboratory_id: string | null;
  clear_laboratory: boolean;
  /** true: enviarla al crearla; false: no enviarla. En la edición no se usa (se envía moviéndola de etapa). */
  send: boolean | null;
  due_date: string | null;
  urgent: boolean | null;
  /** Texto a agregar a las notas. */
  note_add: string | null;
}

export type VoiceAiIntent =
  | 'lab_order.move' | 'lab_order.create' | 'lab_order.open'
  /** Cambiar entrega, urgente o agregar una nota a una orden existente. */
  | 'lab_order.update'
  /** "¿En qué etapa está la 45?": se responde, no se cambia nada. */
  | 'lab_order.status'
  /** "Mostrame las atrasadas": filtra la pantalla de órdenes. */
  | 'lab_order.list'
  /** Corrección a la orden abierta por voz, nueva o en edición ("que sea urgente", "agregá un perno"). */
  | 'lab_order.draft_edit'
  /**
   * Editar una orden existente (con número) en el asistente: "editá la 45", "a la 45 agregale un
   * perno", "la 45 es para María López". Lo que se pide cambiar viene en `draft_edit`.
   */
  | 'lab_order.edit'
  | 'unknown';

/** Filtros pedidos con lab_order.list. */
export interface VoiceAiListFilter {
  overdue: boolean;
  urgent: boolean;
  due_today: boolean;
  view: 'list' | 'board' | null;
  /** Quitar los filtros que había. */
  clear: boolean;
  /** Se preguntó "¿cuántas…?": además de mostrarlas se dice el número. */
  count: boolean;
}

export interface VoiceAiItem {
  /** Cómo se nombró el trabajo ("corona de zirconio"): se busca en los servicios de laboratorio. */
  service: string;
  quantity: number;
  teeth: number[];
}

/** `result` de voice/interpret para el módulo lab_orders, validado (todo lo que no cierra viene en null). */
export interface VoiceAiResult {
  intent: VoiceAiIntent;
  order_id: number | null;
  stage_id: number | null;
  move_kind: 'send' | 'received' | 'complete' | 'cancel' | 'next' | null;
  /** Cuándo pasó ('YYYY-MM-DD'): "se envió ayer". */
  effective_date: string | null;
  due_date: string | null;
  laboratory_id: string | null;
  /** Nombre del paciente tal como se dijo. */
  patient: string | null;
  items: VoiceAiItem[];
  work_description: string | null;
  teeth: number[];
  is_urgent: boolean;
  send: boolean;
  notes: string | null;
  /** lab_order.update: true = marcar urgente, false = quitarlo, null = no se habló de eso. */
  urgent_change: boolean | null;
  /** lab_order.update: nota a agregar. */
  note_add: string | null;
  /** lab_order.list. Paciente y laboratorio van en `patient` y `laboratory_id`. */
  filter: VoiceAiListFilter | null;
  /** lab_order.draft_edit y lab_order.edit (en este, vacío si solo se pidió abrirla para editar). */
  draft_edit: VoiceAiDraftEdit | null;
  confidence: number;
}

// ── Calendario por voz (módulo `calendar` de voice/interpret) ───────────────────

/** Las vistas del calendario (mismo conjunto que CalendarView de components/calendar). */
export type CalendarVoiceView = 'day' | 'week' | 'month' | 'year' | '2-day' | '3-day' | '4-day' | '5-day' | '6-day' | 'schedule';

export type CalendarVoiceIntent =
  /** Ir a una fecha ("andá al jueves") o avanzar/retroceder (`step`). */
  | 'calendar.navigate'
  /** Cambiar la vista ("vista semanal"). */
  | 'calendar.view'
  /** Mostrar / ocultar doctores, agendas o sedes ("solo el doctor Pérez"). */
  | 'calendar.filter'
  /** Agrupar las columnas por doctor o agenda. */
  | 'calendar.group'
  /** Abrir el buscador de citas con un texto. */
  | 'calendar.search'
  /** "¿Qué tengo mañana?": citas de un día (no cambia nada). */
  | 'calendar.agenda'
  /** "¿Quién sigue?": la próxima cita de hoy. */
  | 'calendar.next'
  /** "¿Cuándo viene Ana Gómez?": la próxima cita de un paciente. */
  | 'calendar.patient_next'
  /** "¿Hay huecos el jueves a la tarde?". */
  | 'calendar.gaps'
  /** Cambiar el estado de una cita ("Ana llegó", "cancelá la de las 10"). */
  | 'calendar.status'
  /** Nueva cita (abre el formulario completo). */
  | 'calendar.create'
  /** Reprogramar una cita (abre el formulario de reprogramación completo). */
  | 'calendar.reschedule'
  | 'calendar.edit'
  /** Menú de la cita: color, agenda, doctor, duración, borrar, abrir lo del paciente / sesión / cobro. */
  | 'calendar.color'
  | 'calendar.move_calendar'
  | 'calendar.assign_doctor'
  | 'calendar.duration'
  | 'calendar.delete'
  | 'calendar.open'
  /** Bloquear / habilitar una franja (horarios de excepción). */
  | 'calendar.block'
  | 'calendar.enable'
  /** Recordatorios y notas: crear, marcar hecho, borrar. */
  | 'calendar.reminder'
  | 'calendar.reminder_done'
  | 'calendar.reminder_delete'
  /** Barra: imprimir/exportar la agenda, actualizar. */
  | 'calendar.print'
  | 'calendar.refresh'
  /** Hoy (botón Hoy). */
  | 'calendar.today'
  /** Zoom de la grilla: acercar, alejar, al máximo/mínimo, un valor, normal. */
  | 'calendar.zoom'
  /** Panel de agendas: abrir, cerrar, fijar, soltar. */
  | 'calendar.panel'
  /** «¿Qué vistas / agendas hay?»: listar opciones y elegir. */
  | 'calendar.options'
  /** Cerrar el buscador / ocultar los huecos. */
  | 'calendar.close_search'
  | 'calendar.hide_gaps'
  /** Exportar agenda con período, fechas y agendas; export_now descarga. */
  | 'calendar.export'
  /** Engranaje: cambiar una preferencia (setting + valor) o abrir/cerrar el engranaje. */
  | 'calendar.settings'
  | 'calendar.settings_open'
  /** Ir a / seleccionar una cita (queda en foco). */
  | 'calendar.select'
  /** Con el formulario abierto: cambiar campos, guardar, cancelar. */
  | 'calendar.form_set'
  | 'calendar.form_save'
  | 'calendar.form_cancel'
  /** Un aviso de la pantalla: continuar o cancelar. */
  | 'calendar.dialog'
  /** Cerrar lo que esté abierto (buscador, huecos, configuración, exportar, lotes, panel); filter_op 'all' = todo. */
  | 'calendar.close_panels'
  /** Buscar un paciente (citas, después el buscador de pacientes por nombre/documento/email/teléfono). */
  | 'calendar.patient_find'
  /** Información del paciente de sus registros (veces que vino, faltas, deuda, pagos, presupuestos…). */
  | 'calendar.patient_info'
  /** Nuevo presupuesto, factura, tratamiento, sesión clínica o cobro rápido del paciente. */
  | 'calendar.patient_action'
  /** Resumen o pregunta sobre el paciente de la cita (agente clínico). */
  | 'calendar.patient_ask'
  | 'unknown';

/** Preferencias de la agenda que se cambian por voz (claves de CalendarSettings). */
export type CalendarVoiceSettingKey =
  | 'mode' | 'default_view' | 'grouped_by' | 'hour_height' | 'slot_duration' | 'default_sede' | 'event_label_format'
  | 'hidden_weekdays' | 'visible_hours' | 'color_by_status' | 'check_availability' | 'block_unavailable'
  | 'filter_doctors_by_service' | 'inline_appointment_creation' | 'inline_draft_live_preview';

/** `result` de voice/interpret para el módulo calendar, validado (lo que no cierra viene en null). */
export interface CalendarVoiceAiResult {
  intent: CalendarVoiceIntent;
  /** 'YYYY-MM-DD': el día del que se habla (en reschedule, el NUEVO día). */
  date: string | null;
  /** 'HH:mm' (en reschedule, la NUEVA hora). */
  time: string | null;
  /** reschedule: día y hora actuales de la cita, si se dijeron ("la del martes a las 10"). */
  from_date: string | null;
  from_time: string | null;
  /** navigate: 1 siguiente, -1 anterior (sin fecha). */
  step: 1 | -1 | null;
  view: CalendarVoiceView | null;
  /** filter: qué hacer y con qué (ids de las listas cerradas). */
  filter_op: 'only' | 'add' | 'remove' | 'all' | null;
  filter_target: 'doctor' | 'calendar' | 'sede' | null;
  doctor_ids: string[];
  calendar_ids: string[];
  sede_ids: string[];
  group_by: 'none' | 'doctor' | 'calendar' | null;
  /** Nombre del paciente tal como se dijo. */
  patient: string | null;
  /** search: el texto a buscar. */
  query: string | null;
  /** create: doctor, agenda y servicios (ids de las listas). */
  doctor_id: string | null;
  calendar_id: string | null;
  service_ids: string[];
  /** status: el estado nuevo. */
  status: AppointmentStatus | null;
  cancellation_reason: Exclude<CancellationReason, 'other' | 'reschedule'> | null;
  /** gaps: parte del día. */
  period: 'morning' | 'afternoon' | null;
  /** color: id del color del menú ('1'…'11') o 'none' (sin color propio). */
  color: string | null;
  /** duration: minutos nuevos. */
  minutes: number | null;
  /** block / enable: fin de la franja ('HH:mm'; el inicio va en `time`). */
  end_time: string | null;
  /** reminder: lo que hay que anotar; reminder_done / reminder_delete: palabras de su título. */
  title: string | null;
  reminder_type: 'reminder' | 'note' | null;
  /** open: qué abrir de la cita. */
  target: 'history' | 'documents' | 'accounts' | 'appointments' | 'patient' | 'session' | 'bill' | null;
  /** zoom: qué hacer; zoom_level: porcentaje (30–250) con 'set'; amount: pasos de 10 % (in/out). */
  zoom_op: 'in' | 'out' | 'max' | 'min' | 'reset' | 'set' | null;
  zoom_level: number | null;
  amount: number | null;
  /** panel: abrir/cerrar/fijar/soltar el panel de agendas; settings_open: el engranaje. */
  panel_op: 'open' | 'close' | 'pin' | 'unpin' | null;
  /** options: de qué listar las opciones. */
  options_of: 'views' | 'calendars' | 'doctors' | 'sedes' | null;
  /** export: período (end_date con 'custom'); export_now: descargar ya. */
  export_range: 'day' | 'week' | 'month' | 'custom' | null;
  end_date: string | null;
  export_now: boolean;
  /** settings: la preferencia y su valor (texto, número o sí/no según la clave). */
  setting: CalendarVoiceSettingKey | null;
  setting_value: string | number | boolean | null;
  /** settings hidden_weekdays: 0=domingo…6=sábado; weekday_op ocultar/mostrar/dejar solo esos ocultos. */
  weekdays: number[];
  weekday_op: 'hide' | 'show' | 'set' | null;
  /** form_set: tratamientos a sacar; notas (el texto va en title). */
  remove_service_ids: string[];
  notes_op: 'append' | 'replace' | 'clear' | null;
  /** dialog: qué botón del aviso. */
  dialog_op: 'confirm' | 'cancel' | null;
  /** patient_find: datos para buscar si no es el nombre. */
  document: string | null;
  email: string | null;
  phone: string | null;
  /** patient_ask: la pregunta tal como se dijo. */
  question: string | null;
  /** patient_info: qué se pregunta. */
  info_topics: Array<'summary' | 'visits' | 'cancellations' | 'no_shows' | 'last_no_show' | 'last_visit' | 'debt' | 'last_payment' | 'payments' | 'quotes' | 'invoices' | 'treatments'>;
  /** patient_action: qué abrir. */
  patient_action: 'quote' | 'invoice' | 'treatment' | 'session' | 'bill' | null;
  confidence: number;
}

/** El resultado del calendario con el plan: el primer paso arriba (compatibilidad) y todos en steps. */
export type CalendarVoiceAiPlanResult = CalendarVoiceAiResult & VoiceAiPlan<CalendarVoiceAiResult>;

/** Lo que el riel derecho le ofrece a la voz (ver src/components/voice/rail-voice-bridge.tsx). */
export interface RailVoiceBridge {
  expanded: boolean;
  setExpanded: (open: boolean) => void;
  /** null: sin permiso para ver la caja. */
  cash: { open: boolean; balances: Array<{ currency: string; amount: number }> } | null;
  sedes: Array<{ id: string; name: string }>;
  activeSedeId: string | null;
  setSede: (id: string) => Promise<void>;
  tv: {
    status: 'on' | 'paused' | 'promo' | 'off';
    rooms: Array<{ id: string; name: string; hasNext: boolean }>;
    setStatus: (status: 'on' | 'paused' | 'promo' | 'off') => void;
    next: (roomId: string) => void;
    openScreen: () => void;
  } | null;
  alerts: { count: number; highest: string };
  inbox: { count: number; open: () => void };
  notes: { count: number; open: () => void; create: (text: string) => Promise<boolean> } | null;
  exchange: { code: string; rate: number } | null;
  openBilling: (context: { patientId?: string; patientName?: string }) => void;
}

// ── Cobro rápido por voz (src/lib/voice/commands/billing.ts) ──────────────────

/** Una línea del cobro rápido, como la ve la voz. */
export interface BillingVoiceLine {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Neto (con el descuento de la línea). */
  total: number;
  discount: { mode: DiscountMode; value: number } | null;
}

export interface BillingVoiceService {
  id: string;
  name: string;
  price: number;
}

/** El asistente de cobro: en qué paso está y los botones del pie que valen ahora (null = no). */
export interface BillingVoiceBridge {
  step: 'patient' | 'items' | 'quote' | 'payment' | 'confirmation' | 'loading';
  patientName: string | null;
  next: (() => void) | null;
  invoiceAndPay: (() => void) | null;
  invoiceOnly: (() => void) | null;
  /** Cobrar lo ya facturado (paso del presupuesto sin servicios nuevos). */
  payOnly: (() => void) | null;
  close: () => void;
}

/** Paso «Paciente» del cobro libre. */
export interface BillingPatientVoiceBridge {
  selected: string | null;
  select: (patient: { id: string; name: string; email?: string; phone?: string }) => void;
}

/** Paso «Servicios» del cobro libre. */
export interface BillingItemsVoiceBridge {
  lines: BillingVoiceLine[];
  currency: string;
  currencies: string[];
  gross: number;
  discountAmount: number;
  total: number;
  discounts: {
    /** Dónde se aplica (null: los descuentos están apagados en la clínica). */
    scope: 'line' | 'total' | null;
    canApply: boolean;
    maxPct: number | null;
    document: { mode: DiscountMode | null; value: number | null } | null;
  };
  sedes: Array<{ id: string; name: string }>;
  sedeId: string;
  searchServices: (query: string) => Promise<BillingVoiceService[]>;
  add: (service: BillingVoiceService, options?: { quantity?: number; price?: number }) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  setPrice: (lineId: string, price: number) => void;
  remove: (lineId: string) => void;
  setLineDiscount: (lineId: string, discount: { mode: DiscountMode; value: number } | null) => void;
  setDocumentDiscount: (discount: { mode: DiscountMode; value: number } | null) => void;
  setCurrency: (currency: string) => void;
  setSede: (sedeId: string) => void;
}

/** Paso «Pago». */
export interface BillingPaymentVoiceBridge {
  /** 'credits': primero se ofrece usar el saldo a favor. */
  substep: 'credits' | 'payment';
  /** Lo que falta cobrar (en la moneda de la factura). */
  pending: number;
  /** Lo que queda sin cubrir con lo cargado. */
  remaining: number;
  currency: string;
  currencies: string[];
  methods: Array<{ id: string; name: string }>;
  entries: Array<{ method: string | null; amount: number; currency: string }>;
  setEntry: (index: number, patch: { method?: string; amount?: number; currency?: string }) => void;
  addEntry: () => void;
  removeEntry: (index: number) => void;
  setNotes: (text: string) => void;
  submit: () => void;
}

/** Lo que el panel de control le ofrece a la voz (src/lib/voice/commands/dashboard.ts). */
export interface DashboardVoiceBridge {
  loading: boolean;
  canFilter: boolean;
  currency: string;
  currencies: string[];
  sedes: Array<{ id: string; name: string }>;
  sedeId: string | null;
  range: { from: Date; to: Date } | null;
  summary: DashboardExecutiveSummary | null;
  branches: ProduccionSucursalRow[];
  services: Array<{ name: string; sales: number; percentage: number }>;
  evolution: EvolucionMensualResponse | null;
  setSede: (sedeId: string | null) => void;
  setRange: (from: Date, to: Date) => void;
  setCurrency: (currency: string) => void;
  reload: () => void;
}

/** Lo que Mi consultorio le ofrece a la voz (src/lib/voice/commands/workspace.ts). */
export interface WorkspaceVoiceBridge {
  loading: boolean;
  appointments: Array<{ id: string; date: string; time: string; patient: string; service: string; status: string }>;
  selectedId: string | null;
  select: (appointmentId: string) => void;
  preset: string;
  setPreset: (preset: 'today' | 'tomorrow' | 'week' | 'next7' | 'month' | 'nextMonth' | 'prevMonth') => void;
  setRange: (from: Date, to: Date) => void;
  viewMode: 'mine' | 'calendar';
  setViewMode: (mode: 'mine' | 'calendar') => void;
  calendars: Array<{ id: string; name: string }>;
  calendarId: string;
  setCalendar: (calendarId: string) => void;
  refresh: () => void;
  panel: 'sessions' | 'odontogram';
  setPanel: (panel: 'sessions' | 'odontogram') => void;
  /** Acciones sobre la cita elegida; null = no se puede ahora (el motivo, en `blocked`). */
  actions: {
    session: (() => void) | null;
    prescribe: (() => void) | null;
    labOrder: (() => void) | null;
    aesthetic: (() => void) | null;
    perio: (() => void) | null;
    patientFile: ((view?: 'anamnesis' | 'timeline') => void) | null;
  };
  blocked: 'noAppointment' | 'futureDate' | 'noPermission' | 'odontogramSession' | null;
}

/** Lo que el Centro de alertas le ofrece a la voz (src/lib/voice/commands/alerts.ts). */
export interface AlertsVoiceBridge {
  loading: boolean;
  alerts: Array<{
    id: string; title: string; summary: string; patient: string; category: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; status: string; date: string;
    canEmail: boolean; canWhatsApp: boolean; hasPatient: boolean;
  }>;
  counts: { total: number; critical: number; high: number; medium: number };
  statusFilter: string;
  priorityFilter: string;
  setStatusFilter: (status: '' | 'PENDING' | 'COMPLETED' | 'ACTION_TAKEN' | 'IGNORED' | 'SUPPRESSED') => void;
  setPriorityFilter: (priority: '' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => void;
  refresh: () => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  permissions: { complete: boolean; ignore: boolean; snooze: boolean; call: boolean; note: boolean; email: boolean; whatsapp: boolean };
  complete: (ids: string[]) => Promise<void>;
  ignore: (ids: string[], reason: string) => Promise<void>;
  snooze: (ids: string[], until: string, reason: string) => Promise<void>;
  registerCall: (ids: string[], scheduledAt: string, notes: string) => Promise<void>;
  addNote: (ids: string[], text: string) => Promise<void>;
  email: (id: string) => void;
  whatsapp: (ids: string[]) => Promise<void>;
  openPatient: (id: string) => void;
}

/** Caja por voz (src/lib/voice/commands/cashier.ts): la pantalla y lo que se está viendo. */
export interface CashierVoiceBridge {
  view: 'loading' | 'points' | 'active' | 'opening' | 'closing';
  /** Paso del asistente de apertura o cierre ('CONFIG', 'COUNT_UYU', 'REVIEW'…). */
  wizardStep: string | null;
  cashPoints: Array<{ id: string; name: string; open: boolean; mine: boolean; user: string }>;
  /** Abre la sesión de ese punto si está abierta; si está cerrada empieza la apertura. */
  openPoint: (id: string) => void;
  startClosing: (() => void) | null;
  viewAll: (() => void) | null;
}

/** La sesión de caja abierta: saldos y movimientos. */
export interface CashierSessionVoiceBridge {
  name: string;
  cashOnHand: Array<{ currency: string; amount: number }>;
  income: Array<{ currency: string; amount: number }>;
  outcome: Array<{ currency: string; amount: number }>;
  card: Array<{ currency: string; amount: number }>;
  movements: Array<{ type: 'INGRESO' | 'EGRESO'; amount: number; currency: string; method: string; document: string; client: string }>;
}

/** Un contador de efectivo (por moneda) del asistente de apertura o cierre. */
export interface CashCountVoiceBridge {
  currency: string;
  title: string;
  /** Billetes y monedas que se cuentan (vacío: solo un monto total). */
  denominations: number[];
  coins: number[];
  quantities: Record<string, number>;
  total: number;
  setQuantity: (denomination: number, quantity: number) => void;
  setTotal: (amount: number) => void;
  setAll: (quantity: number) => void;
  loadLast: (() => void) | null;
}

/** Pacientes por voz (src/lib/voice/commands/patients.ts): la lista y la ficha elegida. */
export interface PatientsVoiceBridge {
  loading: boolean;
  rows: Array<{ id: string; name: string; document: string; phone: string; email: string }>;
  total: number;
  search: (text: string) => void;
  select: (id: string) => void;
  filters: { debtors: boolean; active: boolean; date: string | null };
  setDebtors: ((on: boolean) => void) | null;
  setActive: (on: boolean) => void;
  setDatePreset: (preset: 'today' | 'week' | 'month' | 'allTime') => void;
  clearFilters: () => void;
  refresh: () => void;
  create: (() => void) | null;
  /** La ficha abierta (null: ninguna). */
  selected: { id: string; name: string } | null;
  /** Lo que se sabe del paciente (citas, deuda, pagos…) para contestar preguntas. */
  getFacts: (patient: { id: string; name: string }, needs: Array<'appointments' | 'financial' | 'ledger' | 'treatments'>) => Promise<import('@/services/patient-facts').PatientFacts>;
  tab: 'info' | 'clinical' | 'financial';
  setTab: (tab: 'info' | 'clinical' | 'financial') => void;
  closeDetail: () => void;
  /** Acciones de la ficha; null = no se puede (permiso o sin paciente). */
  actions: {
    edit: (() => void) | null;
    appointment: (() => void) | null;
    quote: (() => void) | null;
    invoice: (() => void) | null;
    prepaid: (() => void) | null;
    bill: (() => void) | null;
    session: (() => void) | null;
    aesthetic: (() => void) | null;
    perio: (() => void) | null;
    odontogram: (() => void) | null;
    document: (() => void) | null;
    instruction: (() => void) | null;
    prescription: (() => void) | null;
    printSummary: (() => void) | null;
    discharge: (() => void) | null;
  };
}

/** La pantalla de órdenes de laboratorio para la voz: lo que se ve y la orden abierta. */
export interface LabOrdersPageVoiceBridge {
  rows: Array<{ id: number; patient: string; laboratory: string; stage: string; work: string; due: string | null; overdue: boolean; urgent: boolean }>;
  selectedId: number | null;
  select: (id: number | null) => void;
}

/** Una tabla de documentos (facturas, pagos, presupuestos) para la voz (src/lib/voice/commands/documents.ts). */
export interface DocumentsVoiceBridge {
  kind: 'invoice' | 'payment' | 'quote';
  isSales: boolean;
  /** Tabla chica (dentro de un detalle): la principal es la que no lo es. */
  compact: boolean;
  rows: Array<{ id: string; docNo: string; party: string; total: number; paid: number | null; currency: string; status: string; paymentStatus: string | null; date: string }>;
  /** Lo que se puede hacer con una fila (null: no en esta tabla o sin permiso). */
  actions: {
    select: ((id: string) => void) | null;
    print: ((id: string) => void) | null;
    email: ((id: string) => void) | null;
    edit: ((id: string) => void) | null;
    confirm: ((id: string) => void) | null;
    reject: ((id: string) => void) | null;
    pay: ((id: string) => void) | null;
    allocate: ((id: string) => void) | null;
  };
  create: (() => void) | null;
  refresh: (() => void) | null;
  exportList: (() => void) | null;
  filters: Array<{ label: string; value: string }>;
  setFilter: ((value: string) => void) | null;
}

/** Un reporte para la voz (src/lib/voice/commands/reports.ts): lo publican las piezas comunes. */
export interface ReportShellVoiceBridge {
  title: string;
  isLoading: boolean;
  hasData: boolean;
  generate: () => void;
  exportPDF: (() => void) | null;
  exportExcel: (() => void) | null;
  exportCSV: (() => void) | null;
  print: (() => void) | null;
}
export interface ReportKpiVoiceBridge { title: string; value: string; subtitle: string }
export interface ReportPeriodVoiceBridge { setRange: (from: Date, to: Date) => void; allTime: (() => void) | null }
export interface ReportTableVoiceBridge { rowCount: number }

/** Una tabla común (DataTable) para la voz (src/lib/voice/commands/crud.ts): altas, abrir, contar. */
export interface CrudVoiceBridge {
  createLabel: string;
  rows: Array<{ id: string; label: string }>;
  total: number;
  create: (() => void) | null;
  open: ((id: string) => void) | null;
  refresh: (() => void) | null;
}
