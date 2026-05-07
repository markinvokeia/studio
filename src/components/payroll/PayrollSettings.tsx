'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { API_ROUTES } from '@/constants/routes';
import { api } from '@/services/api';
import type { FonasaFamilySituation, IrpfBracket, PayrollSettings } from '@/lib/types';
import { DEFAULT_PAYROLL_SETTINGS } from '@/components/payroll/payroll-utils';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';

type SectionId = 'bps' | 'fonasa' | 'irpf' | 'other';

const FIELD_SECTION: Record<keyof PayrollSettings, SectionId> = {
  montepio_employee_rate:   'bps',
  bps_employee_rate:        'bps',
  bps_employer_rate:        'bps',
  bps_salary_cap_uyu:       'bps',
  frl_employee_rate:        'bps',
  frl_employer_rate:        'bps',
  fgcl_employer_rate:       'bps',
  bse_employer_rate:        'bps',
  fonasa_employer_rate:     'fonasa',
  fonasa_annual_cap_uyu:    'fonasa',
  fonasa_table:             'fonasa',
  fonasa_employee_base:     'fonasa',
  fonasa_employee_children: 'fonasa',
  bpc_value_uyu:            'irpf',
  cpe_value_uyu:            'irpf',
  irpf_brackets:            'irpf',
  vacation_days_per_year:   'other',
  min_salary_national:      'other',
  default_currency:         'other',
};

const FONASA_SITUATIONS: { key: FonasaFamilySituation; label: string }[] = [
  { key: 'sin_conyuge_sin_hijos', label: 'Sin cónyuge, sin hijos' },
  { key: 'con_hijos',            label: 'Con hijos (sin cónyuge)' },
  { key: 'con_conyuge',          label: 'Con cónyuge (sin hijos)' },
  { key: 'con_conyuge_e_hijos',  label: 'Con cónyuge e hijos' },
];

/** Map flat DB key-value pairs → PayrollSettings object */
function dbToSettings(data: Record<string, unknown>): PayrollSettings {
  const d = DEFAULT_PAYROLL_SETTINGS;
  return {
    montepio_employee_rate:   Number(data.montepio_employee_rate ?? data.bps_employee_rate ?? d.montepio_employee_rate),
    bps_employee_rate:        Number(data.bps_employee_rate  ?? d.bps_employee_rate),
    bps_employer_rate:        Number(data.bps_employer_rate  ?? d.bps_employer_rate),
    bps_salary_cap_uyu:       Number(data.bps_salary_cap_uyu ?? d.bps_salary_cap_uyu),
    fonasa_employer_rate:     Number(data.fonasa_employer_rate  ?? d.fonasa_employer_rate),
    fonasa_annual_cap_uyu:    Number(data.fonasa_annual_cap_uyu ?? d.fonasa_annual_cap_uyu),
    fonasa_table:             (data.fonasa_table as typeof d.fonasa_table) ?? d.fonasa_table,
    fonasa_employee_base:     Number(data.fonasa_employee_base    ?? d.fonasa_employee_base),
    fonasa_employee_children: Number(data.fonasa_employee_children ?? d.fonasa_employee_children),
    frl_employee_rate:        Number(data.frl_employee_rate ?? d.frl_employee_rate),
    frl_employer_rate:        Number(data.frl_employer_rate ?? d.frl_employer_rate),
    fgcl_employer_rate:       Number(data.fgcl_rate ?? data.fgcl_employer_rate ?? d.fgcl_employer_rate),
    bse_employer_rate:        Number(data.bse_rate  ?? data.bse_employer_rate  ?? d.bse_employer_rate),
    bpc_value_uyu:            Number(data.bpc_value_uyu ?? d.bpc_value_uyu),
    cpe_value_uyu:            Number(data.cpe_value_uyu ?? d.cpe_value_uyu),
    irpf_brackets:            (data.irpf_brackets as IrpfBracket[]) ?? d.irpf_brackets,
    vacation_days_per_year:   Number(data.vacation_days_per_year ?? d.vacation_days_per_year),
    default_currency:         (data.default_currency as 'UYU' | 'USD') ?? d.default_currency,
    min_salary_national:      Number(data.min_salary_national ?? d.min_salary_national),
  };
}

