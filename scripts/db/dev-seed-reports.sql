-- =============================================================================
-- dev-seed-reports.sql — Historia y datos de gestión para que los reportes
-- tengan contenido.
--
-- Corre DESPUÉS de dev-seed.sql (orden: dev-cleanup → dev-seed → este). Se pega
-- entero en el Query Tool de pgAdmin y se ejecuta con F5. Una sola transacción:
-- si algo falla no queda nada a medias (ejecutar ROLLBACK; antes de reintentar).
-- Para probar sin aplicar, cambiar el COMMIT del final por ROLLBACK.
--
-- dev-seed.sql solo cubre los últimos 90 días y deja vacías varias tablas que
-- leen los reportes. Este script agrega:
--   * Historia: agenda, sesiones clínicas y ventas desde hace ~15 meses hasta el
--     día anterior al seed (reportes por año/mes, comparativo, balance mensual,
--     ingresos por período, deudores +90 días, pacientes inactivos).
--     Parte de las ventas de implantes, brackets y estética en USD.
--     Pagos diferidos (saldos que se cancelan semanas después) y deudas viejas.
--   * 40 pacientes "históricos" que dejaron de venir hace más de 6 meses
--     (8 con alta médica) y 10 pacientes nuevos sin citas.
--   * Presupuestos de planes en todos los estados (draft, pending, rejected,
--     Confirmed sin facturar) a lo largo de todo el período.
--   * Servicios en flujo (brackets, implante, endodoncia multirradicular) con sus
--     pasos y planes de tratamiento en curso / completados / pausados / abandonados.
--   * Gastos operativos mensuales (alquiler, sueldos, BPS, DGI, UTE, OSE, Antel,
--     insumos, publicidad…) con su movimiento de caja, como hace la app.
--   * Proveedores (laboratorios) con facturas de compra pagas, parciales y pendientes.
--   * Nómina: legajo y contrato de doctores (honorarios con % de productividad) y
--     recepcionistas; grupos de servicios (filtro de Balance mensual).
--   * Recalcula los totales de cierre de TODAS las cajas del seed.
--
-- Todo lleva 'seed:hist:' / 'seed:' en external_id / internal_id, o tags = {seed}
-- en gastos, y lo borra dev-cleanup.sql.
-- =============================================================================

BEGIN;
SET LOCAL lock_timeout = '15s';
SELECT setseed(0.3141);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE internal_id LIKE 'seed:doc:%')
     OR NOT EXISTS (SELECT 1 FROM appointments WHERE external_id LIKE 'seed:appt:%') THEN
    RAISE EXCEPTION 'Falta el seed base: corré dev-seed.sql primero';
  END IF;
  IF EXISTS (SELECT 1 FROM appointments WHERE external_id LIKE 'seed:hist:%')
     OR EXISTS (SELECT 1 FROM miscellaneous_transactions WHERE 'seed' = ANY(tags)) THEN
    RAISE EXCEPTION 'Este script ya se corrió: para regenerar, correr dev-cleanup.sql y dev-seed.sql primero';
  END IF;
END $$;

ALTER TABLE appointments DISABLE TRIGGER trigger_appointment_change;

-- =============================================================================
-- Funciones auxiliares (pg_temp: desaparecen al cerrar la sesión)
-- =============================================================================
CREATE OR REPLACE FUNCTION pg_temp.pick(arr text[]) RETURNS text LANGUAGE sql VOLATILE AS
$$ SELECT arr[1 + floor(random() * array_length(arr, 1))::int] $$;

CREATE OR REPLACE FUNCTION pg_temp.rint(lo int, hi int) RETURNS int LANGUAGE sql VOLATILE AS
$$ SELECT lo + floor(random() * (hi - lo + 1))::int $$;

