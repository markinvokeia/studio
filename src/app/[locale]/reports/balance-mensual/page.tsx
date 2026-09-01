'use client';

import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DoctorSelector } from '@/components/ui/doctor-selector';
import { PatientGroupSelector } from '@/components/ui/patient-group-selector';
import { SedeMultiSelector, type SedeOption } from '@/components/ui/sede-multi-selector';
import { DateRangePresets } from '@/components/reports/date-range-presets';
import { ReportDataTable } from '@/components/reports/report-data-table';
import { ReportKPICard } from '@/components/reports/report-kpi-card';
import { ReportShell } from '@/components/reports/report-shell';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import { useReportExport, type ExportSection } from '@/hooks/use-report-export';
import type {
  ReportBalanceMensualCobradoRow,
  ReportBalanceMensualPendienteRow,
  ReportBalanceMensualProducidoRow,
  ReportBalanceMensualResponse,
  ReportBalanceMensualResumen,
  ReportBalanceMensualResumenDoctorRow,
  ReportBalanceMensualResumenGrupoRow,
} from '@/lib/types';
import { fmtMultiCurrency } from '@/lib/utils';
import type { DoctorOption } from '@/services/doctors';
import type { GroupOption } from '@/services/patientGroups';
import type { ColumnDef } from '@tanstack/react-table';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { Fragment, type ReactNode, useCallback, useState } from 'react';
import type { DateRange } from 'react-day-picker';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(n);

// yyyy-MM-dd → dd/MM/yyyy without timezone day-shifting
const fmtFecha = (fecha: string) => {
  const [y, m, d] = fecha.split('-');
  return d && m && y ? `${d}/${m}/${y}` : fecha;
};

type DocType = 'all' | 'producido' | 'cobrado' | 'pendiente';
type TabValue = 'resumen' | Exclude<DocType, 'all'>;

type DayRow = { fecha: string; currency: string; importe: number };
type DayGroup<T> = { fecha: string; rows: T[]; subtotal: Record<string, number> };

function groupByDay<T extends DayRow>(rows: T[]): DayGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const arr = map.get(r.fecha) ?? [];
    arr.push(r);
    map.set(r.fecha, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, dayRows]) => ({
      fecha,
      rows: dayRows,
      subtotal: dayRows.reduce<Record<string, number>>((acc, r) => {
        acc[r.currency] = (acc[r.currency] || 0) + Number(r.importe || 0);
        return acc;
      }, {}),
    }));
}

// Buckets rows by group name for the export sheets — a row whose invoiced
// service belongs to several of the filtered groups (e.g. "Brackets") is
// duplicated into each group's bucket, so every group's sheet is complete on
// its own
function bucketRowsByGroup<T extends { patient_groups?: { name: string }[] }>(
  rows: T[],
  fallbackLabel: string,
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const names = r.patient_groups && r.patient_groups.length > 0 ? r.patient_groups.map((g) => g.name) : [fallbackLabel];
    for (const name of names) {
      const arr = map.get(name) ?? [];
      arr.push(r);
      map.set(name, arr);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function totalByCurrency(rows: DayRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.importe || 0);
    return acc;
  }, {});
}

// Suma { currency, total }[] por moneda
function sumByCurrency(rows: { currency: string; total: number }[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.total || 0);
    return acc;
  }, {});
}

