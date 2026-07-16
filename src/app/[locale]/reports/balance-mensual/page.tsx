'use client';

import { CalendarRange, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DoctorSelector } from '@/components/ui/doctor-selector';
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
} from '@/lib/types';
import { fmtMultiCurrency } from '@/lib/utils';
import type { DoctorOption } from '@/services/doctors';
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

function totalByCurrency(rows: DayRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + Number(r.importe || 0);
    return acc;
  }, {});
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
  const [docType, setDocType] = useState<DocType>('all');
  // Sub-tab used only to organize the on-screen blocks when the doc-type
  // filter is "all" — the filter itself still governs which data is shown
  // for a specific type; this just avoids stacking all 3 blocks at once
  const [activeBlock, setActiveBlock] = useState<Exclude<DocType, 'all'>>('producido');

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
      const res = await api.get(API_ROUTES.REPORTS.BALANCE_MENSUAL, query);
      setData(res?.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, currency, doctorIds]);

  const showProducido = docType === 'all' || docType === 'producido';
  const showCobrado = docType === 'all' || docType === 'cobrado';
  const showPendiente = docType === 'all' || docType === 'pendiente';

  // On-screen block visibility: when the filter is a specific type, mirrors it;
  // when "Todos", the active sub-tab decides which single block is displayed
  const blockProducido = docType === 'all' ? activeBlock === 'producido' : showProducido;
  const blockCobrado = docType === 'all' ? activeBlock === 'cobrado' : showCobrado;
  const blockPendiente = docType === 'all' ? activeBlock === 'pendiente' : showPendiente;

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

  // ── Export: one sheet per doctor within each document-type group. Excel
  // gets one .xlsx workbook per type (Producido.xlsx, Cobrado.xlsx, ...), each
  // with a sheet per doctor; CSV has no concept of multiple files per type, so
  // it flattens to one file per (tipo, médico) combo, e.g. "producido_Dr_Juan" ─
  const producidoSheets = showProducido
    ? Array.from(new Set(producido.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
        const rows = producido.filter((r) => r.doctor_name === name);
        return { name, sections: [{ columns: producidoExportCols, rows: buildProducidoRows(groupByDay(rows), totalByCurrency(rows)) }] };
      })
    : [];
  const cobradoSheets = showCobrado
    ? Array.from(new Set(cobrado.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
        const rows = cobrado.filter((r) => r.doctor_name === name);
        return { name, sections: [{ columns: cobradoExportCols, rows: buildCobradoRows(groupByDay(rows), totalByCurrency(rows)) }] };
      })
    : [];
  const pendienteSheets = showPendiente
    ? Array.from(new Set(pendiente.map((r) => r.doctor_name))).sort((a, b) => a.localeCompare(b)).map((name) => {
        const rows = pendiente.filter((r) => r.doctor_name === name);
        return { name, sections: [{ columns: pendienteExportCols, rows: buildPendienteRows(rows) }] };
      })
    : [];

  const withTypePrefix = (typeLabel: string, sheets: { name: string; sections: ExportSection[] }[]) =>
    sheets.map((s) => ({ ...s, name: `${typeLabel}_${s.name.replace(/\s+/g, '_')}` }));

  const exportSheets = data
    ? [
        ...withTypePrefix(t('doc_type_producido'), producidoSheets),
        ...withTypePrefix(t('doc_type_cobrado'), cobradoSheets),
        ...withTypePrefix(t('doc_type_pendiente'), pendienteSheets),
      ]
    : undefined;

  const exportWorkbooks = data
    ? [
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
          {docType === 'all' && (
            <Tabs value={activeBlock} onValueChange={(v) => setActiveBlock(v as Exclude<DocType, 'all'>)} className="print:hidden">
              <TabsList>
                <TabsTrigger value="producido">{t('doc_type_producido')}</TabsTrigger>
                <TabsTrigger value="cobrado">{t('doc_type_cobrado')}</TabsTrigger>
                <TabsTrigger value="pendiente">{t('doc_type_pendiente')}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <div className="flex flex-wrap gap-3 print:grid print:grid-cols-3 print:gap-3">
            {showProducido && <ReportKPICard title={t('kpi_producido')} value={fmtMultiCurrency(producidoByCurrency)} />}
            {showCobrado && <ReportKPICard title={t('kpi_cobrado')} value={fmtMultiCurrency(cobradoByCurrency)} variant="success" />}
            {showPendiente && <ReportKPICard title={t('kpi_pendiente')} value={renderPendienteValue(pendienteByCurrency)} />}
          </div>

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
