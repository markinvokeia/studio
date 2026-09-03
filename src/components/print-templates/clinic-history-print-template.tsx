'use client';

import { useTranslations } from 'next-intl';
import { formatDisplayDate } from '@/lib/utils';
import type { ClinicHistoryPrintData } from '@/stores/print-document-store';
import type { MedicationItem } from '@/hooks/useClinicHistory';

interface ClinicHistoryPrintTemplateProps {
  data: ClinicHistoryPrintData;
}

const RELATIONSHIP_KEYS: Record<string, string> = {
  padre: 'father',
  madre: 'mother',
  abuelo_paterno: 'paternalGrandfather',
  abuela_paterna: 'paternalGrandmother',
  abuelo_materno: 'maternalGrandfather',
  abuela_materna: 'maternalGrandmother',
  hermano: 'siblingBrother',
  hermana: 'sister',
  tio: 'uncle',
  tia: 'aunt',
  primo: 'cousin',
  hijo: 'son',
  hija: 'daughter',
  conyuge: 'spouse',
};

function fmtDate(value?: string | null): string {
  if (!value) return '';
  const out = formatDisplayDate(value);
  return out === 'N/A' || out === 'Invalid Date' ? '' : out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 print-template-section">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 border-b border-gray-300 pb-1 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One stacked "Label: value" line inside the session table's Detail column. */
function DetailLine({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? 'text-[11px] leading-snug text-gray-500' : 'leading-snug'}>
      <span className="font-medium text-gray-600">{label}: </span>
      {value}
    </div>
  );
}

