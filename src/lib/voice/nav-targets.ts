import { normalizeSpeech } from '@/lib/voice/parse';

import { navItems, type NavItem } from '@/config/nav';

/**
 * Destinos del menú principal para la voz («andá a pacientes», «llevame a reportes de deudores»,
 * «go to the cashier»). Salen de src/config/nav.ts (rutas y permisos) con el nombre del menú en el
 * idioma de la app y sinónimos en español e inglés.
 */
export interface NavTarget {
  /** Clave del menú (`Navigation.<key>`). */
  key: string;
  href: string;
  /** Nombre como se ve en el menú. */
  label: string;
  /** Sección del menú a la que pertenece (Ventas, Reportes…). */
  parent?: string;
  parentKey?: string;
  /** Lo que se puede decir para llegar, ya normalizado. */
  names: string[];
}

/** Otras formas de nombrar cada destino (español e inglés, sin tildes). */
const SYNONYMS: Record<string, string[]> = {
  Dashboard: ['inicio', 'home', 'panel de control', 'tablero', 'dashboard', 'pantalla principal', 'principal', 'main page', 'home page', 'control panel', 'start page'],
  DoctorWorkspace: ['mi consultorio', 'consultorio', 'workspace', 'my workspace', 'my office', 'doctor workspace', 'espacio del doctor', 'mi espacio'],
  AlertsCenter: ['centro de alertas', 'alertas', 'alerts', 'alert center', 'alerts center'],
  Cashier: ['caja', 'cashier', 'cash desk', 'checkout', 'till'],
  MiscellaneousTransactions: ['transacciones varias', 'movimientos varios', 'miscellaneous transactions', 'other transactions', 'transacciones miscelaneas'],
  MiscellaneousCategories: ['categorias de caja', 'categorias de productos y servicios', 'miscellaneous categories', 'product and services categories', 'products and services categories'],
  CashSessions: ['sesiones de caja', 'cash sessions', 'turnos de caja', 'cierres de caja'],
  PhysicalCashRegisters: ['cajas registradoras', 'cajas fisicas', 'puntos de caja', 'cash registers', 'cash points', 'cajas registradoras fisicas', 'physical cash registers'],
  Appointments: ['citas', 'agenda', 'calendario', 'turnos', 'agenda de citas', 'appointments', 'calendar', 'schedule', 'agendas'],
  TVDisplay: ['pantalla tv', 'tv', 'tele', 'television', 'pantalla de la sala de espera', 'tv display', 'tv screen', 'waiting room screen'],
  Pacientes: ['pacientes', 'patients', 'lista de pacientes', 'patient list'],
  Studies: ['estudios', 'studies', 'imagenes', 'radiografias', 'dicom', 'images', 'x rays', 'imaging'],
  SharedStudies: ['estudios compartidos', 'shared studies'],
  LabOrders: ['ordenes de laboratorio', 'laboratorio', 'pedidos de laboratorio', 'trabajos de laboratorio', 'lab orders', 'lab', 'laboratory', 'lab work'],
  Sales: ['ventas', 'sales'],
  Quotes: ['presupuestos', 'quotes', 'cotizaciones', 'estimates', 'presupuestos de venta'],
  Invoices: ['facturas', 'invoices', 'facturacion', 'facturas de venta', 'billing'],
  Payments: ['pagos', 'cobros', 'payments', 'pagos de pacientes'],
  PaymentMethods: ['metodos de pago', 'formas de pago', 'medios de pago', 'payment methods'],
  Services: ['servicios', 'services', 'prestaciones', 'lista de precios', 'price list', 'aranceles'],
  Purchases: ['compras', 'purchases', 'purchasing'],
  PurchaseQuotes: ['presupuestos de compra', 'cotizaciones de compra', 'purchase quotes', 'supplier quotes'],
  PurchaseInvoices: ['facturas de compra', 'facturas de proveedores', 'purchase invoices', 'supplier invoices', 'bills'],
  PurchasePayments: ['pagos de compra', 'pagos a proveedores', 'purchase payments', 'supplier payments'],
  Providers: ['proveedores', 'providers', 'suppliers', 'vendors'],
  ProviderProducts: ['productos de proveedores', 'productos y servicios de proveedores', 'supplier products', 'provider products'],
  ClinicCatalog: ['catalogo', 'catalogo de la clinica', 'catalogo clinico', 'catalog', 'clinic catalog', 'clinical catalog'],
  Ailments: ['padecimientos', 'enfermedades', 'ailments', 'diseases'],
  Medications: ['medicamentos', 'remedios', 'medications', 'medicines', 'drugs'],
  DentalConditions: ['condiciones dentales', 'dental conditions', 'hallazgos dentales'],
  DentalSurfaces: ['superficies dentales', 'dental surfaces', 'caras dentales'],
  MeasurementUnits: ['unidades de medida', 'unidades', 'measurement units', 'units'],
  BusinessSetup: ['configuracion de negocio', 'configuracion del negocio', 'configuracion', 'ajustes', 'business setup', 'business settings', 'settings', 'setup'],
  ClinicDetails: ['datos de la clinica', 'detalles de la clinica', 'clinic details', 'clinic info'],
  ClinicPrefs: ['preferencias de la clinica', 'preferencias', 'clinic preferences', 'preferences'],
  PatientsPortal: ['portal del paciente', 'portal de pacientes', 'patient portal', 'patients portal'],
  Sedes: ['sedes', 'sucursales', 'locations', 'branches', 'sites'],
  Schedules: ['horarios', 'horarios de atencion', 'schedules', 'opening hours', 'business hours'],
  Holidays: ['feriados', 'excepciones de horario', 'horarios de excepcion', 'holidays', 'closures', 'exception schedules'],
  Calendars: ['calendarios', 'configuracion de calendarios', 'calendars', 'calendar settings'],
  CalendarColors: ['colores de calendario', 'colores de la agenda', 'calendar colors'],
  Doctors: ['doctores', 'medicos', 'odontologos', 'profesionales', 'doctors', 'dentists'],
  Staff: ['secretarias', 'personal', 'administracion', 'recepcionistas', 'staff', 'receptionists', 'receptionists administration', 'secretarias y administracion'],
  DoctorAvailability: ['disponibilidad medica', 'disponibilidad de los doctores', 'disponibilidad', 'doctor availability', 'availability'],
  DoctorAvailabilityExceptions: ['excepciones de disponibilidad', 'ausencias', 'licencias de doctores', 'availability exceptions', 'time off'],
  Currencies: ['monedas', 'tipos de cambio', 'tipo de cambio', 'cotizacion', 'currencies', 'exchange rates', 'currencies exchange rates', 'monedas y tipos de cambio'],
  Sequences: ['secuencias', 'numeracion', 'sequences', 'numbering'],
  MutualSocieties: ['sociedades mutuales', 'mutualistas', 'mutuales', 'obras sociales', 'mutual societies', 'insurers', 'insurance companies'],
  PatientGroups: ['grupos de pacientes', 'patient groups'],
  ProviderGroups: ['grupos de proveedores', 'provider groups', 'supplier groups'],
  LabStages: ['etapas de laboratorio', 'lab stages'],
  Templates: ['plantillas', 'plantillas de documentos', 'plantillas de impresion', 'templates', 'print templates'],
  MedicalInstructionTemplates: ['plantillas de indicaciones', 'indicaciones medicas', 'medical instruction templates', 'instruction templates', 'plantillas de indicaciones medicas'],
  PrescriptionTemplates: ['plantillas de receta', 'recetas', 'prescription templates', 'prescriptions'],
  System: ['sistema', 'system', 'administracion del sistema', 'system admin'],
  SystemUsers: ['usuarios', 'usuarios del sistema', 'users', 'system users'],
  Roles: ['roles', 'perfiles'],
  Permissions: ['permisos', 'permissions'],
  AlertsConfig: ['configuracion de alertas', 'alerts config', 'alert settings', 'alerts configuration', 'alert configuration'],
  AlertCategories: ['categorias de alertas', 'alert categories'],
  AlertRules: ['reglas de alertas', 'alert rules'],
  AlertTemplates: ['plantillas de alertas', 'plantillas de mensajes', 'alert templates', 'message templates'],
  AlertHistory: ['historial de alertas', 'historial de comunicaciones', 'mensajes enviados', 'alert history', 'communication history'],
  AlertExecutions: ['ejecuciones de alertas', 'alert executions'],
  WhatsAppAgent: ['agente de whatsapp', 'whatsapp', 'whatsapp agent'],
  HelpInsights: ['metricas del asistente', 'help insights', 'assistant metrics', 'assistant insights'],
  Configurations: ['configuraciones del sistema', 'configuracion del sistema', 'system settings', 'configurations', 'configuraciones'],
  NotificationSettings: ['notificaciones', 'configuracion de notificaciones', 'notification settings', 'notifications'],
  AuditLog: ['auditoria', 'registro de auditoria', 'audit log', 'audit'],
  AccessLog: ['registro de acceso', 'accesos', 'access log', 'logins'],
  ErrorLog: ['registro de errores', 'errores', 'error log', 'errors'],
  ImportData: ['importar datos', 'importar', 'import data', 'import'],
  Licenses: ['licencias', 'licenses', 'licencia'],
  Subscriptions: ['suscripciones', 'suscripcion', 'subscriptions', 'subscription', 'mi plan', 'my plan'],
  Reports: ['reportes', 'informes', 'reports', 'estadisticas'],
  ReportCierreCaja: ['cierre de caja', 'cash closing', 'cash close', 'till closing'],
  ReportCobrosDia: ['cobros del dia', 'cobros de hoy', 'daily collections', 'payments of the day', 'todays payments'],
  ReportCuentasCtes: ['cuentas corrientes', 'saldos de pacientes', 'current accounts', 'account balances', 'accounts receivable'],
  ReportPresupuestos: ['estado de presupuestos', 'quote status', 'quotes status'],
  ReportProduccionDoc: ['produccion por doctor', 'produccion de los doctores', 'production by doctor', 'doctor production'],
  ReportTratamientos: ['tratamientos realizados', 'treatments performed', 'treatments done'],
  ReportComparativo: ['comparativo de produccion', 'production comparison'],
  ReportHonorarios: ['honorarios', 'fees', 'doctor fees'],
  ReportNuevosPx: ['nuevos pacientes', 'pacientes nuevos', 'new patients'],
  ReportInactivosPx: ['pacientes inactivos', 'inactive patients'],
  ReportTratCurso: ['tratamientos en curso', 'treatments in progress', 'ongoing treatments'],
  ReportOcupacion: ['ocupacion de agenda', 'ocupacion', 'schedule occupancy', 'occupancy'],
  ReportCancelaciones: ['cancelaciones', 'cancellations'],
  ReportIngPeriodo: ['ingresos por periodo', 'ingresos', 'income by period', 'revenue', 'income'],
  ReportFactCobranza: ['facturacion vs cobranza', 'facturacion y cobranza', 'billing vs collections', 'billing and collections'],
  ReportDeudores: ['deudores', 'morosos', 'debtors', 'who owes'],
  ReportServicios: ['rendimiento de servicios', 'servicios mas vendidos', 'service performance'],
  ReportGastos: ['gastos operativos', 'gastos', 'operating expenses', 'expenses'],
  ReportEstadoRes: ['estado de resultados', 'income statement', 'profit and loss', 'p and l'],
  ReportKPIs: ['kpis', 'kpi', 'indicadores', 'indicators', 'kpis de la clinica', 'clinic kpis'],
  ReportBalanceMensual: ['balance mensual', 'monthly balance'],
};

