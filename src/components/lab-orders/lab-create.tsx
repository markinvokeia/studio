'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { DuplicateContactDialog, UniqueConflictDialog } from '@/components/patients/duplicate-contact-dialog';
import { saveProviderGroups } from '@/components/providers/provider-groups-field';

import { useToast } from '@/hooks/use-toast';
import { normalizePersonName } from '@/lib/person-name';
import { api, REQUEST_TIMEOUT_MS } from '@/services/api';
import { extractCreatedUserId } from '@/services/users';

import { API_ROUTES } from '@/constants/routes';
import type { DuplicateContactOwners, LabCategory, Laboratory, UniqueConflict } from '@/lib/types';

export interface NewLaboratoryInput {
  name: string;
  phone: string;
  email: string;
  /** Especialidades (categorías de laboratorio): al menos una, es lo que lo hace laboratorio. */
  categoryIds: string[];
}

/** Busca el proveedor recién creado cuando el upsert no devuelve el id. */
async function findCreatedProvider(name: string): Promise<string | null> {
  const data = await api.get(API_ROUTES.USERS, { filter_type: 'PROVEEDOR', search: name });
  const first = Array.isArray(data) ? data[0] : data;
  const rows: any[] = first?.json?.data || first?.data || [];
  const match = rows.find((u) => String(u.name ?? '').toLowerCase() === name.toLowerCase());
  return match?.id != null ? String(match.id) : null;
}

/**
 * Alta de un laboratorio: crea el proveedor y lo asigna a sus especialidades (grupos de
 * proveedores marcados como categoría de laboratorio). Maneja los avisos de contacto
 * repetido: `dialogs` se monta donde se use, y al confirmar se reintenta solo.
 */
export function useLaboratoryCreator({ categories, onCreated }: {
  /** Para devolver el laboratorio con los nombres de sus especialidades. */
  categories: LabCategory[] | null;
  onCreated: (lab: Laboratory) => void;
}) {
  const t = useTranslations('LabOrdersPage.labSelector');
  const tEntity = useTranslations('EntitySelectors');
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [duplicateOwners, setDuplicateOwners] = React.useState<DuplicateContactOwners | null>(null);
  const [uniqueConflict, setUniqueConflict] = React.useState<UniqueConflict | null>(null);
  const savingRef = React.useRef(false);
  const lastInputRef = React.useRef<NewLaboratoryInput | null>(null);

  const create = async (input: NewLaboratoryInput, confirmDuplicates = false) => {
    const name = normalizePersonName(input.name);
    if (!name || savingRef.current) return;
    if (input.categoryIds.length === 0) {
      setError(t('categoriesRequired'));
      return;
    }
    savingRef.current = true;
    lastInputRef.current = input;
    setIsSaving(true);
    setError(null);
    try {
      const response = await api.post(API_ROUTES.USERS_UPSERT, {
        name,
        phone: input.phone.trim() || '',
        email: input.email.trim() || '',
        filter_type: 'PROVEEDOR',
        is_sales: false,
        is_active: true,
        ...(confirmDuplicates ? { confirm_duplicates: true } : {}),
      }, undefined, undefined, { timeoutMs: REQUEST_TIMEOUT_MS.mutation });

      const errPayload = response?.error;
      if (errPayload?.code === 'duplicate_contact' && errPayload.owners) { setDuplicateOwners(errPayload.owners); return; }
      if (errPayload?.code === 'unique_conflict') {
        setUniqueConflict({ conflictedFields: errPayload.conflictedFields ?? [], owners: errPayload.owners ?? {} });
        return;
      }
      if (errPayload) { setError(tEntity('invalidData')); return; }

      const id = extractCreatedUserId(response) ?? await findCreatedProvider(name);
      if (!id) { setError(t('createError')); return; }

      try {
        await saveProviderGroups(id, input.categoryIds);
      } catch {
        // El proveedor ya existe: se usa igual (el backend acepta cualquier proveedor) y se avisa.
        toast({ variant: 'destructive', title: t('categoriesFailedTitle'), description: t('categoriesFailedDescription', { name }) });
      }
      const chosen = (categories ?? []).filter((c) => input.categoryIds.includes(c.id));
      onCreated({
        id,
        name,
        phone_number: input.phone.trim() || null,
        email: input.email.trim() || null,
        categories: chosen.map((c) => ({ id: c.id, name: c.name })),
      });
    } catch (err: any) {
      const errPayload = err?.data?.error || err?.error;
      if (errPayload?.code === 'duplicate_contact' && errPayload.owners) setDuplicateOwners(errPayload.owners);
      else if (errPayload?.code === 'unique_conflict') {
        setUniqueConflict({ conflictedFields: errPayload.conflictedFields ?? [], owners: errPayload.owners ?? {} });
      } else setError(t('createError'));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const dialogs = (
    <>
      <DuplicateContactDialog
        owners={duplicateOwners}
        onCancel={() => setDuplicateOwners(null)}
        onConfirm={() => {
          setDuplicateOwners(null);
          if (lastInputRef.current) void create(lastInputRef.current, true);
        }}
      />
      <UniqueConflictDialog conflict={uniqueConflict} onClose={() => setUniqueConflict(null)} />
    </>
  );

  /** Hay un aviso de contacto repetido abierto encima: no cerrar lo de abajo. */
  const isAsking = Boolean(duplicateOwners || uniqueConflict);

  return { create, isSaving, error, setError, dialogs, isAsking };
}
