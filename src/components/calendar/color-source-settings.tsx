'use client';

import * as React from 'react';
import { Save, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

import { Can } from '@/components/auth/Can';

import { CALENDAR_DISPLAY_PERMISSIONS } from '@/constants/permissions';
import type { CalendarColorSources, InheritedColorLevel } from '@/lib/types';

const LEVELS: InheritedColorLevel[] = ['service', 'doctor', 'calendar'];

interface ColorSourceSettingsProps {
  value: CalendarColorSources;
  onChange: (next: CalendarColorSources) => void;
  /** Sin permiso de edición, o con una operación en curso. */
  disabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  /** Solo en el alcance de un calendario: true si ya tiene override propio. */
  hasOverride?: boolean;
  onRevert?: () => void;
  isReverting?: boolean;
}

/**
 * Configuración → Colores de calendario → Origen del color. Qué niveles de la
 * cadena (servicio > doctor > calendario) cuentan al pintar una cita. El color
 * propio de la cita es la etiqueta que elige el usuario y siempre gana.
 */
export function ColorSourceSettings({
  value,
  onChange,
  disabled,
  isDirty,
  isSaving,
  onSave,
  hasOverride,
  onRevert,
  isReverting,
}: ColorSourceSettingsProps) {
  const t = useTranslations('CalendarColorsPage.colorSource');
  const allOff = LEVELS.every((level) => !value[level]);

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{t('title')}</h3>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{t('description')}</p>
        </div>
        <Can permission={CALENDAR_DISPLAY_PERMISSIONS.UPDATE}>
          <div className="flex items-center gap-2">
            {onRevert && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRevert}
                disabled={disabled || !hasOverride}
                loading={isReverting}
                className="gap-1.5"
              >
                <Undo2 className="h-4 w-4" />
                {t('revert')}
              </Button>
            )}
            <Button size="sm" onClick={onSave} disabled={disabled || !isDirty} loading={isSaving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {t('save')}
            </Button>
          </div>
        </Can>
      </div>

      <ul className="divide-y rounded-lg border">
        <li className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('levels.appointment.label')}</p>
            <p className="text-xs text-muted-foreground">{t('levels.appointment.help')}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{t('alwaysActive')}</span>
        </li>
        {LEVELS.map((level) => (
          <li key={level} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <label htmlFor={`color-source-${level}`} className="cursor-pointer text-sm font-medium">
                {t(`levels.${level}.label`)}
              </label>
              <p className="text-xs text-muted-foreground">{t(`levels.${level}.help`)}</p>
            </div>
            <Switch
              id={`color-source-${level}`}
              checked={value[level]}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...value, [level]: checked })}
            />
          </li>
        ))}
      </ul>

      {allOff && <p className="text-xs text-amber-600 dark:text-amber-400">{t('allOffWarning')}</p>}
      {hasOverride !== undefined && (
        <p className="text-xs text-muted-foreground">{hasOverride ? t('customizedHint') : t('inheritedHint')}</p>
      )}
    </section>
  );
}