/** Palabras que no distinguen un destino («la pantalla de», «the … page»). */
const FILLER = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'lo', 'al', 'a', 'en', 'the', 'of', 'to', 'my', 'mi', 'mis', 'our', 'nuestro', 'nuestra', 'su', 'sus',
  'pantalla', 'pagina', 'seccion', 'modulo', 'menu', 'parte', 'area', 'listado', 'lista', 'screen', 'page', 'section', 'module', 'list',
  'vs', 'versus', 'y', 'and', 'por', 'favor', 'please', 'reporte', 'informe', 'report',
]);

/** Lo que es una fecha o un momento: no se completa un destino con eso («ir a hoy» no es «cobros de hoy»). */
const TIME_WORDS = /^(?:hoy|ayer|manana|pasado|today|tomorrow|yesterday|semana|semanas|week|weeks|mes|meses|month|months|dia|dias|day|days|ano|year|lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|proximo|proxima|siguiente|anterior|next|previous|last|que|viene|pasada|pasado|[0-9]+)$/;

/** Singular y plural, español e inglés («reportes» = «reporte», «studies» = «study»). */
export function stemWord(word: string): string {
  return word.replace(/s$/, '').replace(/e$/, '').replace(/y$/, 'i');
}

const tokens = (text: string) => text.split(' ').filter((w) => w && !FILLER.has(w));

