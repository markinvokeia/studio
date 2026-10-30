-- =====================================================================
-- Plantilla de receta por defecto (formato Uruguay)
--
-- Inserta una única fila en public.prescription_templates con el formato
-- clásico de receta uruguaya: membrete con datos de la clínica, bloque de
-- identificación del paciente (nombre, C.I., edad, mutualista, domicilio),
-- diagnóstico, cuerpo "Rp." con los medicamentos, firma del profesional y
-- pie con los datos de contacto.
--
-- Se separa del 068 a propósito: el 068 crea el esquema y los permisos
-- (obligatorio), esto es contenido de ejemplo que una clínica puede editar
-- o borrar sin afectar la estructura.
--
-- El HTML va entre comillas de dólar ($html$…$html$) para no tener que
-- escapar las comillas simples del atributo onerror.
--
-- El id es fijo y se usa ON CONFLICT DO NOTHING: reejecutar el script NO
-- pisa los cambios que el usuario le haya hecho a la plantilla.
--
-- Variables usadas (ver src/lib/prescription-template-variables.ts):
--   {{clinic_logo}} {{clinic_name}} {{clinic_address}} {{clinic_phone}}
--   {{clinic_email}} {{clinic_rut}}
--   {{patient_name}} {{patient_document}} {{patient_age}}
--   {{patient_birthday}} {{patient_mutual_society}} {{patient_address}}
--   {{date}} {{diagnosis}} {{notes}}
--   {{medications_list}} {{doctor_name}} {{doctor_signature}}
--
-- Idempotente. Depende de: 068.
-- =====================================================================

BEGIN;

INSERT INTO public.prescription_templates (id, name, description, content_html, is_active)
VALUES (
    'a7f3c1d2-5b8e-4a91-9c3d-6e2f8b4a1c70'::uuid,
    'Receta médica estándar',
    'Formato clásico de receta uruguaya: membrete de la clínica, datos del paciente, Rp. y firma del profesional.',
    $html$
<div style="font-family:Helvetica,Arial,sans-serif;color:#111827;max-width:720px;margin:0 auto;">

  <!-- ── Membrete ─────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:center;gap:1rem;padding-bottom:0.75rem;border-bottom:3px solid #1f2937;">
    <img src="{{clinic_logo}}" alt="" style="height:4rem;max-width:130px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'" />
    <div style="flex:1;min-width:0;">
      <p style="margin:0;font-size:1.25rem;font-weight:700;letter-spacing:-0.01em;">{{clinic_name}}</p>
      <p style="margin:0.1rem 0 0;font-size:0.75rem;color:#4b5563;">{{clinic_address}}</p>
      <p style="margin:0;font-size:0.75rem;color:#4b5563;">Tel. {{clinic_phone}} · {{clinic_email}}</p>
      <p style="margin:0;font-size:0.7rem;color:#6b7280;">RUT {{clinic_rut}}</p>
    </div>
  </div>

  <!-- ── Título ───────────────────────────────────────────────────── -->
  <div style="background:#1f2937;color:#ffffff;padding:0.4rem 0.75rem;margin-top:0;">
    <p style="margin:0;font-size:0.95rem;font-weight:700;letter-spacing:0.12em;text-align:center;">RECETA MÉDICA</p>
  </div>

  <!-- ── Identificación del paciente ──────────────────────────────── -->
  <table class="rx-id-table" style="width:100%;border-collapse:collapse;margin-top:0.9rem;font-size:0.8125rem;">
    <tr>
      <td style="padding:2px 0;width:50%;"><span style="color:#6b7280;">Paciente:</span> <strong>{{patient_name}}</strong></td>
      <td style="padding:2px 0;width:50%;"><span style="color:#6b7280;">C.I.:</span> <strong>{{patient_document}}</strong></td>
    </tr>
    <tr>
      <td style="padding:2px 0;"><span style="color:#6b7280;">Edad:</span> {{patient_age}} años</td>
      <td style="padding:2px 0;"><span style="color:#6b7280;">Fecha de nac.:</span> {{patient_birthday}}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;"><span style="color:#6b7280;">Mutualista:</span> {{patient_mutual_society}}</td>
      <td style="padding:2px 0;"><span style="color:#6b7280;">Fecha:</span> <strong>{{date}}</strong></td>
    </tr>
    <tr>
      <td colspan="2" style="padding:2px 0;"><span style="color:#6b7280;">Domicilio:</span> {{patient_address}}</td>
    </tr>
  </table>

  <!-- ── Diagnóstico ──────────────────────────────────────────────── -->
  <div style="margin-top:0.9rem;padding:0.5rem 0.7rem;background:#f3f4f6;border-left:3px solid #9ca3af;">
    <p style="margin:0;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Diagnóstico</p>
    <p style="margin:0.15rem 0 0;font-size:0.8125rem;">{{diagnosis}}</p>
  </div>

  <!-- ── Rp. ──────────────────────────────────────────────────────── -->
  <div style="margin-top:1.1rem;min-height:15rem;">
    <p style="margin:0 0 0.4rem;font-size:1.5rem;font-weight:700;font-style:italic;line-height:1;">Rp.</p>
    {{medications_list}}
  </div>

  <!-- ── Indicaciones generales ───────────────────────────────────── -->
  <div style="margin-top:0.9rem;">
    <p style="margin:0;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;">Indicaciones</p>
    <p style="margin:0.15rem 0 0;font-size:0.8125rem;white-space:pre-wrap;">{{notes}}</p>
  </div>

  <!-- ── Firma ────────────────────────────────────────────────────── -->
  {{doctor_signature}}

  <!-- ── Pie ──────────────────────────────────────────────────────── -->
  <div style="margin-top:2rem;padding-top:0.5rem;border-top:1px solid #d1d5db;text-align:center;">
    <p style="margin:0;font-size:0.7rem;color:#6b7280;">
      {{clinic_name}} · {{clinic_address}} · Tel. {{clinic_phone}}
    </p>
    <p style="margin:0.15rem 0 0;font-size:0.65rem;color:#9ca3af;">
      Esta receta es personal e intransferible. Consulte a su médico ante cualquier efecto adverso.
    </p>
  </div>

</div>
$html$,
    true
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Registro de migración
-- -----------------------------------------------------------------------
INSERT INTO public.db_migrations (script_name, version_tag, notes)
VALUES (
    '069_20260819_default-prescription-template.sql',
    'v1',
    'Plantilla de receta por defecto con formato uruguayo (membrete, Rp., firma y pie)'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;

-- =====================================================================
-- ROLLBACK (manual)
-- =====================================================================
-- BEGIN;
-- DELETE FROM public.prescription_templates WHERE id = 'a7f3c1d2-5b8e-4a91-9c3d-6e2f8b4a1c70'::uuid;
-- DELETE FROM public.db_migrations WHERE script_name = '069_20260819_default-prescription-template.sql';
-- COMMIT;
