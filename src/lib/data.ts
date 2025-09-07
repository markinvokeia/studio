
import {
  User,
  Role,
  Permission,
  Service,
  Clinic,
  Quote,
  Conversation,
  CommunicationChannel,
  SystemConfiguration,
  AuditLog,
  AccessLog,
  ErrorLog,
  MedicalEvent,
  Message,
  Appointment,
  UserLog,
  PatientDemographics,
} from './types';

export const statsData = [
  {
    title: 'Total Revenue',
    value: '$45,231.89',
    change: '+20.1% from last month',
    icon: 'dollar-sign',
  },
  {
    title: 'Subscriptions',
    value: '+2350',
    change: '+180.1% from last month',
    icon: 'users',
  },
  {
    title: 'Sales',
    value: '+12,234',
    change: '+19% from last month',
    icon: 'credit-card',
  },
  {
    title: 'Active Now',
    value: '+573',
    change: '+201 since last hour',
    icon: 'activity',
  },
];

export const revenueChartData = [
  { month: 'Jan', revenue: 4500 },
  { month: 'Feb', revenue: 4200 },
  { month: 'Mar', revenue: 5800 },
  { month: 'Apr', revenue: 5000 },
  { month: 'May', revenue: 6200 },
  { month: 'Jun', revenue: 7800 },
  { month: 'Jul', revenue: 7500 },
  { month: 'Aug', revenue: 8100 },
  { month: 'Sep', revenue: 8500 },
  { month: 'Oct', revenue: 9200 },
  { month: 'Nov', revenue: 8800 },
  { month: 'Dec', revenue: 9500 },
];

export const salesByServiceData = [
    { name: 'Service A', sales: 400, fill: "var(--color-chart-1)" },
    { name: 'Service B', sales: 300, fill: "var(--color-chart-2)" },
    { name: 'Service C', sales: 200, fill: "var(--color-chart-3)" },
    { name: 'Service D', sales: 278, fill: "var(--color-chart-4)" },
    { name: 'Service E', sales: 189, fill: "var(--color-chart-5)" },
];

export const users: User[] = [
  { id: 'usr_1', name: 'Alice Johnson', email: 'alice@example.com', phone_number: '123-456-7890', is_active: true, avatar: 'https://picsum.photos/id/1011/40/40' },
  { id: 'usr_2', name: 'Bob Williams', email: 'bob@example.com', phone_number: '234-567-8901', is_active: false, avatar: 'https://picsum.photos/id/1012/40/40' },
  { id: 'usr_3', name: 'Charlie Brown', email: 'charlie@example.com', phone_number: '345-678-9012', is_active: true, avatar: 'https://picsum.photos/id/1013/40/40' },
  { id: 'usr_4', name: 'Diana Miller', email: 'diana@example.com', phone_number: '456-789-0123', is_active: true, avatar: 'https://picsum.photos/id/1014/40/40' },
  { id: 'usr_5', name: 'Ethan Davis', email: 'ethan@example.com', phone_number: '567-890-1234', is_active: false, avatar: 'https://picsum.photos/id/1015/40/40' },
];

export const roles: Role[] = [
  { id: 'rol_1', name: 'Admin' },
  { id: 'rol_2', name: 'Sales Manager' },
  { id: 'rol_3', name: 'Support Agent' },
  { id: 'rol_4', name: 'Accountant' },
];

export const permissions: Permission[] = [
  { id: 'perm_1', name: 'Create User', action: 'create', resource: 'user', description: 'Allows creating new users.' },
  { id: 'perm_2', name: 'Read User', action: 'read', resource: 'user', description: 'Allows viewing user profiles.' },
  { id: 'perm_3', name: 'Update User', action: 'update', resource: 'user', description: 'Allows editing user details.' },
  { id: 'perm_4', name: 'Delete User', action: 'delete', resource: 'user', description: 'Allows deleting users.' },
  { id: 'perm_5', name: 'Manage Billing', action: 'manage', resource: 'billing', description: 'Full access to billing and invoices.' },
];

