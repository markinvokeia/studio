'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { addMonths, format } from 'date-fns';
import { CalendarIcon, Loader2, Paperclip, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { DoctorOption } from '@/services/dental-record';

export interface SessionFormValues {
  date: string;
  description: string;
  notes: string;
  files: File[];
  doctorId: string;
  shouldDischarge?: boolean;
  dischargeDate?: string;
  nextSessionPlan?: string;
  nextSessionDate?: string;
}

interface SessionFormProps {
  defaultDate?: string;
  defaultDescription?: string;
  doctors?: DoctorOption[];
  /** Controlled notes value — when provided, parent owns the notes state */
  notes?: string;
  onNotesChange?: (v: string) => void;
  onSave: (values: SessionFormValues) => Promise<void>;
  onCancel: () => void;
  lockDoctorId?: string;
  lockDoctorName?: string;
}

export function SessionForm({
  defaultDate,
  defaultDescription,
  doctors = [],
  notes: controlledNotes,
  onNotesChange,
  onSave,
  onCancel,
  lockDoctorId,
  lockDoctorName,
}: SessionFormProps) {
  const t = useTranslations('DentalRecord');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(defaultDate ?? '');
  useEffect(() => {
    if (!defaultDate && !date) setDate(new Date().toISOString().split('T')[0]);
  }, [defaultDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [doctorId, setDoctorId] = useState(lockDoctorId ?? '');
  const [internalNotes, setInternalNotes] = useState('');
  const notes = controlledNotes !== undefined ? controlledNotes : internalNotes;
  const setNotes = (v: string) => { if (onNotesChange) onNotesChange(v); else setInternalNotes(v); };
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldDischarge, setShouldDischarge] = useState(false);
  const [dischargeDate, setDischargeDate] = useState('');
  const [selectedDischargePreset, setSelectedDischargePreset] = useState<number | null>(null);
  const [nextSessionPlan, setNextSessionPlan] = useState('');
  const [nextSessionDate, setNextSessionDate] = useState('');

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles((prev) => [...prev, ...Array.from(incoming)]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError(t('session.descriptionRequired')); return; }
    if (doctors.length > 0 && !doctorId) { setError(t('session.doctorRequired')); return; }
    if (shouldDischarge && !dischargeDate) {
      setError(t('session.discharge.dateRequired'));
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ date, description, notes, files, doctorId, shouldDischarge, dischargeDate, nextSessionPlan, nextSessionDate });
    } catch {
      setError(t('session.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{t('session.newTitle')}</h3>

      {/* Hidden title — still sent to the API but not shown to the user */}
      <input type="hidden" value={description} readOnly />

      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t('session.date')}</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-8 text-xs"
          required
        />
      </div>

      {/* Doctor */}
      {lockDoctorId ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('session.doctor')}</Label>
          <div className="h-8 flex items-center rounded-md border border-input bg-muted/50 px-3 text-xs text-foreground">
            {lockDoctorName ?? lockDoctorId}
          </div>
        </div>
      ) : doctors.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            {t('session.doctor')}
            <span className="text-destructive ml-0.5">*</span>
          </Label>
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={t('session.doctorPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t('session.notes')}</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('session.notesPlaceholder')}
          className="min-h-[80px] text-xs resize-y"
          rows={4}
        />
      </div>

      {/* File attachments */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t('session.files')}</Label>
        <div
          className={cn(
            'rounded-lg border-2 border-dashed p-3 text-center cursor-pointer transition-colors text-xs text-muted-foreground',
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
        >
          <Paperclip className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          {t('session.filesDrop')}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="flex flex-col gap-1 mt-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Session Plan */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t('session.nextSessionPlan')}</Label>
        <Textarea
          value={nextSessionPlan}
          onChange={(e) => setNextSessionPlan(e.target.value)}
          placeholder={t('session.nextSessionPlanPlaceholder')}
          className="min-h-[60px] text-xs resize-y"
          rows={3}
        />
      </div>

      {/* Next Session Date */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs">{t('session.nextSessionDate')}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('w-full justify-start text-left font-normal h-8 text-xs border-input', !nextSessionDate && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {nextSessionDate
                ? format(new Date(nextSessionDate + 'T00:00:00'), 'dd/MM/yyyy')
                : t('session.nextSessionDatePlaceholder')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={nextSessionDate ? new Date(nextSessionDate + 'T00:00:00') : undefined}
              onSelect={(d) => setNextSessionDate(d ? format(d, 'yyyy-MM-dd') : '')}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Discharge */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <Checkbox
            id="discharge-patient-session"
            checked={shouldDischarge}
            onCheckedChange={(checked) => {
              const enabled = Boolean(checked);
              setShouldDischarge(enabled);
              if (!enabled) setDischargeDate('');
            }}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="discharge-patient-session" className="cursor-pointer text-sm font-medium">
              {t('session.discharge.checkboxLabel')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('session.discharge.checkboxDescription')}
            </p>
          </div>
        </div>

        {shouldDischarge && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">
                {t('session.discharge.optionsLabel')}
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={selectedDischargePreset === 1 ? 'default' : 'secondary'} size="sm" className="rounded-full"
                  onClick={() => { setDischargeDate(format(addMonths(new Date(), 1), 'yyyy-MM-dd')); setSelectedDischargePreset(1); }}>
                  {t('session.discharge.option1Month')}
                </Button>
                <Button type="button" variant={selectedDischargePreset === 3 ? 'default' : 'secondary'} size="sm" className="rounded-full"
                  onClick={() => { setDischargeDate(format(addMonths(new Date(), 3), 'yyyy-MM-dd')); setSelectedDischargePreset(3); }}>
                  {t('session.discharge.option3Months')}
                </Button>
                <Button type="button" variant={selectedDischargePreset === 6 ? 'default' : 'secondary'} size="sm" className="rounded-full"
                  onClick={() => { setDischargeDate(format(addMonths(new Date(), 6), 'yyyy-MM-dd')); setSelectedDischargePreset(6); }}>
                  {t('session.discharge.option6Months')}
                </Button>
                <Button type="button" variant={selectedDischargePreset === 12 ? 'default' : 'secondary'} size="sm" className="rounded-full"
                  onClick={() => { setDischargeDate(format(addMonths(new Date(), 12), 'yyyy-MM-dd')); setSelectedDischargePreset(12); }}>
                  {t('session.discharge.option1Year')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('session.discharge.dateLabel')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal h-10 border-input', !dischargeDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dischargeDate
                      ? format(new Date(dischargeDate + 'T00:00:00'), 'dd/MM/yyyy')
                      : t('session.discharge.datePlaceholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dischargeDate ? new Date(dischargeDate + 'T00:00:00') : undefined}
                    onSelect={(date) => { setDischargeDate(date ? format(date, 'yyyy-MM-dd') : ''); setSelectedDischargePreset(null); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          {t('session.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t('session.save')}
        </Button>
      </div>
    </form>
  );
}
