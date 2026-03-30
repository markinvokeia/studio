'use client';

import { IMPORT_SCHEMAS, ImportEntityType } from '@/config/import-schemas';
import { WizardStepper } from '@/components/import/WizardStepper';
import { StepSelectType } from '@/components/import/steps/StepSelectType';
import { StepUploadFile } from '@/components/import/steps/StepUploadFile';
import { StepPreview } from '@/components/import/steps/StepPreview';
import { StepMapColumns, buildAutoMapping, ColumnMapping } from '@/components/import/steps/StepMapColumns';
import { StepValidate, validateData, ValidationResult } from '@/components/import/steps/StepValidate';
import { StepResult, ImportResult } from '@/components/import/steps/StepResult';
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
    if (currentStep === 3) return true; // mapping is optional
    if (currentStep === 4) return false; // handled by validate actions
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
      // Moving from mapping to validate: run validation
      const result = validateData(parsedData.rows, parsedData.headers, columnMapping, schema);
      setValidationResult(result);
    }
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, [currentStep, parsedData, schema, columnMapping]);

  const handleBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const handleImportValid = useCallback(() => {
    if (!validationResult) return;
    // Simulación: ir directo al resultado sin llamar al API
    setImportResult({
      imported: validationResult.valid,
      skipped: validationResult.invalid,
      errors: 0,
    });
    setCurrentStep(5);
  }, [validationResult]);

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

  // Mapping stats
  const mappedCount = Object.values(columnMapping).filter(Boolean).length;
  const ignoredCount = Object.values(columnMapping).filter((v) => !v).length;
  const notUpdatedCount = schema
    ? schema.fields.filter((f) => !Object.values(columnMapping).includes(f.key)).length
    : 0;

  const showPills = currentStep > 0 && selectedLabel;

  return (
    <div className="flex flex-col gap-4">
      {/* Stepper */}
      <WizardStepper currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {/* Context pills */}
      {showPills && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Pill label="Tipo" value={selectedLabel} color="primary" />

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
              <Pill label="Columnas sin mapear en BD" value={String(notUpdatedCount)} color="warning" />
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
              <Pill label="Importados" value={String(importResult.imported)} color="success" />
              <Pill label="Omitidos" value={String(importResult.skipped)} color="muted" />
              <Pill label="Errores" value={String(importResult.errors)} color="danger" />
            </>
          )}
        </div>
      )}

      {/* Step header */}
      <div className="border-b pb-3">
        <h2 className="text-lg font-semibold">{stepTitles[currentStep]}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{stepDescriptions[currentStep]}</p>
      </div>

      {/* Step content — scrollable area */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 440px)', minHeight: '220px' }}>
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
            isImporting={false}
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

      {/* Navigation buttons — always visible, hidden only on result step */}
      {currentStep !== 5 && (
        <div className="flex items-center justify-between border-t pt-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('nav.back')}
          </button>

          {/* On validate step show hint instead of next */}
          {currentStep === 4 ? (
            <span className="text-xs text-muted-foreground">
              Usá los botones de arriba para importar o corregir
            </span>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              {t('nav.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