export function ClinicHistoryPrintTemplate({ data }: ClinicHistoryPrintTemplateProps) {
  const t = useTranslations('ClinicHistoryPrint');
  const tRel = useTranslations('ClinicHistoryPage.anamnesis.dialogs.family');
  const { patient, personalHistory, familyHistory, allergies, medications, habits, sessions, emittedAt } = data;

  const relationshipLabel = (parentesco: string): string => {
    const key = RELATIONSHIP_KEYS[parentesco];
    return key ? tRel(key) : parentesco;
  };

  const activeMeds = medications.filter((m) => !m.fecha_fin);
  const pastMeds = medications.filter((m) => !!m.fecha_fin);

  const medLine = (m: MedicationItem): string => {
    const parts = [m.dosis, m.frecuencia].filter(Boolean).join(' · ');
    const range = [fmtDate(m.fecha_inicio), fmtDate(m.fecha_fin)].filter(Boolean).join(' – ');
    return [parts, range && `(${range})`, m.motivo].filter(Boolean).join('  ');
  };

  const habitRows = habits
    ? [
        habits.tabaquismo && { label: t('habits.smoking'), value: habits.tabaquismo },
        habits.alcoholismo && { label: t('habits.alcohol'), value: habits.alcoholismo },
        habits.bruxismo && { label: t('habits.bruxism'), value: habits.bruxismo },
        habits.otros && { label: t('habits.other'), value: habits.otros },
        habits.comentarios && { label: t('habits.comments'), value: habits.comentarios },
      ].filter(Boolean as unknown as (v: unknown) => v is { label: string; value: string })
    : [];

  return (
    <div className="account-statement-print text-gray-900">
      {/* Title */}
      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-gray-300">
        <h1 className="text-2xl font-bold tracking-tight uppercase">{t('title')}</h1>
        <span className="text-sm text-gray-500">
          {t('emittedOn')} {formatDisplayDate(emittedAt)}
        </span>
      </div>

      {/* Patient info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-6 text-sm print-template-section">
        <div>
          <span className="text-gray-500">{t('patient.name')}: </span>
          <span className="font-medium">{patient.name || '—'}</span>
        </div>
        {patient.identityDocument && (
          <div>
            <span className="text-gray-500">{t('patient.document')}: </span>
            <span className="font-medium">{patient.identityDocument}</span>
          </div>
        )}
        {patient.birthDate && (
          <div>
            <span className="text-gray-500">{t('patient.birthDate')}: </span>
            <span className="font-medium">{fmtDate(patient.birthDate)}</span>
          </div>
        )}
        {patient.email && (
          <div>
            <span className="text-gray-500">{t('patient.email')}: </span>
            <span className="font-medium">{patient.email}</span>
          </div>
        )}
        {patient.phone && (
          <div>
            <span className="text-gray-500">{t('patient.phone')}: </span>
            <span className="font-medium">{patient.phone}</span>
          </div>
        )}
      </div>

      {/* ── Anamnesis ─────────────────────────────────────────────────────────── */}
      <h2 className="text-base font-bold uppercase tracking-wide mb-3">{t('anamnesis')}</h2>

      {/* Allergies first — clinical safety. */}
      <Section title={t('allergies')}>
        {allergies.length > 0 ? (
          <ul className="space-y-1">
            {allergies.map((a, i) => (
              <li key={a.id ?? i} className="text-sm">
                <span className="font-semibold text-red-700">{a.alergeno}</span>
                {a.reaccion_descrita && <span className="text-gray-600"> — {a.reaccion_descrita}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('personalHistory')}>
        {personalHistory.length > 0 ? (
          <ul className="space-y-1">
            {personalHistory.map((p, i) => (
              <li key={p.id ?? i} className="text-sm">
                <span className="font-medium">{p.nombre}</span>
                {p.comentarios && <span className="text-gray-600"> — {p.comentarios}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('familyHistory')}>
        {familyHistory.length > 0 ? (
          <ul className="space-y-1">
            {familyHistory.map((f, i) => (
              <li key={f.id ?? i} className="text-sm">
                <span className="font-medium">{f.nombre}</span>
                <span className="text-gray-600"> — {t('relative')}: {relationshipLabel(f.parentesco)}</span>
                {f.comentarios && <span className="text-gray-600"> — {f.comentarios}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('medication')}>
        {medications.length > 0 ? (
          <div className="space-y-2 text-sm">
            {activeMeds.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700">{t('medicationActive')}</p>
                <ul className="space-y-0.5">
                  {activeMeds.map((m, i) => (
                    <li key={m.id ?? i}>
                      <span className="font-medium">{m.nombre_medicamento}</span>
                      {medLine(m) && <span className="text-gray-600"> — {medLine(m)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pastMeds.length > 0 && (
              <div>
                <p className="font-semibold text-gray-700">{t('medicationPast')}</p>
                <ul className="space-y-0.5">
                  {pastMeds.map((m, i) => (
                    <li key={m.id ?? i}>
                      <span className="font-medium">{m.nombre_medicamento}</span>
                      {medLine(m) && <span className="text-gray-600"> — {medLine(m)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('none')}</p>
        )}
      </Section>

      <Section title={t('habits.title')}>
        {habitRows.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {habitRows.map((h, i) => (
              <li key={i}>
                <span className="text-gray-500">{h.label}: </span>
                <span className="font-medium">{h.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t('none')}</p>
        )}
      </Section>

      {/* ── Clinical sessions ─────────────────────────────────────────────────── */}
      <h2 className="text-base font-bold uppercase tracking-wide mb-3 mt-6">{t('sessions')}</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noSessions')}</p>
      ) : (
        <table className="print-template-table w-full">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '54%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">{t('columns.date')}</th>
              <th className="text-left">{t('columns.professional')}</th>
              <th className="text-left">{t('columns.detail')}</th>
              <th className="text-left">{t('columns.next')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, idx) => {
              const treatments = (Array.isArray(s.tratamientos) ? s.tratamientos : [])
                .map((tr) => {
                  const name = tr.descripcion || tr.service_name || '';
                  return tr.numero_diente != null ? `${name} (${t('field.tooth')} ${tr.numero_diente})` : name;
                })
                .filter(Boolean)
                .join('; ');
              const odontogram =
                s.estado_odontograma && typeof s.estado_odontograma === 'object'
                  ? Object.entries(s.estado_odontograma as Record<string, any>)
                      .map(([tooth, info]) => `${tooth}: ${info?.condition ?? '—'}${info?.surface ? ` (${info.surface})` : ''}`)
                      .join('; ')
                  : '';
              const attachments = (Array.isArray(s.archivos_adjuntos) ? s.archivos_adjuntos : [])
                .map((f) => f.file_name || f.tipo || t('field.file'))
                .join(', ');
              const hasDetail =
                s.procedimiento_realizado || s.diagnostico || s.pieza || s.notas_clinicas || treatments || odontogram || attachments;
              const hasNext = s.plan_proxima_cita || s.fecha_proxima_cita;

              return (
                <tr key={`${s.sesion_id}-${idx}`} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                  <td className="align-top">
                    <div className="whitespace-nowrap font-medium">{fmtDate(s.fecha_sesion) || t('noDate')}</div>
                    {s.tipo_sesion && (
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        {s.tipo_sesion === 'odontograma' ? t('sessionTypeOdontogram') : t('sessionTypeClinical')}
                      </div>
                    )}
                  </td>
                  <td className="align-top">{s.doctor_name || s.nombre_doctor || '—'}</td>
                  <td className="align-top">
                    <div className="space-y-0.5">
                      {s.procedimiento_realizado && <DetailLine label={t('field.procedure')} value={s.procedimiento_realizado} />}
                      {s.diagnostico && <DetailLine label={t('field.diagnosis')} value={s.diagnostico} />}
                      {s.pieza && <DetailLine label={t('field.tooth')} value={s.pieza} />}
                      {s.notas_clinicas && <DetailLine label={t('field.notes')} value={s.notas_clinicas} />}
                      {treatments && <DetailLine label={t('field.treatments')} value={treatments} />}
                      {odontogram && <DetailLine label={t('field.odontogramUpdate')} value={odontogram} />}
                      {attachments && <DetailLine label={t('field.attachments')} value={attachments} muted />}
                      {!hasDetail && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="align-top">
                    {s.plan_proxima_cita && <div className="leading-snug">{s.plan_proxima_cita}</div>}
                    {s.fecha_proxima_cita && (
                      <div className="whitespace-nowrap text-gray-500">{fmtDate(s.fecha_proxima_cita)}</div>
                    )}
                    {!hasNext && <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