CREATE OR REPLACE FUNCTION pg_temp.ci_uy(n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text := lpad(n::text, 7, '0');
  w int[] := ARRAY[2, 9, 8, 7, 6, 3, 4];
  total int := 0;
BEGIN
  FOR i IN 1..7 LOOP total := total + substr(s, i, 1)::int * w[i]; END LOOP;
  RETURN substr(s, 1, 1) || '.' || substr(s, 2, 3) || '.' || substr(s, 5, 3) || '-' || ((10 - total % 10) % 10)::text;
END $$;

-- Número de documento con la secuencia real, pero con el año/mes del documento
CREATE OR REPLACE FUNCTION pg_temp.docno(t text, ts timestamp) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT regexp_replace(public.generate_sequence_value(t::document_type_enum),
                        '\d{4}-\d{2}', to_char(ts, 'YYYY-MM'))
$$;

CREATE OR REPLACE FUNCTION pg_temp.slug(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(translate(lower(t), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '.', 'g')
$$;

-- Día hábil (lunes a sábado) más cercano hacia atrás
CREATE OR REPLACE FUNCTION pg_temp.workday(d date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN extract(isodow FROM d) = 7 THEN d - 1 ELSE d END
$$;

-- =============================================================================
-- Contexto: lo que dejó dev-seed.sql
-- =============================================================================
CREATE TEMP TABLE _ctx ON COMMIT DROP AS
SELECT
  (SELECT active_sede_id FROM users WHERE internal_id = 'seed:doc:1')                     AS sede_id,
  (SELECT id FROM roles WHERE name = 'paciente')                                           AS role_patient,
  (SELECT id FROM users WHERE email = 'system@invokeia.com')                               AS system_id,
  (SELECT cs.cash_point_id FROM cash_sessions cs JOIN users u ON u.id = cs.user_id
    WHERE u.internal_id LIKE 'seed:recep:%' ORDER BY cs.id LIMIT 1)                        AS cash_point_id,
  (SELECT id FROM clinic ORDER BY id LIMIT 1)                                              AS clinic_id,
  (date_trunc('month', current_date) - interval '15 months')::date                         AS h_from,
  (SELECT min(start_datetime)::date FROM appointments WHERE external_id LIKE 'seed:appt:%') - 1 AS h_to,
  current_date - 200                                                                       AS lapsed_cutoff,
  (now() AT TIME ZONE 'America/Montevideo')::timestamp                                     AS now_local;

DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM _ctx;
  IF c.sede_id IS NULL OR c.role_patient IS NULL OR c.cash_point_id IS NULL OR c.clinic_id IS NULL THEN
    RAISE EXCEPTION 'Falta contexto del seed (sede del doctor 1, rol paciente, caja del seed o fila en clinic)';
  END IF;
END $$;

CREATE TEMP TABLE _pm ON COMMIT DROP AS
SELECT id, name, code, is_cash_equivalent FROM payment_methods
WHERE is_active AND code IN ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'MERCADO_PAGO');

-- Doctores del seed: la especialidad sale del orden en que los crea dev-seed.sql
CREATE TEMP TABLE _doc ON COMMIT DROP AS
SELECT substring(u.internal_id FROM 10)::int AS n, u.id, u.name, u.sex, u.identity_document, u.calendar_source_id AS cal_id,
       ar.days_of_week AS days, ar.start_time AS t_start, ar.end_time AS t_end,
       (ARRAY['general', 'endodoncia', 'ortodoncia', 'cirugia', 'estetica', 'periodoncia'])[substring(u.internal_id FROM 10)::int] AS specialty
FROM users u
JOIN LATERAL (SELECT * FROM availability_rules a WHERE a.user_id = u.id ORDER BY a.id LIMIT 1) ar ON true
WHERE u.internal_id LIKE 'seed:doc:%';

CREATE TEMP TABLE _recep ON COMMIT DROP AS
SELECT substring(internal_id FROM 12)::int AS n, id, name, sex, identity_document
FROM users WHERE internal_id LIKE 'seed:recep:%';

CREATE TEMP TABLE _svc ON COMMIT DROP AS
SELECT sc.id, substring(sc.external_id FROM 10) AS code, sc.name, sc.specialty, sc.duration_minutes AS duration,
       sc.price, sc.description AS proc,
       substring(sc.external_id FROM 10) = ANY (ARRAY['RESINA','SELLANTE','RX_PERI','ENDO_UNI','ENDO_MULTI','RETRATAM','PERNO',
                                                     'EXODONCIA','TERCER_MOLAR','IMPLANTE','CORONA_IMPL','CORONA']) AS tooth,
       substring(sc.external_id FROM 10) = ANY (ARRAY['CONSULTA','PROFILAXIS','SELLANTE','FLUOR','PEDIATRICA','ORTO_CONS','ORTO_CTRL']) AS kid
FROM service_catalog sc WHERE sc.external_id LIKE 'seed:svc:%';

-- Cajas: las del seed + las que se crean abajo para la historia
CREATE TEMP TABLE _cash (day date PRIMARY KEY, id int) ON COMMIT DROP;
INSERT INTO _cash
SELECT DISTINCT ON (cs.opened_at::date) cs.opened_at::date, cs.id
FROM cash_sessions cs, _ctx c
WHERE cs.cash_point_id = c.cash_point_id AND cs.user_id IN (SELECT id FROM _recep)
ORDER BY cs.opened_at::date, cs.id;

-- =============================================================================
-- Pacientes: los del seed + 40 históricos (dejaron de venir) + 10 nuevos sin citas
-- =============================================================================
CREATE TEMP TABLE _pat ON COMMIT DROP AS
SELECT id, name, coalesce(is_dependant, false) AS kid, created_at, false AS lapsed
FROM users WHERE internal_id LIKE 'seed:pat:%';

DO $$
DECLARE
  c record;
  f_names text[] := ARRAY['María','Lucía','Sofía','Valentina','Camila','Florencia','Agustina','Martina','Carolina','Natalia',
                          'Gabriela','Paula','Andrea','Laura','Mariana','Silvia','Ana','Claudia','Verónica','Fernanda'];
  m_names text[] := ARRAY['Juan','Martín','Diego','Santiago','Nicolás','Federico','Pablo','Gonzalo','Matías','Sebastián',
                          'Andrés','Fernando','Rodrigo','Alejandro','Gustavo','Marcelo','Álvaro','Leonardo','Emiliano','Joaquín'];
  last_names text[] := ARRAY['Rodríguez','González','Fernández','Pérez','García','Martínez','López','Silva','Sosa','Suárez',
                             'Díaz','Pereira','Méndez','Núñez','Castro','Romero','Acosta','Olivera','Cabrera','Ferreira',
                             'Correa','Morales','Hernández','Álvarez','Ramos','Gómez','Benítez','Techera','Píriz','Barreto'];
  is_f boolean;
  v_first text; v_last1 text; v_last2 text;
  v_created timestamp;
  v_id uuid;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR i IN 156..205 LOOP
    is_f := random() < 0.55;
    v_first := CASE WHEN is_f THEN pg_temp.pick(f_names) ELSE pg_temp.pick(m_names) END;
    v_last1 := pg_temp.pick(last_names);
    v_last2 := CASE WHEN random() < 0.6 THEN pg_temp.pick(last_names) END;
    -- 156..195: históricos (alta hace 13-17 meses); 196..205: nuevos (últimos 25 días)
    v_created := CASE WHEN i <= 195
                      THEN c.h_from - (pg_temp.rint(-150, 60) || ' days')::interval + time '10:00'
                      ELSE c.now_local - (pg_temp.rint(0, 25) || ' days')::interval - (pg_temp.rint(0, 600) || ' minutes')::interval END;
    v_id := gen_random_uuid();

    INSERT INTO users (id, name, email, phone_number, internal_id, is_active, sex, birthday, created_at, created_by,
                       identity_document, identity_document_type, address, active_sede_id, doctor_id)
    VALUES (v_id, concat_ws(' ', v_first, v_last1, v_last2),
            pg_temp.slug(v_first || ' ' || v_last1) || '.' || i || '@example.com',
            '+5989' || lpad((1000000 + i * 48271 % 8999999)::text, 7, '0'),
            'seed:pat:' || i, true,
            CASE WHEN is_f THEN 'female'::sex_type ELSE 'male'::sex_type END,
            date '1950-01-01' + pg_temp.rint(0, 365 * 52),
            v_created,
            (SELECT id FROM _recep ORDER BY random() LIMIT 1),
            pg_temp.ci_uy(1500000 + i * 29573), 'cedula_uy',
            pg_temp.pick(ARRAY['Av. 18 de Julio','Bulevar Artigas','Av. Rivera','Av. Italia','Av. Brasil','Canelones','Colonia'])
              || ' ' || pg_temp.rint(100, 3999),
            c.sede_id,
            (SELECT id FROM _doc WHERE specialty = 'general'));

    INSERT INTO user_roles (user_id, role_id, is_active) VALUES (v_id, c.role_patient, true);

    IF i <= 195 THEN
      INSERT INTO _pat VALUES (v_id, concat_ws(' ', v_first, v_last1, v_last2), false, v_created, true);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- Cajas de la historia: una por día hábil, todas cerradas
-- =============================================================================
DO $$
DECLARE
  c record;
  d date;
  v_id int;
  v_recep record;
  v_open timestamp;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR d IN SELECT g::date FROM generate_series(c.h_from, c.h_to, interval '1 day') g LOOP
    CONTINUE WHEN extract(isodow FROM d) = 7 OR EXISTS (SELECT 1 FROM _cash WHERE day = d);
    SELECT * INTO v_recep FROM _recep ORDER BY random() LIMIT 1;
    v_open := d + time '08:30';
    INSERT INTO cash_sessions (user_id, status, opened_at, closed_at, cash_point_id, opening_details, closing_details, created_by)
    VALUES (v_recep.id, 'CLOSE', v_open, d + time '19:45', c.cash_point_id,
            json_build_object('currency', 'UYU', 'date_rate', 40.2,
                              'uyu', json_build_object('500', 2, '1000', 2, '2000', 3, 'total', 9000),
                              'opened_by', v_recep.name, 'opened_at', to_char(v_open, 'YYYY-MM-DD"T"HH24:MI:SS.000"Z"')),
            NULL, v_recep.id)
    RETURNING id INTO v_id;
    INSERT INTO cash_session_currencies (cash_session_id, currency, opening_amount, date_rate)
    VALUES (v_id, 'UYU', 9000, 1);
    INSERT INTO _cash VALUES (d, v_id);
  END LOOP;
END $$;

-- Cobro de una factura de venta: pago + movimiento de caja del día
CREATE OR REPLACE FUNCTION pg_temp.pay(p_inv int, p_amount numeric, p_ts timestamp, p_cur text,
                                       p_pat uuid, p_doc uuid, p_recep uuid, p_ext text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_pm record;
  v_cash int;
  v_pay int;
  v_inv_doc text;
BEGIN
  SELECT id INTO v_cash FROM _cash WHERE day = p_ts::date;
  IF v_cash IS NULL THEN RETURN; END IF;
  IF p_cur = 'USD' THEN
    SELECT * INTO v_pm FROM _pm WHERE code IN ('BANK_TRANSFER', 'CREDIT_CARD') ORDER BY random() LIMIT 1;
  ELSE
    SELECT * INTO v_pm FROM _pm
    ORDER BY CASE code WHEN 'CASH' THEN random() * 0.45 WHEN 'DEBIT_CARD' THEN random() * 0.7 ELSE random() END
    LIMIT 1;
  END IF;
  SELECT doc_no INTO v_inv_doc FROM invoices WHERE id = p_inv;

  INSERT INTO payments (invoice_id, amount, method, created_at, payment_method_id, cash_session_id, currency, is_sales,
                        invoice_currency, exchange_rate, converted_amount, user_id, doc_no, external_id, doctor_id, created_by)
  VALUES (p_inv, p_amount, v_pm.name, p_ts, v_pm.id, v_cash, p_cur, true,
          p_cur, 1, p_amount, p_pat, pg_temp.docno('payment', p_ts), p_ext, p_doc, p_recep)
  RETURNING id INTO v_pay;

  INSERT INTO cash_movements (cash_session_id, type, payment_method_id, amount, description, created_at, user_id,
                              payment_id, currency, is_sales, is_trx, source_type, created_by)
  VALUES (v_cash, 'INFLOW', v_pm.id, p_amount, 'Pago factura: ' || v_inv_doc, p_ts, p_recep,
          v_pay, p_cur, true, true, 'payment', p_recep);
END $$;

-- =============================================================================
-- Agenda histórica + sesiones clínicas + ventas (h_from .. día anterior al seed)
-- =============================================================================
DO $$
DECLARE
  c record;
  doc record;
  svc record;
  pat record;
  recep uuid;
  d date;
  slot timestamp;
  slot_end timestamp;
  n_target int;
  n_made int;
  r numeric;
  v_status text;
  v_cancel text;
  v_appt int;
  v_sesion bigint;
  v_quote int; v_qi int; v_order int; v_oi int; v_inv int;
  v_tooth int;
  v_cur text;
  v_price numeric;
  v_paid numeric;
  v_rest numeric;
  v_def_day date;
  v_found boolean;
  adult_teeth int[] := ARRAY[11,12,13,14,15,16,17,21,22,23,24,25,26,27,31,32,33,34,35,36,37,41,42,43,44,45,46,47];
  molars int[] := ARRAY[16,26,36,46,17,27,37,47];
  wisdom int[] := ARRAY[18,28,38,48];
  notes_pool text[] := ARRAY['Paciente colaborador.', 'Refiere sensibilidad al frío.', 'Buena higiene oral.',
                             'Higiene regular, se refuerza técnica de cepillado.', 'Sin complicaciones.',
                             'Se indica analgésico en caso de dolor.', 'Paciente ansioso, se trabaja con calma.', ''];
BEGIN
  SELECT * INTO c FROM _ctx;

  FOR d IN SELECT g::date FROM generate_series(c.h_from, c.h_to, interval '1 day') g LOOP
    CONTINUE WHEN extract(isodow FROM d) = 7;

    FOR doc IN SELECT * FROM _doc WHERE extract(isodow FROM d)::smallint = ANY(days) ORDER BY n LOOP
      -- la clínica crece: menos carga al principio del período
      n_target := CASE WHEN d < c.h_from + 120 THEN pg_temp.rint(1, 5) ELSE pg_temp.rint(2, 6) END;
      n_made := 0;
      slot := d + doc.t_start + (pg_temp.rint(0, 2) * 15 || ' minutes')::interval;

      WHILE n_made < n_target LOOP
        SELECT * INTO svc FROM _svc
        WHERE specialty = doc.specialty AND NOT (code = 'BRACKETS' AND random() < 0.6)
        ORDER BY CASE WHEN code IN ('CONSULTA','PROFILAXIS','ORTO_CTRL','EST_CONS','TOXINA','PERIO_MANT') THEN random() * 0.6 ELSE random() END
        LIMIT 1;

        slot_end := slot + (svc.duration || ' minutes')::interval;
        EXIT WHEN slot_end > d + doc.t_end;

        -- paciente ya registrado a esa fecha; los "históricos" solo antes del corte
        v_found := false;
        IF svc.code = 'PEDIATRICA' OR (doc.specialty IN ('general', 'ortodoncia') AND svc.kid AND random() < 0.25) THEN
          SELECT * INTO pat FROM _pat WHERE kid AND created_at <= slot ORDER BY random() LIMIT 1;
          v_found := FOUND;
        ELSIF d < c.lapsed_cutoff AND random() < 0.35 THEN
          SELECT * INTO pat FROM _pat WHERE lapsed AND created_at <= slot ORDER BY random() LIMIT 1;
          v_found := FOUND;
        END IF;
        IF NOT v_found THEN
          SELECT * INTO pat FROM _pat WHERE NOT kid AND NOT lapsed AND created_at <= slot ORDER BY random() LIMIT 1;
          v_found := FOUND;
        END IF;
        IF NOT v_found THEN
          SELECT * INTO pat FROM _pat WHERE NOT kid AND created_at <= slot ORDER BY random() LIMIT 1;
          v_found := FOUND;
        END IF;
        IF NOT v_found THEN   -- nadie registrado todavía: se salta el turno
          slot := slot_end;
          n_made := n_made + 1;
          CONTINUE;
        END IF;

        r := random();
        v_cancel := NULL;
        v_status := CASE WHEN r < 0.72 THEN 'completed' WHEN r < 0.76 THEN 'attended_late'
                         WHEN r < 0.86 THEN 'no_show' ELSE 'cancelled' END;
        IF v_status = 'cancelled' THEN
          v_cancel := pg_temp.pick(ARRAY['in_time','in_time','patient_request','reschedule','by_doctor','late']);
        END IF;

        v_tooth := CASE
          WHEN NOT svc.tooth THEN NULL
          WHEN svc.code = 'TERCER_MOLAR' THEN wisdom[1 + floor(random() * 4)::int]
          WHEN svc.code IN ('ENDO_MULTI', 'SELLANTE', 'IMPLANTE', 'CORONA_IMPL') THEN molars[1 + floor(random() * 8)::int]
          ELSE adult_teeth[1 + floor(random() * array_length(adult_teeth, 1))::int] END;

        recep := (SELECT id FROM _recep ORDER BY random() LIMIT 1);

        INSERT INTO appointments (patient_id, start_datetime, end_datetime, status, summary, description, notes,
                                  created_at, updated_at, assignee_id, calendar_source_id, cancellation_reason,
                                  external_id, created_by)
        VALUES (pat.id, slot, slot_end, v_status,
                pat.name || ' - ' || svc.name,
                format(E'Cita para: %s\n\nDoctor: %s\n\nServicios:\n%s\n\nNotas:\n', pat.name, doc.name, svc.name),
                CASE WHEN v_tooth IS NOT NULL THEN 'Pieza ' || v_tooth END,
                greatest(slot - (pg_temp.rint(1, 25) || ' days')::interval, pat.created_at),
                slot,
                doc.id, doc.cal_id, v_cancel,
                'seed:hist:appt:' || to_char(slot, 'YYYYMMDDHH24MI') || ':' || doc.n,
                recep)
        RETURNING id INTO v_appt;

        INSERT INTO appointment_service_catalog (appointment_id, service_id) VALUES (v_appt, svc.id);

        IF v_status IN ('completed', 'attended_late') THEN
          INSERT INTO sesiones_clinicas (paciente_id, doctor_id, fecha_sesion, procedimiento_realizado, plan_proxima_cita,
                                         diagnostico, notas_clinicas, appointment_id, pieza, external_id, created_by)
          VALUES (pat.id, doc.id, slot AT TIME ZONE 'America/Montevideo',
                  svc.proc || CASE WHEN v_tooth IS NOT NULL THEN ' Pieza ' || v_tooth || '.' ELSE '' END,
                  'Control según evolución',
                  CASE svc.specialty
                    WHEN 'endodoncia'  THEN pg_temp.pick(ARRAY['Pulpitis irreversible','Necrosis pulpar','Periodontitis apical crónica'])
                    WHEN 'periodoncia' THEN pg_temp.pick(ARRAY['Gingivitis asociada a placa','Periodontitis estadio II grado B','Periodontitis estadio III grado B'])
                    WHEN 'cirugia'     THEN pg_temp.pick(ARRAY['Resto radicular','Pieza no restaurable','Tercer molar semiincluido','Edentulismo parcial'])
                    WHEN 'general'     THEN CASE WHEN svc.code = 'RESINA' THEN 'Caries dentinaria' ELSE '' END
                    ELSE '' END,
                  pg_temp.pick(notes_pool),
                  v_appt, v_tooth::text,
                  'seed:hist:sc:' || v_appt,
                  doc.id)
          RETURNING id INTO v_sesion;

          INSERT INTO tratamientos_sesion (sesion_id, numero_diente, descripcion_tratamiento, is_for_next_session, service_catalog_id, created_by)
          VALUES (v_sesion, v_tooth, svc.name, false, svc.id, doc.id);

          -- Venta (algunos controles no se cobran)
          IF NOT (svc.code IN ('ORTO_CTRL', 'PERIO_MANT') AND random() < 0.15) THEN
            v_cur := CASE WHEN svc.code IN ('IMPLANTE', 'CORONA_IMPL', 'BRACKETS', 'HILOS', 'LABIOS') AND random() < 0.35
                          THEN 'USD' ELSE 'UYU' END;
            v_price := CASE WHEN v_cur = 'USD' THEN round(svc.price / 40) ELSE svc.price END;

            INSERT INTO quotes (user_id, total, status, billing_status, payment_status, created_at, updated_at, currency, is_sales,
                                doc_no, exchange_rate, external_id, doctor_id, gross_total, discount_amount, sede_id, created_by)
            VALUES (pat.id, v_price, 'Confirmed', 'invoiced', 'not_paid', slot, slot_end, v_cur, true,
                    pg_temp.docno('quote', slot), CASE WHEN v_cur = 'USD' THEN 40 ELSE 1 END,
                    'seed:hist:quote:' || v_appt, doc.id, v_price, 0, c.sede_id, recep)
            RETURNING id INTO v_quote;

            INSERT INTO quote_items (quote_id, service_id, quantity, unit_price, total, tooth_number, gross_total, discount_amount, created_by)
            VALUES (v_quote, svc.id, 1, v_price, v_price, v_tooth, v_price, 0, recep)
            RETURNING id INTO v_qi;

            INSERT INTO orders (quote_id, user_id, status, created_at, currency, is_sales, doc_no, gross_total, discount_amount)
            VALUES (v_quote, pat.id, 'Completed', slot_end, v_cur, true, pg_temp.docno('order', slot), v_price, 0)
            RETURNING id INTO v_order;

            INSERT INTO order_items (order_id, quote_item_id, status, scheduled_date, completed_date, invoiced_date, tooth_number, gross_total, discount_amount)
            VALUES (v_order, v_qi, 'completed', slot, slot_end, slot_end, v_tooth, v_price, 0)
            RETURNING id INTO v_oi;

            INSERT INTO invoices (order_id, total, status, created_at, paid_amount, currency, is_sales, user_id, type,
                                  payment_state, due_date, doc_no, external_id, doctor_id, gross_total, discount_amount,
                                  sede_id, created_by)
            VALUES (v_order, v_price, 'booked', slot_end, 0, v_cur, true, pat.id, 'invoice',
                    'unpaid', (slot + interval '30 days')::date, pg_temp.docno('invoice', slot), 'seed:hist:inv:' || v_appt,
                    doc.id, v_price, 0, c.sede_id, recep)
            RETURNING id INTO v_inv;

            INSERT INTO invoice_items (invoice_id, order_item_id, quantity, unit_price, total, service_id, tooth_number, gross_total, discount_amount, created_by)
            VALUES (v_inv, v_oi, 1, v_price, v_price, svc.id, v_tooth, v_price, 0, recep);

            UPDATE appointments SET quote_id = v_quote, invoice_id = v_inv WHERE id = v_appt;
            UPDATE sesiones_clinicas SET quote_id = v_quote, invoice_id = v_inv WHERE id = v_sesion;

            -- Cobro: 80 % en el momento; 8 % mitad (el resto a veces semanas después);
            -- 6 % nada en el momento pero se paga después; 6 % queda debiendo
            r := random();
            v_paid := CASE WHEN r < 0.80 THEN v_price WHEN r < 0.88 THEN round(v_price * 0.5, 0) ELSE 0 END;
            v_rest := v_price - v_paid;
            IF v_paid > 0 THEN
              PERFORM pg_temp.pay(v_inv, v_paid, slot_end + (pg_temp.rint(2, 20) || ' minutes')::interval, v_cur,
                                  pat.id, doc.id, recep, 'seed:hist:pay:' || v_appt);
            END IF;
            IF v_rest > 0 AND r < 0.94 AND random() < 0.65 THEN
              v_def_day := pg_temp.workday(d + pg_temp.rint(6, 75));
              IF v_def_day < current_date THEN
                PERFORM pg_temp.pay(v_inv, v_rest, v_def_day + time '10:00' + (pg_temp.rint(0, 540) || ' minutes')::interval, v_cur,
                                    pat.id, doc.id, (SELECT id FROM _recep ORDER BY random() LIMIT 1), 'seed:hist:pay2:' || v_appt);
              END IF;
            END IF;
          END IF;
        END IF;

        n_made := n_made + 1;
        slot := slot_end + (pg_temp.rint(0, 2) * 15 || ' minutes')::interval;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- Alta médica para 8 pacientes históricos (reporte de inactivos, filtro "alta médica")
UPDATE users u SET appointment_date = la.last_visit
FROM (
  SELECT a.patient_id, max(a.end_datetime) AS last_visit
  FROM appointments a JOIN _pat p ON p.id = a.patient_id AND p.lapsed
  WHERE a.status IN ('completed', 'attended_late')
  GROUP BY a.patient_id
  ORDER BY a.patient_id
  LIMIT 8
) la
WHERE u.id = la.patient_id;

-- =============================================================================
-- Presupuestos de planes de tratamiento en todos los estados, a lo largo del período
-- =============================================================================
DO $$
DECLARE
  c record;
  pat record;
  plans text[][] := ARRAY[
    ARRAY['IMPLANTE', 'CORONA_IMPL', 'RX_PERI'],
    ARRAY['ENDO_MULTI', 'PERNO', 'CORONA'],
    ARRAY['ORTO_CONS', 'BRACKETS', 'RETENEDOR'],
    ARRAY['RASPADO', 'RASPADO', 'PERIO_MANT'],
    ARRAY['RESINA', 'RESINA', 'PROFILAXIS'],
    ARRAY['TOXINA', 'LABIOS', 'SKINBOOSTER'],
    ARRAY['TERCER_MOLAR', 'TERCER_MOLAR', 'RX_PERI']];
  v_quote int;
  v_total numeric;
  v_doc uuid;
  v_ts timestamp;
  v_status text;
  idx int;
  r numeric;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR i IN 1..90 LOOP
    v_ts := c.h_from + (pg_temp.rint(0, current_date - c.h_from - 1) || ' days')::interval + time '11:00'
            + (pg_temp.rint(0, 420) || ' minutes')::interval;
    SELECT * INTO pat FROM _pat WHERE NOT kid AND created_at <= v_ts ORDER BY random() LIMIT 1;
    CONTINUE WHEN pat.id IS NULL;
    idx := 1 + floor(random() * 7)::int;
    v_doc := (SELECT d.id FROM _doc d JOIN _svc s ON s.specialty = d.specialty WHERE s.code = plans[idx][1]);
    r := random();
    -- los recientes siguen abiertos; los viejos se resolvieron
    v_status := CASE
      WHEN v_ts > c.now_local - interval '30 days' THEN CASE WHEN r < 0.55 THEN 'draft' WHEN r < 0.9 THEN 'pending' ELSE 'rejected' END
      ELSE CASE WHEN r < 0.15 THEN 'draft' WHEN r < 0.35 THEN 'pending' WHEN r < 0.75 THEN 'rejected' ELSE 'Confirmed' END END;

    INSERT INTO quotes (user_id, total, status, billing_status, payment_status, created_at, updated_at, currency, is_sales,
                        doc_no, exchange_rate, notes, external_id, doctor_id, gross_total, discount_amount, sede_id, created_by)
    VALUES (pat.id, 0, v_status, 'not_invoiced', 'not_paid', v_ts, v_ts + (pg_temp.rint(0, 15) || ' days')::interval, 'UYU', true,
            pg_temp.docno('quote', v_ts), 1,
            CASE v_status WHEN 'rejected' THEN pg_temp.pick(ARRAY['El paciente lo considera caro', 'Prefiere pensarlo', 'Se atiende en otra clínica'])
                          ELSE 'Plan de tratamiento propuesto' END,
            'seed:hist:plan:' || i, v_doc, 0, 0, c.sede_id,
            (SELECT id FROM _recep ORDER BY random() LIMIT 1))
    RETURNING id INTO v_quote;

    FOR j IN 1..3 LOOP
      INSERT INTO quote_items (quote_id, service_id, quantity, unit_price, total, tooth_number, gross_total, discount_amount)
      SELECT v_quote, s.id, 1, s.price, s.price,
             CASE WHEN s.tooth THEN pg_temp.pick(ARRAY['16','26','36','46','14','24'])::int END, s.price, 0
      FROM _svc s WHERE s.code = plans[idx][j];
    END LOOP;

    SELECT sum(total) INTO v_total FROM quote_items WHERE quote_id = v_quote;
    UPDATE quotes SET gross_total = v_total, total = v_total WHERE id = v_quote;
  END LOOP;
END $$;

-- =============================================================================
-- Servicios en flujo + planes de tratamiento (treatment_sequences)
-- =============================================================================
-- check_service_is_workflow exige que el servicio ya sea de tipo workflow
UPDATE service_catalog SET service_type = 'workflow'
WHERE id IN (SELECT id FROM _svc WHERE code IN ('BRACKETS', 'IMPLANTE', 'ENDO_MULTI'));

INSERT INTO treatment_steps (service_id, position, step_name, offset_min_days, offset_max_days, required_role, is_lab_dependent, notes)
SELECT s.id, t.pos, t.name, t.omin, t.omax, NULL, t.lab, NULL
FROM _svc s
JOIN (VALUES
  ('BRACKETS',   1, 'Instalación de brackets',       0,   0,   false),
  ('BRACKETS',   2, 'Control mes 1',                 28,  35,  false),
  ('BRACKETS',   3, 'Control mes 2',                 56,  70,  false),
  ('BRACKETS',   4, 'Control mes 3',                 84,  105, false),
  ('BRACKETS',   5, 'Control mes 6',                 170, 190, false),
  ('BRACKETS',   6, 'Retiro de brackets y retenedor', 360, 420, true),
  ('IMPLANTE',   1, 'Colocación del implante',       0,   0,   false),
  ('IMPLANTE',   2, 'Control y retiro de puntos',    7,   10,  false),
  ('IMPLANTE',   3, 'Toma de impresión',             90,  100, false),
  ('IMPLANTE',   4, 'Colocación de corona',          110, 125, true),
  ('IMPLANTE',   5, 'Control a los 6 meses',         180, 200, false),
  ('ENDO_MULTI', 1, 'Tratamiento de conductos',      0,   0,   false),
  ('ENDO_MULTI', 2, 'Perno de fibra',                10,  20,  false),
  ('ENDO_MULTI', 3, 'Tallado e impresión',           20,  30,  false),
  ('ENDO_MULTI', 4, 'Cementado de corona',           35,  45,  true)
) AS t(code, pos, name, omin, omax, lab) ON t.code = s.code;

UPDATE service_catalog sc
SET estimated_total_days = (SELECT max(ts.offset_max_days) FROM treatment_steps ts WHERE ts.service_id = sc.id)
WHERE sc.id IN (SELECT id FROM _svc WHERE code IN ('BRACKETS', 'IMPLANTE', 'ENDO_MULTI'));

DO $$
DECLARE
  a record;
  st record;
  v_seq int;
  v_status text;
  v_last int;
  v_age int;
  v_sched date;
  v_ms text;
  v_upd timestamptz;
  r numeric;
BEGIN
  FOR a IN
    SELECT ap.id, ap.patient_id, ap.assignee_id, ap.start_datetime, s.id AS service_id, s.code,
           (SELECT sc.id FROM sesiones_clinicas sc WHERE sc.appointment_id = ap.id LIMIT 1) AS sesion_id
    FROM appointments ap
    JOIN appointment_service_catalog asc1 ON asc1.appointment_id = ap.id
    JOIN _svc s ON s.id = asc1.service_id AND s.code IN ('BRACKETS', 'IMPLANTE', 'ENDO_MULTI')
    WHERE ap.status IN ('completed', 'attended_late')
      AND ap.start_datetime >= current_date - 400
      AND (s.code <> 'ENDO_MULTI' OR random() < 0.4)
    ORDER BY ap.start_datetime
  LOOP
    SELECT max(offset_max_days) INTO v_last FROM treatment_steps WHERE service_id = a.service_id;
    v_age := current_date - a.start_datetime::date;
    r := random();
    v_status := CASE
      WHEN v_age > v_last + 15 THEN CASE WHEN r < 0.65 THEN 'completed' WHEN r < 0.85 THEN 'abandoned' ELSE 'active' END
      ELSE CASE WHEN r < 0.85 THEN 'active' ELSE 'paused' END END;

    INSERT INTO treatment_sequences (patient_id, service_id, started_by, status, started_at, expected_end_at, notes, created_at, created_by)
    VALUES (a.patient_id, a.service_id, a.assignee_id, v_status, a.start_datetime::date, a.start_datetime::date + v_last,
            CASE v_status WHEN 'abandoned' THEN 'El paciente dejó de concurrir' WHEN 'paused' THEN 'Pausado a pedido del paciente' END,
            a.start_datetime, a.assignee_id)
    RETURNING id INTO v_seq;

    FOR st IN SELECT * FROM treatment_steps WHERE service_id = a.service_id ORDER BY position LOOP
      v_sched := a.start_datetime::date + pg_temp.rint(st.offset_min_days, st.offset_max_days);
      IF st.position = 1 OR v_status = 'completed' THEN
        v_ms := 'done';
      ELSIF v_status = 'abandoned' THEN
        v_ms := CASE WHEN v_sched < a.start_datetime::date + (v_last * 0.4)::int THEN 'done' ELSE 'alert' END;
      ELSIF v_sched < current_date - 3 THEN
        v_ms := CASE WHEN random() < 0.85 THEN 'done' ELSE 'alert' END;
      ELSIF st.is_lab_dependent THEN
        v_ms := 'waiting';
      ELSE
        v_ms := 'pending';
      END IF;
      v_upd := CASE WHEN st.position = 1 THEN a.start_datetime
                    WHEN v_ms = 'done' THEN least(v_sched::timestamp + time '12:00', now()::timestamp)
                    ELSE a.start_datetime END;

      INSERT INTO treatment_seq_steps (sequence_id, step_position, step_name, milestone_status, is_lab_pending, scheduled_date,
                                       duration_minutes, appointment_id, sesion_id, created_at, updated_at, created_by)
      VALUES (v_seq, st.position, st.step_name, v_ms, (v_ms = 'waiting'), v_sched, 45,
              CASE WHEN st.position = 1 THEN a.id END,
              CASE WHEN st.position = 1 THEN a.sesion_id END,
              a.start_datetime, v_upd, a.assignee_id);
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- Grupos de servicios (filtro "grupos" del Balance mensual)
-- =============================================================================
INSERT INTO groups (name, description, is_active, external_id)
VALUES ('Ortodoncia',            'Brackets, controles y retenedores',      true, 'seed:grp:orto'),
       ('Implantes y prótesis',  'Implantes, coronas y pernos',            true, 'seed:grp:impl'),
       ('Estética facial',       'Toxina, rellenos y bioestimulación',     true, 'seed:grp:est'),
       ('Endodoncia',            'Tratamientos de conducto',               true, 'seed:grp:endo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO group_services (group_id, service_id, external_id)
SELECT g.id, s.id, 'seed:grp:' || s.code
FROM groups g
JOIN _svc s ON (g.external_id = 'seed:grp:orto' AND s.code IN ('ORTO_CONS', 'BRACKETS', 'ORTO_CTRL', 'RETENEDOR'))
            OR (g.external_id = 'seed:grp:impl' AND s.code IN ('IMPLANTE', 'CORONA_IMPL', 'CORONA', 'PERNO'))
            OR (g.external_id = 'seed:grp:est'  AND s.specialty = 'estetica')
            OR (g.external_id = 'seed:grp:endo' AND s.code IN ('ENDO_UNI', 'ENDO_MULTI', 'RETRATAM', 'PERNO'));

-- =============================================================================
-- Nómina: legajos y contratos (honorarios con % de productividad)
-- =============================================================================
CREATE TEMP TABLE _staff ON COMMIT DROP AS
SELECT d.id AS user_id, d.n, true AS is_doctor, d.name, d.sex, d.identity_document, d.specialty FROM _doc d
UNION ALL
SELECT r.id, r.n, false, r.name, r.sex, r.identity_document, NULL FROM _recep r;

INSERT INTO payroll_employees (user_id, clinic_id, cedula, nombres, apellidos, sexo, email, telefono, banco, cuenta_banco,
                               fecha_ingreso, activo, created_by)
SELECT s.user_id, c.clinic_id, s.identity_document,
       split_part(regexp_replace(s.name, '^(Dra?\.)\s*', ''), ' ', 1),
       substring(regexp_replace(s.name, '^(Dra?\.)\s*', '') FROM position(' ' IN regexp_replace(s.name, '^(Dra?\.)\s*', '')) + 1),
       CASE WHEN s.sex::text = 'female' THEN 'F' ELSE 'M' END,
       u.email, u.phone_number, pg_temp.pick(ARRAY['BROU', 'Itaú', 'Santander', 'Scotiabank']),
       lpad((100000000 + s.n * 7919 + CASE WHEN s.is_doctor THEN 0 ELSE 500000 END)::text, 10, '0'),
       c.h_from - 240 - s.n * 30, true, c.system_id
FROM _staff s JOIN users u ON u.id = s.user_id, _ctx c;

INSERT INTO payroll_employments (employee_id, clinic_id, tipo_contrato, category_id, fecha_inicio, jornada_horas_semanales,
                                 modalidad_jornada, sueldo_base, productividad_porcentaje, productividad_base, tipo_aporte_bps,
                                 is_active, created_by)
SELECT pe.id, c.clinic_id,
       CASE WHEN s.is_doctor THEN 'honorarios' ELSE 'dependencia' END::contract_type_enum,
       (SELECT id FROM payroll_categories WHERE codigo = CASE WHEN NOT s.is_doctor THEN 'G15-11'
                                                              WHEN s.specialty = 'general' THEN 'G15-01' ELSE 'G15-02' END),
       pe.fecha_ingreso,
       CASE WHEN s.is_doctor THEN 20 ELSE 44 END,
       'mensual'::modalidad_jornada_enum,
       CASE WHEN s.is_doctor THEN 0 ELSE 42000 END,
       CASE WHEN NOT s.is_doctor THEN 0 ELSE (ARRAY[40, 35, 40, 35, 45, 35])[s.n] END,
       'sobre_cobrado'::percentage_basis_enum,
       CASE WHEN s.is_doctor THEN 'civil' ELSE 'industria_comercio' END::tipo_aporte_bps_enum,
       true, c.system_id
FROM _staff s JOIN payroll_employees pe ON pe.user_id = s.user_id, _ctx c;

-- =============================================================================
-- Gastos operativos (miscellaneous_transactions + movimiento de caja, como
-- complete_miscellaneous_transaction)
-- =============================================================================
-- DEV no tiene configurada la numeración de gastos (el DEFAULT de doc_no falla y
-- la app tampoco puede registrar gastos). Se crea si falta; es configuración y
-- dev-cleanup.sql la conserva.
INSERT INTO sequences (name, document_type, pattern, reset_period, current_counter, is_active)
SELECT 'Gastos y otros ingresos', 'miscellaneous', 'MSC-{YYYY}-{MM}-{COUNTER:6}', 'never', 1, true
WHERE NOT EXISTS (SELECT 1 FROM sequences WHERE document_type = 'miscellaneous');

CREATE OR REPLACE FUNCTION pg_temp.expense(p_cat text, p_amount numeric, p_cur text, p_date date, p_method text,
                                           p_benef text, p_descr text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_day date := pg_temp.workday(p_date);
  v_cash int;
  v_cat int;
  v_pm int;
  v_mt int;
  v_status text;
  v_user uuid;
  v_ts timestamp;
BEGIN
  IF v_day > current_date THEN RETURN; END IF;
  SELECT id INTO v_cat FROM miscellaneous_categories WHERE code = p_cat AND category_type = 'expense' ORDER BY id LIMIT 1;
  IF v_cat IS NULL THEN RAISE NOTICE 'Categoría de gasto % no existe: se omite', p_cat; RETURN; END IF;
  SELECT id INTO v_pm FROM payment_methods WHERE code = p_method AND is_active ORDER BY id LIMIT 1;
  SELECT id INTO v_cash FROM _cash WHERE day = v_day;
  SELECT id INTO v_user FROM _recep ORDER BY random() LIMIT 1;
  v_ts := v_day + time '09:00' + (pg_temp.rint(0, 600) || ' minutes')::interval;
  -- lo de los últimos días a veces sigue pendiente de pago
  v_status := CASE WHEN v_cash IS NULL OR (v_day > current_date - 6 AND random() < 0.4) THEN 'pending' ELSE 'completed' END;

  INSERT INTO miscellaneous_transactions (doc_no, category_id, beneficiary, amount, currency, exchange_rate, payment_method_id,
                                          cash_session_id, transaction_date, created_at, updated_at, completed_at, description,
                                          status, created_by, tags)
  VALUES (pg_temp.docno('miscellaneous', v_ts), v_cat, p_benef, p_amount, p_cur, CASE WHEN p_cur = 'USD' THEN 40 ELSE 1 END,
          v_pm, CASE WHEN v_status = 'completed' THEN v_cash END, v_day, v_ts, v_ts,
          CASE WHEN v_status = 'completed' THEN v_ts END, p_descr, v_status, v_user, ARRAY['seed'])
  RETURNING id INTO v_mt;

  IF v_status = 'completed' THEN
    INSERT INTO cash_movements (cash_session_id, type, payment_method_id, amount, description, created_at, user_id,
                                currency, is_sales, is_trx, source_type, source_id, created_by)
    VALUES (v_cash, 'expense', v_pm, -abs(p_amount), p_descr, v_ts, v_user, p_cur, false, true, 'miscellaneous', v_mt, v_user);
  END IF;
END $$;

DO $$
DECLARE
  c record;
  m date;
  f numeric;
  mm text;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR m IN SELECT g::date FROM generate_series(c.h_from, date_trunc('month', current_date)::date, interval '1 month') g LOOP
    f := 1 + ((m - c.h_from) / 30.0) * 0.006;           -- inflación ~7 % anual
    mm := to_char(m, 'MM/YYYY');

    PERFORM pg_temp.expense('ALQ',      round(68000 * f, -2), 'UYU', m + pg_temp.rint(0, 4),  'BANK_TRANSFER', 'Inmobiliaria Pocitos', 'Alquiler del local ' || mm);
    PERFORM pg_temp.expense('SAL',      round(84000 * f, -2), 'UYU', m + pg_temp.rint(0, 4),  'BANK_TRANSFER', 'Personal administrativo', 'Sueldos recepción ' || to_char(m - 1, 'MM/YYYY'));
    PERFORM pg_temp.expense('IMP_BPS',  round(26000 * f + random()::numeric * 3000, 0), 'UYU', m + pg_temp.rint(12, 16), 'BANK_TRANSFER', 'BPS', 'Aportes BPS ' || to_char(m - 1, 'MM/YYYY'));
    PERFORM pg_temp.expense('IMP_DGI',  round(14000 + random()::numeric * 11000, 0), 'UYU', m + pg_temp.rint(17, 22), 'BANK_TRANSFER', 'DGI', 'IVA e IRAE anticipo ' || to_char(m - 1, 'MM/YYYY'));
    IF extract(month FROM m)::int % 2 = 1 THEN
      PERFORM pg_temp.expense('IMP_IMM', round(4800 * f, -1), 'UYU', m + pg_temp.rint(5, 10), 'BANK_TRANSFER', 'Intendencia de Montevideo', 'Tributos domiciliarios bimestre ' || mm);
    END IF;
    PERFORM pg_temp.expense('SER_LUZ',  round(5200 + random()::numeric * 2800, 0), 'UYU', m + pg_temp.rint(8, 14),  'BANK_TRANSFER', 'UTE', 'Energía eléctrica ' || mm);
    PERFORM pg_temp.expense('SER_AGUA', round(1500 + random()::numeric * 700, 0),  'UYU', m + pg_temp.rint(8, 14),  'BANK_TRANSFER', 'OSE', 'Agua ' || mm);
    PERFORM pg_temp.expense('SER_INT',  2490, 'UYU', m + pg_temp.rint(10, 12), 'BANK_TRANSFER', 'Antel', 'Fibra óptica ' || mm);
    PERFORM pg_temp.expense('SER_TEL',  1890, 'UYU', m + pg_temp.rint(10, 12), 'BANK_TRANSFER', 'Antel', 'Telefonía fija y celular ' || mm);
    PERFORM pg_temp.expense('SEG',      round(7800 * f, -1), 'UYU', m + pg_temp.rint(1, 6), 'BANK_TRANSFER', 'Banco de Seguros del Estado', 'Seguro de responsabilidad civil ' || mm);
    PERFORM pg_temp.expense('HON',      14500, 'UYU', m + pg_temp.rint(3, 8), 'BANK_TRANSFER', 'Estudio Contable Ferrer', 'Honorarios contables ' || mm);
    PERFORM pg_temp.expense('PUB',      round(7000 + random()::numeric * 7000, 0), 'UYU', m + pg_temp.rint(20, 27), 'CREDIT_CARD', 'Meta Platforms', 'Campaña Instagram / Facebook ' || mm);
    PERFORM pg_temp.expense('LAB_EXTERNO', round(3500 + random()::numeric * 6000, 0), 'UYU', m + pg_temp.rint(0, 27), 'BANK_TRANSFER', 'Centro de Radiología Dental', 'Tomografías y panorámicas ' || mm);
    FOR k IN 1..pg_temp.rint(3, 5) LOOP
      PERFORM pg_temp.expense('INSUMO_CLIN', round(4000 + random()::numeric * 12000, 0), 'UYU', m + pg_temp.rint(0, 27),
                              CASE WHEN random() < 0.7 THEN 'BANK_TRANSFER' ELSE 'CASH' END,
                              pg_temp.pick(ARRAY['Casa Dental Uruguay', 'Dental Uruguay SRL', 'Odontomarket']),
                              pg_temp.pick(ARRAY['Resinas y adhesivos', 'Anestesia y descartables', 'Guantes, barbijos y baberos',
                                                 'Limas y conos de gutapercha', 'Material de impresión', 'Esterilización']));
    END LOOP;
    IF extract(month FROM m)::int % 3 = 0 THEN
      PERFORM pg_temp.expense('INSUMO_CLIN', round(450 + random()::numeric * 450, 0), 'USD', m + pg_temp.rint(0, 27), 'BANK_TRANSFER',
                              'Neodent Uruguay', 'Implantes y aditamentos protésicos');
    END IF;
    IF random() < 0.35 THEN
      PERFORM pg_temp.expense('MAN', round(6000 + random()::numeric * 12000, 0), 'UYU', m + pg_temp.rint(0, 27), 'BANK_TRANSFER',
                              'Servicio Técnico Dental', pg_temp.pick(ARRAY['Service de sillón', 'Mantenimiento de compresor', 'Reparación de autoclave']));
    END IF;
    PERFORM pg_temp.expense('OFI',  round(1200 + random()::numeric * 2300, 0), 'UYU', m + pg_temp.rint(0, 27), 'CASH', 'Papelería El Clip', 'Artículos de oficina');
    PERFORM pg_temp.expense('CAFE', round(800 + random()::numeric * 800, 0),   'UYU', m + pg_temp.rint(0, 13),  'CASH', 'Supermercado', 'Café y cocina');
    PERFORM pg_temp.expense('CAFE', round(800 + random()::numeric * 800, 0),   'UYU', m + pg_temp.rint(14, 27), 'CASH', 'Supermercado', 'Café y cocina');
  END LOOP;
END $$;

-- =============================================================================
-- Proveedores (laboratorios) y facturas de compra
-- =============================================================================
CREATE TEMP TABLE _sup (n int, id uuid DEFAULT gen_random_uuid(), name text, email text, kind text) ON COMMIT DROP;
INSERT INTO _sup (n, name, email, kind) VALUES
  (1, 'Laboratorio Dental Cerro', 'facturacion@labcerro.example.com',  'protesis'),
  (2, 'Cerámica Dental Prado',    'admin@ceramicaprado.example.com',   'protesis'),
  (3, 'Ortolab Uruguay',          'ventas@ortolab.example.com',        'orto'),
  (4, 'Dental Uruguay SRL',       'cobranzas@dentaluy.example.com',    'insumos');

INSERT INTO users (id, name, email, phone_number, internal_id, is_active, is_sales, rut, created_at, created_by, active_sede_id)
SELECT s.id, s.name, s.email, '+5982' || (4000000 + s.n * 3137)::text, 'seed:sup:' || s.n, true, false,
       '21' || lpad((4512300 + s.n * 77731)::text, 8, '0') || '0' || s.n, c.h_from - 300, c.system_id, c.sede_id
FROM _sup s, _ctx c;

DO $$
DECLARE
  c record;
  m date;
  sup record;
  v_inv int;
  v_ts timestamp;
  v_total numeric;
  v_n int := 0;
  v_pay_day date;
  r numeric;
BEGIN
  SELECT * INTO c FROM _ctx;
  FOR m IN SELECT g::date FROM generate_series(c.h_from, date_trunc('month', current_date)::date, interval '1 month') g LOOP
    FOR k IN 1..pg_temp.rint(3, 6) LOOP
      v_ts := pg_temp.workday(m + pg_temp.rint(0, 27)) + time '11:00' + (pg_temp.rint(0, 300) || ' minutes')::interval;
      CONTINUE WHEN v_ts > c.now_local;
      SELECT * INTO sup FROM _sup ORDER BY CASE kind WHEN 'protesis' THEN random() * 0.6 ELSE random() END LIMIT 1;
      v_n := v_n + 1;

      INSERT INTO invoices (order_id, total, status, created_at, paid_amount, currency, is_sales, user_id, type, payment_state,
                            due_date, doc_no, notes, external_id, gross_total, discount_amount, sede_id, created_by)
      VALUES (NULL, 0, 'booked', v_ts, 0, 'UYU', false, sup.id, 'invoice', 'unpaid',
              (v_ts + interval '30 days')::date, pg_temp.docno('invoice', v_ts),
              CASE sup.kind WHEN 'insumos' THEN 'Compra de insumos ' ELSE 'Trabajos de laboratorio ' END || to_char(m, 'MM/YYYY'),
              'seed:hist:pinv:' || v_n, 0, 0, c.sede_id, (SELECT id FROM _recep ORDER BY random() LIMIT 1))
      RETURNING id INTO v_inv;

      INSERT INTO invoice_items (invoice_id, quantity, unit_price, total, service_id, gross_total, discount_amount)
      SELECT v_inv, s.qty, round(s.price * 0.35, -1), s.qty * round(s.price * 0.35, -1), s.id, s.qty * round(s.price * 0.35, -1), 0
      FROM (SELECT s2.id, s2.price, pg_temp.rint(1, 3) AS qty FROM _svc s2
            WHERE (sup.kind = 'protesis' AND s2.code IN ('CORONA', 'CORONA_IMPL', 'PERNO'))
               OR (sup.kind = 'orto'     AND s2.code IN ('BRACKETS', 'RETENEDOR'))
               OR (sup.kind = 'insumos'  AND s2.code IN ('RESINA', 'SELLANTE', 'ENDO_UNI'))
            ORDER BY random() LIMIT pg_temp.rint(1, 2)) s;

      SELECT sum(total) INTO v_total FROM invoice_items WHERE invoice_id = v_inv;
      UPDATE invoices SET total = v_total, gross_total = v_total WHERE id = v_inv;

      -- Pago al proveedor: lo viejo se pagó (a veces en dos partes), lo reciente queda pendiente
      r := random();
      IF v_ts < c.now_local - interval '45 days' OR r < 0.3 THEN
        v_pay_day := least(pg_temp.workday((v_ts + interval '30 days')::date - pg_temp.rint(0, 12)), current_date - 1);
        IF v_ts < c.now_local - interval '45 days' AND r < 0.12 THEN
          v_total := round(v_total * 0.5, 0);   -- pago parcial
        END IF;
        IF v_pay_day > v_ts::date THEN
          INSERT INTO payments (invoice_id, amount, method, created_at, payment_method_id, currency, is_sales, invoice_currency,
                                exchange_rate, converted_amount, user_id, doc_no, external_id, created_by)
          SELECT v_inv, v_total, pm.name, v_pay_day + time '15:00', pm.id, 'UYU', false, 'UYU', 1, v_total, sup.id,
                 pg_temp.docno('payment', v_pay_day + time '15:00'), 'seed:hist:ppay:' || v_n, c.system_id
          FROM _pm pm WHERE pm.code = 'BANK_TRANSFER';
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- Cierre de TODAS las cajas del seed: totales por moneda desde los movimientos
-- (cobros + gastos), así el cierre de caja cuadra con lo cargado arriba
-- =============================================================================
INSERT INTO cash_session_currencies (cash_session_id, currency, opening_amount, date_rate)
SELECT DISTINCT cm.cash_session_id, cm.currency, 0, 40
FROM cash_movements cm JOIN _cash c ON c.id = cm.cash_session_id
WHERE cm.currency <> 'UYU'
  AND NOT EXISTS (SELECT 1 FROM cash_session_currencies x WHERE x.cash_session_id = cm.cash_session_id AND x.currency = cm.currency);

UPDATE cash_session_currencies csc SET
  calculated_cash     = t.cash,
  calculated_card     = t.card,
  calculated_transfer = t.transfer,
  calculated_other    = t.other,
  declared_cash       = CASE WHEN cs.status = 'CLOSE' THEN csc.opening_amount + t.cash ELSE 0 END,
  cash_variance       = 0
FROM cash_sessions cs,
     (
       SELECT x.cash_session_id, x.currency,
              coalesce(sum(cm.amount) FILTER (WHERE pm.is_cash_equivalent), 0)                          AS cash,
              coalesce(sum(cm.amount) FILTER (WHERE pm.code IN ('DEBIT_CARD', 'CREDIT_CARD')), 0)       AS card,
              coalesce(sum(cm.amount) FILTER (WHERE pm.code = 'BANK_TRANSFER'), 0)                      AS transfer,
              coalesce(sum(cm.amount) FILTER (WHERE NOT pm.is_cash_equivalent
                                                AND pm.code NOT IN ('DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER')), 0) AS other
       FROM cash_session_currencies x
       LEFT JOIN cash_movements cm ON cm.cash_session_id = x.cash_session_id AND cm.currency = x.currency
       LEFT JOIN payment_methods pm ON pm.id = cm.payment_method_id
       WHERE x.cash_session_id IN (SELECT id FROM _cash)
       GROUP BY x.cash_session_id, x.currency
     ) t
WHERE cs.id = csc.cash_session_id AND t.cash_session_id = csc.cash_session_id AND t.currency = csc.currency;

UPDATE cash_sessions cs SET closing_details = json_build_object(
         'uyu', json_build_object('total', coalesce((SELECT x.opening_amount + x.calculated_cash FROM cash_session_currencies x
                                                     WHERE x.cash_session_id = cs.id AND x.currency = 'UYU'), 0)),
         'usd', CASE WHEN EXISTS (SELECT 1 FROM cash_session_currencies x WHERE x.cash_session_id = cs.id AND x.currency = 'USD')
                     THEN json_build_object('total', (SELECT x.opening_amount + x.calculated_cash FROM cash_session_currencies x
                                                      WHERE x.cash_session_id = cs.id AND x.currency = 'USD'))
                     ELSE json_build_object() END),
       bank_deposit_details = json_build_object('uyu', json_build_object(), 'usd', json_build_object())
WHERE cs.status = 'CLOSE' AND cs.id IN (SELECT id FROM _cash);

ALTER TABLE appointments ENABLE TRIGGER trigger_appointment_change;

COMMIT;   -- cambiar por ROLLBACK para probar sin aplicar

-- =============================================================================
-- Resumen (pgAdmin muestra el resultado de esta última consulta)
-- =============================================================================
SELECT 'citas (historia)' AS que, count(*) AS n, min(start_datetime)::date::text AS desde, max(start_datetime)::date::text AS hasta
FROM appointments WHERE external_id LIKE 'seed:hist:%'
UNION ALL SELECT 'citas (total)', count(*), min(start_datetime)::date::text, max(start_datetime)::date::text FROM appointments WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'sesiones clínicas (total)', count(*), min(fecha_sesion)::date::text, max(fecha_sesion)::date::text FROM sesiones_clinicas WHERE external_id LIKE 'seed:%'
UNION ALL SELECT 'facturas de venta · ' || currency || ' · ' || payment_state, count(*), min(created_at)::date::text, max(created_at)::date::text
FROM invoices WHERE is_sales AND external_id LIKE 'seed:%' GROUP BY currency, payment_state
UNION ALL SELECT 'cobros', count(*), min(created_at)::date::text, max(created_at)::date::text FROM payments WHERE is_sales AND external_id LIKE 'seed:%'
UNION ALL SELECT 'presupuestos · ' || status, count(*), min(created_at)::date::text, max(created_at)::date::text FROM quotes WHERE external_id LIKE 'seed:%' AND billing_status = 'not_invoiced' GROUP BY status
UNION ALL SELECT 'planes de tratamiento · ' || status, count(*), min(started_at)::text, max(started_at)::text FROM treatment_sequences GROUP BY status
UNION ALL SELECT 'gastos · ' || status, count(*), min(transaction_date)::text, max(transaction_date)::text FROM miscellaneous_transactions WHERE 'seed' = ANY(tags) GROUP BY status
UNION ALL SELECT 'facturas de compra · ' || payment_state, count(*), min(created_at)::date::text, max(created_at)::date::text FROM invoices WHERE NOT is_sales AND external_id LIKE 'seed:%' GROUP BY payment_state
UNION ALL SELECT 'pacientes inactivos (> 6 meses)', count(*), NULL, NULL FROM users u WHERE u.internal_id LIKE 'seed:pat:%'
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = u.id AND a.status <> 'cancelled' AND a.start_datetime > current_date - 180)
UNION ALL SELECT 'cajas', count(*), min(opened_at)::date::text, max(opened_at)::date::text FROM cash_sessions cs JOIN users u ON u.id = cs.user_id WHERE u.internal_id LIKE 'seed:recep:%'
UNION ALL SELECT 'contratos de nómina', count(*), NULL, NULL FROM payroll_employments
UNION ALL SELECT 'grupos de servicios', count(*), NULL, NULL FROM groups WHERE external_id LIKE 'seed:%';