/** All DB key→value pairs for a section (used for diffing). */
function keysForSection(section: SectionId, s: PayrollSettings): Array<{ key: string; value: unknown }> {
  switch (section) {
    case 'bps': return [
      { key: 'bps_employee_rate',      value: s.bps_employee_rate },
      { key: 'montepio_employee_rate', value: s.montepio_employee_rate },
      { key: 'bps_employer_rate',      value: s.bps_employer_rate },
      { key: 'frl_employee_rate',      value: s.frl_employee_rate },
      { key: 'frl_employer_rate',      value: s.frl_employer_rate },
      { key: 'fgcl_employer_rate',     value: s.fgcl_employer_rate },
      { key: 'bse_employer_rate',      value: s.bse_employer_rate },
      { key: 'bps_salary_cap_uyu',     value: s.bps_salary_cap_uyu },
    ];
    case 'fonasa': return [
      { key: 'fonasa_employer_rate',     value: s.fonasa_employer_rate },
      { key: 'fonasa_annual_cap_uyu',    value: s.fonasa_annual_cap_uyu },
      { key: 'fonasa_table',             value: s.fonasa_table },
      { key: 'fonasa_employee_base',     value: s.fonasa_employee_base },
      { key: 'fonasa_employee_children', value: s.fonasa_employee_children },
    ];
    case 'irpf': return [
      { key: 'bpc_value_uyu', value: s.bpc_value_uyu },
      { key: 'cpe_value_uyu', value: s.cpe_value_uyu },
      { key: 'irpf_brackets', value: s.irpf_brackets },
    ];
    case 'other': return [
      { key: 'vacation_days_per_year', value: s.vacation_days_per_year },
      { key: 'min_salary_national',    value: s.min_salary_national },
      { key: 'default_currency',       value: s.default_currency },
    ];
  }
}

/** Returns only keys whose value changed vs the last saved state. */
function changedKeys(
  section: SectionId,
  current: PayrollSettings,
  saved: PayrollSettings,
): Array<{ key: string; value: unknown }> {
  const curr = keysForSection(section, current);
  const prev = keysForSection(section, saved);
  return curr.filter((c, i) => JSON.stringify(c.value) !== JSON.stringify(prev[i].value));
}

/** After a successful save, advance savedRef for the fields of this section only. */
function applySectionToSaved(section: SectionId, source: PayrollSettings, saved: PayrollSettings): PayrollSettings {
  const result = { ...saved };
  for (const k of Object.keys(FIELD_SECTION) as (keyof PayrollSettings)[]) {
    if (FIELD_SECTION[k] === section) {
      (result as Record<string, unknown>)[k] = source[k];
    }
  }
  return result;
}

