

export type User = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  is_active: boolean;
  avatar: string;
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
  user_name?: string;
  userEmail?: string;
  createdAt: string;
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
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
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
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  createdAt: string;
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
  amount: number;
  method: 'credit_card' | 'bank_transfer' | 'cash';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
};

export type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
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
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  user_id?: string;
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
};

export type Appointment = {
  id: string;
  user_name?: string;
  service_name: string;
  date: string;
  time: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'pending';
};

export type UserLog = {
  id: string;
  timestamp: string;
  action: string;
  details: string;
};