export const services: Service[] = [
  { id: 'srv_1', name: 'Initial Consultation', category: 'Consulting', price: 150, duration_minutes: 60 },
  { id: 'srv_2', name: 'Advanced SEO Package', category: 'Marketing', price: 1200, duration_minutes: 0 },
  { id: 'srv_3', name: 'Web Development', category: 'Development', price: 5000, duration_minutes: 0 },
  { id: 'srv_4', name: 'Support Retainer', category: 'Support', price: 500, duration_minutes: 0 },
];

export const clinics: Clinic[] = [
  { id: 'cli_1', name: 'Downtown Branch', location: '123 Main St, Anytown', contact_email: 'downtown@clinic.com', phone_number: '111-222-3333' },
  { id: 'cli_2', name: 'Uptown Clinic', location: '456 Oak Ave, Anytown', contact_email: 'uptown@clinic.com', phone_number: '444-555-6666' },
];

export const quotes: Quote[] = [
  { id: 'qt_1', user_id: 'usr_1', total: 1500, status: 'accepted', payment_status: 'paid', billing_status: 'invoiced', userName: 'Alice Johnson', userEmail: 'alice@example.com', createdAt: '2023-10-01' },
  { id: 'qt_2', user_id: 'usr_2', total: 500, status: 'sent', payment_status: 'unpaid', billing_status: 'not invoiced', userName: 'Bob Williams', userEmail: 'bob@example.com', createdAt: '2023-10-05' },
  { id: 'qt_3', user_id: 'usr_3', total: 7500, status: 'draft', payment_status: 'unpaid', billing_status: 'not invoiced', userName: 'Charlie Brown', userEmail: 'charlie@example.com', createdAt: '2023-10-10' },
  { id: 'qt_4', user_id: 'usr_4', total: 300, status: 'accepted', payment_status: 'partial', billing_status: 'partially invoiced', userName: 'Diana Miller', userEmail: 'diana@example.com', createdAt: '2023-10-12' },
  { id: 'qt_5', user_id: 'usr_5', total: 2500, status: 'rejected', payment_status: 'unpaid', billing_status: 'not invoiced', userName: 'Ethan Davis', userEmail: 'ethan@example.com', createdAt: '2023-10-15' },
];

export const conversations: Conversation[] = [
  { id: 'conv_1', subject: 'Question about billing', user_id: 'usr_1', channel_id: 'chan_1', status: 'open' },
  { id: 'conv_2', subject: 'Technical support needed', user_id: 'usr_3', channel_id: 'chan_2', status: 'closed' },
];

export const communicationChannels: CommunicationChannel[] = [
  { id: 'chan_1', name: 'Support Email', channel_type: 'email', is_active: true },
  { id: 'chan_2', name: 'Live Chat', channel_type: 'chat', is_active: true },
  { id: 'chan_3', name: 'SMS Alerts', channel_type: 'sms', is_active: false },
];

export const systemConfigurations: SystemConfiguration[] = [
  { id: 'cfg_1', key: 'API_ENDPOINT', value: 'https://api.example.com', data_type: 'string', updated_by: 'usr_1' },
  { id: 'cfg_2', key: 'MAINTENANCE_MODE', value: 'false', data_type: 'boolean', updated_by: 'usr_1' },
  { id: 'cfg_3', key: 'SESSION_TIMEOUT', value: '3600', data_type: 'number', updated_by: 'usr_1' },
];

export const auditLogs: AuditLog[] = [
  { id: 'aud_1', changed_at: '2023-10-26T10:00:00Z', changed_by: 'usr_1', table_name: 'users', record_id: 'usr_2', operation: 'update', old_value: {}, new_value: {} },
  { id: 'aud_2', changed_at: '2023-10-26T10:05:00Z', changed_by: 'usr_1', table_name: 'roles', record_id: 'rol_3', operation: 'create', old_value: {}, new_value: {} },
];