export function PayrollSettingsPage() {
  const t = useTranslations('PayrollPage.settings');
  const { toast } = useToast();
  const { user } = useAuth();

  const [settings, setSettings] = useState<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionId | null>(null);
  const [dirty, setDirty] = useState<Set<SectionId>>(new Set());

  // settingsRef — always the latest UI state (avoids stale closures in handlers)
  const settingsRef = useRef<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS);
  // savedSettingsRef — what the DB currently holds; used to diff before saving
  const savedSettingsRef = useRef<PayrollSettings>(DEFAULT_PAYROLL_SETTINGS);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.get(API_ROUTES.PAYROLL.SETTINGS)
      .then((res) => {
        if (cancelled) return;
        const raw = (res?.data ?? res) as Record<string, unknown>;
        const loaded = dbToSettings(raw);
        settingsRef.current = loaded;
        savedSettingsRef.current = loaded;
        setSettings(loaded);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      });
    return () => { cancelled = true; };
  }, []);

  function setField<K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setSettings(next);
    if (initialLoadDone.current) {
      setDirty((prev) => new Set([...prev, FIELD_SECTION[key]]));
    }
  }

  function updateBracket(index: number, field: keyof IrpfBracket, value: number) {
    const updated = settingsRef.current.irpf_brackets.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    );
    setField('irpf_brackets', updated);
  }

  function updateFonasaRow(situation: FonasaFamilySituation, field: 'until_2_5_bpc' | 'above_2_5_bpc', value: number) {
    const updated = settingsRef.current.fonasa_table.map((r) =>
      r.situation === situation ? { ...r, [field]: value } : r
    );
    setField('fonasa_table', updated);
  }

  async function handleSaveSection(section: SectionId) {
    const changed = changedKeys(section, settingsRef.current, savedSettingsRef.current);
    if (changed.length === 0) return;

    setSaving(section);
    try {
      await api.post(API_ROUTES.PAYROLL.SETTINGS_UPDATE, {
        settings: changed,
        updated_by: user?.id ?? null,
      });
      // Advance saved baseline to the current state for this section only
      savedSettingsRef.current = applySectionToSaved(section, settingsRef.current, savedSettingsRef.current);
      setDirty((prev) => { const next = new Set(prev); next.delete(section); return next; });
      toast({ title: t('saveSuccess') });
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6">

      {/* BPS / Montepíos */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('bpsSection')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2 grid grid-cols-2 gap-3 flex-1">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('montepioRate')} (%)</Label>
            <Input type="number"
              value={(settings.montepio_employee_rate * 100).toFixed(2)}
              onChange={(e) => { const v = Number(e.target.value) / 100; setField('montepio_employee_rate', v); setField('bps_employee_rate', v); }}
              step={0.01} min={0} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('bpsEmployerRate')} (%)</Label>
            <Input type="number"
              value={(settings.bps_employer_rate * 100).toFixed(3)}
              onChange={(e) => setField('bps_employer_rate', Number(e.target.value) / 100)}
              step={0.001} min={0} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('frlEmployeeRate')} (%)</Label>
            <Input type="number"
              value={(settings.frl_employee_rate * 100).toFixed(3)}
              onChange={(e) => setField('frl_employee_rate', Number(e.target.value) / 100)}
              step={0.001} min={0} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('frlEmployerRate')} (%)</Label>
            <Input type="number"
              value={(settings.frl_employer_rate * 100).toFixed(3)}
              onChange={(e) => setField('frl_employer_rate', Number(e.target.value) / 100)}
              step={0.001} min={0} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('fgclRate')} (%)</Label>
            <Input type="number"
              value={(settings.fgcl_employer_rate * 100).toFixed(3)}
              onChange={(e) => setField('fgcl_employer_rate', Number(e.target.value) / 100)}
              step={0.001} min={0} max={100} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('bseRate')} (%)</Label>
            <Input type="number"
              value={(settings.bse_employer_rate * 100).toFixed(3)}
              onChange={(e) => setField('bse_employer_rate', Number(e.target.value) / 100)}
              step={0.001} min={0} max={100} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">{t('bpsCap')} (UYU)</Label>
            <Input type="number"
              value={settings.bps_salary_cap_uyu}
              onChange={(e) => setField('bps_salary_cap_uyu', Number(e.target.value))}
              min={0} />
          </div>
        </CardContent>
        <CardFooter className="px-4 pb-4 pt-2">
          <Button size="sm" className="w-full"
            disabled={saving === 'bps' || !dirty.has('bps')}
            onClick={() => handleSaveSection('bps')}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving === 'bps' ? 'Guardando…' : t('save')}
          </Button>
        </CardFooter>
      </Card>

      {/* FONASA */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('fonasaSection')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2 space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fonasaEmployer')} (%)</Label>
              <Input type="number"
                value={(settings.fonasa_employer_rate * 100).toFixed(1)}
                onChange={(e) => setField('fonasa_employer_rate', Number(e.target.value) / 100)}
                step={0.1} min={0} max={100} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('fonasaAnnualCap')} (UYU)</Label>
              <Input type="number"
                value={settings.fonasa_annual_cap_uyu}
                onChange={(e) => setField('fonasa_annual_cap_uyu', Number(e.target.value))}
                min={0} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('fonasaTable')}</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('familySituation')}</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">≤2.5 BPC</th>
                    <th className="px-2 py-1.5 text-center font-medium text-muted-foreground">&gt;2.5 BPC</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.fonasa_table.map((row) => {
                    const label = FONASA_SITUATIONS.find((s) => s.key === row.situation)?.label ?? row.situation;
                    return (
                      <tr key={row.situation} className="border-b last:border-0">
                        <td className="px-2 py-1 text-muted-foreground">{label}</td>
                        <td className="px-2 py-1">
                          <Input type="number"
                            value={(row.until_2_5_bpc * 100).toFixed(1)}
                            onChange={(e) => updateFonasaRow(row.situation, 'until_2_5_bpc', Number(e.target.value) / 100)}
                            className="h-6 text-xs text-center px-1"
                            step={0.1} min={0} max={100} />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number"
                            value={(row.above_2_5_bpc * 100).toFixed(1)}
                            onChange={(e) => updateFonasaRow(row.situation, 'above_2_5_bpc', Number(e.target.value) / 100)}
                            className="h-6 text-xs text-center px-1"
                            step={0.1} min={0} max={100} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-4 pb-4 pt-2">
          <Button size="sm" className="w-full"
            disabled={saving === 'fonasa' || !dirty.has('fonasa')}
            onClick={() => handleSaveSection('fonasa')}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving === 'fonasa' ? 'Guardando…' : t('save')}
          </Button>
        </CardFooter>
      </Card>

      {/* IRPF */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('irpfSection')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2 space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('bpcValue')} (UYU)</Label>
              <Input type="number"
                value={settings.bpc_value_uyu}
                onChange={(e) => setField('bpc_value_uyu', Number(e.target.value))}
                min={1} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('cpeValue')} (UYU)</Label>
              <Input type="number"
                value={settings.cpe_value_uyu}
                onChange={(e) => setField('cpe_value_uyu', Number(e.target.value))}
                min={1} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('irpfBrackets')} (BPC/mes)</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('bracketFrom')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('bracketTo')}</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">{t('bracketRate')} %</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.irpf_brackets.map((bracket, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-2 py-1">
                        <Input type="number"
                          value={bracket.from}
                          onChange={(e) => updateBracket(i, 'from', Number(e.target.value))}
                          className="h-6 text-xs px-1" min={0} />
                      </td>
                      <td className="px-2 py-1">
                        {bracket.to === Infinity ? (
                          <span className="text-muted-foreground px-1">∞</span>
                        ) : (
                          <Input type="number"
                            value={bracket.to}
                            onChange={(e) => updateBracket(i, 'to', Number(e.target.value))}
                            className="h-6 text-xs px-1" min={0} />
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <Input type="number"
                          value={(bracket.rate * 100).toFixed(0)}
                          onChange={(e) => updateBracket(i, 'rate', Number(e.target.value) / 100)}
                          className="h-6 text-xs px-1" min={0} max={100} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-4 pb-4 pt-2">
          <Button size="sm" className="w-full"
            disabled={saving === 'irpf' || !dirty.has('irpf')}
            onClick={() => handleSaveSection('irpf')}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving === 'irpf' ? 'Guardando…' : t('save')}
          </Button>
        </CardFooter>
      </Card>

      {/* Vacaciones, SMN y moneda */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium">{t('vacationSection')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2 grid grid-cols-2 gap-3 flex-1">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('vacationDays')}</Label>
            <Input type="number"
              value={settings.vacation_days_per_year}
              onChange={(e) => setField('vacation_days_per_year', Number(e.target.value))}
              min={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('minSalaryNational')} (UYU)</Label>
            <Input type="number"
              value={settings.min_salary_national}
              onChange={(e) => setField('min_salary_national', Number(e.target.value))}
              min={1} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">{t('defaultCurrency')}</Label>
            <Select value={settings.default_currency}
              onValueChange={(v) => setField('default_currency', v as 'UYU' | 'USD')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UYU">UYU — Peso Uruguayo</SelectItem>
                <SelectItem value="USD">USD — Dólar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="px-4 pb-4 pt-2">
          <Button size="sm" className="w-full"
            disabled={saving === 'other' || !dirty.has('other')}
            onClick={() => handleSaveSection('other')}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saving === 'other' ? 'Guardando…' : t('save')}
          </Button>
        </CardFooter>
      </Card>

    </div>
  );
}
