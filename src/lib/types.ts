

export type User = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  avatar: string;
  identity_document?: string;
  color?: string;
  is_sales?: boolean;
  total_invoiced?: any;
  total_paid?: any;
  current_debt?: any;
  available_balance?: any;
};

export type Debtor = {
  user_id: string;
  patient_name: string;
  email: string;
  identity_document: string;
  currency: 'UYU' | 'USD';
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
};

export type Permission = {
  id: string;
  name: string;
  action: string;
  resource: string;
  description?: string;
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

export type Quote = {
  id: string;
  user_id: string;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'pending' | 'confirmed';
  payment_status: 'unpaid' | 'paid' | 'partial';
  billing_status: string;
  currency?: 'UYU' | 'USD';
  user_name?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt?: string;
};

export type QuoteItem = {
  id: string;
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  total: number;
};

export type Order = {
  id: string;
  user_id: string;
  quote_id: string;
  user_name?: string;
  currency?: 'UYU' | 'USD';
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  scheduled_date?: string;
  completed_date?: string;
  invoiced_date?: string;
};

export type Invoice = {
  id: string;
  order_id: string;
  quote_id: string;
  user_name: string;
  userEmail?: string;
  user_id: string;
  total: number;
  currency?: 'UYU' | 'USD';
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'booked';
  payment_status: 'unpaid' | 'paid' | 'partial' | 'partially_paid';
  paid_amount?: number;
  type?: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  id: string;
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type Payment = {
  id: string;
  order_id: string;
  invoice_id: string;
  quote_id: string;
  user_name: string;
  userEmail?: string;
  payment_date: string;
  amount_applied: number;
  source_amount: number;
  source_currency: 'UYU' | 'USD';
  exchange_rate?: number;
  payment_method: string;
  transaction_type: 'direct_payment' | 'credit_note_allocation' | 'payment_allocation';
  transaction_id: string;
  reference_doc_id?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  amount: number;
  method: string;
  currency?: 'UYU' | 'USD';
};

export type PaymentMethod = {
  id: string;
  name: string;
  code: string;
  is_cash_equivalent: boolean;
  is_active: boolean;
}

export type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  currency?: 'UYU' | 'USD';
  duration_minutes: number;
  description?: string;
  indications?: string;
  is_active: boolean;
  color?: string | null;
  is_sales?: boolean;
};

export type Clinic = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  phone_number: string;
  logo?: string;
  logo_base64?: string;
  currency?: 'UYU' | 'USD';
};

export type ClinicSchedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ClinicException = {
  id: string;
  date: string;
  is_open: boolean;
  start_time?: string;
  end_time?: string;
  notes: string;
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

export type AuditLog = {
  id: string;
  changed_at: string;
  changed_by: string;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
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

export type Appointment = {
  id: string;
  patientName: string;
  patientEmail?: string;
  service_name: string;
  description?: string;
  date: string;
  time: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'pending';
  patientPhone?: string;
  doctorName?: string;
  doctorEmail?: string;
  calendar_id: string;
  calendar_name?: string;
  color?: string;
  colorId?: string;
  start?: any;
  end?: any;
};

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

export type Calendar = {
  id: string;
  name: string;
  google_calendar_id: string;
  is_active: boolean;
  color?: string;
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
};

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
  diagnostico: string | null;
  procedimiento_realizado: string;
  notas_clinicas: string;
  plan_proxima_cita?: string;
  doctor_id: string | null;
  estado_odontograma?: any;
  tratamientos: TreatmentDetail[];
  archivos_adjuntos: AttachedFile[];
};

export type AvailabilityRule = {
  id: string;
  user_id: string;
  user_name?: string;
  recurrence: 'daily' | 'weekly' | 'biweekly';
  day_of_week?: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date?: string;
};

export type AvailabilityException = {
  id: string;
  user_id: string;
  user_name?: string;
  exception_date: string;
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
  estado: 'OPEN' | 'CLOSE';
  fechaApertura: string;
  fechaCierre?: string | null;
  montoApertura: number;
  opening_details?: object | string;
  closing_details?: object | string | null;
  notasCierre?: string | null;
  currencies_data?: Array<{
    currency: 'UYU' | 'USD';
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
};

export type CajaMovimiento = {
  id: string;
  cajaSesionId: string;
  tipo: 'INGRESO' | 'EGRESO';
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO';
  monto: number;
  descripcion: string;
  fecha: string;
  usuarioId: string;
  pagoId?: string;
  currency: 'UYU' | 'USD';
};

export type CashPoint = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  transaction_number: string;
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


export type Credit = {
  source_id: string;
  available_balance: string;
  currency: 'UYU' | 'USD';
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
  days_before?: number;
  days_after?: number;
  recurrence_type?: 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  auto_send_email: boolean;
  auto_send_sms: boolean;
  email_template_id?: string;
  sms_template_id?: string;
  is_active: boolean;
};

export type AlertInstance = {
  id: string;
  rule_id: string;
  rule_name?: string;
  reference_table: string;
  reference_id: string;
  patient_id?: string;
  patient_name?: string;
  alert_date: string;
  event_date?: string;
  title: string;
  summary?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'IGNORED' | 'SNOOZED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigned_to?: string;
  assigned_to_name?: string;
};

export type CommunicationTemplate = {
  id?: string;
  code: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'DOCUMENT' | 'WHATSAPP';
  category_id?: number;
  subject?: string;
  body_html?: string;
  body_text?: string;
  variables_schema?: any;
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
  performed_by: string;
  performed_at: string;
};

export type CommunicationLog = {
  id: string;
  alert_instance_id?: string;
  template_id?: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PRINT';
  recipient_address: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';
  sent_at?: string;
};

export type AlertScheduleRun = {
  id: string;
  run_date: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  alerts_created: number;
  errors_count: number;
};

export type UserAlertPreference = {
  id: string;
  user_id: string;
  category_id?: string;
  rule_id?: string;
  show_in_dashboard: boolean;
  email_notification: boolean;
};
