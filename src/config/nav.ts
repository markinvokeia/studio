
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
      { title: 'Clinic-History', href: '/clinic-history', icon: HeartPulse, isChidren: true },
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
      { title: 'Services', href: '/config/services', icon: Briefcase, isChidren: true },
      { title: 'ClinicDetails', href: '/config/clinics', icon: Building, isChidren: true },
      { title: 'Schedules', href: '/config/schedules', icon: CalendarClock, isChidren: true },
      { title: 'Holidays', href: '/config/holidays', icon: CalendarOff, isChidren: true },
      { title: 'Calendars', href: '/config/calendars', icon: Calendar, isChidren: true },
    ],
  },
  {
    title: 'Communications',
    href: '/communications',
    icon: MessageSquare,
    items: [
      { title: 'Conversations', href: '/communications', icon: MessageSquare, isChidren: true },
      { title: 'Channels', href: '/communications/channels', icon: BotMessageSquare, isChidren: true },
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
