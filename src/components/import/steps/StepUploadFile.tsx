'use client';

import { IMPORT_SCHEMAS, ImportEntityType } from '@/config/import-schemas';
import { cn } from '@/lib/utils';
import { Download, FileText, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

interface StepUploadFileProps {
  entityType: ImportEntityType;
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function StepUploadFile({ entityType, file, onFileSelect, onFileClear }: StepUploadFileProps) {
  const t = useTranslations('ImportPage');
  const schema = IMPORT_SCHEMAS[entityType];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (incoming: File) => {
      setError(null);
      if (!incoming.name.endsWith('.csv')) {
        setError(t('upload.acceptedFormat'));
        return;
      }
      if (incoming.size > MAX_FILE_SIZE) {
        setError(t('upload.maxSize'));
        return;
      }
      onFileSelect(incoming);
    },
    [onFileSelect, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    // Reset input value so same file can be re-selected after clearing
    e.target.value = '';
  };

  const exampleUrl = schema.exampleCsvUrl;
  const isPlaceholder = exampleUrl === '#placeholder';

  return (
    <div className="flex flex-col gap-6">
      {/* Example CSV download */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t('upload.exampleCsv')}</p>
            <p className="text-xs text-muted-foreground">
              {t(`entityTypes.${schema.labelKey}`)} — estructura de columnas esperada
            </p>
          </div>
        </div>
        {isPlaceholder ? (
          <span className="text-xs text-muted-foreground italic">Próximamente</span>
        ) : (
          <a
            href={exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            {t('upload.exampleCsv')}
          </a>
        )}
      </div>

      {/* Drop zone */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/40'
          )}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Upload className={cn('h-7 w-7', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragOver ? t('upload.dragActive') : t('upload.dragDrop')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('upload.acceptedFormat')} · {t('upload.maxSize')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFileClear}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