export interface NavLookup {
  /** Sin traductor quedan solo los sinónimos (para reconocer la frase). */
  t: ((key: string) => string) | null;
  hasPermission: (code: string) => boolean;
}

function allowed(item: NavItem, hasPermission: (code: string) => boolean): boolean {
  if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
  if (item.requiredPermissions && !item.requiredPermissions.every(hasPermission)) return false;
  if (item.requiredAnyPermission && !item.requiredAnyPermission.some(hasPermission)) return false;
  return true;
}

const label = (t: NavLookup['t'], key: string) => {
  if (!t) return key;
  try {
    const text = t(`Navigation.${key}`);
    return text && !text.startsWith('Navigation.') ? text : key;
  } catch {
    return key;
  }
};

/** Todos los destinos del menú, con sus nombres. `allowed` dice si el usuario puede entrar. */
export function listNavTargets({ t, hasPermission }: NavLookup): Array<NavTarget & { allowed: boolean }> {
  const out: Array<NavTarget & { allowed: boolean }> = [];
  const seen = new Set<string>();
  const add = (item: NavItem, parent: NavItem | null, ok: boolean) => {
    if (!item.href || item.isSeparator || !item.title) return;
    const id = `${item.title}|${item.href}`;
    if (seen.has(id)) return;
    seen.add(id);
    const own = [...(t ? [normalizeSpeech(label(t, item.title))] : []), ...(SYNONYMS[item.title] ?? [])];
    const parentNames = parent ? [...(t ? [normalizeSpeech(label(t, parent.title))] : []), ...(SYNONYMS[parent.title] ?? [])] : [];
    // «reportes de deudores», «facturas de ventas»: la sección más el destino.
    const names = [...own, ...parentNames.flatMap((p) => own.map((o) => `${p} ${o}`))];
    out.push({
      key: item.title,
      href: item.href,
      label: label(t, item.title),
      parent: parent ? label(t, parent.title) : undefined,
      parentKey: parent?.title,
      names: [...new Set(names.filter(Boolean))],
      allowed: ok,
    });
  };
  for (const item of navItems) {
    const okParent = allowed(item, hasPermission);
    const children = (item.items ?? []).filter((c) => !c.isSeparator && c.href);
    // La sección sola lleva a su primera página (Ventas → presupuestos), salvo que repita a un hijo.
    if (!children.some((c) => c.title === item.title)) add(item, null, okParent);
    for (const child of children) add(child, item, okParent && allowed(child, hasPermission));
  }
  return out;
}

