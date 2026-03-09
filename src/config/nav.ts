
import { ALERT_CENTER_PERMISSIONS, CASHIER_PERMISSIONS, CLINIC_CATALOG_PERMISSIONS, DASHBOARD_PERMISSIONS, DICOM_PERMISSIONS, MEDICAL_HISTORY_PERMISSIONS, PATIENTS_PERMISSIONS, PURCHASES_PERMISSIONS, SALES_PERMISSIONS } from '@/constants/permissions';
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
    title: 'Pacientes',
    href: '/users',
    icon: Users,
    requiredAnyPermission: [
      PATIENTS_PERMISSIONS.VIEW_MENU,
      PATIENTS_PERMISSIONS.VIEW_LIST,
      MEDICAL_HISTORY_PERMISSIONS.VIEW_MENU,
      DICOM_PERMISSIONS.VIEW_MENU,
    ],
    items: [
      { title: 'Pacientes', href: '/users', icon: Users, isChidren: true, requiredPermission: PATIENTS_PERMISSIONS.VIEW_LIST },
      { title: 'ClinicHistory', href: '/clinic-history', icon: HeartPulse, isChidren: true, requiredPermission: MEDICAL_HISTORY_PERMISSIONS.VIEW_MENU },
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
      { title: 'Orders', href: '/sales/orders', icon: ShoppingCart, isChidren: true, requiredPermission: SALES_PERMISSIONS.ORDERS_VIEW_MENU },
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
      { title: 'PurchaseOrders', href: '/purchases/orders', icon: ShoppingCart, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.ORDERS_VIEW_MENU },
      { title: 'PurchaseInvoices', href: '/purchases/invoices', icon: Receipt, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.INVOICES_VIEW_MENU },
      { title: 'PurchasePayments', href: '/purchases/payments', icon: CreditCard, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.PAYMENTS_VIEW_MENU },
      { title: 'Providers', href: '/providers', icon: Briefcase, isChidren: true, requiredPermission: PURCHASES_PERMISSIONS.SUPPLIERS_VIEW_MENU },
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
    items: [
      { title: 'ClinicDetails', href: '/config/clinics', icon: Building, isChidren: true },
      { title: 'Schedules', href: '/config/schedules', icon: CalendarClock, isChidren: true },
      { title: 'Holidays', href: '/config/holidays', icon: CalendarOff, isChidren: true },
      { title: 'Calendars', href: '/config/calendars', icon: Calendar, isChidren: true },
      { title: 'Doctors', href: '/config/doctors', icon: UserSquare, isChidren: true },
      { title: 'DoctorAvailability', href: '/config/doctor-availability', icon: CalendarPlus, isChidren: true },
      { title: 'DoctorAvailabilityExceptions', href: '/config/availability-exceptions', icon: UserX, isChidren: true },
      { title: 'Currencies', href: '/config/currencies', icon: DollarSign, isChidren: true },
      { title: 'Sequences', href: '/config/sequences', icon: List, isChidren: true },
    ],
  },
  {
    title: 'System',
    href: '/system/users',
    icon: Shield,
    items: [
      { title: 'SystemUsers', href: '/system/users', icon: Users, isChidren: true },
      { title: 'Roles', href: '/roles', icon: KeyRound, isChidren: true },
      { title: 'Permissions', href: '/permissions', icon: Shield, isChidren: true },
      { title: '', href: '', icon: Shield, isChidren: false, isSeparator: true },
      { title: 'AlertsConfig', href: '/system/alerts-config', icon: Settings, isChidren: true },
      { title: 'AlertCategories', href: '/system/alert-categories', icon: Layers, isChidren: true },
      { title: 'AlertRules', href: '/system/alert-rules', icon: BotMessageSquare, isChidren: true },
      { title: 'AlertTemplates', href: '/system/communication-templates', icon: BookCopy, isChidren: true },
      { title: 'AlertHistory', href: '/system/communication-history', icon: Mails, isChidren: true },
      { title: 'AlertExecutions', href: '/system/execution-history', icon: FileClock, isChidren: true },
      { title: '', href: '', icon: Shield, isChidren: false, isSeparator: true },
      { title: 'Configurations', href: '/system/config', icon: Settings, isChidren: true },
      { title: 'NotificationSettings', href: '/system/notification-settings', icon: Mails, isChidren: true },
      { title: 'AuditLog', href: '/system/audit', icon: BarChart, isChidren: true },
      { title: 'AccessLog', href: '/system/access', icon: UserCheck, isChidren: true },
      { title: 'ErrorLog', href: '/system/errors', icon: FileWarning, isChidren: true },
    ],
  },
];
