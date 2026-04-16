'use client';

import { IMPORT_SCHEMAS, ImportEntityType } from '@/config/import-schemas';
import { WizardStepper } from '@/components/import/WizardStepper';
import { StepSelectType } from '@/components/import/steps/StepSelectType';
import { StepUploadFile } from '@/components/import/steps/StepUploadFile';
import { StepPreview } from '@/components/import/steps/StepPreview';
import { StepMapColumns, buildAutoMapping, ColumnMapping } from '@/components/import/steps/StepMapColumns';
import { StepValidate, validateData, ValidationResult } from '@/components/import/steps/StepValidate';
import { StepResult, ImportResult } from '@/components/import/steps/StepResult';
import { api } from '@/services/api';
import { API_ROUTES } from '@/constants/routes';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

type PillColor = 'primary' | 'success' | 'warning' | 'danger' | 'muted';

function Pill({
  label,
  value,
  color = 'muted',
  title,
}: {
  label: string;
  value: string;
  color?: PillColor;
  title?: string;
}) {
  const colorClass: Record<PillColor, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', colorClass[color])}
      title={title}
    >
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

const TOTAL_STEPS = 6;

interface ParsedData {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

function parseCsv(text: string): ParsedData {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((v) => v.trim());
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows, totalRows: rows.length };
}

export function ImportWizard() {
  const t = useTranslations('ImportPage');

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<ImportEntityType | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const schema = selectedType ? IMPORT_SCHEMAS[selectedType] : null;

  const stepTitles = [
    t('stepTitles.selectType'),
    t('stepTitles.upload'),
    t('stepTitles.preview'),
    t('stepTitles.mapping'),
    t('stepTitles.validate'),
    t('stepTitles.result'),
  ];

  const stepDescriptions = [
    t('stepDescriptions.selectType'),
    t('stepDescriptions.upload'),
    t('stepDescriptions.preview'),
    t('stepDescriptions.mapping'),
    t('stepDescriptions.validate'),
    t('stepDescriptions.result'),
  ];

  const canGoNext = useCallback((): boolean => {
    if (currentStep === 0) return selectedType !== null;
    if (currentStep === 1) return uploadedFile !== null && parsedData !== null;
    if (currentStep === 2) return parsedData !== null && parsedData.headers.length > 0;
    if (currentStep === 3) return true;
    if (currentStep === 4) return false;
    return false;
  }, [currentStep, selectedType, uploadedFile, parsedData]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setUploadedFile(file);
      const text = await file.text();
      const data = parseCsv(text);
      setParsedData(data);
      if (selectedType && schema) {
        setColumnMapping(buildAutoMapping(data.headers, schema.fields));
      }
    },
    [selectedType, schema]
  );

  const handleFileClear = useCallback(() => {
    setUploadedFile(null);
    setParsedData(null);
    setColumnMapping({});
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep === 3 && parsedData && schema) {
      const result = validateData(parsedData.rows, parsedData.headers, columnMapping, schema);
      setValidationResult(result);
    }
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [currentStep, parsedData, schema, columnMapping]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleImportValid = useCallback(async () => {
    if (!parsedData || !schema || !validationResult) return;
    setIsImporting(true);
    try {
      const reverseMapping: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([csvHeader, fieldKey]) => {
        if (fieldKey) reverseMapping[fieldKey] = csvHeader;
      });

      const errorRows = new Set(validationResult.errors.map((e) => e.row - 1));
      const validRows = parsedData.rows.filter((_, i) => !errorRows.has(i));

      const records = validRows.map((row) => {
        const record: Record<string, string> = {};
        schema.fields.forEach((field) => {
          const csvHeader = reverseMapping[field.key];
          if (!csvHeader) return;
          const colIndex = parsedData.headers.indexOf(csvHeader);
          if (colIndex >= 0) record[field.key] = row[colIndex] ?? '';
        });
        return record;
      });

      const response = await api.post(API_ROUTES.SYSTEM.DATA_IMPORT, {
        entity: schema.type,
        records,
      });

      setImportResult({
        inserted: response.inserted ?? 0,
        updated: response.updated ?? 0,
        skipped: response.skipped ?? 0,
        errors: response.errors ?? 0,
        error_details: response.error_details ?? [],
      });
      setCurrentStep(5);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo completar la importación. Intente nuevamente.',
      });
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, schema, validationResult, columnMapping, toast]);

  const handleFixCsv = useCallback(() => {
    setCurrentStep(1);
    handleFileClear();
  }, [handleFileClear]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSelectedType(null);
    setUploadedFile(null);
    setParsedData(null);
    setColumnMapping({});
    setValidationResult(null);
    setImportResult(null);
  }, []);

  const selectedLabel = selectedType
    ? t(`entityTypes.${IMPORT_SCHEMAS[selectedType].labelKey}`)
    : null;

  const truncatedFileName =
    uploadedFile && uploadedFile.name.length > 30
      ? uploadedFile.name.slice(0, 27) + '...'
      : uploadedFile?.name ?? null;

  const mappedCount = Object.values(columnMapping).filter(Boolean).length;
  const ignoredCount = Object.values(columnMapping).filter((v) => !v).length;
  const notUpdatedCount = schema
    ? schema.fields.filter((f) => !Object.values(columnMapping).includes(f.key)).length
    : 0;

  const showPills = currentStep > 0 && selectedLabel;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Stepper */}
      <div className="flex-none px-4 pt-4">
        <WizardStepper currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      </div>

      {/* Context pills */}
      {showPills && (
        <div className="flex-none px-4 pt-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2">
            <Pill label="Tipo" value={selectedLabel!} color="primary" />
            {truncatedFileName && currentStep > 1 && (
              <Pill label="Archivo" value={truncatedFileName} title={uploadedFile?.name} />
            )}
            {parsedData && currentStep > 2 && (
              <>
                <Pill label="Registros" value={String(parsedData.totalRows)} />
                <Pill label="Columnas" value={String(parsedData.headers.length)} />
              </>
            )}
            {parsedData && currentStep > 3 && (
              <>
                <Pill label="Mapeadas" value={String(mappedCount)} color="success" />
                <Pill label="Ignoradas" value={String(ignoredCount)} color="muted" />
                <Pill label="Sin mapear" value={String(notUpdatedCount)} color="warning" />
              </>
            )}
            {validationResult && currentStep > 4 && (
              <>
                <Pill label="Válidos" value={String(validationResult.valid)} color="success" />
                <Pill label="Con errores" value={String(validationResult.invalid)} color="danger" />
              </>
            )}
            {importResult && currentStep === 5 && (
              <>
                <Pill label="Insertados" value={String(importResult.inserted)} color="success" />
                <Pill label="Actualizados" value={String(importResult.updated)} color="primary" />
                <Pill label="Omitidos" value={String(importResult.skipped)} color="muted" />
                <Pill label="Errores" value={String(importResult.errors)} color="danger" />
              </>
            )}
          </div>
        </div>
      )}

      {/* Step header */}
      <div className="flex-none px-4 py-3 mt-3 border-b">
        <h2 className="text-base font-semibold">{stepTitles[currentStep]}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{stepDescriptions[currentStep]}</p>
      </div>

      {/* Step content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {currentStep === 0 && (
          <StepSelectType
            selected={selectedType}
            onSelect={(type) => {
              setSelectedType(type);
              setUploadedFile(null);
              setParsedData(null);
              setColumnMapping({});
              setValidationResult(null);
            }}
          />
        )}

        {currentStep === 1 && selectedType && (
          <StepUploadFile
            entityType={selectedType}
            file={uploadedFile}
            onFileSelect={handleFileSelect}
            onFileClear={handleFileClear}
          />
        )}

        {currentStep === 2 && parsedData && (
          <StepPreview data={parsedData} />
        )}

        {currentStep === 3 && parsedData && schema && (
          <StepMapColumns
            csvHeaders={parsedData.headers}
            schema={schema}
            mapping={columnMapping}
            onChange={setColumnMapping}
          />
        )}

        {currentStep === 4 && validationResult && (
          <StepValidate
            result={validationResult}
            onImportValid={handleImportValid}
            onFixCsv={handleFixCsv}
            isImporting={isImporting}
          />
        )}

        {currentStep === 5 && importResult && (
          <StepResult
            result={importResult}
            onClose={handleReset}
            onImportAnother={handleReset}
          />
        )}
      </div>

      {/* Navigation — always visible, hidden on result step */}
      {currentStep !== 5 && (
        <div className="flex-none px-4 py-3 border-t bg-card">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('nav.back')}
            </button>

            {currentStep === 4 ? (
              <p className="hidden sm:block flex-1 text-center text-xs text-muted-foreground">
                Usá los botones de arriba para importar o corregir
              </p>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
              >
                {t('nav.next')}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
