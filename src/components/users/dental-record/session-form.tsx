'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Paperclip, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import type { DoctorOption } from '@/services/dental-record';

export interface SessionFormValues {
  date: string;
  description: string;
  notes: string;
  files: File[];
  doctorId: string;
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
}

export function SessionForm({
  defaultDate,
  defaultDescription,
  doctors = [],
  notes: controlledNotes,
  onNotesChange,
  onSave,
  onCancel,
}: SessionFormProps) {
  const t = useTranslations('DentalRecord');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [doctorId, setDoctorId] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const notes = controlledNotes !== undefined ? controlledNotes : internalNotes;
  const setNotes = (v: string) => { if (onNotesChange) onNotesChange(v); else setInternalNotes(v); };
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ date, description, notes, files, doctorId });
    } catch {
      setError(t('session.saveError'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border bg-background p-4">
      <h3 className="text-sm font-semibold text-foreground">{t('session.newTitle')}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Date */}
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

        {/* Description */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{t('session.description')}</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('session.descriptionPlaceholder')}
            className="h-8 text-xs"
            maxLength={120}
          />
        </div>
      </div>

      {/* Doctor */}
      {doctors.length > 0 && (
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
