'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Building2, CalendarDays, CalendarX2, Check, ChevronsUpDown, Clock, FileText, Loader2, Palette, Pencil, Plus, StickyNote, Stethoscope, UserCog, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InlineEntityPicker } from '@/components/appointments/InlineEntityPicker';
import { InlineServicePicker } from '@/components/calendar/inline-service-picker';
import { UserSelector } from '@/components/ui/user-selector';
import type { Calendar as CalendarType, Service, User } from '@/lib/types';

interface InlineColorOption {
  id: string;
  hex: string;
  label?: string;
}

interface InlineAppointmentDraftProps {
  variant?: 'default' | 'custom';
  date: Date;
  endTime: string;
  durationMin: number;
  onDurationChange: (min: number) => void;
  timeStepMinutes?: number;
  onDateChange?: (date: Date) => void;
  /** Refine the start time (HH:mm). When provided, the start becomes editable. */
  onStartTimeChange?: (hours: number, minutes: number) => void;
  color?: string;
  colorOptions?: InlineColorOption[];
  onColorChange?: (color: string) => void;
  calendar: CalendarType | null;
  onCalendarChange: (c: CalendarType | null) => void;
  calendarOptions: CalendarType[];
  doctor: User | null;
  onDoctorChange: (d: User | null) => void;
  doctorOptions: User[];
  patient: User | null;
  onPatientChange: (user: User | null) => void;
  services: Service[];
  onServicesChange: (services: Service[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  overlapWarning?: boolean;
  patientDebt?: { currency: string; amount: number }[];
  /** Number of cancelled appointments the patient has (shown next to the debt). */
  cancelledCount?: number;
  onViewStatement?: () => void;
  isSaving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Accent color shown on the card (derived from service > doctor > calendar). */
  accentColor?: string;
  onCreatePatient?: () => void;
  onEditPatient?: () => void;
  canCreatePatient?: boolean;
  canEditPatient?: boolean;
  /** Overrides the card title (e.g. "Edit appointment"). Defaults to "New appointment". */
  title?: string;
  /** Overrides the save button label (e.g. "Update"). Defaults to "Save". */
  saveLabel?: string;
}

/** A field row: leading icon + content. */
function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function CustomField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Inline searchable picker (doctor/room) shown as a badge + popover. */
function PickerField({
  icon, valueLabel, valueColor, placeholder, options, selectedId, onSelect, searchPlaceholder, emptyText,
}: {
  icon: React.ComponentType<{ className?: string }>;
  valueLabel?: string;
  valueColor?: string;
  placeholder: string;
  options: { id: string; name: string; color?: string }[];
  selectedId?: string;
  onSelect: (id: string) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Field icon={icon}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 w-full justify-between px-2 text-xs font-normal">
            {valueLabel ? (
              <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
                {valueColor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: valueColor }} />}
                <span className="truncate">{valueLabel}</span>
              </Badge>
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <InlineEntityPicker
            className="border-0"
            items={options}
            selectedId={selectedId}
            onSelect={(id) => { onSelect(id); setOpen(false); }}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}

function ColorField({
  color,
  colorOptions,
  onColorChange,
  placeholder,
  noColorLabel,
}: {
  color?: string;
  colorOptions: InlineColorOption[];
  onColorChange?: (color: string) => void;
  placeholder: string;
  noColorLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = colorOptions.find((option) => option.id === color);
  const selectedColor = selected?.hex;
  const selectedLabel = selected?.label ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-between px-2 text-xs font-normal">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border border-border"
              style={selectedColor ? { backgroundColor: selectedColor } : undefined}
            />
            <span className="truncate text-muted-foreground">{selectedLabel}</span>
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="grid grid-cols-6 gap-1.5">
          <button
            type="button"
            className="h-6 rounded-sm border border-border bg-background text-[10px] text-muted-foreground hover:bg-muted"
            onClick={() => { onColorChange?.(''); setOpen(false); }}
            title={noColorLabel}
          >
            -
          </button>
          {colorOptions.map((color) => (
            <button
              key={color.id}
              type="button"
              className="h-6 rounded-sm border border-border ring-offset-background hover:ring-2 hover:ring-ring"
              style={{ backgroundColor: color.hex }}
              onClick={() => { onColorChange?.(color.id); setOpen(false); }}
              title={color.label ?? color.id}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatMinutesLabel(minutes: number, hourLabel: string, minuteLabel: string): string {
  if (minutes < 60) return `${minutes} ${minuteLabel}`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining === 0 ? `${hours} ${hourLabel}` : `${hours} ${hourLabel} ${remaining} ${minuteLabel}`;
}

function TimeScrollSelect({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  // When the list opens, scroll the currently-selected option into view (and
  // centered) so it's visible/marked instead of the list starting at 00:00.
  React.useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 w-full justify-between px-2 text-xs font-semibold">
          <span>{value}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-48 overflow-y-auto py-1">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                className={cn(
                  'flex h-7 w-full items-center gap-1.5 px-2 text-left text-xs hover:bg-accent',
                  isSelected && 'bg-accent font-semibold',
                )}
                onClick={() => { onSelect(option.value); setOpen(false); }}
              >
                <Check className={cn('h-3 w-3 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Compact in-canvas appointment creation form rendered inside a draft card. Room
 * and doctor are pre-filled from the view but editable; only duration is editable
 * among the time fields. Background is a very light violet.
 */
export function InlineAppointmentDraft({
  variant = 'default',
  date,
  endTime,
  durationMin,
  onDurationChange,
  timeStepMinutes = 15,
  onDateChange,
  onStartTimeChange,
  color,
  colorOptions = [],
  onColorChange,
  calendar,
  onCalendarChange,
  calendarOptions,
  doctor,
  onDoctorChange,
  doctorOptions,
  patient,
  onPatientChange,
  services,
  onServicesChange,
  notes,
  onNotesChange,
  overlapWarning,
  patientDebt,
  cancelledCount,
  onViewStatement,
  isSaving,
  onSave,
  onCancel,
  accentColor,
  onCreatePatient,
  onEditPatient,
  canCreatePatient = false,
  canEditPatient = false,
  title,
  saveLabel,
}: InlineAppointmentDraftProps) {
  const t = useTranslations('AppointmentsPage.inlineCreate');
  const [serviceOpen, setServiceOpen] = React.useState(false);
  const [createPatientToken, setCreatePatientToken] = React.useState(0);
  // Start time is read-only until clicked; while editing we hide "→ end" so the
  // input fits on a single line.
  const [editingStart, setEditingStart] = React.useState(false);
  const hasDebt = (patientDebt?.length ?? 0) > 0;
  const normalizedStep = Math.max(5, Math.min(60, timeStepMinutes || 15));
  const startMinutes = date.getHours() * 60 + date.getMinutes();
  const startTimeValue = format(date, 'HH:mm');
  const formatDurationLabel = React.useCallback((minutes: number) => formatMinutesLabel(minutes, t('hoursShort'), t('minutesShort')), [t]);

  const toggleService = (svc: Service) => {
    const exists = services.some((s) => s.id === svc.id);
    onServicesChange(exists ? services.filter((s) => s.id !== svc.id) : [...services, svc]);
  };

  const handleDateInputChange = (value: string) => {
    if (!onDateChange || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) return;
    onDateChange(new Date(year, month - 1, day, date.getHours(), date.getMinutes(), 0, 0));
  };

  const handleStartTimeInputChange = (value: string) => {
    if (!onStartTimeChange) return;
    const [h, m] = value.split(':').map((n) => parseInt(n, 10));
    if (!Number.isNaN(h) && !Number.isNaN(m)) onStartTimeChange(h, m);
  };

  const startTimeOptions = React.useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += normalizedStep) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      options.push({ value, label: value });
    }
    if (!options.some((option) => option.value === startTimeValue)) {
      options.push({ value: startTimeValue, label: startTimeValue });
      options.sort((a, b) => a.value.localeCompare(b.value));
    }
    return options;
  }, [normalizedStep, startTimeValue]);

  const endTimeOptions = React.useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const endTimeStep = 5;
    const minEndDuration = 10;
    const maxDuration = (24 * 60) - startMinutes;
    for (let minutes = minEndDuration; minutes <= maxDuration; minutes += endTimeStep) {
      const total = startMinutes + minutes;
      const hours = Math.floor(total / 60);
      const mins = total % 60;
      const value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      options.push({ value: String(minutes), label: `${value} (${formatDurationLabel(minutes)})` });
    }
    if (durationMin > 0 && !options.some((option) => Number(option.value) === durationMin)) {
      options.push({ value: String(durationMin), label: `${endTime} (${formatDurationLabel(durationMin)})` });
      options.sort((a, b) => Number(a.value) - Number(b.value));
    }
    return options;
  }, [durationMin, endTime, formatDurationLabel, startMinutes]);

  const handleCreatePatientClick = () => {
    setCreatePatientToken((token) => token + 1);
    onCreatePatient?.();
  };

  const roomField = (
    <PickerField
      icon={Building2}
      valueLabel={calendar?.name}
      valueColor={calendar?.color}
      placeholder={t('selectRoom')}
      options={calendarOptions.map((c) => ({ id: String(c.id), name: c.name, color: c.color }))}
      selectedId={calendar ? String(calendar.id) : undefined}
      onSelect={(id) => onCalendarChange(calendarOptions.find((c) => String(c.id) === id) ?? null)}
      searchPlaceholder={t('searchRoom')}
      emptyText={t('noRooms')}
    />
  );

  const doctorField = (
    <PickerField
      icon={UserCog}
      valueLabel={doctor?.name}
      valueColor={doctor?.color}
      placeholder={t('selectDoctor')}
      options={doctorOptions.map((d) => ({ id: String(d.id), name: d.name, color: d.color }))}
      selectedId={doctor ? String(doctor.id) : undefined}
      onSelect={(id) => onDoctorChange(doctorOptions.find((d) => String(d.id) === id) ?? null)}
      searchPlaceholder={t('searchDoctor')}
      emptyText={t('noDoctors')}
    />
  );

  const patientSelector = (
    <UserSelector
      filterType="PACIENTE"
      isSales
      value={patient?.id}
      selectedUserName={patient?.name}
      onValueChange={(_, u) => onPatientChange(u ?? null)}
      openCreateToken={createPatientToken}
      triggerText={t('selectPatient')}
      placeholder={t('searchPatient')}
      className="h-7 px-2 text-xs font-normal"
    />
  );

  const serviceField = (
    <>
      <Field icon={Stethoscope}>
        <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-full justify-between px-2 text-xs font-normal">
              <span className="truncate text-muted-foreground">
                {services.length > 0 ? t('servicesSelected', { count: services.length }) : t('selectService')}
              </span>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <InlineServicePicker
              selected={services}
              onToggle={toggleService}
              searchPlaceholder={t('searchService')}
              emptyText={t('noServices')}
              createLabel={(name) => t('createService', { name })}
            />
          </PopoverContent>
        </Popover>
      </Field>
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {services.map((svc) => (
            <Badge key={svc.id} variant="secondary" className="gap-0.5 px-1.5 py-0 text-[10px] font-normal">
              {svc.name}
              <button type="button" onClick={() => toggleService(svc)} className="hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      className="flex max-h-[85vh] w-full flex-col gap-2 overflow-auto rounded-lg border border-l-4 border-border bg-card p-2 text-xs text-card-foreground shadow-xl ring-1 ring-black/5 dark:shadow-2xl dark:ring-white/10"
      style={accentColor ? { borderLeftColor: accentColor } : undefined}
    >
      {/* Header: title + close */}
      <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/30 px-2 py-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          {accentColor && <span className="h-2.5 w-2.5 shrink-0 rounded-sm shadow-sm ring-1 ring-black/10 dark:ring-white/20" style={{ backgroundColor: accentColor }} />}
          <span className="truncate">{title ?? t('title')}</span>
        </span>
        <button type="button" onClick={onCancel} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground" aria-label={t('cancel')}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {overlapWarning && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t('overlapWarning')}
        </span>
      )}

      {variant === 'custom' ? (
        <>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3">
            <CustomField label={t('date')}>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={format(date, 'yyyy-MM-dd')}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  className="h-7 pl-7 pr-2 text-xs"
                />
              </div>
            </CustomField>

            <CustomField label={t('background')}>
              <div className="relative">
                <Palette className="pointer-events-none absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <div className="pl-6">
                  <ColorField
                    color={color}
                    colorOptions={colorOptions}
                    onColorChange={onColorChange}
                    placeholder={t('noBackground')}
                    noColorLabel={t('noBackground')}
                  />
                </div>
              </div>
            </CustomField>
          </div>

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3">
            <CustomField label={t('from')}>
              <TimeScrollSelect
                value={startTimeValue}
                options={startTimeOptions}
                onSelect={handleStartTimeInputChange}
              />
            </CustomField>

            <CustomField label={t('to')}>
              <TimeScrollSelect
                value={`${endTime} (${formatDurationLabel(durationMin || 0)})`}
                options={endTimeOptions}
                onSelect={(value) => onDurationChange(Math.max(0, parseInt(value, 10) || 0))}
              />
            </CustomField>
          </div>

          <CustomField label={t('patient')}>
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">{patientSelector}</div>
              {canCreatePatient && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCreatePatientClick}
                  title={t('addPatient')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
              {patient && canEditPatient && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={onEditPatient}
                  title={t('editPatient')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CustomField>

          <CustomField label={t('annotation')}>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={t('notePlaceholder')}
              rows={2}
              className="min-h-[2.25rem] resize-none px-2 py-1 text-xs"
            />
          </CustomField>

          <div className="rounded-md border border-border/70 bg-muted/20 p-2">
            <div className="space-y-1.5">
              {roomField}
              {doctorField}
              {serviceField}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Room (calendar) */}
          {roomField}

          {/* Doctor */}
          {doctorField}

          {/* Time: start (click to edit) → end + duration. While editing the start,
              the "→ end" is hidden so the time input fits on one line. */}
          <Field icon={Clock}>
            <div className="flex items-center gap-1.5">
              {onStartTimeChange && editingStart ? (
                <Input
                  type="time"
                  autoFocus
                  value={format(date, 'HH:mm')}
                  onChange={(e) => handleStartTimeInputChange(e.target.value)}
                  onBlur={() => setEditingStart(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingStart(false); }}
                  className="h-7 w-[5.5rem] px-1.5 text-xs font-semibold"
                />
              ) : onStartTimeChange ? (
                <button
                  type="button"
                  onClick={() => setEditingStart(true)}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {format(date, 'HH:mm')}
                </button>
              ) : (
                <span className="font-semibold text-foreground">{format(date, 'HH:mm')}</span>
              )}
              {!editingStart && <span className="font-semibold text-foreground">→ {endTime}</span>}
              <span className="ml-auto text-muted-foreground">{t('duration')}</span>
              <Input
                type="number"
                min={5}
                step={5}
                value={durationMin || ''}
                onChange={(e) => onDurationChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="h-7 w-14 px-1.5 text-xs"
              />
            </div>
          </Field>

          {/* Patient */}
          <Field icon={UserRound}>{patientSelector}</Field>
        </>
      )}

      {/* Debt warning */}
      {patient && hasDebt && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 dark:bg-destructive/15">
          <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {patientDebt!.map((d) => `${d.currency} ${d.amount.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`).join(' · ')}
          </span>
          {onViewStatement && (
            <button type="button" onClick={onViewStatement} className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" title={t('viewStatement')}>
              <FileText className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Cancelled appointments count */}
      {patient && (cancelledCount ?? 0) > 0 && (
        <span className="flex items-center gap-1 pl-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <CalendarX2 className="h-3 w-3 shrink-0" />
          {t('cancelledAppointments', { count: cancelledCount! })}
        </span>
      )}

      {variant !== 'custom' && (
        <>
          {/* Service */}
          {serviceField}

          {/* Note */}
          <Field icon={StickyNote}>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={t('notePlaceholder')}
              rows={2}
              className="min-h-[2.25rem] resize-none px-2 py-1 text-xs"
            />
          </Field>
        </>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-border/70 pt-2">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onCancel} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={onSave} disabled={isSaving || !patient}>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saveLabel ?? t('save')}
        </Button>
      </div>
    </div>
  );
}
