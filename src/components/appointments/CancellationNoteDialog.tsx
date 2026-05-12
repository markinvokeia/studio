'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface CancellationNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
}

export function CancellationNoteDialog({ open, onOpenChange, onConfirm }: CancellationNoteDialogProps) {
  const t = useTranslations('CancellationDialog');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const trimmed = note.trim();
  const disabled = trimmed.length === 0;

  const handleConfirm = () => {
    if (disabled) return;
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('placeholder')}
          rows={4}
          autoFocus
          className="resize-none"
        />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('back')}
          </Button>
          <Button variant="destructive" disabled={disabled} onClick={handleConfirm}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