// Reconstruye el bloque `resumen` a partir del detalle cuando el workflow aún
// no lo devuelve. Misma lógica que el Code node: producido por médico, cobrado
// total y cobrado/producido por grupo del servicio con "atribución completa"
// (una línea que toca varios grupos suma a cada uno; sin grupo → fallbackLabel).
function buildResumenFallback(
  producido: ReportBalanceMensualProducidoRow[],
  cobrado: ReportBalanceMensualCobradoRow[],
  fallbackLabel: string,
): ReportBalanceMensualResumen {
  const prodDoc = new Map<string, ReportBalanceMensualResumenDoctorRow>();
  for (const r of producido) {
    const k = `${r.doctor_id || 'null'}|${r.currency}`;
    const b = prodDoc.get(k) ?? { doctor_id: r.doctor_id || null, doctor_name: r.doctor_name, currency: r.currency, total: 0 };
    b.total += Number(r.importe || 0);
    prodDoc.set(k, b);
  }

  const cobTot = new Map<string, { currency: string; total: number }>();
  for (const r of cobrado) {
    const b = cobTot.get(r.currency) ?? { currency: r.currency, total: 0 };
    b.total += Number(r.importe || 0);
    cobTot.set(r.currency, b);
  }

  const byGroup = (
    rows: { currency: string; importe: number; patient_groups?: { id: string; name: string }[] }[],
  ): ReportBalanceMensualResumenGrupoRow[] => {
    const m = new Map<string, ReportBalanceMensualResumenGrupoRow>();
    for (const r of rows) {
      const gs = r.patient_groups && r.patient_groups.length > 0
        ? r.patient_groups.map((g) => ({ id: g.id as string | null, name: g.name }))
        : [{ id: null as string | null, name: fallbackLabel }];
      for (const g of gs) {
        const k = `${g.id || 'null'}|${r.currency}`;
        const b = m.get(k) ?? { group_id: g.id, group_name: g.name, currency: r.currency, total: 0 };
        b.total += Number(r.importe || 0);
        m.set(k, b);
      }
    }
    return [...m.values()];
  };

  const sortDoc = (a: ReportBalanceMensualResumenDoctorRow, b: ReportBalanceMensualResumenDoctorRow) =>
    a.doctor_name.localeCompare(b.doctor_name) || a.currency.localeCompare(b.currency);
  const sortGrp = (a: ReportBalanceMensualResumenGrupoRow, b: ReportBalanceMensualResumenGrupoRow) =>
    a.group_name.localeCompare(b.group_name) || a.currency.localeCompare(b.currency);

  return {
    producido_por_doctor: [...prodDoc.values()].sort(sortDoc),
    cobrado_total: [...cobTot.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    cobrado_por_grupo: byGroup(cobrado).sort(sortGrp),
    producido_por_grupo: byGroup(producido).sort(sortGrp),
  };
}

// Saldo pendiente puede ser negativo (crédito a favor si se cobró de más), así que
// cada moneda se colorea según su propio signo en vez de un único color por tarjeta
function renderPendienteValue(amounts: Record<string, number>): ReactNode {
  const entries = Object.entries(amounts)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return '—';
  return entries.map(([currency, v], i) => (
    <span key={currency}>
      {i > 0 && ' / '}
      <span className={v < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
        {fmt(v)} ({currency})
      </span>
    </span>
  ));
}

export default function BalanceMensualPage() {
  const t = useTranslations('ReportBalanceMensualPage');

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [currency, setCurrency] = useState('all');
  const [selectedDoctors, setSelectedDoctors] = useState<DoctorOption[]>([]);
  const doctorIds = selectedDoctors.map((d) => d.id);
  const [selectedGroups, setSelectedGroups] = useState<GroupOption[]>([]);
  const groupIds = selectedGroups.map((g) => g.id);
  const [selectedSedes, setSelectedSedes] = useState<SedeOption[]>([]);
  const sedeIds = selectedSedes.map((s) => s.id);
  const [docType, setDocType] = useState<DocType>('all');
  // Active tab. "resumen" is always available; the detail tabs depend on the
  // doc-type filter ("all" → the 3 blocks; a specific type → only that one).
  const [activeTab, setActiveTab] = useState<TabValue>('resumen');

  const [data, setData] = useState<ReportBalanceMensualResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const query: Record<string, string> = {
        date_from: format(dateRange.from, 'yyyy-MM-dd'),
        date_to: format(dateRange.to, 'yyyy-MM-dd'),
      };
      if (currency !== 'all') query.currency = currency;
      if (doctorIds.length > 0) query.doctor_ids = doctorIds.join(',');
      if (groupIds.length > 0) query.group_ids = groupIds.join(',');
      if (sedeIds.length > 0) query.sede_ids = sedeIds.join(',');
      const res = await api.get(API_ROUTES.REPORTS.BALANCE_MENSUAL, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency, doctorIds, groupIds, sedeIds]);

  const showProducido = docType === 'all' || docType === 'producido';
  const showCobrado = docType === 'all' || docType === 'cobrado';
  const showPendiente = docType === 'all' || docType === 'pendiente';

  // Tabs shown next to "Resumen": all 3 detail blocks when the filter is
  // "Todos", otherwise just the selected type
  const detailTabs: Exclude<DocType, 'all'>[] =
    docType === 'all' ? ['producido', 'cobrado', 'pendiente'] : [docType];
  // Keep the selection valid when the doc-type filter changes under it
  const effectiveTab: TabValue =
    activeTab === 'resumen' || detailTabs.includes(activeTab as Exclude<DocType, 'all'>)
      ? activeTab
      : detailTabs[0];

  const blockResumen = effectiveTab === 'resumen';
  const blockProducido = effectiveTab === 'producido';
  const blockCobrado = effectiveTab === 'cobrado';
  const blockPendiente = effectiveTab === 'pendiente';

  const producido = data?.producido ?? [];
  const cobrado = data?.cobrado ?? [];
  // Rows with saldo 0 mean the invoiced amount was fully collected — nothing
  // actually pending, so they're excluded from this block
  const pendiente = (data?.pendiente ?? []).filter((r) => Number(r.saldo) !== 0);

  const producidoByCurrency = totalByCurrency(producido);
  const cobradoByCurrency = totalByCurrency(cobrado);
  const pendienteByCurrency = pendiente.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.saldo || 0);
    return acc;
  }, {});

  const producidoDays = groupByDay(producido);
  const cobradoDays = groupByDay(cobrado);

  // ── Pendiente por médico (Bloque C) ──────────────────────────────────────
  const pendienteColumns: ColumnDef<ReportBalanceMensualPendienteRow>[] = [
    { accessorKey: 'doctor_name', header: t('col_medico') },
    { accessorKey: 'currency', header: t('col_moneda') },
    {
      accessorKey: 'total_facturado',
      header: t('col_facturado'),
      cell: ({ row }) => <span className="tabular-nums">{fmt(Number(row.original.total_facturado))}</span>,
    },
    {
      accessorKey: 'total_cobrado',
      header: t('col_cobrado'),
      cell: ({ row }) => <span className="tabular-nums text-emerald-600">{fmt(Number(row.original.total_cobrado))}</span>,
    },
    {
      accessorKey: 'saldo',
      header: t('col_saldo'),
      cell: ({ row }) => {
        const saldo = Number(row.original.saldo);
        return (
          <span className={`tabular-nums ${saldo < 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {fmt(saldo)}
          </span>
        );
      },
    },
  ];

  // ── Export: each block keeps its own columns instead of being forced into
  // one shared flat table, so e.g. "Pendiente por médico" isn't padded with
  // Fecha/Paciente/Forma de pago columns that don't apply to it ────────────
  const producidoExportCols = [
    { header: t('col_fecha'), key: 'fecha' },
    { header: t('col_medico'), key: 'medico' },
    { header: t('col_paciente'), key: 'paciente' },
    { header: t('col_servicio'), key: 'servicio' },
    { header: t('col_factura'), key: 'factura' },
    { header: t('col_moneda'), key: 'moneda' },
    { header: t('col_importe'), key: 'importe' },
  ];
  const cobradoExportCols = [
    { header: t('col_fecha'), key: 'fecha' },
    { header: t('col_medico'), key: 'medico' },
    { header: t('col_paciente'), key: 'paciente' },
    { header: t('col_factura'), key: 'factura' },
    { header: t('col_forma_pago'), key: 'forma_pago' },
    { header: t('col_moneda'), key: 'moneda' },
    { header: t('col_importe'), key: 'importe' },
  ];
  const pendienteExportCols = [
    { header: t('col_medico'), key: 'medico' },
    { header: t('col_moneda'), key: 'moneda' },
    { header: t('col_facturado'), key: 'facturado' },
    { header: t('col_cobrado'), key: 'cobrado' },
    { header: t('col_saldo'), key: 'saldo' },
  ];

  const buildProducidoRows = (days: DayGroup<ReportBalanceMensualProducidoRow>[], total: Record<string, number>) => {
    const rows: Record<string, unknown>[] = days.flatMap((g) => [
      ...g.rows.map((r) => ({
        fecha: fmtFecha(r.fecha), medico: r.doctor_name, paciente: r.patient_name,
        servicio: r.service_name, factura: r.invoice_doc_no, moneda: r.currency, importe: Number(r.importe),
      })),
      ...Object.entries(g.subtotal).map(([cur, val]) => ({
        fecha: '', medico: '', paciente: '', servicio: `${t('subtotal_dia')} · ${fmtFecha(g.fecha)}`,
        factura: '', moneda: cur, importe: val,
      })),
    ]);
    Object.entries(total).forEach(([cur, val]) => {
      rows.push({ fecha: '', medico: '', paciente: '', servicio: t('total_periodo'), factura: '', moneda: cur, importe: val });
    });
    return rows;
  };
  const buildCobradoRows = (days: DayGroup<ReportBalanceMensualCobradoRow>[], total: Record<string, number>) => {
    const rows: Record<string, unknown>[] = days.flatMap((g) => [
      ...g.rows.map((r) => ({
        fecha: fmtFecha(r.fecha), medico: r.doctor_name, paciente: r.patient_name,
        factura: r.invoice_doc_no, forma_pago: r.payment_method, moneda: r.currency, importe: Number(r.importe),
      })),
      ...Object.entries(g.subtotal).map(([cur, val]) => ({
        fecha: '', medico: '', paciente: '', factura: `${t('subtotal_dia')} · ${fmtFecha(g.fecha)}`,
        forma_pago: '', moneda: cur, importe: val,
      })),
    ]);
    Object.entries(total).forEach(([cur, val]) => {
      rows.push({ fecha: '', medico: '', paciente: '', factura: t('total_periodo'), forma_pago: '', moneda: cur, importe: val });
    });
    return rows;
  };
  const buildPendienteRows = (rows: ReportBalanceMensualPendienteRow[]) =>
    rows.map((r) => ({
      medico: r.doctor_name,
      moneda: r.currency,
      facturado: Number(r.total_facturado),
      cobrado: Number(r.total_cobrado),
      saldo: Number(r.saldo),
    }));

  const periodTag = dateRange?.from ? format(dateRange.from, 'yyyy-MM') : '';
  const docTypeTag = docType === 'all' ? t('doc_type_all') : t(`doc_type_${docType}`);

  // Distinct doctors present in the current data — used both to split the
  // CSV/Excel export into one sheet per doctor, and to paginate the printed
  // PDF so each doctor starts on a new page, when more than one doctor is in scope
  const doctorNames = data
    ? Array.from(new Set([
        ...producido.map((r) => r.doctor_name),
        ...cobrado.map((r) => r.doctor_name),
        ...pendiente.map((r) => r.doctor_name),
      ].filter(Boolean))).sort((a, b) => a.localeCompare(b))
    : [];
  const showPerDoctorPrint = doctorNames.length > 1;

  // ── Export: "Resumen" siempre va como archivo aparte y primero (Resumen.xlsx
  // / Resumen.csv). Producido/Cobrado/Pendiente van cada uno en su propio
  // archivo, con una hoja (Excel) o un archivo (CSV) por médico — salvo que
  // haya filtro de grupo activo, en cuyo caso se organiza por grupo de paciente
  // (un paciente en varios grupos se duplica en cada uno). Todo se empaqueta en
  // un .zip cuando hay más de un archivo ──────────────────────────────────────
  const isGroupFiltered = groupIds.length > 0;
  const noGroupLabel = t('no_group');

  // Resumen: precalculado por el workflow; si falta (workflow no desplegado)
  // se reconstruye del detalle
  const resumen: ReportBalanceMensualResumen =
    data?.resumen ?? buildResumenFallback(producido, cobrado, noGroupLabel);
  const resumenProdByCurrency = sumByCurrency(resumen.producido_por_doctor);
  const resumenCobByCurrency = sumByCurrency(resumen.cobrado_total);
  const resumenGrpByCurrency = sumByCurrency(resumen.cobrado_por_grupo);

  const producidoSheets = showProducido
    ? isGroupFiltered
      ? bucketRowsByGroup(producido, noGroupLabel).map(([name, rows]) => ({
          name, sections: [{ columns: producidoExportCols, rows: buildProducidoRows(groupByDay(rows), totalByCurrency(rows)) }],
        }))
      : Array.from(new Set(producido.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
          const rows = producido.filter((r) => r.doctor_name === name);
          return { name, sections: [{ columns: producidoExportCols, rows: buildProducidoRows(groupByDay(rows), totalByCurrency(rows)) }] };
        })
    : [];
  const cobradoSheets = showCobrado
    ? isGroupFiltered
      ? bucketRowsByGroup(cobrado, noGroupLabel).map(([name, rows]) => ({
          name, sections: [{ columns: cobradoExportCols, rows: buildCobradoRows(groupByDay(rows), totalByCurrency(rows)) }],
        }))
      : Array.from(new Set(cobrado.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
          const rows = cobrado.filter((r) => r.doctor_name === name);
          return { name, sections: [{ columns: cobradoExportCols, rows: buildCobradoRows(groupByDay(rows), totalByCurrency(rows)) }] };
        })
    : [];
  const pendientePorGrupo = data?.pendiente_por_grupo ?? [];
  const pendienteSheets = showPendiente
    ? isGroupFiltered
      ? Array.from(new Set(pendientePorGrupo.map((r) => r.group_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
          const rows = pendientePorGrupo.filter((r) => r.group_name === name);
          return { name, sections: [{ columns: pendienteExportCols, rows: buildPendienteRows(rows) }] };
        })
      : Array.from(new Set(pendiente.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
          const rows = pendiente.filter((r) => r.doctor_name === name);
          return { name, sections: [{ columns: pendienteExportCols, rows: buildPendienteRows(rows) }] };
        })
    : [];

  const withTypePrefix = (typeLabel: string, sheets: { name: string; sections: ExportSection[] }[]) =>
    sheets.map((s) => ({ ...s, name: `${typeLabel}_${s.name.replace(/\s+/g, '_')}` }));

  // Redondeo a 2 decimales para las celdas numéricas del Resumen
  const round2 = (n: number) => Math.round(n * 100) / 100;
  // Fila(s) "Total general" por moneda para las tablas [label, moneda, total]
  const curTotalsRows = (totals: Record<string, number>) =>
    Object.entries(totals)
      .filter(([, v]) => v !== 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cur, val]) => ({ k1: t('total_general'), k2: cur, k3: round2(val) }));

  const resumenExportSections: ExportSection[] = [
    {
      title: t('resumen_producido_doctor'),
      columns: [
        { header: t('col_medico'), key: 'k1' },
        { header: t('col_moneda'), key: 'k2' },
        { header: t('col_total'), key: 'k3' },
      ],
      rows: [
        ...resumen.producido_por_doctor.map((r) => ({ k1: r.doctor_name, k2: r.currency, k3: round2(r.total) })),
        ...curTotalsRows(resumenProdByCurrency),
      ],
    },
    {
      title: t('resumen_pago_total'),
      columns: [
        { header: t('col_moneda'), key: 'k1' },
        { header: t('col_total'), key: 'k2' },
      ],
      rows: resumen.cobrado_total.map((r) => ({ k1: r.currency, k2: round2(r.total) })),
    },
    {
      title: t('resumen_pago_grupo'),
      columns: [
        { header: t('col_grupo'), key: 'k1' },
        { header: t('col_moneda'), key: 'k2' },
        { header: t('col_total'), key: 'k3' },
      ],
      rows: [
        ...resumen.cobrado_por_grupo.map((r) => ({ k1: r.group_name, k2: r.currency, k3: round2(r.total) })),
        ...curTotalsRows(resumenGrpByCurrency),
      ],
    },
  ];

  // CSV: un archivo por (tipo, médico/grupo) + un Resumen.csv aparte, todo en
  // un .zip. El orden del array manda, así que Resumen va primero.
  const exportSheets = data
    ? [
        { name: t('tab_resumen'), sections: resumenExportSections },
        ...withTypePrefix(t('doc_type_producido'), producidoSheets),
        ...withTypePrefix(t('doc_type_cobrado'), cobradoSheets),
        ...withTypePrefix(t('doc_type_pendiente'), pendienteSheets),
      ]
    : undefined;

  // Excel: un .xlsx separado por tipo (Producido/Cobrado/Pendiente), cada uno
  // con una hoja por médico/grupo, + un Resumen.xlsx aparte. Se empaquetan en
  // un .zip cuando hay más de uno.
  const exportWorkbooks = data
    ? [
        { name: t('tab_resumen'), sheets: [{ name: t('tab_resumen'), sections: resumenExportSections }] },
        ...(producidoSheets.length ? [{ name: t('doc_type_producido'), sheets: producidoSheets }] : []),
        ...(cobradoSheets.length ? [{ name: t('doc_type_cobrado'), sheets: cobradoSheets }] : []),
        ...(pendienteSheets.length ? [{ name: t('doc_type_pendiente'), sheets: pendienteSheets }] : []),
      ]
    : undefined;

  const { exportCSV, exportExcel, exportPDF } = useReportExport(
    [] as ColumnDef<Record<string, unknown>>[],
    data ? [{}] : null,
    `Balance_${docTypeTag}_${periodTag}`,
    { sheets: exportSheets, workbooks: exportWorkbooks },
  );

  const filters = (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangePresets value={dateRange} onChange={setDateRange} />
      <div className="flex items-center gap-1">
        <DoctorSelector
          multiple
          values={doctorIds}
          selectedDoctors={selectedDoctors}
          onValuesChange={(_, doctors) => setSelectedDoctors(doctors)}
          triggerText={t('all_doctors')}
          className="h-8 w-52 text-xs"
        />
        {selectedDoctors.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSelectedDoctors([])}
            aria-label={t('all_doctors')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <PatientGroupSelector
          values={groupIds}
          selectedGroups={selectedGroups}
          onValuesChange={(_, groups) => setSelectedGroups(groups)}
          triggerText={t('all_groups')}
          className="h-8 w-52 text-xs"
        />
        {selectedGroups.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSelectedGroups([])}
            aria-label={t('all_groups')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <SedeMultiSelector
          values={sedeIds}
          onValuesChange={(_, sedes) => setSelectedSedes(sedes)}
          triggerText={t('all_sedes')}
          className="h-8 w-52 text-xs"
        />
        {selectedSedes.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSelectedSedes([])}
            aria-label={t('all_sedes')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="h-8 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('all_currencies')}</SelectItem>
          <SelectItem value="UYU">UYU</SelectItem>
          <SelectItem value="USD">USD</SelectItem>
        </SelectContent>
      </Select>
      <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('doc_type_all')}</SelectItem>
          <SelectItem value="producido">{t('doc_type_producido')}</SelectItem>
          <SelectItem value="cobrado">{t('doc_type_cobrado')}</SelectItem>
          <SelectItem value="pendiente">{t('doc_type_pendiente')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const filterParts: string[] = [];
  if (dateRange?.from && dateRange?.to) {
    filterParts.push(`${format(dateRange.from, 'dd/MM/yyyy')} al ${format(dateRange.to, 'dd/MM/yyyy')}`);
  }
  if (selectedDoctors.length > 0) filterParts.push(selectedDoctors.map((d) => d.name).join(', '));
  if (selectedGroups.length > 0) filterParts.push(selectedGroups.map((g) => g.name).join(', '));
  if (selectedSedes.length > 0) filterParts.push(selectedSedes.map((s) => s.name).join(', '));
  if (currency !== 'all') filterParts.push(currency);
  if (docType !== 'all') filterParts.push(docTypeTag);
  const dateRangeDescription = filterParts.length > 0 ? (
    <span>
      {t('description')}{' — '}
      {filterParts.map((p, i) => (
        <span key={p}>
          {i > 0 && ' · '}
          <strong className="text-foreground font-semibold">{p}</strong>
        </span>
      ))}
    </span>
  ) : t('description');

  return (
    <ReportShell
      icon={CalendarRange}
      title={t('title')}
      description={dateRangeDescription}
      filters={filters}
      onGenerate={handleGenerate}
      isLoading={isLoading}
      hasData={!!data}
      onExportCSV={exportCSV}
      onExportExcel={exportExcel}
      onExportPDF={exportPDF}
    >
      {data && (
        <>
          <Tabs value={effectiveTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="print:hidden">
            <TabsList>
              <TabsTrigger value="resumen">{t('tab_resumen')}</TabsTrigger>
              {detailTabs.map((tab) => (
                <TabsTrigger key={tab} value={tab}>{t(`doc_type_${tab}`)}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-3 print:gap-3">
            {showProducido && <ReportKPICard title={t('kpi_producido')} value={fmtMultiCurrency(producidoByCurrency)} />}
            {showCobrado && <ReportKPICard title={t('kpi_cobrado')} value={fmtMultiCurrency(cobradoByCurrency)} variant="success" />}
            {showPendiente && <ReportKPICard title={t('kpi_pendiente')} value={renderPendienteValue(pendienteByCurrency)} />}
          </div>

          {/* Pestaña Resumen — producido por doctor, pago total de pacientes y
              pago por grupo. Se imprime siempre que esté activa. */}
          {blockResumen && (
            <ResumenBlock
              resumen={resumen}
              prodByCurrency={resumenProdByCurrency}
              cobByCurrency={resumenCobByCurrency}
              grpByCurrency={resumenGrpByCurrency}
              labels={{
                producido_doctor: t('resumen_producido_doctor'),
                pago_total: t('resumen_pago_total'),
                pago_grupo: t('resumen_pago_grupo'),
                nota_grupos: t('resumen_nota_grupos'),
                total_general: t('total_general'),
                col_medico: t('col_medico'),
                col_grupo: t('col_grupo'),
                col_moneda: t('col_moneda'),
                col_total: t('col_total'),
                empty: t('empty_block'),
              }}
            />
          )}

          {/* Combined view (all doctors mixed together) — used on screen always,
              and for print only when a single doctor is in scope */}
          <div className={showPerDoctorPrint ? 'flex flex-col gap-4 print:hidden' : undefined}>
            {/* Bloque A — Producido por día */}
            {blockProducido && (
              <DayDetailBlock<ReportBalanceMensualProducidoRow>
                title={t('block_producido')}
                emptyLabel={t('empty_block')}
                days={producidoDays}
                total={producidoByCurrency}
                headers={[t('col_fecha'), t('col_medico'), t('col_paciente'), t('col_servicio'), t('col_factura'), t('col_moneda'), t('col_importe')]}
                renderRow={(r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{fmtFecha(r.fecha)}</TableCell>
                    <TableCell>{r.doctor_name}</TableCell>
                    <TableCell>{r.patient_name}</TableCell>
                    <TableCell>{r.service_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.invoice_doc_no}</TableCell>
                    <TableCell>{r.currency}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(r.importe))}</TableCell>
                  </TableRow>
                )}
                colSpanBeforeAmount={5}
                subtotalLabel={t('subtotal_dia')}
                totalLabel={t('total_periodo')}
              />
            )}

            {/* Bloque B — Cobrado por día */}
            {blockCobrado && (
              <DayDetailBlock<ReportBalanceMensualCobradoRow>
                title={t('block_cobrado')}
                emptyLabel={t('empty_block')}
                days={cobradoDays}
                total={cobradoByCurrency}
                headers={[t('col_fecha'), t('col_medico'), t('col_paciente'), t('col_factura'), t('col_forma_pago'), t('col_moneda'), t('col_importe')]}
                renderRow={(r, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{fmtFecha(r.fecha)}</TableCell>
                    <TableCell>{r.doctor_name}</TableCell>
                    <TableCell>{r.patient_name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.invoice_doc_no}</TableCell>
                    <TableCell>{r.payment_method}</TableCell>
                    <TableCell>{r.currency}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(Number(r.importe))}</TableCell>
                  </TableRow>
                )}
                colSpanBeforeAmount={5}
                subtotalLabel={t('subtotal_dia')}
                totalLabel={t('total_periodo')}
              />
            )}

            {/* Bloque C — Pendiente por médico */}
            {blockPendiente && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{t('block_pendiente')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReportDataTable columns={pendienteColumns} data={pendiente} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Print-only view: one section per doctor, each starting on a new page */}
          {showPerDoctorPrint && (
            <div className="hidden print:flex print:flex-col print:gap-4">
              {doctorNames.map((name, idx) => {
                const prodRows = producido.filter((r) => r.doctor_name === name);
                const cobRows = cobrado.filter((r) => r.doctor_name === name);
                const pendRows = pendiente.filter((r) => r.doctor_name === name);
                return (
                  <div key={name} className={idx > 0 ? 'flex flex-col gap-4 print:break-before-page' : 'flex flex-col gap-4'}>
                    <h2 className="text-base font-semibold">{name}</h2>
                    {showProducido && (
                      <DayDetailBlock<ReportBalanceMensualProducidoRow>
                        title={t('block_producido')}
                        emptyLabel={t('empty_block')}
                        days={groupByDay(prodRows)}
                        total={totalByCurrency(prodRows)}
                        headers={[t('col_fecha'), t('col_medico'), t('col_paciente'), t('col_servicio'), t('col_factura'), t('col_moneda'), t('col_importe')]}
                        renderRow={(r, i) => (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap">{fmtFecha(r.fecha)}</TableCell>
                            <TableCell>{r.doctor_name}</TableCell>
                            <TableCell>{r.patient_name}</TableCell>
                            <TableCell>{r.service_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{r.invoice_doc_no}</TableCell>
                            <TableCell>{r.currency}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(Number(r.importe))}</TableCell>
                          </TableRow>
                        )}
                        colSpanBeforeAmount={5}
                        subtotalLabel={t('subtotal_dia')}
                        totalLabel={t('total_periodo')}
                      />
                    )}
                    {showCobrado && (
                      <DayDetailBlock<ReportBalanceMensualCobradoRow>
                        title={t('block_cobrado')}
                        emptyLabel={t('empty_block')}
                        days={groupByDay(cobRows)}
                        total={totalByCurrency(cobRows)}
                        headers={[t('col_fecha'), t('col_medico'), t('col_paciente'), t('col_factura'), t('col_forma_pago'), t('col_moneda'), t('col_importe')]}
                        renderRow={(r, i) => (
                          <TableRow key={i}>
                            <TableCell className="whitespace-nowrap">{fmtFecha(r.fecha)}</TableCell>
                            <TableCell>{r.doctor_name}</TableCell>
                            <TableCell>{r.patient_name}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">{r.invoice_doc_no}</TableCell>
                            <TableCell>{r.payment_method}</TableCell>
                            <TableCell>{r.currency}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(Number(r.importe))}</TableCell>
                          </TableRow>
                        )}
                        colSpanBeforeAmount={5}
                        subtotalLabel={t('subtotal_dia')}
                        totalLabel={t('total_periodo')}
                      />
                    )}
                    {showPendiente && pendRows.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">{t('block_pendiente')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ReportDataTable columns={pendienteColumns} data={pendRows} />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </ReportShell>
  );
}

// ── Pestaña Resumen ───────────────────────────────────────────────────────
interface ResumenLabels {
  producido_doctor: string;
  pago_total: string;
  pago_grupo: string;
  nota_grupos: string;
  total_general: string;
  col_medico: string;
  col_grupo: string;
  col_moneda: string;
  col_total: string;
  empty: string;
}

function ResumenBlock({
  resumen,
  prodByCurrency,
  cobByCurrency,
  grpByCurrency,
  labels,
}: {
  resumen: ReportBalanceMensualResumen;
  prodByCurrency: Record<string, number>;
  cobByCurrency: Record<string, number>;
  grpByCurrency: Record<string, number>;
  labels: ResumenLabels;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{labels.producido_doctor}</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTotalsTable
            head={[labels.col_medico, labels.col_moneda, labels.col_total]}
            rows={resumen.producido_por_doctor.map((r) => [r.doctor_name, r.currency, fmt(Number(r.total))])}
            totalLabel={labels.total_general}
            totals={prodByCurrency}
            emptyLabel={labels.empty}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{labels.pago_total}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 print:text-xl">
            {fmtMultiCurrency(cobByCurrency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{labels.pago_grupo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SimpleTotalsTable
            head={[labels.col_grupo, labels.col_moneda, labels.col_total]}
            rows={resumen.cobrado_por_grupo.map((r) => [r.group_name, r.currency, fmt(Number(r.total))])}
            totalLabel={labels.total_general}
            totals={grpByCurrency}
            emptyLabel={labels.empty}
          />
          <p className="text-xs text-muted-foreground">{labels.nota_grupos}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Tabla simple [texto…, importe] con una fila final de total multi-moneda
function SimpleTotalsTable({
  head,
  rows,
  totalLabel,
  totals,
  emptyLabel,
}: {
  head: string[];
  rows: (string | number)[][];
  totalLabel: string;
  totals: Record<string, number>;
  emptyLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={h} className={i === head.length - 1 ? 'text-right' : undefined}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} className="py-6 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, ri) => (
              <TableRow key={ri}>
                {r.map((c, ci) => (
                  <TableCell key={ci} className={ci === r.length - 1 ? 'text-right tabular-nums' : undefined}>
                    {c}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
          <TableRow className="border-t-2 font-semibold">
            <TableCell colSpan={Math.max(1, head.length - 1)} className="text-right">
              {totalLabel}
            </TableCell>
            <TableCell className="text-right tabular-nums">{fmtMultiCurrency(totals)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ── Reusable day-grouped detail block (subtotal per day + period total) ─────
interface DayDetailBlockProps<T> {
  title: string;
  emptyLabel: string;
  days: DayGroup<T>[];
  total: Record<string, number>;
  headers: string[];
  renderRow: (row: T, index: number) => ReactNode;
  colSpanBeforeAmount: number;
  subtotalLabel: string;
  totalLabel: string;
}

function DayDetailBlock<T extends DayRow>({
  title,
  emptyLabel,
  days,
  total,
  headers,
  renderRow,
  colSpanBeforeAmount,
  subtotalLabel,
  totalLabel,
}: DayDetailBlockProps<T>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h, i) => (
                    <TableHead key={h} className={i === headers.length - 1 ? 'text-right' : undefined}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((g) => (
                  <Fragment key={g.fecha}>
                    {g.rows.map((r, i) => renderRow(r, i))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={colSpanBeforeAmount} className="text-right text-muted-foreground">
                        {subtotalLabel} · {fmtFecha(g.fecha)}
                      </TableCell>
                      <TableCell colSpan={2} className="text-right tabular-nums">
                        {fmtMultiCurrency(g.subtotal)}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={colSpanBeforeAmount} className="text-right">
                    {totalLabel}
                  </TableCell>
                  <TableCell colSpan={2} className="text-right tabular-nums">
                    {fmtMultiCurrency(total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