export const accessLogs: AccessLog[] = [
  { id: 'acc_1', user_id: 'usr_1', timestamp: '2023-10-26T09:00:00Z', action: 'login', success: true, ip_address: '192.168.1.1' },
  { id: 'acc_2', user_id: 'usr_2', timestamp: '2023-10-26T09:05:00Z', action: 'failed_login', success: false, ip_address: '198.51.100.2' },
];

export const errorLogs: ErrorLog[] = [
  { id: 'err_1', created_at: '2023-10-26T11:00:00Z', severity: 'error', message: 'Database connection failed', user_id: 'system' },
  { id: 'err_2', created_at: '2023-10-26T11:02:00Z', severity: 'warning', message: 'API response time exceeded threshold', user_id: 'usr_4' },
];

export const medicalHistory: MedicalEvent[] = [
  {
    id: 'evt_1',
    date: '2023-01-15',
    title: 'Annual Check-up',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Routine annual physical examination. All vitals normal.',
    details: 'Patient presented for annual check-up. Blood pressure 120/80. Heart rate 70 bpm. No acute complaints. <strong>Advised to continue current medication and diet plan.</strong> Follow-up in one year.',
    eventType: 'appointment',
  },
  {
    id: 'evt_2',
    date: '2023-03-22',
    title: 'Blood Test',
    doctor: 'Dr. Samuel Carter',
    summary: 'Complete blood count (CBC). Results within normal range.',
    details: 'CBC ordered by Dr. Reed. All markers within normal limits. Cholesterol levels show slight improvement. <strong>Patient commended for adherence to diet.</strong>',
    eventType: 'test',
  },
  {
    id: 'evt_3',
    date: '2023-05-30',
    title: 'X-Ray',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Chest X-ray due to persistent cough. No abnormalities found.',
    details: 'Patient reported a persistent dry cough for 3 weeks. Chest X-ray was clear. Diagnosis: Post-viral cough. <strong>Prescribed cough suppressant and advised rest.</strong>',
    eventType: 'procedure',
  },
  {
    id: 'evt_4',
    date: '2023-06-05',
    title: 'Prescription Refill',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Refilled prescription for hypertension medication.',
    details: 'Lisinopril (10mg) prescription refilled for 3 months. <strong>Patient reminded to monitor blood pressure at home.</strong>',
    eventType: 'prescription',
  },
  {
    id: 'evt_5',
    date: '2023-09-10',
    title: 'Follow-up Consultation',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Follow-up regarding hypertension. Blood pressure stable.',
    details: 'Patient\'s home blood pressure readings are stable. No side effects reported from medication. Continue current treatment plan. <strong>Next follow-up scheduled in 6 months.</strong>',
    eventType: 'appointment',
  },
  {
    id: 'evt_6',
    date: '2023-11-20',
    title: 'Flu Shot',
    doctor: 'Nurse Alice Faye',
    summary: 'Seasonal influenza vaccination administered.',
    details: 'Patient received the quadrivalent influenza vaccine in the left deltoid. No immediate adverse reaction. <strong>Post-vaccination instructions provided.</strong>',
    eventType: 'procedure',
  },
  {
    id: 'evt_7',
    date: '2024-01-18',
    title: 'Annual Check-up',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Routine annual physical. Recommended increase in physical activity.',
    details: 'Vitals stable. Patient reports feeling well. Discussed importance of regular exercise. <strong>Goal set for 30 minutes of moderate activity, 3-4 times a week.</strong>',
    eventType: 'appointment'
  },
  {
    id: 'evt_8',
    date: '2024-02-25',
    title: 'Patient Note',
    doctor: 'Dr. Evelyn Reed',
    summary: 'Patient reports feeling well and adhering to medication schedule.',
    details: 'Patient called to confirm next appointment. Reports no new issues and is adherent to all prescribed medications and lifestyle recommendations. <strong>No changes to plan of care needed at this time.</strong>',
    eventType: 'note'
  },
];


