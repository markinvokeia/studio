import type { LucideIcon } from 'lucide-react';
import {
  AreaChart,
  BarChart,
  BotMessageSquare,
  Briefcase,
  Building,
  FileText,
  Home,
  KeyRound,
  MessageSquare,
  Shield,
  Settings,
  Users,
  Wallet,
  FileWarning,
  UserCheck,
  CalendarClock,
  CalendarOff,
  Calendar,
  HeartPulse,
  Pill,
  Smile,
  Layers,
  BookHeart,
  ShoppingCart,
  Receipt,
  CreditCard,
  Radiation,
  Share2,
  CalendarPlus,
  UserX,
  Box,
  History,
  Archive,
  DollarSign,
  UserSquare,
  ShoppingBasket,
} from 'lucide-react';

export interface NavItem {
  title: keyof IntlMessages['Navigation'] | string;
  href: string;
  icon: LucideIcon;
  label?: string;
  items?: NavItem[];
  isChidren?: boolean;
}

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: Home,
  },
  {
    title: 'Cashier',
    href: '/cashier',
    icon: Box,
    items: [
        { title: 'Cashier', href: '/cashier', icon: Box, isChidren: true },
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
    title: 'UsersAndAccess',
    href: '/users',
    icon: Users,
    items: [
      { title: 'Users', href: '/users', icon: Users, isChidren: true },
      { title: 'Providers', href: '/providers', icon: Briefcase, isChidren: true },
      { title: 'ClinicHistory', href: '/clinic-history', icon: HeartPulse, isChidren: true },
      { title: 'Studies', href: '/studies', icon: Radiation, isChidren: true },
      { title: 'SharedStudies', href: '/shared-studies', icon: Share2, isChidren: true },
    ],
  },
  {
    title: 'SalesAndBilling',
    href: '/sales',
    icon: Wallet,
    items: [
      { title: 'Quotes', href: '/sales/quotes', icon: FileText, isChidren: true },
      { title: 'Orders', href: '/sales/orders', icon: ShoppingCart, isChidren: true },
      { title: 'Invoices', href: '/sales/invoices', icon: Receipt, isChidren: true },
      { title: 'Payments', href: '/sales/payments', icon: CreditCard, isChidren: true },
      { title: 'PaymentMethods', href: '/sales/payment-methods', icon: CreditCard, isChidren: true },
      { title: 'Services', href: '/config/services', icon: Briefcase, isChidren: true },
    ],
  },
   {
    title: 'Purchases',
    href: '/purchases/quotes',
    icon: ShoppingBasket,
    items: [
      { title: 'PurchaseQuotes', href: '/purchases/quotes', icon: FileText, isChidren: true },
      { title: 'PurchaseOrders', href: '/purchases/orders', icon: ShoppingCart, isChidren: true },
      { title: 'PurchaseInvoices', href: '/purchases/invoices', icon: Receipt, isChidren: true },
      { title: 'PurchasePayments', href: '/purchases/payments', icon: CreditCard, isChidren: true },
      { title: 'PurchaseServices', href: '/purchases/services', icon: Briefcase, isChidren: true },
    ],
  },
   {
    title: 'ClinicCatalog',
    href: '/clinic-catalog',
    icon: BookHeart,
    items: [
      { title: 'Ailments', href: '/clinic-catalog/ailments', icon: HeartPulse, isChidren: true },
      { title: 'Medications', href: '/clinic-catalog/medications', icon: Pill, isChidren: true },
      { title: 'DentalConditions', href: '/clinic-catalog/dental-conditions', icon: Smile, isChidren: true },
      { title: 'DentalSurfaces', href: '/clinic-catalog/dental-surfaces', icon: Layers, isChidren: true },
    ],
  },
  {
    title: 'BusinessSetup',
    href: '/config',
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
    ],
  },
  {
    title: 'System',
    href: '/system',
    icon: Shield,
    items: [
      { title: 'Roles', href: '/roles', icon: KeyRound, isChidren: true },
      { title: 'Permissions', href: '/permissions', icon: Shield, isChidren: true },
      { title: 'Configurations', href: '/system/config', icon: Settings, isChidren: true },
      { title: 'AuditLog', href: '/system/audit', icon: BarChart, isChidren: true },
      { title: 'AccessLog', href: '/system/access', icon: UserCheck, isChidren: true },
      { title: 'ErrorLog', href: '/system/errors', icon: FileWarning, isChidren: true },
    ],
  },
];
