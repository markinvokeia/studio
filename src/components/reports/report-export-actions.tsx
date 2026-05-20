'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Download, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ReportExportActionsProps {
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  onPrint?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ReportExportActions({
  onExportPDF,
  onExportExcel,
  onPrint,
  isLoading = false,
  disabled = false,
}: ReportExportActionsProps) {
  const t = useTranslations('ReportExportActions');

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-0.5 md:gap-1.5 print:hidden">
      <Button
        variant="ghost"
        onClick={handlePrint}
        disabled={disabled || isLoading}
        className="h-7 w-7 md:h-8 md:w-auto md:px-3 md:variant-outline gap-1 text-muted-foreground md:text-foreground md:border md:border-input md:bg-background hover:bg-accent"
      >
        <Printer className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{t('print')}</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            disabled={disabled || isLoading}
            className="h-7 w-7 md:h-8 md:w-auto md:px-3 gap-1 text-muted-foreground md:text-foreground md:border md:border-input md:bg-background hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('export')}</span>
            <ChevronDown className="hidden md:inline h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onExportPDF && (
            <DropdownMenuItem onClick={onExportPDF}>
              {t('exportPDF')}
            </DropdownMenuItem>
          )}
          {onExportExcel && (
            <DropdownMenuItem onClick={onExportExcel}>
              {t('exportExcel')}
            </DropdownMenuItem>
          )}
          {!onExportPDF && !onExportExcel && (
            <DropdownMenuItem disabled>{t('comingSoon')}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