export const messages: Message[] = [
    { id: 'msg_1', user_id: 'mock_user', sender: 'user', content: 'Hello, I have a question about my bill.', timestamp: '2024-05-15T10:30:00Z' },
    { id: 'msg_2', user_id: 'mock_user', sender: 'system', content: 'Of course, I can help with that. What is your question?', timestamp: '2024-05-15T10:30:45Z' },
    { id: 'msg_3', user_id: 'mock_user', sender: 'user', content: 'I see a charge from last week that I don\'t recognize.', timestamp: '2024-05-15T10:31:20Z' },
    { id: 'msg_4', user_id: 'mock_user', sender: 'system', content: 'I can look into that for you. Can you provide the date and amount of the charge?', timestamp: '2024-05-15T10:32:00Z' },
    { id: 'msg_5', user_id: 'mock_user', sender: 'user', content: 'It was for $45.50 on May 8th.', timestamp: '2024-05-15T10:33:10Z' },
    { id: 'msg_6', user_id: 'mock_user', sender: 'system', content: 'Thank you. One moment while I pull up that transaction... I see it was for a co-payment for your visit with Dr. Smith. Does that sound correct?', timestamp: '2024-05-15T10:34:00Z' },
    { id: 'msg_7', user_id: 'mock_user', sender: 'user', content: 'Oh, right! I completely forgot. Thanks for clarifying.', timestamp: '2024-05-15T10:34:50Z' },
    { id: 'msg_8', user_id: 'mock_user', sender: 'system', content: 'You\'re welcome! Is there anything else I can help you with today?', timestamp: '2024-05-15T10:35:15Z' },
    { id: 'msg_9', user_id: 'another_user', sender: 'user', content: 'I need to reschedule my appointment.', timestamp: '2024-05-16T11:00:00Z' },
    { id: 'msg_10', user_id: 'another_user', sender: 'system', content: 'I can help with that. Which appointment would you like to reschedule?', timestamp: '2024-05-16T11:00:30Z' }
];



export const appointments: Appointment[] = [
  { id: 'apt_1', user_name: 'Alice Johnson', service_name: 'Initial Consultation', date: '2024-06-01', time: '10:00:00', status: 'completed' },
  { id: 'apt_2', user_name: 'Bob Williams', service_name: 'Follow-up', date: '2024-06-15', time: '14:30:00', status: 'confirmed' },
  { id: 'apt_3', user_name: 'Charlie Brown', service_name: 'Dental Cleaning', date: '2024-07-01', time: '11:00:00', status: 'confirmed' },
  { id: 'apt_4', user_name: 'Diana Miller', service_name: 'Check-up', date: '2024-05-20', time: '09:00:00', status: 'cancelled' },
  { id: 'apt_5', user_name: 'Ethan Davis', service_name: 'Teeth Whitening', date: '2024-08-01', time: '16:00:00', status: 'pending' },
  { id: 'apt_6', user_name: 'Alice Johnson', service_name: 'Dental Cleaning', date: '2024-07-10', time: '09:30:00', status: 'confirmed' },
  { id: 'apt_7', user_name: 'Charlie Brown', service_name: 'Follow-up', date: '2024-07-22', time: '15:00:00', status: 'confirmed' },
];

export const userLogs: UserLog[] = [
  { id: 'log_1', timestamp: '2024-06-01T10:00:00Z', action: 'User Login', details: 'Successful login from IP 192.168.1.1' },
  { id: 'log_2', timestamp: '2024-06-01T10:05:00Z', action: 'Profile Update', details: 'Changed phone number.' },
  { id: 'log_3', timestamp: '2024-06-02T14:00:00Z', action: 'Quote Created', details: 'Created quote #QT-2024-001' },
  { id: 'log_4', timestamp: '2024-06-03T16:30:00Z', action: 'Password Reset', details: 'Password reset requested from email.' },
  { id: 'log_5', timestamp: '2024-06-04T09:00:00Z', action: 'User Logout', details: 'User logged out.' },
];

export const patientDemographicsData: PatientDemographics = {
    total: 215,
    data: [
        { type: 'New', count: 86, fill: 'hsl(var(--chart-1))' },
        { type: 'Recurrent', count: 129, fill: 'hsl(var(--chart-2))' },
    ]
};