export type NavMatch =
  | { target: NavTarget & { allowed: boolean }; score: number }
  | { ambiguous: Array<NavTarget & { allowed: boolean }>; score: number };

/**
 * Qué destino se nombró. `spoken` es solo el nombre («reportes de deudores»), sin el verbo. Gana el
 * que coincide entero (tal cual, después en singular/plural, después el que contiene todo lo dicho
 * con menos palabras de más); si dos quedan igual de bien, es ambiguo.
 */
export function matchNavTarget(spoken: string, targets: Array<NavTarget & { allowed: boolean }>): NavMatch | null {
  const said = tokens(normalizeSpeech(spoken));
  if (!said.length) return null;
  const saidSet = new Set(said);
  const saidStem = new Set(said.map(stemWord));
  const timeLike = said.some((w) => TIME_WORDS.test(w));
  let best: { score: number; list: Array<NavTarget & { allowed: boolean }> } = { score: 0, list: [] };
  for (const target of targets) {
    let score = 0;
    for (const name of target.names) {
      const words = tokens(name);
      if (!words.length) continue;
      const set = new Set(words);
      const stems = new Set(words.map(stemWord));
      let s = 0;
      if (set.size === saidSet.size && [...saidSet].every((w) => set.has(w))) s = 3;
      else if (stems.size === saidStem.size && [...saidStem].every((w) => stems.has(w))) s = 2;
      else if (!timeLike && [...saidStem].every((w) => stems.has(w))) s = 1 - Math.min(0.9, (stems.size - saidStem.size) * 0.15);
      score = Math.max(score, s);
    }
    if (score <= 0) continue;
    if (score > best.score + 1e-6) best = { score, list: [target] };
    else if (Math.abs(score - best.score) <= 1e-6 && !best.list.some((b) => b.href === target.href)) best.list.push(target);
  }
  if (!best.list.length || best.score < 0.5) return null;
  // Mismo destino con permiso y sin permiso: el que se puede.
  if (best.list.length > 1) {
    const ok = best.list.filter((b) => b.allowed);
    if (ok.length === 1) return { target: ok[0], score: best.score };
    return { ambiguous: ok.length ? ok : best.list, score: best.score };
  }
  return { target: best.list[0], score: best.score };
}

/** La ruta actual sin el locale («/es/appointments» → «/appointments»). */
export function currentRoute(): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return window.location.pathname.replace(/^\/(es-ES|es|en)(?=\/|$)/, '') || '/';
}

export function isOnRoute(href: string, route = currentRoute()): boolean {
  if (href === '/') return route === '/';
  return route === href || route.startsWith(`${href}/`);
}

/**
 * Qué módulos de voz registra cada pantalla. Después de navegar, la continuación del pedido espera
 * a que la página nueva esté lista para la voz. Se agrega una línea por cada página que se suma.
 */
export const ROUTE_VOICE_DOMAINS: Record<string, string[]> = {
  '/': ['dashboard'],
  '/appointments': ['calendar'],
  '/workspace': ['workspace'],
  '/alerts': ['alerts'],
  '/cashier': ['cashier'],
  '/patients': ['patients'],
  // Las subpáginas de Caja no tienen voz propia (todavía): la genérica.
  '/cashier/miscellaneous-transactions': [],
  '/cashier/miscellaneous-categories': [],
  '/cashier/sessions': [],
  '/cashier/cash-points': [],
  '/lab-orders': ['lab_orders'],
};

export function expectedDomainsFor(href: string): string[] {
  const match = Object.keys(ROUTE_VOICE_DOMAINS)
    .filter((route) => isOnRoute(route, href))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ROUTE_VOICE_DOMAINS[match] : [];
}
