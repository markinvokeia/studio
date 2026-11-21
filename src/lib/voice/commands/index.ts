/**
 * Registra todos los comandos de voz. Lo importa el host (VoiceCommandHost); cada módulo nuevo
 * agrega su archivo acá.
 */
import '@/lib/voice/commands/core';
import '@/lib/voice/commands/navigation';
import '@/lib/voice/commands/screen';
import '@/lib/voice/commands/rail';
import '@/lib/voice/commands/billing';
import '@/lib/voice/commands/dashboard';
import '@/lib/voice/commands/workspace';
import '@/lib/voice/commands/workspace-agent';
import '@/lib/voice/commands/alerts';
import '@/lib/voice/commands/cashier';
import '@/lib/voice/commands/patients';
import '@/lib/voice/commands/documents';
import '@/lib/voice/commands/reports';
import '@/lib/voice/commands/crud';
import '@/lib/voice/commands/table';
import '@/lib/voice/commands/lab-orders';
import '@/lib/voice/commands/lab-orders-create';
import '@/lib/voice/commands/lab-orders-manage';
import '@/lib/voice/commands/lab-orders-edit';
import '@/lib/voice/commands/lab-orders-pick';
import '@/lib/voice/commands/perio';
import '@/lib/voice/commands/perio-dictate';
import '@/lib/voice/commands/calendar';
import '@/lib/voice/commands/calendar-query';
import '@/lib/voice/commands/calendar-manage';
import '@/lib/voice/commands/calendar-actions';
import '@/lib/voice/commands/calendar-agent';
