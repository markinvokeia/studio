-- =====================================================================
-- Periodontograma — reporte por email y recordatorio enviable (ajuste de P5)
--
--   1. perio_exam_json devuelve también patientEmail (reporte al paciente por email).
--   2. v_alert_perio_maintenance pasa a apuntar a "users" (una fila por paciente, id = paciente):
--      el auto-envío de WhatsApp y de email de las alertas sólo resuelve citas, facturas y
--      pacientes; con "perio_exams" generaba la alerta pero no la podía enviar. La vista
--      cambia de columnas, por eso se recrea (DROP + CREATE).
--
-- Regla de alerta (Sistema → Reglas de alerta): origen v_alert_perio_maintenance,
-- campo id = id, campo de usuario = patient_id, campo de evento = due_date.
--
-- Sin cambios en el flujo n8n. Idempotente: se puede ejecutar varias veces.
-- =====================================================================

BEGIN;

-- Examen completo, con la forma del frontend (camelCase). Los sitios van en orden D, C, M.
CREATE OR REPLACE FUNCTION public.perio_exam_json(p_exam_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
    SELECT jsonb_build_object(
        'id', e.id::text,
        'patientId', e.patient_id,
        'doctorId', e.doctor_id,
        'doctorName', d.name,
        'appointmentId', e.appointment_id::text,
        'date', to_char(e.exam_date, 'YYYY-MM-DD'),
        'examType', e.exam_type,
        'guideExamId', e.guide_exam_id::text,
        'title', e.title,
        'notes', e.notes,
        'status', e.status,
        'completeness', e.completeness,
        'stats', e.stats,
        'closedAt', e.closed_at,
        'closedByName', cb.name,
        'createdAt', e.created_at,
        'updatedAt', e.updated_at,
        'diagnosis', e.diagnosis,
        'patientBirthday', to_char(p.birthday, 'YYYY-MM-DD'),
        'patientPhone', NULLIF(TRIM(COALESCE(p.phone_number, '')), ''),
        'patientEmail', NULLIF(TRIM(COALESCE(p.email, '')), ''),
        'closing', e.closing,
        'screening', e.screening,
        'invoice', (
            SELECT jsonb_build_object(
                'id', i.id::text,
                'docNo', COALESCE(NULLIF(i.doc_no, ''), i.invoice_ref),
                'total', i.total,
                'paidAmount', COALESCE(i.paid_amount, 0),
                'currency', i.currency,
                'status', i.status,
                'paymentState', i.payment_state,
                'createdAt', to_char(i.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'serviceIds', COALESCE((
                    SELECT jsonb_agg(DISTINCT ii.service_id::text)
                    FROM public.invoice_items ii
                    WHERE ii.invoice_id = i.id AND ii.service_id IS NOT NULL
                ), '[]'::jsonb)
            )
            FROM public.invoices i
            WHERE i.id = e.invoice_id
        ),
        'amendments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id::text,
                'body', a.body,
                'createdAt', to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
                'createdByName', NULLIF(TRIM(COALESCE(au.name, '')), '')
            ) ORDER BY a.created_at)
            FROM public.perio_exam_amendments a
            LEFT JOIN public.users au ON au.id = a.created_by
            WHERE a.exam_id = e.id
        ), '[]'::jsonb),
        'teeth', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'tooth', t.tooth,
                'status', t.status,
                'mobility', t.mobility,
                'furcation', t.furcation,
                'note', COALESCE(t.note, ''),
                'sites', jsonb_build_object(
                    'v', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'pd', s.pd_mm, 'gm', s.gm_mm, 'bop', s.bop, 'sup', s.suppuration,
                                'plaque', s.plaque, 'source', s.source)
                            ORDER BY array_position(ARRAY['D', 'C', 'M'], s.site::text)), '[]'::jsonb)
                          FROM public.perio_sites s
                          WHERE s.exam_id = t.exam_id AND s.tooth = t.tooth AND s.side = 'v'),
                    'i', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                                'pd', s.pd_mm, 'gm', s.gm_mm, 'bop', s.bop, 'sup', s.suppuration,
                                'plaque', s.plaque, 'source', s.source)
                            ORDER BY array_position(ARRAY['D', 'C', 'M'], s.site::text)), '[]'::jsonb)
                          FROM public.perio_sites s
                          WHERE s.exam_id = t.exam_id AND s.tooth = t.tooth AND s.side = 'i')
                )
            ) ORDER BY t.tooth)
            FROM public.perio_teeth t
            WHERE t.exam_id = e.id
        ), '[]'::jsonb)
    )
    FROM public.perio_exams e
    LEFT JOIN public.users d ON d.id = e.doctor_id
    LEFT JOIN public.users cb ON cb.id = e.closed_by
    LEFT JOIN public.users p ON p.id = e.patient_id
    WHERE e.id = p_exam_id;
$$;

DROP VIEW IF EXISTS public.v_alert_perio_maintenance;
CREATE VIEW public.v_alert_perio_maintenance AS
SELECT DISTINCT ON (e.patient_id)
    e.patient_id AS id,
    e.patient_id,
    e.id AS exam_id,
    e.exam_date,
    e.exam_type,
    COALESCE((e.diagnosis->>'maintenanceMonths')::integer, 6) AS maintenance_months,
    COALESCE(
        CASE WHEN e.closing->'nextVisit'->>'mode' = 'later' THEN NULLIF(e.closing->'nextVisit'->>'date', '')::date END,
        (e.exam_date + make_interval(months => COALESCE((e.diagnosis->>'maintenanceMonths')::integer, 6)))::date
    ) AS due_date,
    e.diagnosis->>'risk' AS risk,
    e.closing->'nextVisit'->>'mode' AS next_visit_mode
FROM public.perio_exams e
WHERE e.status = 'closed' AND e.deleted_at IS NULL
ORDER BY e.patient_id, e.exam_date DESC, e.created_at DESC;

COMMENT ON VIEW public.v_alert_perio_maintenance IS
    '{"reference_table":"users","label":"Mantenimiento periodontal (último periodontograma cerrado de cada paciente)"}';

-- ─── Registro de migración ────────────────────────────────────────────────────

INSERT INTO db_migrations (script_name, version_tag, notes)
VALUES (
    '166_20261105_perio-report-email.sql',
    'v1',
    'Periodontograma: patientEmail en el JSON y v_alert_perio_maintenance apuntando a users'
)
ON CONFLICT (script_name) DO UPDATE
    SET applied_at  = NOW(),
        version_tag = EXCLUDED.version_tag,
        notes       = EXCLUDED.notes;

COMMIT;
