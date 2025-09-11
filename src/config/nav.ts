
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
} from 'lucide-react';

export interface NavItem {
  title: string;
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
    title: 'Users & Access',
    href: '/users',
    icon: Users,
    items: [
      { title: 'Users', href: '/users', icon: Users, isChidren: true },
      { title: 'Clinic History', href: '/clinic-history/1', icon: HeartPulse, isChidren: true },
    ],
  },
  {
    title: 'Sales & Billing',
    href: '/sales',
    icon: Wallet,
    items: [
      { title: 'Quotes', href: '/sales/quotes', icon: FileText, isChidren: true },
    ],
  },
   {
    title: 'Clinic Catalog',
    href: '/clinic-catalog',
    icon: BookHeart,
    items: [
      { title: 'Ailments', href: '/clinic-catalog/ailments', icon: HeartPulse, isChidren: true },
      { title: 'Medications', href: '/clinic-catalog/medications', icon: Pill, isChidren: true },
      { title: 'Dental Conditions', href: '/clinic-catalog/dental-conditions', icon: Smile, isChidren: true },
      { title: 'Dental Surfaces', href: '/clinic-catalog/dental-surfaces', icon: Layers, isChidren: true },
    ],
  },
  {
    title: 'Business Setup',
    href: '/config',
    icon: Settings,
    items: [
      { title: 'Services', href: '/config/services', icon: Briefcase, isChidren: true },
      { title: 'Clinic Details', href: '/config/clinics', icon: Building, isChidren: true },
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
      { title: 'Audit Log', href: '/system/audit', icon: BarChart, isChidren: true },
      { title: 'Access Log', href: '/system/access', icon: UserCheck, isChidren: true },
      { title: 'Error Log', href: '/system/errors', icon: FileWarning, isChidren: true },
    ],
  },
];
