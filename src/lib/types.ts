
export type User = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  avatar: string;
  identity_document?: string;
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
  user_id: string;
  role_id: string;
  is_active: boolean;
  name: string;
};

export type UserRoleAssignment = {
    user_id: string;
    role_ids: string[];
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
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  payment_status: 'unpaid' | 'paid' | 'partial';
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
  amount: number;
  method: 'credit_card' | 'bank_transfer' | 'cash';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
  description?: string;
  indications?: string;
};

export type Clinic = {
  id: string;
  name: string;
  location: string;
  contact_email: string;
  phone_number: string;
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
  service_name: string;
  date: string;
  time: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'pending';
  patientPhone?: string;
  doctorName?: string;
  calendar_id: string;
  calendar_name?: string;
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
  diente_asociado: number | null;
  ruta: string;
  tipo: string;
};

export type PatientSession = {
  sesion_id: number;
  tipo_sesion?: 'odontograma' | 'clinica';
  fecha_sesion: string;
  diagnostico: string | null;
  procedimiento_realizado: string;
  notas_clinicas: string;
  doctor_id: string | null;
  estado_odontograma?: any;
  tratamientos: TreatmentDetail[];
  archivos_adjuntos: AttachedFile[];
};
