'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Building2, ChevronsUpDown, Clock, FileText, Loader2, Stethoscope, UserCog, UserRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InlineEntityPicker } from '@/components/appointments/InlineEntityPicker';
import { InlineServicePicker } from '@/components/calendar/inline-service-picker';
import { UserSelector } from '@/components/ui/user-selector';
import type { Calendar as CalendarType, Service, User } from '@/lib/types';

interface InlineAppointmentDraftProps {
  date: Date;
  endTime: string;
  durationMin: number;
  onDurationChange: (min: number) => void;
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
  overlapWarning?: boolean;
  patientDebt?: { currency: string; amount: number }[];
  onViewStatement?: () => void;
  isSaving?: boolean;
  onSave: () => void;
  onCancel: () => void;
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

/**
 * Compact in-canvas appointment creation form rendered inside a draft card. Room
 * and doctor are pre-filled from the view but editable; only duration is editable
 * among the time fields. Background is a very light violet.
 */
export function InlineAppointmentDraft({
  date,
  endTime,
  durationMin,
  onDurationChange,
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
  overlapWarning,
  patientDebt,
  onViewStatement,
  isSaving,
  onSave,
  onCancel,
}: InlineAppointmentDraftProps) {
  const t = useTranslations('AppointmentsPage.inlineCreate');
  const [serviceOpen, setServiceOpen] = React.useState(false);
  const hasDebt = (patientDebt?.length ?? 0) > 0;

  const toggleService = (svc: Service) => {
    const exists = services.some((s) => s.id === svc.id);
    onServicesChange(exists ? services.filter((s) => s.id !== svc.id) : [...services, svc]);
  };

  return (
    <div className="flex h-full flex-col gap-1.5 overflow-auto rounded-lg border border-primary/40 bg-primary/5 p-2 text-xs shadow-lg ring-1 ring-primary/20 backdrop-blur-sm">
      {/* Header: title + close */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{t('title')}</span>
        <button type="button" onClick={onCancel} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label={t('cancel')}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {overlapWarning && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t('overlapWarning')}
        </span>
      )}

      {/* Room (calendar) */}
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

      {/* Doctor */}
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

      {/* Time: start → end + duration (only editable) */}
      <Field icon={Clock}>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">{format(date, 'HH:mm')} → {endTime}</span>
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
      <Field icon={UserRound}>
        <UserSelector
          filterType="PACIENTE"
          isSales
          value={patient?.id}
          selectedUserName={patient?.name}
          onValueChange={(_, u) => onPatientChange(u ?? null)}
          triggerText={t('selectPatient')}
          placeholder={t('searchPatient')}
          className="h-7 text-xs"
        />
      </Field>

      {/* Debt warning */}
      {patient && hasDebt && (
        <div className="flex items-center justify-between gap-2 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-1">
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

      {/* Service */}
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

      {/* Actions */}
      <div className="mt-auto flex items-center justify-end gap-1.5 pt-1">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onCancel} disabled={isSaving}>
          {t('cancel')}
        </Button>
        <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={onSave} disabled={isSaving || !patient}>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
