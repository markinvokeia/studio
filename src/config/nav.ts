
import { ALERT_CENTER_PERMISSIONS, BUSINESS_CONFIG_PERMISSIONS, CASHIER_PERMISSIONS, CLINIC_CATALOG_PERMISSIONS, DASHBOARD_PERMISSIONS, DICOM_PERMISSIONS, MEDICAL_HISTORY_PERMISSIONS, PATIENTS_PERMISSIONS, PURCHASES_PERMISSIONS, SALES_PERMISSIONS, SYSTEM_PERMISSIONS, TV_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BarChart,
  BellRing,
  BookCopy,
  BookHeart,
  BotMessageSquare,
  Box,
  Briefcase,
  Building,
  Calendar,
  CalendarClock,
  CalendarOff,
  CalendarPlus,
  Coins,
  CreditCard,
  DollarSign,
  FileClock,
  FileText,
  FileWarning,
  Handshake,
  HeartPulse,
  History,
  Home,
  KeyRound,
  Layers,
  List,
  Mails,
  Pill,
  Radiation,
  Receipt,
  Settings,
  Share2,
  Shield,
  ShoppingBasket,
  ShoppingCart,
  Smile,
  Tags,
  Tv,
  Upload,
  UserCheck,
  Users,
  UserSquare,
  UserX,
  Wallet
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  label?: string;
  items?: NavItem[];
  isChidren?: boolean;
  isSeparator?: boolean;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requiredAnyPermission?: string[];
  requiredRole?: string;
}

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: Home,
    requiredPermission: DASHBOARD_PERMISSIONS.VIEW_MENU,
  },
  {
    title: 'AlertsCenter',
    href: '/alerts',
    icon: BellRing,
    requiredPermission: ALERT_CENTER_PERMISSIONS.VIEW_MENU,
  },
  {
    title: 'Cashier',
    href: '/cashier',
    icon: Box,
    requiredPermission: CASHIER_PERMISSIONS.VIEW_MENU,
    items: [
      { title: 'Cashier', href: '/cashier', icon: Box, isChidren: true },
      { title: 'MiscellaneousTransactions', href: '/cashier/miscellaneous-transactions', icon: Coins, isChidren: true },
      { title: 'MiscellaneousCategories', href: '/cashier/miscellaneous-categories', icon: Tags, isChidren: true },
      { title: 'CashSessions', href: '/cashier/sessions', icon: History, isChidren: true },
      { title: 'PhysicalCashRegisters', href: '/cashier/cash-points', icon: Archive, isChidren: true },
    ],
  },
  {
    title: 'Appointments',
    href: '/appointments',
    icon: Calendar,
  },
  {
    title: 'TVDisplay',
    href: '/tv-display',
    icon: Tv,
    requiredPermission: TV_DISPLAY_PERMISSIONS.VIEW_MENU,
  },
  {
    title: 'Pacientes',
    href: '/patients',
    icon: Users,
    requiredAnyPermission: [
      PATIENTS_PERMISSIONS.VIEW_MENU,
      PATIENTS_PERMISSIONS.VIEW_LIST,
      MEDICAL_HISTORY_PERMISSIONS.VIEW_MENU,
      DICOM_PERMISSIONS.VIEW_MENU,
    ],
    items: [
      { title: 'Pacientes', href: '/patients', icon: Users, isChidren: true, requiredPermission: PATIENTS_PERMISSIONS.VIEW_LIST },
      { title: 'Studies', href: '/studies', icon: Radiation, isChidren: true, requiredPermission: DICOM_PERMISSIONS.VIEW_MENU },
      { title: 'SharedStudies', href: '/shared-studies', icon: Share2, isChidren: true, requiredPermission: DICOM_PERMISSIONS.VIEW_MENU },
    ],
  },
  {
    title: 'Sales',
    href: '/sales/quotes',
    icon: Wallet,
    requiredAnyPermission: [
      SALES_PERMISSIONS.QUOTES_VIEW_MENU,
      SALES_PERMISSIONS.ORDERS_VIEW_MENU,
      SALES_PERMISSIONS.INVOICES_VIEW_MENU,
      SALES_PERMISSIONS.PAYMENTS_VIEW_MENU,
      SALES_PERMISSIONS.PAYMENT_METHODS_VIEW_MENU,
      SALES_PERMISSIONS.SERVICES_VIEW_MENU,
    ],
    items: [
      { title: 'Quotes', href: '/sales/quotes', icon: FileText, isChidren: true, requiredPermission: SALES_PERMISSIONS.QUOTES_VIEW_MENU },
      // hidden: orders tab { title: 'Orders', href: '/sales/orders', icon: ShoppingCart, isChidren: true, requiredPermission: SALES_PERMISSIONS.ORDERS_VIEW_MENU },
      { title: 'Invoices', href: '/sales/invoices', icon: Receipt, isChidren: true, requiredPermission: SALES_PERMISSIONS.INVOICES_VIEW_MENU },
      { title: 'Payments', href: '/sales/payments', icon: CreditCard, isChidren: true, requiredPermission: SALES_PERMISSIONS.PAYMENTS_VIEW_MENU },
      { title: 'PaymentMethods', href: '/sales/payment-methods', icon: CreditCard, isChidren: true, requiredPermission: SALES_PERMISSIONS.PAYMENT_METHODS_VIEW_MENU },
      { title: 'Services', href: '/sales/services', icon: Briefcase, isChidren: true, requiredPermission: SALES_PERMISSIONS.SERVICES_VIEW_MENU },
    ],
  },
  {
    title: 'Purchases',
    href: '/purchases/quotes',
    icon: ShoppingBasket,
    requiredAnyPermission: [
      PURCHASES_PERMISSIONS.INVOICES_VIEW_MENU,
      PURCHASES_PERMISSIONS.QUOTES_VIEW_MENU,
      PURCHASES_PERMISSIONS.ORDERS_VIEW_MENU,
      PURCHASES_PERMISSIONS.PAYMENTS_VIEW_MENU,
      PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_MENU,
      PURCHASES_PERMISSIONS.PRODUCTS_VIEW_MENU,
    ],
    items: [
      { title: 'PurchaseQuotes', href: '/purchases/quotes', icon: FileText, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.QUOTES_VIEW_MENU },
      // hidden: orders tab { title: 'PurchaseOrders', href: '/purchases/orders', icon: ShoppingCart, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.ORDERS_VIEW_MENU },
      { title: 'PurchaseInvoices', href: '/purchases/invoices', icon: Receipt, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.INVOICES_VIEW_MENU },
      { title: 'PurchasePayments', href: '/purchases/payments', icon: CreditCard, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.PAYMENTS_VIEW_MENU },
      { title: 'Providers', href: '/purchases/providers', icon: Briefcase, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_MENU },
      { title: 'ProviderProducts', href: '/purchases/services', icon: Briefcase, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.PRODUCTS_VIEW_MENU },
    ],
  },
  {
    title: 'ClinicCatalog',
    href: '/clinic-catalog/ailments',
    icon: BookHeart,
    requiredAnyPermission: [
      CLINIC_CATALOG_PERMISSIONS.CONDITIONS_VIEW_LIST,
      CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_VIEW_LIST,
      CLINIC_CATALOG_PERMISSIONS.DENTAL_COND_VIEW_LIST,
      CLINIC_CATALOG_PERMISSIONS.DENTAL_SURF_VIEW_LIST,
    ],
    items: [
      { title: 'Ailments', href: '/clinic-catalog/ailments', icon: HeartPulse, isChidren: true, requiredPermission: CLINIC_CATALOG_PERMISSIONS.CONDITIONS_VIEW_LIST },
      { title: 'Medications', href: '/clinic-catalog/medications', icon: Pill, isChidren: true, requiredPermission: CLINIC_CATALOG_PERMISSIONS.MEDICATIONS_VIEW_LIST },
      { title: 'DentalConditions', href: '/clinic-catalog/dental-conditions', icon: Smile, isChidren: true, requiredPermission: CLINIC_CATALOG_PERMISSIONS.DENTAL_COND_VIEW_LIST },
      { title: 'DentalSurfaces', href: '/clinic-catalog/dental-surfaces', icon: Layers, isChidren: true, requiredPermission: CLINIC_CATALOG_PERMISSIONS.DENTAL_SURF_VIEW_LIST },
    ],
  },
  {
    title: 'BusinessSetup',
    href: '/config/clinics',
    icon: Settings,
    requiredAnyPermission: [
      BUSINESS_CONFIG_PERMISSIONS.VIEW_MENU,
      BUSINESS_CONFIG_PERMISSIONS.CLINIC_DETAILS_VIEW,
      BUSINESS_CONFIG_PERMISSIONS.SCHEDULES_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.CALENDARS_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.DOCTORS_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_RULES_VIEW,
      BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_EXCEPTIONS_VIEW,
      BUSINESS_CONFIG_PERMISSIONS.CURRENCIES_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.SEQUENCES_VIEW_LIST,
      BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_VIEW_LIST,
    ],
    items: [
      { title: 'ClinicDetails', href: '/config/clinics', icon: Building, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.CLINIC_DETAILS_VIEW },
      { title: 'Schedules', href: '/config/schedules', icon: CalendarClock, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.SCHEDULES_VIEW_LIST },
      { title: 'Holidays', href: '/config/holidays', icon: CalendarOff, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.HOLIDAYS_VIEW_LIST },
      { title: 'Calendars', href: '/config/calendars', icon: Calendar, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.CALENDARS_VIEW_LIST },
      { title: 'Doctors', href: '/config/doctors', icon: UserSquare, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.DOCTORS_VIEW_LIST },
      { title: 'DoctorAvailability', href: '/config/doctor-availability', icon: CalendarPlus, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_RULES_VIEW },
      { title: 'DoctorAvailabilityExceptions', href: '/config/availability-exceptions', icon: UserX, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.AVAILABILITY_EXCEPTIONS_VIEW },
      { title: 'Currencies', href: '/config/currencies', icon: DollarSign, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.CURRENCIES_VIEW_LIST },
      { title: 'Sequences', href: '/config/sequences', icon: List, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.SEQUENCES_VIEW_LIST },
      { title: 'MutualSocieties', href: '/config/mutual-societies', icon: Handshake, isChidren: true, requiredPermission: BUSINESS_CONFIG_PERMISSIONS.MUTUAL_SOC_VIEW_MENU },
    ],
  },
  {
    title: 'System',
    href: '/system/users',
    icon: Shield,
    requiredPermission: SYSTEM_PERMISSIONS.VIEW_MENU,
    items: [
      { title: 'SystemUsers', href: '/system/users', icon: Users, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.USERS_VIEW_MENU },
      { title: 'Roles', href: '/roles', icon: KeyRound, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ROLES_VIEW_MENU },
      { title: 'Permissions', href: '/permissions', icon: Shield, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.PERMISSIONS_VIEW_MENU },
      { title: '', href: '', icon: Shield, isChidren: false, isSeparator: true },
      { title: 'AlertsConfig', href: '/system/alerts-config', icon: Settings, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_CONFIG_VIEW_MENU },
      { title: 'AlertCategories', href: '/system/alert-categories', icon: Layers, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_CATEGORIES_VIEW_MENU },
      { title: 'AlertRules', href: '/system/alert-rules', icon: BotMessageSquare, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_RULES_VIEW_MENU },
      { title: 'AlertTemplates', href: '/system/communication-templates', icon: BookCopy, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_TEMPLATES_VIEW_MENU },
      { title: 'AlertHistory', href: '/system/communication-history', icon: Mails, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_HISTORY_VIEW_MENU },
      { title: 'AlertExecutions', href: '/system/execution-history', icon: FileClock, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ALERT_EXECUTIONS_VIEW_MENU },
      { title: '', href: '', icon: Shield, isChidren: false, isSeparator: true },
      { title: 'Configurations', href: '/system/config', icon: Settings, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.SYS_CONFIG_VIEW_MENU },
      { title: 'NotificationSettings', href: '/system/notification-settings', icon: Mails, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.NOTIFICATION_SETTINGS_VIEW_MENU },
      { title: 'AuditLog', href: '/system/audit', icon: BarChart, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.AUDIT_LOG_VIEW_MENU },
      { title: 'AccessLog', href: '/system/access', icon: UserCheck, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ACCESS_LOG_VIEW_MENU },
      { title: 'ErrorLog', href: '/system/errors', icon: FileWarning, isChidren: true, requiredPermission: SYSTEM_PERMISSIONS.ERROR_LOG_VIEW_MENU },
      { title: '', href: '', icon: Shield, isChidren: false, isSeparator: true },
      { title: 'ImportData', href: '/system/import', icon: Upload, isChidren: true },
    ],
  },
];
